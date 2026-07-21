-- ============================================================
-- VTMS — ALL LIVE DATABASE UPDATES (single idempotent script)
-- ============================================================
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor → Run.
--
-- Safe to re-run: skips objects that already exist and refreshes
-- policies/constraints to the latest version.
--
-- Prerequisites: base VTMS schema already applied (profiles, batches,
-- trainees, etc.). If this is a brand-new project, run schema.sql first.
--
-- Note: enum values must be committed before use. If the first run
-- fails on project_coordinator / logistics_officer, click Run again.
-- ============================================================

-- ── 0. Extensions & helpers ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION current_role_is(roles user_role[])
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND active AND role = ANY(roles)
  );
$$;

-- ── 1. Roles enum (new SCM roles) ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'admin', 'director', 'project_coordinator', 'trainer',
      'case_worker', 'finance_officer', 'logistics_officer'
    );
  END IF;
END $$;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project_coordinator' AFTER 'director';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'logistics_officer' AFTER 'finance_officer';

-- ── 2. Multi-trade batches ───────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_trades (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trade TEXT NOT NULL CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity')),
  PRIMARY KEY (profile_id, trade)
);

CREATE TABLE IF NOT EXISTS batch_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  trade TEXT NOT NULL CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity')),
  trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (batch_id, trade)
);

GRANT ALL ON TABLE profile_trades TO anon, authenticated, service_role;
GRANT ALL ON TABLE batch_trades TO anon, authenticated, service_role;

ALTER TABLE profile_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_trades ENABLE ROW LEVEL SECURITY;

-- Backfill legacy single-trade columns, then drop them
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'batches' AND column_name = 'trade'
  ) THEN
    INSERT INTO batch_trades (batch_id, trade, trainer_id)
    SELECT b.id, b.trade, NULL
    FROM batches b
    WHERE b.trade IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM batch_trades bt WHERE bt.batch_id = b.id AND bt.trade = b.trade
      );

    ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_trade_check;
    ALTER TABLE batches DROP COLUMN IF EXISTS trade;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'batches' AND column_name = 'trainer_name'
  ) THEN
    ALTER TABLE batches DROP COLUMN IF EXISTS trainer_name;
  END IF;
END $$;

ALTER TABLE trainees ADD COLUMN IF NOT EXISTS trade TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trainees'::regclass
      AND conname = 'trainees_trade_check'
  ) THEN
    ALTER TABLE public.trainees
      ADD CONSTRAINT trainees_trade_check
      CHECK (trade IS NULL OR trade IN ('Carpentry','Tailoring','Masonry','Electricity'));
  END IF;
END $$;

UPDATE trainees t
SET trade = bt.trade
FROM batch_trades bt
WHERE t.batch_id = bt.batch_id
  AND t.trade IS NULL
  AND (SELECT COUNT(*) FROM batch_trades x WHERE x.batch_id = t.batch_id) = 1;

-- ── 3. Entity lifecycle (paused status + delete policies) ────
DO $$
DECLARE
  cname text;
BEGIN
  IF to_regclass('public.batches') IS NOT NULL THEN
    FOR cname IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.conrelid = 'public.batches'::regclass
        AND con.contype = 'c'
        AND att.attname = 'status'
    LOOP
      EXECUTE format('ALTER TABLE public.batches DROP CONSTRAINT %I', cname);
    END LOOP;

    ALTER TABLE public.batches
      ADD CONSTRAINT batches_status_check
      CHECK (status IN ('planned', 'active', 'paused', 'completed', 'archived'));
  END IF;
END $$;

DO $$
DECLARE
  cname text;
BEGIN
  IF to_regclass('public.trainees') IS NOT NULL THEN
    FOR cname IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.conrelid = 'public.trainees'::regclass
        AND con.contype = 'c'
        AND att.attname = 'status'
    LOOP
      EXECUTE format('ALTER TABLE public.trainees DROP CONSTRAINT %I', cname);
    END LOOP;

    ALTER TABLE public.trainees
      ADD CONSTRAINT trainees_status_check
      CHECK (status IN ('prospect', 'enrolled', 'paused', 'graduated', 'dropped', 'alumni'));
  END IF;
END $$;

-- ── 4. Inventory & procurement columns ───────────────────────
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS trade_relevance text[] DEFAULT '{}';

ALTER TABLE procurement_requests
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF to_regclass('public.procurement_requests') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'procurement_requests_requested_by_fkey'
    ) THEN
      ALTER TABLE procurement_requests
        ADD CONSTRAINT procurement_requests_requested_by_fkey
        FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'procurement_requests_approved_by_fkey'
    ) THEN
      ALTER TABLE procurement_requests
        ADD CONSTRAINT procurement_requests_approved_by_fkey
        FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ── 5. Financial tables & org settings ───────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'org',
  currency_code TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO app_settings (id, currency_code)
VALUES ('org', 'USD')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_currency_code_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_currency_code_check
  CHECK (currency_code IN ('USD', 'SSP'));

CREATE TABLE IF NOT EXISTS financial_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL
    CHECK (action IN ('transaction_update', 'transaction_delete', 'currency_change')),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('financial_transaction', 'app_settings')),
  entity_id TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financial_change_log_changed_at_idx
  ON financial_change_log (changed_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'financial_change',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  entity_type TEXT,
  entity_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON notifications (user_id, created_at DESC);

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

GRANT ALL ON TABLE app_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE financial_change_log TO anon, authenticated, service_role;
GRANT ALL ON TABLE notifications TO anon, authenticated, service_role;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ── 6. Trainee interviews ────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainee_interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  interview_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responses JSONB NOT NULL DEFAULT '{}',
  scores JSONB NOT NULL DEFAULT '{}',
  total_score INTEGER NOT NULL DEFAULT 0,
  panel_notes TEXT DEFAULT '',
  panelist_names TEXT DEFAULT '',
  decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'selected', 'waitlist', 'rejected')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trainee_interviews_trainee_id_idx ON trainee_interviews(trainee_id);
CREATE INDEX IF NOT EXISTS trainee_interviews_batch_id_idx ON trainee_interviews(batch_id);

GRANT ALL ON TABLE trainee_interviews TO anon, authenticated, service_role;
ALTER TABLE trainee_interviews ENABLE ROW LEVEL SECURITY;

-- ── 7. Trainee documents ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainee_id UUID NOT NULL REFERENCES trainees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('national_id', 'recommendation_letter', 'birth_certificate', 'signed_rules', 'photo')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trainee_id, document_type)
);

CREATE INDEX IF NOT EXISTS trainee_documents_trainee_id_idx ON trainee_documents(trainee_id);

GRANT ALL ON TABLE trainee_documents TO anon, authenticated, service_role;
ALTER TABLE trainee_documents ENABLE ROW LEVEL SECURITY;

-- ── 8. Storage bucket for trainee documents ──────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('trainee-documents', 'trainee-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- ── 9. RLS policies (drop + recreate = safe to re-run) ───────

-- profiles
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR current_role_is(ARRAY['director','admin','finance_officer']::user_role[])
    OR (
      role = 'trainer'
      AND active
      AND current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[])
    )
  );
DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (current_role_is(ARRAY['admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
DROP POLICY IF EXISTS profiles_delete ON profiles;
CREATE POLICY profiles_delete ON profiles FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- profile_trades
DROP POLICY IF EXISTS profile_trades_select ON profile_trades;
CREATE POLICY profile_trades_select ON profile_trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS profile_trades_insert ON profile_trades;
CREATE POLICY profile_trades_insert ON profile_trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['director','admin']::user_role[]));
DROP POLICY IF EXISTS profile_trades_update ON profile_trades;
CREATE POLICY profile_trades_update ON profile_trades FOR UPDATE
  USING (current_role_is(ARRAY['director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['director','admin']::user_role[]));
DROP POLICY IF EXISTS profile_trades_delete ON profile_trades;
CREATE POLICY profile_trades_delete ON profile_trades FOR DELETE
  USING (current_role_is(ARRAY['director','admin']::user_role[]));

-- batches
DROP POLICY IF EXISTS batches_select ON batches;
CREATE POLICY batches_select ON batches FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS batches_insert ON batches;
CREATE POLICY batches_insert ON batches FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS batches_update ON batches;
CREATE POLICY batches_update ON batches FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS batches_delete ON batches;
CREATE POLICY batches_delete ON batches FOR DELETE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

-- batch_trades
DROP POLICY IF EXISTS batch_trades_select ON batch_trades;
CREATE POLICY batch_trades_select ON batch_trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS batch_trades_insert ON batch_trades;
CREATE POLICY batch_trades_insert ON batch_trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS batch_trades_update ON batch_trades;
CREATE POLICY batch_trades_update ON batch_trades FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS batch_trades_delete ON batch_trades;
CREATE POLICY batch_trades_delete ON batch_trades FOR DELETE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

-- trades
DROP POLICY IF EXISTS trades_select ON trades;
CREATE POLICY trades_select ON trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trades_insert ON trades;
CREATE POLICY trades_insert ON trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS trades_update ON trades;
CREATE POLICY trades_update ON trades FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS trades_delete ON trades;
CREATE POLICY trades_delete ON trades FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- trainees
DROP POLICY IF EXISTS trainees_select ON trainees;
CREATE POLICY trainees_select ON trainees FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainees_insert ON trainees;
CREATE POLICY trainees_insert ON trainees FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainees_update ON trainees;
CREATE POLICY trainees_update ON trainees FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainees_delete ON trainees;
CREATE POLICY trainees_delete ON trainees FOR DELETE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

-- attendance
DROP POLICY IF EXISTS attendance_select ON attendance;
CREATE POLICY attendance_select ON attendance FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS attendance_insert ON attendance;
CREATE POLICY attendance_insert ON attendance FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
DROP POLICY IF EXISTS attendance_update ON attendance;
CREATE POLICY attendance_update ON attendance FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
DROP POLICY IF EXISTS attendance_delete ON attendance;
CREATE POLICY attendance_delete ON attendance FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- competency_assessments
DROP POLICY IF EXISTS competency_assessments_select ON competency_assessments;
CREATE POLICY competency_assessments_select ON competency_assessments FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS competency_assessments_insert ON competency_assessments;
CREATE POLICY competency_assessments_insert ON competency_assessments FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
DROP POLICY IF EXISTS competency_assessments_update ON competency_assessments;
CREATE POLICY competency_assessments_update ON competency_assessments FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
DROP POLICY IF EXISTS competency_assessments_delete ON competency_assessments;
CREATE POLICY competency_assessments_delete ON competency_assessments FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- modules
DROP POLICY IF EXISTS modules_select ON modules;
CREATE POLICY modules_select ON modules FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS modules_insert ON modules;
CREATE POLICY modules_insert ON modules FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
DROP POLICY IF EXISTS modules_update ON modules;
CREATE POLICY modules_update ON modules FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
DROP POLICY IF EXISTS modules_delete ON modules;
CREATE POLICY modules_delete ON modules FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- case_notes
DROP POLICY IF EXISTS case_notes_select ON case_notes;
CREATE POLICY case_notes_select ON case_notes FOR SELECT
  USING (current_role_is(ARRAY['case_worker','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS case_notes_insert ON case_notes;
CREATE POLICY case_notes_insert ON case_notes FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
DROP POLICY IF EXISTS case_notes_update ON case_notes;
CREATE POLICY case_notes_update ON case_notes FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
DROP POLICY IF EXISTS case_notes_delete ON case_notes;
CREATE POLICY case_notes_delete ON case_notes FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- vulnerability_assessments
DROP POLICY IF EXISTS vulnerability_assessments_select ON vulnerability_assessments;
CREATE POLICY vulnerability_assessments_select ON vulnerability_assessments FOR SELECT
  USING (current_role_is(ARRAY['case_worker','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS vulnerability_assessments_insert ON vulnerability_assessments;
CREATE POLICY vulnerability_assessments_insert ON vulnerability_assessments FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
DROP POLICY IF EXISTS vulnerability_assessments_update ON vulnerability_assessments;
CREATE POLICY vulnerability_assessments_update ON vulnerability_assessments FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
DROP POLICY IF EXISTS vulnerability_assessments_delete ON vulnerability_assessments;
CREATE POLICY vulnerability_assessments_delete ON vulnerability_assessments FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- inventory_items
DROP POLICY IF EXISTS inventory_items_select ON inventory_items;
CREATE POLICY inventory_items_select ON inventory_items FOR SELECT
  USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS inventory_items_insert ON inventory_items;
CREATE POLICY inventory_items_insert ON inventory_items FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
DROP POLICY IF EXISTS inventory_items_update ON inventory_items;
CREATE POLICY inventory_items_update ON inventory_items FOR UPDATE
  USING (current_role_is(ARRAY['trainer','logistics_officer','finance_officer','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS inventory_items_delete ON inventory_items;
CREATE POLICY inventory_items_delete ON inventory_items FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- inventory_usage
DROP POLICY IF EXISTS inventory_usage_select ON inventory_usage;
CREATE POLICY inventory_usage_select ON inventory_usage FOR SELECT
  USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS inventory_usage_insert ON inventory_usage;
CREATE POLICY inventory_usage_insert ON inventory_usage FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
DROP POLICY IF EXISTS inventory_usage_update ON inventory_usage;
CREATE POLICY inventory_usage_update ON inventory_usage FOR UPDATE
  USING (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
DROP POLICY IF EXISTS inventory_usage_delete ON inventory_usage;
CREATE POLICY inventory_usage_delete ON inventory_usage FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- procurement_requests
DROP POLICY IF EXISTS procurement_requests_select ON procurement_requests;
CREATE POLICY procurement_requests_select ON procurement_requests FOR SELECT
  USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS procurement_requests_insert ON procurement_requests;
CREATE POLICY procurement_requests_insert ON procurement_requests FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
DROP POLICY IF EXISTS procurement_requests_update ON procurement_requests;
CREATE POLICY procurement_requests_update ON procurement_requests FOR UPDATE
  USING (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
DROP POLICY IF EXISTS procurement_requests_delete ON procurement_requests;
CREATE POLICY procurement_requests_delete ON procurement_requests FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- production_logs
DROP POLICY IF EXISTS production_logs_select ON production_logs;
CREATE POLICY production_logs_select ON production_logs FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS production_logs_insert ON production_logs;
CREATE POLICY production_logs_insert ON production_logs FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
DROP POLICY IF EXISTS production_logs_update ON production_logs;
CREATE POLICY production_logs_update ON production_logs FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
DROP POLICY IF EXISTS production_logs_delete ON production_logs;
CREATE POLICY production_logs_delete ON production_logs FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- sales
DROP POLICY IF EXISTS sales_select ON sales;
CREATE POLICY sales_select ON sales FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS sales_insert ON sales;
CREATE POLICY sales_insert ON sales FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
DROP POLICY IF EXISTS sales_update ON sales;
CREATE POLICY sales_update ON sales FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
DROP POLICY IF EXISTS sales_delete ON sales;
CREATE POLICY sales_delete ON sales FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- financial_transactions
DROP POLICY IF EXISTS financial_transactions_select ON financial_transactions;
CREATE POLICY financial_transactions_select ON financial_transactions FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS financial_transactions_insert ON financial_transactions;
CREATE POLICY financial_transactions_insert ON financial_transactions FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
DROP POLICY IF EXISTS financial_transactions_update ON financial_transactions;
CREATE POLICY financial_transactions_update ON financial_transactions FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
DROP POLICY IF EXISTS financial_transactions_delete ON financial_transactions;
CREATE POLICY financial_transactions_delete ON financial_transactions FOR DELETE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]));

-- app_settings
DROP POLICY IF EXISTS app_settings_select ON app_settings;
CREATE POLICY app_settings_select ON app_settings FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS app_settings_update ON app_settings;
CREATE POLICY app_settings_update ON app_settings FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS app_settings_insert ON app_settings;
CREATE POLICY app_settings_insert ON app_settings FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

-- financial_change_log
DROP POLICY IF EXISTS financial_change_log_select ON financial_change_log;
CREATE POLICY financial_change_log_select ON financial_change_log FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS financial_change_log_insert ON financial_change_log;
CREATE POLICY financial_change_log_insert ON financial_change_log FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

-- notifications
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT
  WITH CHECK (
    current_role_is(ARRAY['finance_officer','director','admin']::user_role[])
    OR user_id = auth.uid()
  );

-- starter_kits
DROP POLICY IF EXISTS starter_kits_select ON starter_kits;
CREATE POLICY starter_kits_select ON starter_kits FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS starter_kits_insert ON starter_kits;
CREATE POLICY starter_kits_insert ON starter_kits FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
DROP POLICY IF EXISTS starter_kits_update ON starter_kits;
CREATE POLICY starter_kits_update ON starter_kits FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
DROP POLICY IF EXISTS starter_kits_delete ON starter_kits;
CREATE POLICY starter_kits_delete ON starter_kits FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- alumni_follow_ups
DROP POLICY IF EXISTS alumni_follow_ups_select ON alumni_follow_ups;
CREATE POLICY alumni_follow_ups_select ON alumni_follow_ups FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS alumni_follow_ups_insert ON alumni_follow_ups;
CREATE POLICY alumni_follow_ups_insert ON alumni_follow_ups FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
DROP POLICY IF EXISTS alumni_follow_ups_update ON alumni_follow_ups;
CREATE POLICY alumni_follow_ups_update ON alumni_follow_ups FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
DROP POLICY IF EXISTS alumni_follow_ups_delete ON alumni_follow_ups;
CREATE POLICY alumni_follow_ups_delete ON alumni_follow_ups FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- job_placements
DROP POLICY IF EXISTS job_placements_select ON job_placements;
CREATE POLICY job_placements_select ON job_placements FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS job_placements_insert ON job_placements;
CREATE POLICY job_placements_insert ON job_placements FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
DROP POLICY IF EXISTS job_placements_update ON job_placements;
CREATE POLICY job_placements_update ON job_placements FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
DROP POLICY IF EXISTS job_placements_delete ON job_placements;
CREATE POLICY job_placements_delete ON job_placements FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- trainee_interviews
DROP POLICY IF EXISTS trainee_interviews_select ON trainee_interviews;
CREATE POLICY trainee_interviews_select ON trainee_interviews FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_interviews_insert ON trainee_interviews;
CREATE POLICY trainee_interviews_insert ON trainee_interviews FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_interviews_update ON trainee_interviews;
CREATE POLICY trainee_interviews_update ON trainee_interviews FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_interviews_delete ON trainee_interviews;
CREATE POLICY trainee_interviews_delete ON trainee_interviews FOR DELETE
  USING (current_role_is(ARRAY['project_coordinator','finance_officer','director','admin']::user_role[]));

-- trainee_documents
DROP POLICY IF EXISTS trainee_documents_select ON trainee_documents;
CREATE POLICY trainee_documents_select ON trainee_documents FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_documents_insert ON trainee_documents;
CREATE POLICY trainee_documents_insert ON trainee_documents FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_documents_update ON trainee_documents;
CREATE POLICY trainee_documents_update ON trainee_documents FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_documents_delete ON trainee_documents;
CREATE POLICY trainee_documents_delete ON trainee_documents FOR DELETE
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

-- storage.objects (trainee document uploads)
DROP POLICY IF EXISTS trainee_docs_storage_select ON storage.objects;
CREATE POLICY trainee_docs_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'trainee-documents' AND current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS trainee_docs_storage_insert ON storage.objects;
CREATE POLICY trainee_docs_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trainee-documents' AND current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS trainee_docs_storage_delete ON storage.objects;
CREATE POLICY trainee_docs_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'trainee-documents' AND current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

-- ── 10. Sanity checks (informational; errors here are non-fatal) ──
SELECT 'batches.status' AS check_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.batches'::regclass
  AND conname = 'batches_status_check'
UNION ALL
SELECT 'trainees.status',
       pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.trainees'::regclass
  AND conname = 'trainees_status_check'
UNION ALL
SELECT 'app_settings.currency',
       pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.app_settings'::regclass
  AND conname = 'app_settings_currency_code_check';

-- ── 11. Custom auth (passwords on profiles, no Supabase Auth) ──
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_token_idx
  ON public.profiles(invite_token) WHERE invite_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_password_reset_token_idx
  ON public.profiles(password_reset_token) WHERE password_reset_token IS NOT NULL;

SELECT 'VTMS migration complete' AS status, NOW() AS completed_at;

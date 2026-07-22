-- ============================================================
-- VTMS — APPLY ALL PENDING DB CHANGES (single file)
-- ============================================================
-- Paste this ENTIRE file into Supabase → SQL Editor → Run.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS.
--
-- Covers:
--   1. Custom auth (password_hash, invite/reset tokens)
--   2. Login lockout + password-reset cooldown columns
--   3. Admin-only receipts table + RLS
--   4. Trainee documents (photos + ID docs) table, bucket, RLS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Custom auth on profiles ───────────────────────────────
-- Detach from auth.users so staff IDs can be app-generated UUIDs.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_invite_token_idx
  ON public.profiles (invite_token)
  WHERE invite_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_password_reset_token_idx
  ON public.profiles (password_reset_token)
  WHERE password_reset_token IS NOT NULL;

-- ── 2. Login lockout & forgot-password cooldown ──────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_reset_last_sent_at TIMESTAMPTZ;

-- ── 3. Admin-only receipts ───────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq;

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number TEXT UNIQUE NOT NULL
    DEFAULT (
      'RCT-' || to_char(NOW(), 'YYYY') || '-' ||
      lpad(nextval('public.receipt_number_seq')::text, 6, '0')
    ),
  financial_transaction_id UUID
    REFERENCES public.financial_transactions (id) ON DELETE SET NULL,
  batch_id UUID
    REFERENCES public.batches (id) ON DELETE SET NULL,
  payer_name TEXT NOT NULL,
  payer_email TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  category TEXT,
  description TEXT,
  notes TEXT,
  issued_by UUID
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  emailed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS receipts_batch_id_idx
  ON public.receipts (batch_id);
CREATE INDEX IF NOT EXISTS receipts_issued_at_idx
  ON public.receipts (issued_at DESC);
CREATE INDEX IF NOT EXISTS receipts_financial_transaction_id_idx
  ON public.receipts (financial_transaction_id);

GRANT ALL ON TABLE public.receipts TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.receipt_number_seq TO anon, authenticated, service_role;

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipts_select ON public.receipts;
CREATE POLICY receipts_select ON public.receipts FOR SELECT
  USING (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS receipts_insert ON public.receipts;
CREATE POLICY receipts_insert ON public.receipts FOR INSERT
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS receipts_update ON public.receipts;
CREATE POLICY receipts_update ON public.receipts FOR UPDATE
  USING (current_role_is(ARRAY['admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));

DROP POLICY IF EXISTS receipts_delete ON public.receipts;
CREATE POLICY receipts_delete ON public.receipts FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- ── 4. Trainee documents (photos + related files) ────────────
CREATE TABLE IF NOT EXISTS public.trainee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainee_id UUID NOT NULL REFERENCES public.trainees (id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN (
      'national_id',
      'recommendation_letter',
      'birth_certificate',
      'signed_rules',
      'photo'
    )),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trainee_id, document_type)
);

CREATE INDEX IF NOT EXISTS trainee_documents_trainee_id_idx
  ON public.trainee_documents (trainee_id);

GRANT ALL ON TABLE public.trainee_documents TO anon, authenticated, service_role;
ALTER TABLE public.trainee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trainee_documents_select ON public.trainee_documents;
CREATE POLICY trainee_documents_select ON public.trainee_documents FOR SELECT
  USING (current_role_is(ARRAY[
    'trainer','case_worker','project_coordinator','finance_officer',
    'logistics_officer','director','admin'
  ]::user_role[]));

DROP POLICY IF EXISTS trainee_documents_insert ON public.trainee_documents;
CREATE POLICY trainee_documents_insert ON public.trainee_documents FOR INSERT
  WITH CHECK (current_role_is(ARRAY[
    'trainer','case_worker','project_coordinator','finance_officer','director','admin'
  ]::user_role[]));

DROP POLICY IF EXISTS trainee_documents_update ON public.trainee_documents;
CREATE POLICY trainee_documents_update ON public.trainee_documents FOR UPDATE
  USING (current_role_is(ARRAY[
    'trainer','case_worker','project_coordinator','finance_officer','director','admin'
  ]::user_role[]))
  WITH CHECK (current_role_is(ARRAY[
    'trainer','case_worker','project_coordinator','finance_officer','director','admin'
  ]::user_role[]));

DROP POLICY IF EXISTS trainee_documents_delete ON public.trainee_documents;
CREATE POLICY trainee_documents_delete ON public.trainee_documents FOR DELETE
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

-- Private Storage bucket (max 10 MB per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('trainee-documents', 'trainee-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS trainee_docs_storage_select ON storage.objects;
CREATE POLICY trainee_docs_storage_select ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trainee-documents'
    AND current_role_is(ARRAY[
      'trainer','case_worker','project_coordinator','finance_officer','director','admin'
    ]::user_role[])
  );

DROP POLICY IF EXISTS trainee_docs_storage_insert ON storage.objects;
CREATE POLICY trainee_docs_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trainee-documents'
    AND current_role_is(ARRAY[
      'trainer','case_worker','project_coordinator','finance_officer','director','admin'
    ]::user_role[])
  );

DROP POLICY IF EXISTS trainee_docs_storage_update ON storage.objects;
CREATE POLICY trainee_docs_storage_update ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'trainee-documents'
    AND current_role_is(ARRAY[
      'trainer','case_worker','project_coordinator','finance_officer','director','admin'
    ]::user_role[])
  )
  WITH CHECK (
    bucket_id = 'trainee-documents'
    AND current_role_is(ARRAY[
      'trainer','case_worker','project_coordinator','finance_officer','director','admin'
    ]::user_role[])
  );

DROP POLICY IF EXISTS trainee_docs_storage_delete ON storage.objects;
CREATE POLICY trainee_docs_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trainee-documents'
    AND current_role_is(ARRAY['finance_officer','director','admin']::user_role[])
  );

-- ── 5. Login OTP, hidden owner staff, activity log ───────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hidden_from_staff BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_otp_hash TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_otp_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx
  ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_actor_id_idx
  ON public.activity_log (actor_id);

GRANT ALL ON TABLE public.activity_log TO anon, authenticated, service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_select ON public.activity_log;
CREATE POLICY activity_log_select ON public.activity_log FOR SELECT
  USING (current_role_is(ARRAY['admin', 'director']::user_role[]));

DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
CREATE POLICY activity_log_insert ON public.activity_log FOR INSERT
  WITH CHECK (current_role_is(ARRAY[
    'admin','director','project_coordinator','trainer',
    'case_worker','finance_officer','logistics_officer'
  ]::user_role[]));

-- ── 6. Sanity checks ─────────────────────────────────────────
SELECT 'profiles.password_hash' AS check_name,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password_hash'
       ) THEN 'ok' ELSE 'MISSING' END AS status
UNION ALL
SELECT 'profiles.failed_login_attempts',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'failed_login_attempts'
       ) THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'profiles.hidden_from_staff',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hidden_from_staff'
       ) THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'profiles.login_otp_hash',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'login_otp_hash'
       ) THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'table receipts',
       CASE WHEN to_regclass('public.receipts') IS NOT NULL THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'table trainee_documents',
       CASE WHEN to_regclass('public.trainee_documents') IS NOT NULL THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'bucket trainee-documents',
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'trainee-documents')
         THEN 'ok' ELSE 'MISSING' END
UNION ALL
SELECT 'table activity_log',
       CASE WHEN to_regclass('public.activity_log') IS NOT NULL THEN 'ok' ELSE 'MISSING' END;

SELECT 'VTMS APPLY_NOW complete' AS status, NOW() AS completed_at;

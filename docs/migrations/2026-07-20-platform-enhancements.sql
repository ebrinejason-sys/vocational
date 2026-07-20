-- Platform enhancements: missing tables, currency fix, trainee documents, procurement assignment.
-- Run once in Supabase SQL Editor.

-- ── 1. Ensure financial / settings tables exist (fixes 404 on currency save) ──
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY DEFAULT 'org',
    currency_code TEXT NOT NULL DEFAULT 'USD'
      CHECK (currency_code IN ('USD', 'SSP')),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO app_settings (id, currency_code) VALUES ('org', 'USD')
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

-- ── 2. Trainee documents ──
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

-- ── 3. Procurement: assign requests to responsible staff ──
ALTER TABLE procurement_requests
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 4. RLS for new / updated tables ──
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
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

ALTER TABLE financial_change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_change_log_select ON financial_change_log;
CREATE POLICY financial_change_log_select ON financial_change_log FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS financial_change_log_insert ON financial_change_log;
CREATE POLICY financial_change_log_insert ON financial_change_log FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
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

ALTER TABLE trainee_interviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trainee_interviews_select ON trainee_interviews;
CREATE POLICY trainee_interviews_select ON trainee_interviews FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_interviews_insert ON trainee_interviews;
CREATE POLICY trainee_interviews_insert ON trainee_interviews FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_interviews_update ON trainee_interviews;
CREATE POLICY trainee_interviews_update ON trainee_interviews FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));
DROP POLICY IF EXISTS trainee_interviews_delete ON trainee_interviews;
CREATE POLICY trainee_interviews_delete ON trainee_interviews FOR DELETE
  USING (current_role_is(ARRAY['project_coordinator','finance_officer','director','admin']::user_role[]));

ALTER TABLE trainee_documents ENABLE ROW LEVEL SECURITY;
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

-- Privileged roles: director + finance can edit inventory stock
DROP POLICY IF EXISTS inventory_items_update ON inventory_items;
CREATE POLICY inventory_items_update ON inventory_items FOR UPDATE
  USING (current_role_is(ARRAY['trainer','logistics_officer','finance_officer','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','finance_officer','director','admin']::user_role[]));

-- Storage bucket for trainee documents (create in dashboard if this fails)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('trainee-documents', 'trainee-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS trainee_docs_storage_select ON storage.objects;
CREATE POLICY trainee_docs_storage_select ON storage.objects FOR SELECT
  USING (bucket_id = 'trainee-documents' AND current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS trainee_docs_storage_insert ON storage.objects;
CREATE POLICY trainee_docs_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trainee-documents' AND current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS trainee_docs_storage_delete ON storage.objects;
CREATE POLICY trainee_docs_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'trainee-documents' AND current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

-- ============================================================
-- Org currency, financial change audit, in-app notifications
-- Run once in Supabase SQL Editor.
-- ============================================================

-- Org settings (single row)
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'org',
  currency_code TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency_code IN ('USD', 'UGX', 'SSP', 'EUR', 'KES')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO app_settings (id, currency_code)
VALUES ('org', 'USD')
ON CONFLICT (id) DO NOTHING;

GRANT ALL ON TABLE app_settings TO anon, authenticated, service_role;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_select ON app_settings;
CREATE POLICY app_settings_select ON app_settings FOR SELECT
  USING (current_role_is(ARRAY[
    'trainer','case_worker','project_coordinator','finance_officer',
    'logistics_officer','director','admin'
  ]::user_role[]));

DROP POLICY IF EXISTS app_settings_update ON app_settings;
CREATE POLICY app_settings_update ON app_settings FOR UPDATE
  USING (current_role_is(ARRAY['director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['director','admin']::user_role[]));

-- Append-only financial change log
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

GRANT ALL ON TABLE financial_change_log TO anon, authenticated, service_role;

ALTER TABLE financial_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_change_log_select ON financial_change_log;
CREATE POLICY financial_change_log_select ON financial_change_log FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS financial_change_log_insert ON financial_change_log;
CREATE POLICY financial_change_log_insert ON financial_change_log FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

-- In-app notifications
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

GRANT ALL ON TABLE notifications TO anon, authenticated, service_role;

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

-- Allow finance_officer to delete transactions (with reason enforced in app)
DROP POLICY IF EXISTS financial_transactions_delete ON financial_transactions;
CREATE POLICY financial_transactions_delete ON financial_transactions FOR DELETE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]));

-- Optional metadata on financial_transactions
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

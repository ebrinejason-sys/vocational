-- Restrict org currency to USD or SSP (South Sudan operations).
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_currency_code_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_currency_code_check
  CHECK (currency_code IN ('USD', 'SSP'));
-- Run once in Supabase SQL Editor.

-- Profiles: finance can list staff (trainers, etc.)
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

-- Attendance / competency / modules — finance read
DROP POLICY IF EXISTS attendance_select ON attendance;
CREATE POLICY attendance_select ON attendance FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS competency_assessments_select ON competency_assessments;
CREATE POLICY competency_assessments_select ON competency_assessments FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS modules_select ON modules;
CREATE POLICY modules_select ON modules FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

-- Case notes / vulnerability — finance read (operational reporting)
DROP POLICY IF EXISTS case_notes_select ON case_notes;
CREATE POLICY case_notes_select ON case_notes FOR SELECT
  USING (current_role_is(ARRAY['case_worker','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS vulnerability_assessments_select ON vulnerability_assessments;
CREATE POLICY vulnerability_assessments_select ON vulnerability_assessments FOR SELECT
  USING (current_role_is(ARRAY['case_worker','finance_officer','director','admin']::user_role[]));

-- Graduation / alumni — finance read
DROP POLICY IF EXISTS starter_kits_select ON starter_kits;
CREATE POLICY starter_kits_select ON starter_kits FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS alumni_follow_ups_select ON alumni_follow_ups;
CREATE POLICY alumni_follow_ups_select ON alumni_follow_ups FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS job_placements_select ON job_placements;
CREATE POLICY job_placements_select ON job_placements FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS trainee_interviews_select ON trainee_interviews;
CREATE POLICY trainee_interviews_select ON trainee_interviews FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','director','admin']::user_role[]));

-- Financials bucket — remove project_coordinator from financial data
DROP POLICY IF EXISTS production_logs_select ON production_logs;
CREATE POLICY production_logs_select ON production_logs FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS sales_select ON sales;
CREATE POLICY sales_select ON sales FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

DROP POLICY IF EXISTS financial_transactions_select ON financial_transactions;
CREATE POLICY financial_transactions_select ON financial_transactions FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));

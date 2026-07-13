-- ============================================================
-- Migration: new SCM roles + fictional demo-data purge
-- Run in the Supabase SQL Editor in TWO separate executions:
-- Postgres requires new enum values to be committed before any
-- statement can reference them, so Step 1 and Step 2 cannot run
-- in the same transaction.
-- ============================================================

-- ─────────────── STEP 1: run this block first, alone ───────────────

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project_coordinator' AFTER 'director';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'logistics_officer' AFTER 'finance_officer';

-- ─────────────── STEP 2: run everything below as a second execution ───────────────

-- 2a. Purge the fictional Ugandan demo data (trainees first: they
-- reference batches; their own children cascade automatically).
DELETE FROM trainees;
DELETE FROM batches;

-- 2b. Tighten the trade list to the four SCM actually runs.
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_trade_check;
ALTER TABLE batches ADD CONSTRAINT batches_trade_check
  CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity'));

-- 2c. Grant the new roles their RLS access (mirrors schema.sql / permissions.ts).

-- Batches, trades, trainees — PC edits; logistics views
ALTER POLICY batches_select ON batches USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
ALTER POLICY batches_insert ON batches WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
ALTER POLICY batches_update ON batches USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

ALTER POLICY trades_select ON trades USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
ALTER POLICY trades_insert ON trades WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
ALTER POLICY trades_update ON trades USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

ALTER POLICY trainees_select ON trainees USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
ALTER POLICY trainees_insert ON trainees WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
ALTER POLICY trainees_update ON trainees USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

-- Attendance / competency / modules — PC gains view
ALTER POLICY attendance_select ON attendance USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
ALTER POLICY competency_assessments_select ON competency_assessments USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
ALTER POLICY modules_select ON modules USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

-- Inventory / procurement — logistics edits; PC views
ALTER POLICY inventory_items_select ON inventory_items USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
ALTER POLICY inventory_items_insert ON inventory_items WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
ALTER POLICY inventory_items_update ON inventory_items USING (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));

ALTER POLICY inventory_usage_select ON inventory_usage USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
ALTER POLICY inventory_usage_insert ON inventory_usage WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
ALTER POLICY inventory_usage_update ON inventory_usage USING (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));

ALTER POLICY procurement_requests_select ON procurement_requests USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
ALTER POLICY procurement_requests_insert ON procurement_requests WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
ALTER POLICY procurement_requests_update ON procurement_requests USING (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));

-- Production / sales / financials — PC gains view
ALTER POLICY production_logs_select ON production_logs USING (current_role_is(ARRAY['project_coordinator','finance_officer','director','admin']::user_role[]));
ALTER POLICY sales_select ON sales USING (current_role_is(ARRAY['project_coordinator','finance_officer','director','admin']::user_role[]));
ALTER POLICY financial_transactions_select ON financial_transactions USING (current_role_is(ARRAY['project_coordinator','finance_officer','director','admin']::user_role[]));

-- Graduation / alumni — PC edits; logistics views starter kits
ALTER POLICY starter_kits_select ON starter_kits USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','logistics_officer','director','admin']::user_role[]));
ALTER POLICY starter_kits_insert ON starter_kits WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
ALTER POLICY starter_kits_update ON starter_kits USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));

ALTER POLICY alumni_follow_ups_select ON alumni_follow_ups USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
ALTER POLICY alumni_follow_ups_insert ON alumni_follow_ups WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
ALTER POLICY alumni_follow_ups_update ON alumni_follow_ups USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));

ALTER POLICY job_placements_select ON job_placements USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
ALTER POLICY job_placements_insert ON job_placements WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
ALTER POLICY job_placements_update ON job_placements USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[])) WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));

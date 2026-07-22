-- ============================================================
-- Clean-slate operational wipe (keeps staff / curriculum / settings)
-- Safe to re-run. Does NOT delete profiles, profile_trades, trades,
-- modules, or app_settings.
-- ============================================================

BEGIN;

DELETE FROM inventory_usage;
DELETE FROM procurement_requests;
DELETE FROM attendance;
DELETE FROM competency_assessments;
DELETE FROM case_notes;
DELETE FROM vulnerability_assessments;
DELETE FROM trainee_interviews;
DELETE FROM trainee_documents;
DELETE FROM alumni_follow_ups;
DELETE FROM job_placements;
DELETE FROM starter_kits;
DELETE FROM production_logs;
DELETE FROM sales;
DELETE FROM receipts;
DELETE FROM financial_transactions;
DELETE FROM financial_change_log;
DELETE FROM notifications;
DELETE FROM activity_log;

DELETE FROM inventory_items;

DELETE FROM trainees;
DELETE FROM batch_trades;
DELETE FROM batches;

COMMIT;

SELECT 'inventory_items' AS tbl, COUNT(*)::int AS n FROM inventory_items
UNION ALL SELECT 'financial_transactions', COUNT(*)::int FROM financial_transactions
UNION ALL SELECT 'trainees', COUNT(*)::int FROM trainees
UNION ALL SELECT 'batches', COUNT(*)::int FROM batches
UNION ALL SELECT 'profiles', COUNT(*)::int FROM profiles;

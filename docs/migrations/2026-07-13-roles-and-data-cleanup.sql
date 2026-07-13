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

-- ─────────────── STEP 2: separate file (do NOT paste below with Step 1) ───────────────
-- After Step 1 succeeds, run the standalone file instead:
--   docs/migrations/2026-07-13-roles-step2-data-and-rls.sql
-- (data purge + trade CHECK + RLS policy updates for the new roles)
# VTMS Phase 1: Auth + RBAC + Real Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real Supabase Auth + Postgres-RLS-enforced RBAC (5 roles) into VTMS, and convert Batches + Trainees from local seed data to real Supabase-backed CRUD, per `docs/superpowers/specs/2026-07-12-auth-rbac-foundation-design.md`.

**Architecture:** A `profiles` table (linked 1:1 to `auth.users`) carries each staff member's role. Every Postgres table gets RLS policies keyed off a `current_role_is()` helper, so authorization is enforced by the database, not just the UI. The React app gains an `AuthProvider` (session + profile), route guards (`RequireAuth`/`RequireRole`), a login page, and an admin-only staff/invite page backed by a Vercel serverless function (the only place the Supabase service-role key is used). Zustand's store keeps its current shape for 12 of 14 data domains; only `batches` and `trainees` become async and Supabase-backed.

**Tech Stack:** React 19 + Vite + TypeScript, React Router v7, Zustand 5, `@supabase/supabase-js` 2.105 (already a dependency), Vitest + Testing Library (already configured), Vercel serverless functions (`@vercel/node`, to be added), Postgres RLS on Supabase.

## Global Constraints

- Role set: `admin`, `director`, `trainer`, `case_worker`, `finance_officer` (per approved spec §3–4).
- No public signup route anywhere in the app — admin-invite only.
- RLS must be enabled and policy-covered on every table in `schema.sql`, even tables the frontend doesn't query yet this phase, per spec §4.
- Only `batches` and `trainees` get real Supabase reads/writes this phase; all other 12 domains keep today's local Zustand/seed behavior unchanged.
- The Supabase **service role key** must never appear in any `VITE_`-prefixed env var or any file shipped to the browser — server-side (Vercel function) use only.
- `vtms-frontend/.env.local` and a new root-level `.env.local` hold real credentials and are already git-ignored — never remove those ignore rules, never commit a `.env*` file other than `.env.example`.
- Applying `schema.sql` to the live Supabase project is a **manual step**: paste into Supabase Dashboard → SQL Editor → Run. No task in this plan can execute DDL directly (no DB connection string was provided).

### Batch / Trainee ID Map (used by Task 2's seed SQL and Task 3's seed.ts edit — must match exactly)

| Old seed id | UUID |
|---|---|
| b1 | `10000000-0000-4000-8000-000000000001` |
| b2 | `10000000-0000-4000-8000-000000000002` |
| b3 | `10000000-0000-4000-8000-000000000003` |
| b4 | `10000000-0000-4000-8000-000000000004` |
| b5 | `10000000-0000-4000-8000-000000000005` |
| t01..t20 | `20000000-0000-4000-8000-0000000000` + zero-padded 2-digit index (t01 → `...0001`, t20 → `...0020`) |

---

### Task 1: Enable the test runner

**Files:**
- Modify: `vtms-frontend/package.json`

**Interfaces:**
- Produces: `npm test` (run once) and `npm run test:watch` scripts, usable by every later task's test steps.

- [ ] **Step 1: Add test scripts**

In `vtms-frontend/package.json`, inside `"scripts"`, add two entries (keep existing ones):

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Verify the existing test suite runs**

Run: `cd vtms-frontend && npm test`
Expected: PASS — the existing `CompetencyAssessment.test.tsx` suite runs and passes (2 tests).

- [ ] **Step 3: Commit**

```bash
git add vtms-frontend/package.json
git commit -m "test: add npm test script for vitest"
```

---

### Task 2: Database schema — profiles, RBAC, RLS, seed data

**Files:**
- Modify: `schema.sql` (full rewrite of the AUTH & ROLES section, the `batches`/`trainees` table definitions, plus a new RLS + seed section appended at the end)

**Interfaces:**
- Produces: `profiles` table (`id`, `full_name`, `email`, `role user_role`, `active`), `user_role` enum, `current_role_is(user_role[])` SQL function, RLS policies on every table, 5 seeded batches + 20 seeded trainees using the UUIDs in the Global Constraints table above.
- Consumes: nothing (this is the schema every other task builds on).

This task's SQL cannot be executed by an agent directly — no DB connection string is available (per Global Constraints). The step ends with instructions for the human operator to run it.

- [ ] **Step 1: Replace the AUTH & ROLES section**

In `schema.sql`, replace:

```sql
-- 1. AUTH & ROLES
-- Roles: admin, manager, trainer, case_worker, finance_officer
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL
);

INSERT INTO roles (name) VALUES ('admin'), ('manager'), ('trainer'), ('case_worker'), ('finance_officer');
```

with:

```sql
-- 1. AUTH & ROLES
CREATE TYPE user_role AS ENUM ('admin', 'director', 'trainer', 'case_worker', 'finance_officer');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECURITY DEFINER so RLS policies can check the caller's role without
-- recursively hitting the RLS policy on profiles itself.
CREATE OR REPLACE FUNCTION current_role_is(roles user_role[])
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND active AND role = ANY(roles)
  );
$$;
```

- [ ] **Step 2: Replace the `batches` table definition**

Replace:

```sql
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- e.g., "Batch 5 - 2024"
    trade_id UUID REFERENCES trades(id),
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'planned', -- planned, active, completed, archived
    budget_allocated DECIMAL(12,2) DEFAULT 0,
    target_enrollment INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

with:

```sql
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- e.g., "Batch 5 - 2024"
    trade TEXT NOT NULL CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity','Entrepreneurship')),
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','archived')),
    budget_allocated DECIMAL(12,2) DEFAULT 0,
    target_enrollment INTEGER,
    trainer_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

(`trade` becomes a direct text column instead of a `trades` FK, and `trainer_name`/`description` are added — the original schema was missing both columns despite the frontend's `Batch` type requiring them. The `trades` table itself is left in place, unused for now.)

- [ ] **Step 3: Add `vulnerability_assessment` to `trainees` and constrain enums**

Replace the `trainees` table definition with:

```sql
CREATE TABLE trainees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male','female')),
    phone_number TEXT,
    national_id TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    -- Selection & Vulnerability
    mobilization_source TEXT,
    vulnerability_score INTEGER,
    vulnerability_assessment JSONB,
    vulnerability_notes TEXT,
    status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect','enrolled','graduated','dropped','alumni')),
    graduation_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 4: Append RLS policies for every table**

Add this whole block at the end of `schema.sql` (after the `batch_performance_summary` view):

```sql
-- ============================================================
-- 12. ROW LEVEL SECURITY
-- Permission matrix per docs/superpowers/specs/2026-07-12-auth-rbac-foundation-design.md §4
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid() OR current_role_is(ARRAY['director','admin']::user_role[]));
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (current_role_is(ARRAY['admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
CREATE POLICY profiles_delete ON profiles FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket A: batches, trades — view: all 5 roles, edit: trainer/case_worker/director/admin
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY batches_select ON batches FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','finance_officer','director','admin']::user_role[]));
CREATE POLICY batches_insert ON batches FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY batches_update ON batches FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY batches_delete ON batches FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY trades_select ON trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','finance_officer','director','admin']::user_role[]));
CREATE POLICY trades_insert ON trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
CREATE POLICY trades_update ON trades FOR UPDATE
  USING (current_role_is(ARRAY['admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
CREATE POLICY trades_delete ON trades FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket B: trainees — same shape as batches
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;
CREATE POLICY trainees_select ON trainees FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','finance_officer','director','admin']::user_role[]));
CREATE POLICY trainees_insert ON trainees FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY trainees_update ON trainees FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY trainees_delete ON trainees FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket C: attendance, competency_assessments, modules — view: trainer/case_worker/director/admin, edit: trainer/admin
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_select ON attendance FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY attendance_insert ON attendance FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY attendance_update ON attendance FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY attendance_delete ON attendance FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY competency_assessments_select ON competency_assessments FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY competency_assessments_insert ON competency_assessments FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY competency_assessments_update ON competency_assessments FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY competency_assessments_delete ON competency_assessments FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY modules_select ON modules FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY modules_insert ON modules FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY modules_update ON modules FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY modules_delete ON modules FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket D: case_notes, vulnerability_assessments — view: case_worker/director/admin, edit: case_worker/admin
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_notes_select ON case_notes FOR SELECT
  USING (current_role_is(ARRAY['case_worker','director','admin']::user_role[]));
CREATE POLICY case_notes_insert ON case_notes FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY case_notes_update ON case_notes FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY case_notes_delete ON case_notes FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE vulnerability_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY vulnerability_assessments_select ON vulnerability_assessments FOR SELECT
  USING (current_role_is(ARRAY['case_worker','director','admin']::user_role[]));
CREATE POLICY vulnerability_assessments_insert ON vulnerability_assessments FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY vulnerability_assessments_update ON vulnerability_assessments FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY vulnerability_assessments_delete ON vulnerability_assessments FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket E: inventory_items, inventory_usage, procurement_requests — view: trainer/finance_officer/director/admin, edit: trainer/admin
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_select ON inventory_items FOR SELECT
  USING (current_role_is(ARRAY['trainer','finance_officer','director','admin']::user_role[]));
CREATE POLICY inventory_items_insert ON inventory_items FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY inventory_items_update ON inventory_items FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY inventory_items_delete ON inventory_items FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE inventory_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_usage_select ON inventory_usage FOR SELECT
  USING (current_role_is(ARRAY['trainer','finance_officer','director','admin']::user_role[]));
CREATE POLICY inventory_usage_insert ON inventory_usage FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY inventory_usage_update ON inventory_usage FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY inventory_usage_delete ON inventory_usage FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY procurement_requests_select ON procurement_requests FOR SELECT
  USING (current_role_is(ARRAY['trainer','finance_officer','director','admin']::user_role[]));
CREATE POLICY procurement_requests_insert ON procurement_requests FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY procurement_requests_update ON procurement_requests FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY procurement_requests_delete ON procurement_requests FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket F: production_logs, sales, financial_transactions — view: finance_officer/director/admin, edit: finance_officer/admin
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_logs_select ON production_logs FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
CREATE POLICY production_logs_insert ON production_logs FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY production_logs_update ON production_logs FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY production_logs_delete ON production_logs FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_select ON sales FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
CREATE POLICY sales_insert ON sales FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY sales_update ON sales FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY sales_delete ON sales FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_transactions_select ON financial_transactions FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
CREATE POLICY financial_transactions_insert ON financial_transactions FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY financial_transactions_update ON financial_transactions FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY financial_transactions_delete ON financial_transactions FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket G: starter_kits, alumni_follow_ups, job_placements — view: trainer/case_worker/director/admin, edit: case_worker/admin
ALTER TABLE starter_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY starter_kits_select ON starter_kits FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY starter_kits_insert ON starter_kits FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY starter_kits_update ON starter_kits FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY starter_kits_delete ON starter_kits FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE alumni_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY alumni_follow_ups_select ON alumni_follow_ups FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_insert ON alumni_follow_ups FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_update ON alumni_follow_ups FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_delete ON alumni_follow_ups FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE job_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_placements_select ON job_placements FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY job_placements_insert ON job_placements FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY job_placements_update ON job_placements FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY job_placements_delete ON job_placements FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- ============================================================
-- 13. SEED DATA — Batches + Trainees
-- Fixed UUIDs so locally-seeded demo data for the other 10 modules
-- (attendance, competency, case notes, etc. — still local-only this
-- phase) keeps referencing the same trainee/batch ids. See
-- docs/superpowers/plans/2026-07-12-auth-rbac-foundation.md Global
-- Constraints for the full id map.
-- ============================================================

INSERT INTO batches (id, name, trade, start_date, end_date, status, budget_allocated, target_enrollment, trainer_name, description) VALUES
('10000000-0000-4000-8000-000000000001', 'Batch 1 — Carpentry 2021', 'Carpentry', '2021-02-01', '2021-07-30', 'completed', 4200000, 15, 'Mr. Byamugisha Ronald', 'Foundation batch focused on furniture making and wood joinery.'),
('10000000-0000-4000-8000-000000000002', 'Batch 2 — Tailoring 2022', 'Tailoring', '2022-01-10', '2022-06-30', 'completed', 3800000, 12, 'Ms. Kyomuhangi Grace', 'Tailoring and garment construction for vulnerable young women.'),
('10000000-0000-4000-8000-000000000003', 'Batch 3 — Masonry 2023', 'Masonry', '2023-01-16', '2023-07-14', 'completed', 5100000, 16, 'Mr. Tumusiime Patrick', 'Bricklaying, plastering, and construction for street-connected youth.'),
('10000000-0000-4000-8000-000000000004', 'Batch 4 — Electricity 2024', 'Electricity', '2024-02-05', '2024-07-26', 'completed', 4800000, 14, 'Mr. Ruhweza Denis', 'Domestic and commercial wiring with safety and entrepreneurship integration.'),
('10000000-0000-4000-8000-000000000005', 'Batch 5 — Carpentry 2025', 'Carpentry', '2025-02-03', NULL, 'active', 5500000, 15, 'Mr. Byamugisha Ronald', 'Advanced carpentry: furniture, cabinetry, and production unit operations.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trainees (id, batch_id, first_name, last_name, date_of_birth, gender, phone_number, address, emergency_contact_name, emergency_contact_phone, mobilization_source, vulnerability_score, vulnerability_assessment, status, graduation_date) VALUES
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Mugisha', 'Samuel', '1999-04-12', 'male', '+256 701 234 567', 'Bwindi Cell, Ishaka', 'Mugisha Rose', '+256 772 111 222', 'Church Outreach', 88, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2021-07-30'),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Atuhaire', 'Prossy', '2000-08-22', 'female', '+256 702 345 678', 'Kagongo, Bushenyi', 'Atuhaire James', '+256 772 222 333', 'Community Leader', 76, '{"housingStatus":"shelter","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2021-07-30'),
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Banturaki', 'John', '1998-11-05', 'male', '+256 703 456 789', 'Kashenyi, Bushenyi', 'Banturaki Mary', '+256 772 333 444', 'Probation Office', 92, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"none","familyStatus":"street_connected","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2021-07-30'),
('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Natukunda', 'Allen', '2001-03-17', 'female', '+256 704 567 890', 'Biharwe, Mbarara', 'Natukunda Peter', '+256 772 444 555', 'Church Outreach', 84, '{"housingStatus":"rented","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2022-06-30'),
('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Ampaire', 'Beatrice', '2000-06-09', 'female', '+256 705 678 901', 'Ntare, Mbarara', 'Ampaire Fred', '+256 772 555 666', 'Social Worker', 79, '{"housingStatus":"shelter","foodSecurity":"adequate","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2022-06-30'),
('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'Kabagambe', 'Ruth', '2002-01-28', 'female', '+256 706 789 012', 'Ruharo, Mbarara', 'Kabagambe Thomas', '+256 772 666 777', 'Church Outreach', 72, '{"housingStatus":"rented","foodSecurity":"inadequate","previousEducation":"secondary","familyStatus":"both_parents","hasDisability":true,"disabilityDetails":"Partial hearing impairment"}'::jsonb, 'dropped', NULL),
('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'Tumusiime', 'Richard', '1999-09-14', 'male', '+256 707 890 123', 'Ishaka Town', 'Tumusiime Grace', '+256 772 777 888', 'Community Leader', 81, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"street_connected","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2023-07-14'),
('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000003', 'Rwabuhanga', 'Moses', '2001-05-30', 'male', '+256 708 901 234', 'Kyabugimbi, Bushenyi', 'Rwabuhanga Janet', '+256 772 888 999', 'Probation Office', 94, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"none","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2023-07-14'),
('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000003', 'Atwine', 'Caroline', '2002-12-03', 'female', '+256 709 012 345', 'Rubirizi Town', 'Atwine Paul', '+256 772 999 000', 'Church Outreach', 68, '{"housingStatus":"rented","foodSecurity":"adequate","previousEducation":"secondary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2023-07-14'),
('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000004', 'Kamanzi', 'Felix', '2000-07-19', 'male', '+256 710 123 456', 'Bushenyi Town', 'Kamanzi Sarah', '+256 773 111 222', 'Church Outreach', 87, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2024-07-26'),
('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000004', 'Tukamushaba', 'Sharon', '2001-10-08', 'female', '+256 711 234 567', 'Nyakabirizi, Bushenyi', 'Tukamushaba David', '+256 773 222 333', 'Social Worker', 75, '{"housingStatus":"shelter","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2024-07-26'),
('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000004', 'Bigiriwe', 'Nathan', '1999-02-25', 'male', '+256 712 345 678', 'Ishaka Town', 'Bigiriwe Agnes', '+256 773 333 444', 'Probation Office', 91, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"street_connected","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2024-07-26'),
('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000005', 'Nkurunziza', 'Emmanuel', '2003-06-11', 'male', '+256 713 456 789', 'Bwindi Cell, Ishaka', 'Nkurunziza Rose', '+256 773 444 555', 'Church Outreach', 90, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000005', 'Turyasingura', 'Diana', '2004-03-22', 'female', '+256 714 567 890', 'Kagongo, Bushenyi', 'Turyasingura John', '+256 773 555 666', 'Community Leader', 83, '{"housingStatus":"shelter","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000005', 'Mutabazi', 'Brian', '2002-09-07', 'male', '+256 715 678 901', 'Kashenyi, Bushenyi', 'Mutabazi Grace', '+256 773 666 777', 'Probation Office', 95, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"none","familyStatus":"street_connected","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000005', 'Kyomuhangi', 'Lydia', '2003-12-15', 'female', '+256 716 789 012', 'Biharwe, Mbarara', 'Kyomuhangi Frank', '+256 773 777 888', 'Church Outreach', 77, '{"housingStatus":"rented","foodSecurity":"inadequate","previousEducation":"secondary","familyStatus":"both_parents","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000005', 'Byaruhanga', 'Ivan', '2001-04-18', 'male', '+256 717 890 123', 'Ruharo, Mbarara', 'Byaruhanga Mary', '+256 773 888 999', 'Social Worker', 86, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000005', 'Tumuhairwe', 'Sandra', '2004-07-29', 'female', '+256 718 901 234', 'Ishaka Town', 'Tumuhairwe Peter', '+256 773 999 000', 'Church Outreach', 71, '{"housingStatus":"rented","foodSecurity":"adequate","previousEducation":"secondary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000005', 'Nshemereirwe', 'Patrick', '2002-11-02', 'male', '+256 719 012 345', 'Kyabugimbi, Bushenyi', 'Nshemereirwe Agnes', '+256 774 111 222', 'Community Leader', 89, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"street_connected","hasDisability":true,"disabilityDetails":"Mild speech difficulty"}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000005', 'Nyamuhanga', 'Irene', '2003-02-14', 'female', '+256 720 123 456', 'Rubirizi Town', 'Nyamuhanga Robert', '+256 774 222 333', 'Church Outreach', 74, '{"housingStatus":"shelter","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 5: Self-check the SQL file**

Run: `cd "c:\Users\ebrin\VOCATIONAL\vocational" && node -e "const s = require('fs').readFileSync('schema.sql','utf8'); const dollarQuotes = (s.match(/\$\$/g)||[]).length; console.log('dollar-quote count:', dollarQuotes, dollarQuotes % 2 === 0 ? '(balanced)' : '(UNBALANCED)'); console.log('CREATE POLICY count:', (s.match(/CREATE POLICY/g)||[]).length);"`
Expected: `dollar-quote count: 2 (balanced)` (the one `current_role_is` function body) and `CREATE POLICY count: 72` — 18 tables get exactly 4 policies each (select/insert/update/delete): `profiles`, `batches`, `trades`, `trainees`, `attendance`, `competency_assessments`, `modules`, `case_notes`, `vulnerability_assessments`, `inventory_items`, `inventory_usage`, `procurement_requests`, `production_logs`, `sales`, `financial_transactions`, `starter_kits`, `alumni_follow_ups`, `job_placements` (18 × 4 = 72). If the printed count differs, find the missing/extra table's policy block in Step 4 before proceeding.

- [ ] **Step 6: Hand off for manual execution**

Tell the user: "`schema.sql` is ready. Please paste its full contents into your Supabase project's Dashboard → SQL Editor → New query, and click Run. Paste back any error output." Wait for confirmation of success (or an error to fix) before proceeding to Task 14's bootstrap step — Tasks 3–13 can proceed in parallel since they don't require the live schema to exist yet (only Task 14's manual verification does).

- [ ] **Step 7: Commit**

```bash
git add schema.sql
git commit -m "feat: add profiles table, RBAC roles, and RLS policies to schema"
```

---

### Task 3: Migrate local seed data to UUIDs

**Files:**
- Modify: `vtms-frontend/src/store/seed.ts`

**Interfaces:**
- Consumes: the ID map from Global Constraints (must match Task 2's seed SQL exactly).
- Produces: `seed.ts` no longer exports `SEED_BATCHES` or `SEED_TRAINEES`; all other exports (`SEED_MODULES`, `SEED_COMPETENCY_ASSESSMENTS`, `SEED_ATTENDANCE`, `SEED_CASE_NOTES`, `SEED_INVENTORY_USAGE`, `SEED_STARTER_KITS`, `SEED_ALUMNI_FOLLOWUPS`, `SEED_JOB_PLACEMENTS`, `SEED_PRODUCTION_LOGS`, `SEED_SALES`, `SEED_FINANCIALS`) reference the new UUIDs instead of `b1`..`b5`/`t01`..`t20`.

- [ ] **Step 1: Remove `SEED_BATCHES` and `SEED_TRAINEES`**

Delete lines 8–42 of `vtms-frontend/src/store/seed.ts` (the `export const SEED_BATCHES` and `export const SEED_TRAINEES` blocks) and remove `Batch` and `Trainee` from the `import type { ... } from '../types'` line at the top.

- [ ] **Step 2: Replace every `batchId`/`traineeId`/`itemId`-adjacent `'bN'`/`'tNN'` reference with its UUID**

Throughout the rest of the file, replace every occurrence of the old ids with the mapped UUIDs from the Global Constraints table:
- `'b1'` → `'10000000-0000-4000-8000-000000000001'`, `'b2'` → `...002`, `'b3'` → `...003`, `'b4'` → `...004`, `'b5'` → `...005`
- `'t01'` → `'20000000-0000-4000-8000-000000000001'`, `'t02'` → `...0002`, … `'t20'` → `...0020`
- The `SEED_ATTENDANCE` array is built from `['t13','t14','t15','t16','t17','t18','t19','t20']` — replace that array literal with `['20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000020']`.

Every other reference (`SEED_COMPETENCY_ASSESSMENTS`, `SEED_CASE_NOTES`, `SEED_INVENTORY_USAGE`'s `batchId: 'b5'`, `SEED_PRODUCTION_LOGS`, `SEED_SALES`, `SEED_FINANCIALS`, `SEED_STARTER_KITS`, `SEED_ALUMNI_FOLLOWUPS`, `SEED_JOB_PLACEMENTS`) gets the same substitution.

- [ ] **Step 3: Verify no old-format ids remain**

Run: `cd vtms-frontend && node -e "const s = require('fs').readFileSync('src/store/seed.ts','utf8'); const m = s.match(/'(b[1-5]|t[0-2][0-9])'/g); console.log(m ? 'STILL PRESENT: ' + m.join(', ') : 'clean');"`
Expected: `clean`

- [ ] **Step 4: Verify the project still typechecks**

Run: `cd vtms-frontend && npx tsc -b --noEmit`
Expected: PASS (no errors) — this will fail if `Batch`/`Trainee` type imports were left dangling or a seed array still references a removed constant; fix any reported error before continuing. (Note: `store/index.ts` still imports `SEED_BATCHES`/`SEED_TRAINEES` at this point — Task 10 removes that. It's fine for this task's typecheck to still show that specific error; only fix errors inside `seed.ts` itself here.)

- [ ] **Step 5: Commit**

```bash
git add vtms-frontend/src/store/seed.ts
git commit -m "refactor: migrate local seed data to UUIDs matching the Supabase schema"
```

---

### Task 4: Supabase client

**Files:**
- Create: `vtms-frontend/src/lib/supabase.ts`
- Create: `vtms-frontend/src/vite-env.d.ts`

**Interfaces:**
- Produces: `export const supabase: SupabaseClient` — imported by every subsequent frontend task.

- [ ] **Step 1: Add env var typing**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Create the Supabase client**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 3: Verify the app still builds**

Run: `cd vtms-frontend && npx tsc -b --noEmit 2>&1 | grep -v "seed.ts\|store/index.ts" || true`
Expected: no output (ignoring the already-known `store/index.ts` error from Task 3, which Task 10 fixes).

- [ ] **Step 4: Commit**

```bash
git add vtms-frontend/src/lib/supabase.ts vtms-frontend/src/vite-env.d.ts
git commit -m "feat: add Supabase client"
```

---

### Task 5: Permission matrix module

**Files:**
- Create: `vtms-frontend/src/lib/permissions.ts`
- Test: `vtms-frontend/src/lib/permissions.test.ts`

**Interfaces:**
- Produces: `Role`, `Domain`, `PermissionLevel` types; `permissionFor(role, domain)`, `canView(role, domain)`, `canEdit(role, domain)`, `rolesWithAccess(domain): Role[]` — consumed by `AuthContext`, `RouteGuards`, `App.tsx`, `Layout.tsx`, `AdminStaff.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { canView, canEdit, permissionFor, rolesWithAccess, type Domain } from './permissions';

const DOMAINS: Domain[] = ['batches', 'trainees', 'attendance', 'competency', 'case_notes', 'inventory', 'financials', 'graduation', 'alumni'];

describe('permissions', () => {
  it('gives admin full access to every domain', () => {
    DOMAINS.forEach((d) => {
      expect(permissionFor('admin', d)).toBe('full');
      expect(canView('admin', d)).toBe(true);
      expect(canEdit('admin', d)).toBe(true);
    });
  });

  it('denies finance_officer any access to case_notes', () => {
    expect(canView('finance_officer', 'case_notes')).toBe(false);
    expect(canEdit('finance_officer', 'case_notes')).toBe(false);
  });

  it('gives case_worker edit access to case_notes but only view on attendance', () => {
    expect(canEdit('case_worker', 'case_notes')).toBe(true);
    expect(canEdit('case_worker', 'attendance')).toBe(false);
    expect(canView('case_worker', 'attendance')).toBe(true);
  });

  it('denies trainer any access to case_notes and financials', () => {
    expect(canView('trainer', 'case_notes')).toBe(false);
    expect(canView('trainer', 'financials')).toBe(false);
  });

  it('rolesWithAccess returns only roles that can at least view the domain', () => {
    expect(rolesWithAccess('financials').sort()).toEqual(['admin', 'director', 'finance_officer'].sort());
    expect(rolesWithAccess('case_notes').sort()).toEqual(['admin', 'case_worker', 'director'].sort());
    expect(rolesWithAccess('batches').sort()).toEqual(['admin', 'case_worker', 'director', 'finance_officer', 'trainer'].sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vtms-frontend && npx vitest run src/lib/permissions.test.ts`
Expected: FAIL with "Cannot find module './permissions'"

- [ ] **Step 3: Write the implementation**

```typescript
export type Role = 'admin' | 'director' | 'trainer' | 'case_worker' | 'finance_officer';

export type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

export type Domain =
  | 'batches' | 'trainees' | 'attendance' | 'competency' | 'case_notes'
  | 'inventory' | 'financials' | 'graduation' | 'alumni';

const ALL_ROLES: Role[] = ['admin', 'director', 'trainer', 'case_worker', 'finance_officer'];

const MATRIX: Record<Domain, Record<Role, PermissionLevel>> = {
  batches:    { admin: 'full', director: 'edit', trainer: 'edit', case_worker: 'edit', finance_officer: 'view' },
  trainees:   { admin: 'full', director: 'edit', trainer: 'edit', case_worker: 'edit', finance_officer: 'view' },
  attendance: { admin: 'full', director: 'view', trainer: 'edit', case_worker: 'view', finance_officer: 'none' },
  competency: { admin: 'full', director: 'view', trainer: 'edit', case_worker: 'view', finance_officer: 'none' },
  case_notes: { admin: 'full', director: 'view', trainer: 'none', case_worker: 'edit', finance_officer: 'none' },
  inventory:  { admin: 'full', director: 'view', trainer: 'edit', case_worker: 'none', finance_officer: 'view' },
  financials: { admin: 'full', director: 'view', trainer: 'none', case_worker: 'none', finance_officer: 'edit' },
  graduation: { admin: 'full', director: 'view', trainer: 'view', case_worker: 'edit', finance_officer: 'none' },
  alumni:     { admin: 'full', director: 'view', trainer: 'view', case_worker: 'edit', finance_officer: 'none' },
};

export function permissionFor(role: Role, domain: Domain): PermissionLevel {
  return MATRIX[domain][role];
}

export function canView(role: Role, domain: Domain): boolean {
  const level = permissionFor(role, domain);
  return level === 'view' || level === 'edit' || level === 'full';
}

export function canEdit(role: Role, domain: Domain): boolean {
  const level = permissionFor(role, domain);
  return level === 'edit' || level === 'full';
}

export function rolesWithAccess(domain: Domain): Role[] {
  return ALL_ROLES.filter((r) => canView(r, domain));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vtms-frontend && npx vitest run src/lib/permissions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add vtms-frontend/src/lib/permissions.ts vtms-frontend/src/lib/permissions.test.ts
git commit -m "feat: add RBAC permission matrix module"
```

---

### Task 6: AuthContext

**Files:**
- Create: `vtms-frontend/src/contexts/AuthContext.tsx`
- Test: `vtms-frontend/src/contexts/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase` (Task 4), `Role` from `../lib/permissions` (Task 5).
- Produces: `AuthProvider` component, `useAuth(): { session: Session | null; profile: Profile | null; loading: boolean; signOut: () => Promise<void> }`, `Profile` interface (`id`, `fullName`, `email`, `role: Role`, `active: boolean`) — consumed by `RouteGuards`, `Login`, `App.tsx`, `Layout.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: { id: 'user-1', full_name: 'Test User', email: 'test@example.com', role: 'admin', active: true },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

import { supabase } from '../lib/supabase';

function Consumer() {
  const { loading, profile } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{profile ? `${profile.fullName} (${profile.role})` : 'signed out'}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never);
  });

  it('shows signed out state when there is no session', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('signed out')).toBeDefined());
  });

  it('loads the profile once a session exists', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } as never },
      error: null,
    } as never);
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('Test User (admin)')).toBeDefined());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vtms-frontend && npx vitest run src/contexts/AuthContext.test.tsx`
Expected: FAIL with "Cannot find module './AuthContext'"

- [ ] **Step 3: Write the implementation**

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Role } from '../lib/permissions';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, active')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return { id: data.id, fullName: data.full_name, email: data.email, role: data.role, active: data.active };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setProfile(session ? await fetchProfile(session.user.id) : null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      setProfile(session ? await fetchProfile(session.user.id) : null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vtms-frontend && npx vitest run src/contexts/AuthContext.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add vtms-frontend/src/contexts/AuthContext.tsx vtms-frontend/src/contexts/AuthContext.test.tsx
git commit -m "feat: add AuthProvider with Supabase session and profile state"
```

---

### Task 7: Route guards + Unauthorized page

**Files:**
- Create: `vtms-frontend/src/components/RouteGuards.tsx`
- Create: `vtms-frontend/src/pages/Unauthorized.tsx`
- Test: `vtms-frontend/src/components/RouteGuards.test.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../contexts/AuthContext` (Task 6), `Role` from `../lib/permissions` (Task 5).
- Produces: `RequireAuth`, `RequireRole({ roles }: { roles: Role[] })` — consumed by `App.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { RequireAuth, RequireRole } from './RouteGuards';

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/unauthorized" element={<div>unauthorized page</div>} />
        <Route path="/protected" element={<RequireAuth><div>protected content</div></RequireAuth>} />
        <Route
          path="/admin-only"
          element={
            <RequireAuth>
              <RequireRole roles={['admin']}><div>admin content</div></RequireRole>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth', () => {
  it('redirects to /login when there is no session', () => {
    mockUseAuth.mockReturnValue({ session: null, profile: null, loading: false });
    renderWithRouter('/protected');
    expect(screen.getByText('login page')).toBeDefined();
  });

  it('renders children when a session exists', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '1' } },
      profile: { id: '1', fullName: 'A', email: 'a@b.com', role: 'admin', active: true },
      loading: false,
    });
    renderWithRouter('/protected');
    expect(screen.getByText('protected content')).toBeDefined();
  });
});

describe('RequireRole', () => {
  it('redirects to /unauthorized when role is not allowed', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '1' } },
      profile: { id: '1', fullName: 'A', email: 'a@b.com', role: 'trainer', active: true },
      loading: false,
    });
    renderWithRouter('/admin-only');
    expect(screen.getByText('unauthorized page')).toBeDefined();
  });

  it('renders children when role is allowed', () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: '1' } },
      profile: { id: '1', fullName: 'A', email: 'a@b.com', role: 'admin', active: true },
      loading: false,
    });
    renderWithRouter('/admin-only');
    expect(screen.getByText('admin content')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vtms-frontend && npx vitest run src/components/RouteGuards.test.tsx`
Expected: FAIL with "Cannot find module './RouteGuards'"

- [ ] **Step 3: Write `Unauthorized.tsx`**

```tsx
import { ShieldOff } from 'lucide-react';

export default function Unauthorized() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <ShieldOff className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-lg font-semibold text-gray-700">Access restricted</p>
      <p className="text-sm text-gray-400 mt-1">Your role doesn't have permission to view this page.</p>
    </div>
  );
}
```

- [ ] **Step 4: Write `RouteGuards.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../lib/permissions';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!session || (profile !== null && !profile.active)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd vtms-frontend && npx vitest run src/components/RouteGuards.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add vtms-frontend/src/components/RouteGuards.tsx vtms-frontend/src/components/RouteGuards.test.tsx vtms-frontend/src/pages/Unauthorized.tsx
git commit -m "feat: add RequireAuth/RequireRole route guards and Unauthorized page"
```

---

### Task 8: Login page

**Files:**
- Create: `vtms-frontend/src/pages/Login.tsx`
- Test: `vtms-frontend/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 4), `useAuth` (Task 6), `cn` from `../lib/utils` (existing).
- Produces: default-exported `Login` component — consumed by `App.tsx`.

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Login from './Login';

const mockSignIn = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => mockSignIn(...args) } },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ session: null, profile: null, loading: false }),
}));

describe('Login', () => {
  it('submits email and password to Supabase', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    render(<MemoryRouter><Login /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText('you@example.org'), { target: { value: 'staff@agape.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ email: 'staff@agape.org', password: 'secret123' }));
  });

  it('shows an error message when sign-in fails', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<MemoryRouter><Login /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText('you@example.org'), { target: { value: 'staff@agape.org' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText('Invalid email or password.')).toBeDefined());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vtms-frontend && npx vitest run src/pages/Login.test.tsx`
Expected: FAIL with "Cannot find module './Login'"

- [ ] **Step 3: Write the implementation**

```tsx
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export default function Login() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && session) {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError('Invalid email or password.');
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="text-center mb-6">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Agape Skills Centre</p>
          <h1 className="text-xl font-bold text-primary-700">VTMS</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              placeholder="you@example.org"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors',
              submitting ? 'bg-primary-300 text-white cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'
            )}
          >
            <LogIn className="w-4 h-4" />
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vtms-frontend && npx vitest run src/pages/Login.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add vtms-frontend/src/pages/Login.tsx vtms-frontend/src/pages/Login.test.tsx
git commit -m "feat: add Login page"
```

---

### Task 9: Wire App.tsx routes and guards

**Files:**
- Modify: `vtms-frontend/src/App.tsx` (full replace)

**Interfaces:**
- Consumes: `AuthProvider` (Task 6), `RequireAuth`/`RequireRole` (Task 7), `Login`/`Unauthorized` (Tasks 7–8), `rolesWithAccess` (Task 5).

- [ ] **Step 1: Replace `App.tsx` in full**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth, RequireRole } from './components/RouteGuards';
import { rolesWithAccess } from './lib/permissions';
import Layout from './components/Layout';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import Trainees from './pages/Trainees';
import TraineeProfile from './pages/TraineeProfile';
import Attendance from './pages/Attendance';
import Competency from './pages/Competency';
import CaseManagement from './pages/CaseManagement';
import Inventory from './pages/Inventory';
import Financials from './pages/Financials';
import Graduation from './pages/Graduation';
import Alumni from './pages/Alumni';
import AdminStaff from './pages/AdminStaff';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="batches" element={<Batches />} />
            <Route path="batches/:id" element={<BatchDetail />} />
            <Route path="trainees" element={<Trainees />} />
            <Route path="trainees/:id" element={<TraineeProfile />} />
            <Route path="attendance" element={<RequireRole roles={rolesWithAccess('attendance')}><Attendance /></RequireRole>} />
            <Route path="competency" element={<RequireRole roles={rolesWithAccess('competency')}><Competency /></RequireRole>} />
            <Route path="case-management" element={<RequireRole roles={rolesWithAccess('case_notes')}><CaseManagement /></RequireRole>} />
            <Route path="inventory" element={<RequireRole roles={rolesWithAccess('inventory')}><Inventory /></RequireRole>} />
            <Route path="financials" element={<RequireRole roles={rolesWithAccess('financials')}><Financials /></RequireRole>} />
            <Route path="graduation" element={<RequireRole roles={rolesWithAccess('graduation')}><Graduation /></RequireRole>} />
            <Route path="alumni" element={<RequireRole roles={rolesWithAccess('alumni')}><Alumni /></RequireRole>} />
            <Route path="admin/staff" element={<RequireRole roles={['admin']}><AdminStaff /></RequireRole>} />
            <Route path="more" element={<div className="p-6 text-gray-500 text-sm">Settings coming soon</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

Note: `AdminStaff` doesn't exist until Task 12. This task will not typecheck cleanly until Task 12 lands — that's expected and acceptable since Task 12 is later in this same plan (not a separate feature). Proceed; Task 12 resolves it.

- [ ] **Step 2: Commit**

```bash
git add vtms-frontend/src/App.tsx
git commit -m "feat: wire AuthProvider, route guards, and login/unauthorized routes into App"
```

---

### Task 10: Store — Supabase-backed batches/trainees

**Files:**
- Modify: `vtms-frontend/src/store/index.ts` (full replace)
- Modify: `vtms-frontend/src/contexts/AuthContext.tsx` (add one call)
- Modify: `vtms-frontend/src/pages/Batches.tsx`
- Modify: `vtms-frontend/src/pages/Trainees.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 4).
- Produces: `useStore().fetchInitialData(): Promise<void>`, `useStore().dataLoaded: boolean`, `addBatch(b: Omit<Batch,'id'>): Promise<void>`, `updateBatch(id, updates): Promise<void>`, `addTrainee(t: Omit<Trainee,'id'>): Promise<void>`, `updateTrainee(id, updates): Promise<void>` — `dataLoaded` and `fetchInitialData` are consumed by Task 11's `Layout.tsx`.

- [ ] **Step 1: Replace `store/index.ts` in full**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type {
  Batch, Trainee, Module, CompetencyAssessment, AttendanceRecord,
  CaseNote, InventoryItem, InventoryUsage, ProcurementRequest,
  ProductionLog, Sale, FinancialTransaction, StarterKit,
  AlumniFollowUp, JobPlacement,
} from '../types';
import {
  SEED_MODULES, SEED_COMPETENCY_ASSESSMENTS,
  SEED_ATTENDANCE, SEED_CASE_NOTES, SEED_INVENTORY_ITEMS, SEED_INVENTORY_USAGE,
  SEED_PROCUREMENT_REQUESTS, SEED_PRODUCTION_LOGS, SEED_SALES, SEED_FINANCIALS,
  SEED_STARTER_KITS, SEED_ALUMNI_FOLLOWUPS, SEED_JOB_PLACEMENTS,
} from './seed';

// ---- Supabase row <-> app-model mapping (batches & trainees only —
// the other 12 domains stay local-seeded this phase) ----

interface BatchRow {
  id: string; name: string; trade: string; start_date: string; end_date: string | null;
  status: string; budget_allocated: string | number; target_enrollment: number;
  trainer_name: string; description: string | null;
}

function batchFromRow(row: BatchRow): Batch {
  return {
    id: row.id,
    name: row.name,
    trade: row.trade as Batch['trade'],
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as Batch['status'],
    budgetAllocated: Number(row.budget_allocated),
    targetEnrollment: row.target_enrollment,
    trainerName: row.trainer_name,
    description: row.description ?? '',
  };
}

function batchToRow(b: Omit<Batch, 'id'>) {
  return {
    name: b.name,
    trade: b.trade,
    start_date: b.startDate,
    end_date: b.endDate,
    status: b.status,
    budget_allocated: b.budgetAllocated,
    target_enrollment: b.targetEnrollment,
    trainer_name: b.trainerName,
    description: b.description,
  };
}

interface TraineeRow {
  id: string; batch_id: string; first_name: string; last_name: string; date_of_birth: string;
  gender: string; phone_number: string; address: string; emergency_contact_name: string;
  emergency_contact_phone: string; mobilization_source: string; vulnerability_score: number;
  vulnerability_assessment: Trainee['vulnerabilityAssessment'] | null;
  status: string; graduation_date: string | null;
}

function traineeFromRow(row: TraineeRow): Trainee {
  return {
    id: row.id,
    batchId: row.batch_id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender as Trainee['gender'],
    phone: row.phone_number,
    address: row.address,
    emergencyContact: row.emergency_contact_name,
    emergencyPhone: row.emergency_contact_phone,
    mobilizationSource: row.mobilization_source,
    vulnerabilityScore: row.vulnerability_score,
    vulnerabilityAssessment: row.vulnerability_assessment ?? {
      housingStatus: 'rented', foodSecurity: 'adequate', previousEducation: 'primary',
      familyStatus: 'both_parents', hasDisability: false, disabilityDetails: '',
    },
    status: row.status as Trainee['status'],
    graduationDate: row.graduation_date,
    photo: null,
  };
}

function traineeToRow(t: Omit<Trainee, 'id' | 'photo'>) {
  return {
    batch_id: t.batchId,
    first_name: t.firstName,
    last_name: t.lastName,
    date_of_birth: t.dateOfBirth,
    gender: t.gender,
    phone_number: t.phone,
    address: t.address,
    emergency_contact_name: t.emergencyContact,
    emergency_contact_phone: t.emergencyPhone,
    mobilization_source: t.mobilizationSource,
    vulnerability_score: t.vulnerabilityScore,
    vulnerability_assessment: t.vulnerabilityAssessment,
    status: t.status,
    graduation_date: t.graduationDate,
  };
}

interface VTMSState {
  batches: Batch[];
  trainees: Trainee[];
  modules: Module[];
  competencyAssessments: CompetencyAssessment[];
  attendanceRecords: AttendanceRecord[];
  caseNotes: CaseNote[];
  inventoryItems: InventoryItem[];
  inventoryUsage: InventoryUsage[];
  procurementRequests: ProcurementRequest[];
  productionLogs: ProductionLog[];
  sales: Sale[];
  financialTransactions: FinancialTransaction[];
  starterKits: StarterKit[];
  alumniFollowUps: AlumniFollowUp[];
  jobPlacements: JobPlacement[];
  activeBatchId: string;
  dataLoaded: boolean;

  fetchInitialData: () => Promise<void>;
  setActiveBatch: (id: string) => void;
  addTrainee: (t: Omit<Trainee, 'id'>) => Promise<void>;
  updateTrainee: (id: string, updates: Partial<Trainee>) => Promise<void>;
  logAttendance: (records: AttendanceRecord[]) => void;
  addCompetencyAssessment: (a: CompetencyAssessment) => void;
  addCaseNote: (n: CaseNote) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  addProcurementRequest: (r: ProcurementRequest) => void;
  updateProcurementRequest: (id: string, updates: Partial<ProcurementRequest>) => void;
  addProductionLog: (l: ProductionLog) => void;
  addSale: (s: Sale) => void;
  addFinancialTransaction: (t: FinancialTransaction) => void;
  addStarterKit: (k: StarterKit) => void;
  addAlumniFollowUp: (f: AlumniFollowUp) => void;
  addJobPlacement: (p: JobPlacement) => void;
  addBatch: (b: Omit<Batch, 'id'>) => Promise<void>;
  updateBatch: (id: string, updates: Partial<Batch>) => Promise<void>;
}

export const useStore = create<VTMSState>()(
  persist(
    (set, get) => ({
      batches: [],
      trainees: [],
      modules: SEED_MODULES,
      competencyAssessments: SEED_COMPETENCY_ASSESSMENTS,
      attendanceRecords: SEED_ATTENDANCE,
      caseNotes: SEED_CASE_NOTES,
      inventoryItems: SEED_INVENTORY_ITEMS,
      inventoryUsage: SEED_INVENTORY_USAGE,
      procurementRequests: SEED_PROCUREMENT_REQUESTS,
      productionLogs: SEED_PRODUCTION_LOGS,
      sales: SEED_SALES,
      financialTransactions: SEED_FINANCIALS,
      starterKits: SEED_STARTER_KITS,
      alumniFollowUps: SEED_ALUMNI_FOLLOWUPS,
      jobPlacements: SEED_JOB_PLACEMENTS,
      activeBatchId: '',
      dataLoaded: false,

      fetchInitialData: async () => {
        const [batchResult, traineeResult] = await Promise.all([
          supabase.from('batches').select('*').order('start_date', { ascending: false }),
          supabase.from('trainees').select('*'),
        ]);

        if (batchResult.error) throw batchResult.error;
        if (traineeResult.error) throw traineeResult.error;

        const batches = (batchResult.data ?? []).map((r) => batchFromRow(r as BatchRow));
        const trainees = (traineeResult.data ?? []).map((r) => traineeFromRow(r as TraineeRow));
        const currentActive = get().activeBatchId;
        const activeBatchId = batches.some((b) => b.id === currentActive)
          ? currentActive
          : (batches[0]?.id ?? '');

        set({ batches, trainees, activeBatchId, dataLoaded: true });
      },

      setActiveBatch: (id) => set({ activeBatchId: id }),

      addBatch: async (b) => {
        const { data, error } = await supabase.from('batches').insert(batchToRow(b)).select().single();
        if (error) throw error;
        const batch = batchFromRow(data as BatchRow);
        set((s) => ({ batches: [...s.batches, batch] }));
      },

      updateBatch: async (id, updates) => {
        const current = get().batches.find((b) => b.id === id);
        if (!current) throw new Error(`Batch ${id} not found`);
        const merged = { ...current, ...updates };
        const { data, error } = await supabase.from('batches').update(batchToRow(merged)).eq('id', id).select().single();
        if (error) throw error;
        const batch = batchFromRow(data as BatchRow);
        set((s) => ({ batches: s.batches.map((b) => (b.id === id ? batch : b)) }));
      },

      addTrainee: async (t) => {
        const { data, error } = await supabase.from('trainees').insert(traineeToRow(t)).select().single();
        if (error) throw error;
        const trainee = traineeFromRow(data as TraineeRow);
        set((s) => ({ trainees: [...s.trainees, trainee] }));
      },

      updateTrainee: async (id, updates) => {
        const current = get().trainees.find((t) => t.id === id);
        if (!current) throw new Error(`Trainee ${id} not found`);
        const merged = { ...current, ...updates };
        const { data, error } = await supabase.from('trainees').update(traineeToRow(merged)).eq('id', id).select().single();
        if (error) throw error;
        const trainee = traineeFromRow(data as TraineeRow);
        set((s) => ({ trainees: s.trainees.map((t) => (t.id === id ? trainee : t)) }));
      },

      logAttendance: (records) => set((s) => {
        const existing = s.attendanceRecords.filter(
          (r) => !records.some((nr) => nr.traineeId === r.traineeId && nr.date === r.date)
        );
        return { attendanceRecords: [...existing, ...records] };
      }),
      addCompetencyAssessment: (a) => set((s) => ({ competencyAssessments: [...s.competencyAssessments, a] })),
      addCaseNote: (n) => set((s) => ({ caseNotes: [...s.caseNotes, n] })),
      updateInventoryItem: (id, updates) => set((s) => ({ inventoryItems: s.inventoryItems.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
      addProcurementRequest: (r) => set((s) => ({ procurementRequests: [...s.procurementRequests, r] })),
      updateProcurementRequest: (id, updates) => set((s) => ({ procurementRequests: s.procurementRequests.map((r) => (r.id === id ? { ...r, ...updates } : r)) })),
      addProductionLog: (l) => set((s) => ({ productionLogs: [...s.productionLogs, l] })),
      addSale: (sl) => set((s) => ({ sales: [...s.sales, sl] })),
      addFinancialTransaction: (t) => set((s) => ({ financialTransactions: [...s.financialTransactions, t] })),
      addStarterKit: (k) => set((s) => ({ starterKits: [...s.starterKits, k] })),
      addAlumniFollowUp: (f) => set((s) => ({ alumniFollowUps: [...s.alumniFollowUps, f] })),
      addJobPlacement: (p) => set((s) => ({ jobPlacements: [...s.jobPlacements, p] })),
    }),
    {
      name: 'vtms-store',
      version: 2,
      // batches/trainees are now server-sourced (per-user, RLS-scoped) —
      // caching them in localStorage risks showing a previously signed-in
      // user's data to whoever signs in next on the same browser.
      partialize: (s) => {
        const { batches: _batches, trainees: _trainees, dataLoaded: _dataLoaded, ...rest } = s;
        return rest;
      },
    }
  )
);
```

- [ ] **Step 2: Wire `fetchInitialData` into `AuthContext`**

In `vtms-frontend/src/contexts/AuthContext.tsx`, add the import:

```typescript
import { useStore } from '../store';
```

In the `getSession().then(...)` block, replace `setProfile(session ? await fetchProfile(session.user.id) : null);` with:

```typescript
      const nextProfile = session ? await fetchProfile(session.user.id) : null;
      setProfile(nextProfile);
      if (nextProfile) {
        useStore.getState().fetchInitialData().catch((err) => console.error('Failed to load initial data', err));
      }
```

In the `onAuthStateChange` callback, rename its first parameter from `_event` to `event` and replace the same `setProfile(...)` line with the event-gated version — `onAuthStateChange` fires on `TOKEN_REFRESHED` too (with a non-null session), and refetching every batch/trainee row on every silent background token refresh would waste API calls against a Supabase project that already hit its free-tier quota once:

```typescript
      const nextProfile = session ? await fetchProfile(session.user.id) : null;
      setProfile(nextProfile);
      if (nextProfile && event !== 'TOKEN_REFRESHED') {
        useStore.getState().fetchInitialData().catch((err) => console.error('Failed to load initial data', err));
      }
```

- [ ] **Step 3: Update `Batches.tsx`'s submit handler**

In `vtms-frontend/src/pages/Batches.tsx`:
- Remove `generateId` from the `import { cn, formatCurrency, formatDate, generateId } from '../lib/utils';` line (leave the other three).
- Remove `Batch` from `import type { TradeType, Batch } from '../types';` (leave `TradeType`).
- Replace the `handleSubmit` function:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await addBatch({
        name: form.name.trim(),
        trade: form.trade,
        startDate: form.startDate,
        endDate: null,
        status: 'planned',
        budgetAllocated: Number(form.budgetAllocated),
        targetEnrollment: Number(form.targetEnrollment),
        trainerName: form.trainerName.trim(),
        description: form.description.trim(),
      });
      setForm(EMPTY_FORM);
      setErrors({});
      setShowForm(false);
    } catch (err) {
      setErrors({ name: err instanceof Error ? err.message : 'Failed to create batch. Check your permissions.' });
    }
  };
```

- [ ] **Step 4: Update `Trainees.tsx`'s submit handler**

In `vtms-frontend/src/pages/Trainees.tsx`, in the `RegistrationForm` component:
- Remove `generateId` from `import { cn, generateId, getVulnerabilityLabel, formatDate } from '../lib/utils';` (leave the other three).
- Add a `submitError` state next to the existing `submitted` state: `const [submitError, setSubmitError] = useState<string | null>(null);`
- Replace `handleSubmit`:

```typescript
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await addTrainee({
        batchId: form.batchId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone.trim(),
        address: form.address.trim(),
        emergencyContact: form.emergencyContact.trim(),
        emergencyPhone: form.emergencyPhone.trim(),
        mobilizationSource: form.mobilizationSource.trim(),
        vulnerabilityScore: previewScore,
        vulnerabilityAssessment: assessment,
        status: 'enrolled',
        graduationDate: null,
        photo: null,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to register trainee. Check your permissions.');
    }
  }
```

- Just before the closing `</div>` of the `sectionCls` block that contains the disability checkbox (end of the "Vulnerability Assessment" section, right before `{/* Actions */}`), add:

```tsx
      {submitError && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</p>
      )}
```

- [ ] **Step 5: Verify the project typechecks**

Run: `cd vtms-frontend && npx tsc -b --noEmit`
Expected: PASS (no errors) — if `AdminStaff` import errors appear from `App.tsx` (Task 9), that's expected until Task 12; every other file should be clean.

- [ ] **Step 6: Commit**

```bash
git add vtms-frontend/src/store/index.ts vtms-frontend/src/contexts/AuthContext.tsx vtms-frontend/src/pages/Batches.tsx vtms-frontend/src/pages/Trainees.tsx
git commit -m "feat: wire Batches and Trainees to Supabase-backed CRUD"
```

---

### Task 11: Layout — real user, sign-out, nav filtering, loading gate

**Files:**
- Modify: `vtms-frontend/src/components/Layout.tsx` (full replace)

**Interfaces:**
- Consumes: `useAuth` (Task 6), `canView`/`Domain` (Task 5), `useStore().dataLoaded` (Task 10).

- [ ] **Step 1: Replace `Layout.tsx` in full**

```tsx
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, ClipboardList, Package,
  DollarSign, Heart, GraduationCap, UserCheck, Menu, X, Layers,
  LogOut, ShieldCheck, Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { canView, type Domain } from '../lib/permissions';

const NAV_ITEMS: { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean; domain?: Domain }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/batches', icon: Layers, label: 'Batches', domain: 'batches' },
  { to: '/trainees', icon: Users, label: 'Trainees', domain: 'trainees' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance', domain: 'attendance' },
  { to: '/competency', icon: BookOpen, label: 'Competency', domain: 'competency' },
  { to: '/case-management', icon: Heart, label: 'Case Mgmt', domain: 'case_notes' },
  { to: '/inventory', icon: Package, label: 'Inventory', domain: 'inventory' },
  { to: '/financials', icon: DollarSign, label: 'Financials', domain: 'financials' },
  { to: '/graduation', icon: GraduationCap, label: 'Graduation', domain: 'graduation' },
  { to: '/alumni', icon: UserCheck, label: 'Alumni', domain: 'alumni' },
];

const MOBILE_NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/trainees', icon: Users, label: 'Trainees' },
  { to: '/attendance', icon: ClipboardList, label: 'Log' },
  { to: '/case-management', icon: Heart, label: 'Care' },
  { to: '/more', icon: Menu, label: 'More' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { batches, activeBatchId, setActiveBatch, dataLoaded } = useStore();
  const { profile, signOut } = useAuth();
  const activeBatch = batches.find((b) => b.id === activeBatchId);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.domain || (profile && canView(profile.role, item.domain))
  );
  const navItems = profile?.role === 'admin'
    ? [...visibleNavItems, { to: '/admin/staff', icon: ShieldCheck, label: 'Staff' }]
    : visibleNavItems;

  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 z-40 flex flex-col transition-transform duration-200',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Agape Skills Centre</p>
            <h1 className="text-base font-bold text-primary-700 leading-tight">VTMS</h1>
          </div>
          <button className="lg:hidden p-1" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Active batch selector */}
        <div className="px-4 py-3 border-b border-gray-100 bg-primary-50">
          <p className="text-[10px] text-primary-600 uppercase font-semibold mb-1">Active Batch</p>
          <select
            value={activeBatchId}
            onChange={(e) => setActiveBatch(e.target.value)}
            className="w-full text-xs font-semibold text-primary-800 bg-transparent border-0 outline-none cursor-pointer"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {activeBatch && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-1 inline-block',
              activeBatch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            )}>
              {activeBatch.status.toUpperCase()}
            </span>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center space-x-2 px-2">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
              {profile ? profile.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() : ''}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{profile?.fullName}</p>
              <p className="text-[10px] text-gray-400 capitalize">{profile?.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 h-14 flex items-center px-4 gap-3">
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {NAV_ITEMS.find((n) =>
                n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
              )?.label ?? 'VTMS'}
            </p>
            <p className="text-[11px] text-gray-400 truncate hidden sm:block">
              {activeBatch?.name} · {activeBatch?.trade}
            </p>
          </div>
          <span className={cn(
            'hidden sm:flex items-center space-x-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full',
            'bg-green-100 text-green-700'
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>Online</span>
          </span>
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 z-20 px-2">
        {MOBILE_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-colors min-w-0',
              isActive ? 'text-primary-600' : 'text-gray-400'
            )}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Verify the project typechecks**

Run: `cd vtms-frontend && npx tsc -b --noEmit`
Expected: only the pending `AdminStaff` import error from `App.tsx` remains (resolved in Task 12).

- [ ] **Step 3: Commit**

```bash
git add vtms-frontend/src/components/Layout.tsx
git commit -m "feat: show real signed-in user, sign-out, and role-filtered nav in Layout"
```

---

### Task 12: Admin Staff page

**Files:**
- Create: `vtms-frontend/src/pages/AdminStaff.tsx`
- Test: `vtms-frontend/src/pages/AdminStaff.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 4), `Role` (Task 5), `cn` (existing).
- Produces: default-exported `AdminStaff` component — consumed by `App.tsx` (Task 9, already wired).
- Calls `POST /api/invite-staff` (Task 13) with `{ email, fullName, role }` and an `Authorization: Bearer <access_token>` header.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminStaff from './AdminStaff';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({
          data: [
            { id: '1', full_name: 'Jane Admin', email: 'jane@agape.org', role: 'admin', active: true },
            { id: '2', full_name: 'Tom Trainer', email: 'tom@agape.org', role: 'trainer', active: true },
          ],
          error: null,
        }),
      }),
    }),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}));

describe('AdminStaff', () => {
  it('lists existing staff from Supabase', async () => {
    render(<AdminStaff />);
    await waitFor(() => expect(screen.getByText('Jane Admin')).toBeDefined());
    expect(screen.getByText('Tom Trainer')).toBeDefined();
  });

  it('renders the invite form', () => {
    render(<AdminStaff />);
    expect(screen.getByPlaceholderText('Full name')).toBeDefined();
    expect(screen.getByPlaceholderText('Email')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vtms-frontend && npx vitest run src/pages/AdminStaff.test.tsx`
Expected: FAIL with "Cannot find module './AdminStaff'"

- [ ] **Step 3: Write the implementation**

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import type { Role } from '../lib/permissions';

interface StaffProfile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
}

const ROLE_OPTIONS: Role[] = ['admin', 'director', 'trainer', 'case_worker', 'finance_officer'];

export default function AdminStaff() {
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ email: string; fullName: string; role: Role }>({
    email: '', fullName: '', role: 'trainer',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadStaff() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, active')
      .order('full_name');
    if (!error && data) {
      setStaff(data.map((r) => ({ id: r.id, fullName: r.full_name, email: r.email, role: r.role, active: r.active })));
    }
    setLoading(false);
  }

  useEffect(() => { loadStaff(); }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/invite-staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(form),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: 'error', text: body.error ?? 'Failed to send invite' });
      return;
    }
    setMessage({ type: 'success', text: `Invite sent to ${form.email}` });
    setForm({ email: '', fullName: '', role: 'trainer' });
    loadStaff();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Staff & Roles</h2>
        <p className="text-sm text-gray-500 mt-0.5">Invite staff and manage role assignments.</p>
      </div>

      <form onSubmit={handleInvite} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-800">Invite Staff Member</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input
            required
            type="text"
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-400"
          >
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {message && (
          <p className={cn('text-xs', message.type === 'success' ? 'text-green-600' : 'text-red-500')}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            submitting ? 'bg-primary-300 text-white cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'
          )}
        >
          <UserPlus className="w-4 h-4" />
          {submitting ? 'Sending…' : 'Send Invite'}
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Staff ({staff.length})</h3>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.fullName}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                  s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {s.role.replace('_', ' ')}{!s.active ? ' · inactive' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vtms-frontend && npx vitest run src/pages/AdminStaff.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Verify the full project typechecks and full test suite passes**

Run: `cd vtms-frontend && npx tsc -b --noEmit && npm test`
Expected: PASS with zero errors — this is the first point where `App.tsx`'s `AdminStaff` import resolves, so the whole project should be clean now.

- [ ] **Step 6: Commit**

```bash
git add vtms-frontend/src/pages/AdminStaff.tsx vtms-frontend/src/pages/AdminStaff.test.tsx
git commit -m "feat: add admin Staff & Roles page with invite form"
```

---

### Task 13: Vercel invite-staff serverless function

**Files:**
- Create: `api/invite-staff.ts` (repo root, sibling to `vercel.json` — Vercel's zero-config convention looks for `/api` at the project root, not inside `vtms-frontend/`)
- Modify: `vtms-frontend/package.json` (add `@vercel/node` devDependency)
- Modify: `.gitignore` (repo root — currently has no env exclusion at all)
- Create: `.env.local` (repo root, git-ignored, for local `vercel dev` testing)
- Create: `.env.example` (repo root, tracked, placeholder only)

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` env vars (server-side only, never `VITE_`-prefixed).
- Produces: `POST /api/invite-staff` — consumed by `AdminStaff.tsx` (Task 12, already wired).

- [ ] **Step 1: Fix the root `.gitignore`**

Read the current root `.gitignore`, then add:

```
.env
.env.*
!.env.example
```

- [ ] **Step 2: Create root `.env.local` with server-only secrets**

```
SUPABASE_URL=https://ujtrnisximixlirwphwh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<same service role key already stored in vtms-frontend/.env.local>
```

(Copy the exact value from `vtms-frontend/.env.local`'s `SUPABASE_SERVICE_ROLE_KEY` line — do not retype it by hand; use a file read + targeted copy to avoid transcription errors, as happened once already this session.)

- [ ] **Step 3: Create root `.env.example`**

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: Verify the root `.env.local` is git-ignored**

Run: `git check-ignore -v .env.local`
Expected: prints a match against the rule added in Step 1 (confirms it won't be committed).

- [ ] **Step 5: Add `@vercel/node` as a dev dependency**

Run: `cd vtms-frontend && npm install --save-dev @vercel/node`
Expected: installs cleanly, `package.json`'s `devDependencies` gains `@vercel/node`.

- [ ] **Step 6: Write `api/invite-staff.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ALLOWED_ROLES = ['admin', 'director', 'trainer', 'case_worker', 'finance_officer'] as const;
type Role = (typeof ALLOWED_ROLES)[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }
  const callerToken = authHeader.slice('Bearer '.length);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerData, error: callerError } = await admin.auth.getUser(callerToken);
  if (callerError || !callerData.user) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', callerData.user.id)
    .single();

  if (profileError || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.active) {
    res.status(403).json({ error: 'Only active admins can invite staff' });
    return;
  }

  const { email, fullName, role } = (req.body ?? {}) as { email?: string; fullName?: string; role?: string };
  if (!email || !fullName || !role || !ALLOWED_ROLES.includes(role as Role)) {
    res.status(400).json({ error: 'email, fullName, and a valid role are required' });
    return;
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited.user) {
    res.status(500).json({ error: inviteError?.message ?? 'Failed to send invite' });
    return;
  }

  const { error: insertError } = await admin.from('profiles').insert({
    id: invited.user.id,
    full_name: fullName,
    email,
    role,
    active: true,
  });

  if (insertError) {
    res.status(500).json({ error: insertError.message });
    return;
  }

  res.status(200).json({ ok: true });
}
```

- [ ] **Step 7: Verify the function typechecks**

Run: `cd vtms-frontend && npx tsc --noEmit --esModuleInterop --skipLibCheck ../api/invite-staff.ts`
Expected: PASS (no errors). If `@vercel/node` type resolution fails in this standalone check (it's outside `vtms-frontend`'s `tsconfig`), that's acceptable — Vercel's own build step typechecks it in context; note this to the user rather than spending more time on a standalone tsconfig for a single root-level file.

- [ ] **Step 8: Commit**

```bash
git add .gitignore .env.example api/invite-staff.ts vtms-frontend/package.json vtms-frontend/package-lock.json
git commit -m "feat: add admin-invite serverless function"
```

(`.env.local` at the root is git-ignored per Step 1 — do not `git add` it.)

---

### Task 14: Bootstrap first Admin account + manual E2E verification

This task is manual/human-in-the-loop — no code changes. It confirms Tasks 1–13 actually work end-to-end against the live Supabase project, and creates the first real login.

**Prerequisite:** Task 2's SQL must already be applied (confirmed in Task 2 Step 6) before starting this task.

- [ ] **Step 1: Create the first Admin's auth user**

In the Supabase Dashboard → Authentication → Users → "Add user", create a user with the email/password the primary Admin (Jason Ebrin, `ebrinejason@gmail.com`) will use to sign in. Copy the generated user UUID.

- [ ] **Step 2: Insert the matching `profiles` row**

In Supabase Dashboard → SQL Editor, run (substituting the real UUID from Step 1):

```sql
INSERT INTO profiles (id, full_name, email, role, active)
VALUES ('<uuid-from-step-1>', 'Jason Ebrin', 'ebrinejason@gmail.com', 'admin', true);
```

- [ ] **Step 3: Run the app locally and sign in as Admin**

Run: `cd vtms-frontend && npm run dev`
Open the printed local URL, sign in with the Step 1 credentials.
Expected: redirected to `/`, sidebar shows "Jason Ebrin" / "admin", all nav items visible including "Staff", the 5 seeded batches and 20 seeded trainees appear on the Batches/Trainees pages.

- [ ] **Step 4: Verify nav gating for a second role**

From the "Staff" page, invite a second test account with role `finance_officer` (use an email you control). Accept the invite, set a password, sign in as that user.
Expected: sidebar shows only Dashboard, Batches, Trainees, Inventory, Financials (no Attendance, Competency, Case Mgmt, Graduation, Alumni, Staff — per the permission matrix).

- [ ] **Step 5: Verify RLS actually blocks a denied read, not just the nav**

While signed in as the `finance_officer` test account (from Step 4), open the browser devtools console and run:

```javascript
const { data, error } = await window.supabase.from('case_notes').select('*');
console.log({ data, error });
```

(This requires temporarily exposing the client for the test — e.g., add `(window as any).supabase = supabase;` at the bottom of `vtms-frontend/src/lib/supabase.ts` for this manual check, then remove it afterward.)
Expected: `data` is an empty array (RLS silently filters denied rows for SELECT), confirming the database — not just the UI — is the actual enforcement point.

- [ ] **Step 6: Clean up the temporary debug line**

If Step 5's `window.supabase` line was added, remove it and commit:

```bash
git add vtms-frontend/src/lib/supabase.ts
git commit -m "chore: remove temporary window.supabase debug exposure"
```

(Skip this commit if Step 5 wasn't needed.)

- [ ] **Step 7: Report status back to the user**

Summarize: which roles were verified, whether RLS blocked the denied read, and any issues hit along the way (schema errors, RLS policy typos, etc.) for follow-up.

---

## Self-Review Notes

- **Spec coverage:** All of design spec §3 (schema), §4 (matrix), §5 (auth flow), §6 (data wiring), §7 (testing) map to tasks above. §8 (Supabase credentials) is resolved — keys are in hand and stored safely.
- **Placeholder scan:** no TBD/TODO markers; the one open item (exact `@vercel/node` typecheck behavior outside the Vite tsconfig) is called out explicitly with a fallback instruction, not left vague.
- **Type consistency:** `Role`/`Domain`/`PermissionLevel` (Task 5) are the single source of truth referenced identically by `AuthContext` (Task 6), `RouteGuards` (Task 7), `App.tsx` (Task 9), `Layout.tsx` (Task 11), and `AdminStaff.tsx` (Task 12) — no divergent duplicate definitions. `Batch`/`Trainee` mapping function names (`batchFromRow`/`batchToRow`/`traineeFromRow`/`traineeToRow`) are defined once in Task 10 and not redefined elsewhere.
- **Deviation from the approved design spec:** the spec said the invite function would live at `vtms-frontend/api/invite-staff.ts`; this plan places it at `api/invite-staff.ts` (repo root) instead, because `vercel.json` lives at the repo root and Vercel's zero-config convention resolves `/api` relative to it, not to the `buildCommand`'s `cd vtms-frontend`. Functionally identical to what was approved — same function, same security model, corrected path only.

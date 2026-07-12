# VTMS Phase 1: Auth + RBAC + Real Data Foundation — Design

## 1. Context

VTMS is currently a frontend-only prototype: all data lives in a Zustand
store seeded with fake data (`vtms-frontend/src/store/seed.ts`) and
persisted to `localStorage`. There is no login, no session, and no role
enforcement — `Layout.tsx` hardcodes a user ("James Nkurunziza, Programme
Manager") and every page is visible regardless of who's using the app.
`schema.sql` and the `@supabase/supabase-js` dependency exist but are
unwired.

`SYSTEM_BLUEPRINT.md` specifies a 5-role access model (Trainer, Case
Worker, Finance Officer, Director/Manager, Admin) with per-module
visibility, and calls out that trauma/case-note data must be protected —
this system will hold sensitive records on vulnerable minors, so
authorization has to be real, not cosmetic.

This phase builds the foundation every other module depends on: a real
Supabase-backed auth system, database-enforced role-based access control,
and real persistence for two of the twelve data domains (Batches,
Trainees) to prove the pattern. All other modules (Attendance,
Competency, Case Notes, Inventory, Financials, Graduation, Alumni) are
explicitly deferred to a later phase and continue running on local mock
data during this phase.

## 2. Goals / Non-Goals

**Goals**
- Real Supabase Auth: login, logout, session persistence, admin-driven
  staff invites (no public signup).
- Role model: `admin`, `director`, `trainer`, `case_worker`,
  `finance_officer`, stored in a `profiles` table.
- Database-enforced RBAC via Postgres Row-Level Security on every table,
  matching the permission matrix in §4 — enforcement lives in the
  database, not just the UI.
- Frontend route/nav guarding that reflects the same matrix, for UX
  (hiding things a role can't use) — a second layer on top of RLS, not a
  replacement for it.
- Real Supabase-backed CRUD for Batches and Trainees, replacing their
  seed data.

**Non-Goals (this phase)**
- Offline sync / IndexedDB queue. `offlineStorage.ts` is untouched.
- Real backend wiring for the other 10 data domains — they keep working
  on local Zustand/seed data exactly as today.
- Self-service signup or a custom password-reset UI (Supabase's hosted
  reset-password flow is sufficient for now).
- Anything requiring the actual Supabase project credentials — those are
  supplied by the user and wired in as env vars when available; this spec
  assumes a project will exist with `schema.sql` (as amended below)
  applied to it.

## 3. Schema Changes (`schema.sql`)

- Add a Postgres enum:
  ```sql
  CREATE TYPE user_role AS ENUM ('admin', 'director', 'trainer', 'case_worker', 'finance_officer');
  ```
- Replace the existing `roles` lookup table usage with a `profiles`
  table:
  ```sql
  CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role user_role NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
  The pre-existing `roles` table is dropped; `manager` becomes `director`
  everywhere (including any FK columns that referenced role names as
  free text, e.g. `assessor_id`/`recorded_by` stay UUID references to
  `profiles.id` instead of a bare `roles` table).
- Add a `SECURITY DEFINER` helper used inside RLS policies:
  ```sql
  CREATE OR REPLACE FUNCTION current_role_is(roles user_role[])
  RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND active AND role = ANY(roles)
    );
  $$;
  ```
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on every table, with
  `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies built from
  `current_role_is(...)` per the matrix below. `admin` is included in
  every policy's allowed-role list.

## 4. Permission Matrix

Extends the blueprint's table to cover every module so nav-gating and RLS
have one shared source of truth. "view" = SELECT only. "edit" = SELECT +
INSERT + UPDATE (DELETE reserved for `admin` everywhere). "X" = no
access, including SELECT.

| Domain (tables) | Trainer | Case Worker | Finance Officer | Director | Admin |
|---|---|---|---|---|---|
| batches, trades | view/edit | view/edit | view | view/edit | full |
| trainees | view/edit | view/edit | view | view/edit | full |
| attendance, competency_assessments, modules | view/edit | view | X | view | full |
| case_notes, vulnerability_assessments | X | view/edit | X | view* | full |
| inventory_items, inventory_usage, procurement_requests | view/edit | X | view | view | full |
| production_logs, sales, financial_transactions | X | X | view/edit | view | full |
| starter_kits, alumni_follow_ups, job_placements | view | view/edit | X | view | full |
| profiles (staff directory) | view own | view own | view own | view all | full |

\* Director's view of `case_notes` is intended to be anonymized
(no trainee-identifying join) — deferred to the Case Management phase
since `case_notes` isn't wired to Supabase yet; the RLS policy for now
just grants row-level SELECT and the anonymization is a query-shape
concern for that later phase.

Only the `batches`/`trainees` rows are load-bearing this phase; the rest
of the matrix is implemented in the database now so later phases don't
need to revisit RLS module-by-module.

## 5. Auth Flow

- **Login** (`/login`, public route): email + password via
  `supabase.auth.signInWithPassword`. No public signup route exists
  anywhere in the app.
- **Invite** (`/admin/staff`, admin-only route): lists `profiles`, lets an
  Admin create a new staff member (email, full name, role). Calls a
  Vercel serverless function `vtms-frontend/api/invite-staff.ts` (this
  repo already deploys via `vercel.json`), which is the only place the
  Supabase **service role key** is used — it calls
  `supabase.auth.admin.inviteUserByEmail()` then inserts the matching
  `profiles` row. The service role key is a Vercel environment variable,
  never shipped to the client.
- **Session**: `src/lib/supabase.ts` builds the client from
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. An `AuthProvider`
  (React context, wraps `<App>`) holds `{ session, profile, loading }`,
  subscribes to `supabase.auth.onAuthStateChange`, and fetches the
  caller's `profiles` row on sign-in to get `role`.
- **Route protection**:
  - `<RequireAuth>` — redirects to `/login` if there's no session.
  - `<RequireRole roles={[...]}>` — renders a 403 page if the signed-in
    profile's role isn't allowed (or the profile is `active: false`,
    which is treated as signed-out).
- **Logout**: `Layout.tsx`'s hardcoded user block is replaced with the
  real profile's name/role and a working sign-out button that calls
  `supabase.auth.signOut()`.
- **Nav gating**: `NAV_ITEMS` in `Layout.tsx` is filtered by the matrix in
  §4 against the signed-in role, so (e.g.) a Finance Officer never sees
  a "Case Mgmt" link.

## 6. Data Wiring (Batches + Trainees)

- Remove `SEED_BATCHES` / `SEED_TRAINEES` as the store's initial state.
- On mount (inside `AuthProvider`, once a session exists), fetch
  `batches` and `trainees` from Supabase and hydrate the Zustand store.
- `addBatch`, `updateBatch`, `addTrainee`, `updateTrainee` become async:
  write to Supabase first, update local state from the actual returned
  row (so an RLS rejection surfaces as a thrown/caught error rather than
  a UI that silently "succeeds" locally while the DB rejected the
  write).
- The other 12 data domains (attendance, competency, case notes,
  inventory, procurement, production, sales, financials, starter kits,
  alumni, job placements, modules) are untouched this phase — same
  seed-backed Zustand behavior as today.

## 7. Testing

- Unit tests for the permission-matrix-to-nav-filter mapping (pure
  function, easy to test exhaustively per role).
- Unit tests for `<RequireAuth>` / `<RequireRole>` redirect behavior with
  a mocked session.
- Manual verification checklist (run once real Supabase credentials are
  available): sign in as each of the 5 roles (seeded test accounts),
  confirm nav items match the matrix, confirm a direct Supabase REST
  call (or Postgres client) as a restricted role is rejected by RLS for
  at least one denied table (e.g. Finance Officer attempting to SELECT
  `case_notes`).

## 8. Open Dependency

This phase is blocked on the user providing a new Supabase project's
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
(their existing project hit its free-tier quota). Schema and RLS policy
SQL can be written and reviewed without it; applying the migration,
creating the first Admin account, and end-to-end testing require it.

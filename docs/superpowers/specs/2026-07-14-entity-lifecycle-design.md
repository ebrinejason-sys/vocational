# Track A — Entity lifecycle (edit / pause / delete)

**Date:** 2026-07-14  
**Status:** Approved in chat; awaiting implementation plan after spec review  
**Project:** SCM VTMS  

## Problem

Batch editing is unreliable in production. Trainers and trainees lack first-class edit / pause / delete flows. Operators need soft pause (operations frozen, row retained) and hard delete that is refused when dependents exist.

Tracks B (full Supabase domain persistence) and C (PDF auto-fill from paper templates) are **out of scope** for this spec; they follow after Track A ships.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Pause | Soft: status / flag change; row stays visible |
| Delete | Hard delete |
| Dependents | Block delete with an actionable reason (counts); no cascade |
| Approach | Status-based lifecycle + app preflight checks (Approach 1) |

## Goals

1. Batch update succeeds end-to-end (core fields + trade/trainer assignments) with clear errors.
2. Batches, trainees, and trainers can be edited, paused, resumed, and deleted from the UI by permitted roles.
3. Pause blocks the ops that matter (new enrollments / marking / sign-in / new assignments) without hiding historical data.
4. Delete refuses when linked rows exist; operators are told what to clean up.
5. Schema + migration + RLS stay aligned with `schema.sql` as source of truth.

## Non-goals

- Soft-delete / archive-only retention of deleted entities.
- Cascading deletes of attendance, case notes, or auth users (except profile cascade already owned by `auth.users`).
- PDF generation, applicant pipeline, charter/weekly reports (Track C).
- Wiring attendance / case notes / financials to Supabase (Track B), except dependency **counts** for delete guards may query those tables if they exist.

## Current baseline

- `batches.status`: `planned | active | completed | archived` (CHECK in `schema.sql`).
- `trainees.status`: `prospect | enrolled | graduated | dropped | alumni`.
- `profiles`: no `is_active`; trainers are profiles with role `trainer` (+ trades via `profile_trades`).
- Store already has async `updateBatch` / `updateTrainee`; batch UI edit on `BatchDetail`; no pause/delete actions.
- `batch_trades.trainer_id` is `ON DELETE SET NULL`; other tables often `REFERENCES batches(id)` **without** `ON DELETE CASCADE` for trainees → deleting a batch with trainees may fail at FK or leave orphans depending on column nullability. App-level block is still required for clear UX.

## Data model

### Batches

Add `paused` to the status CHECK:

```text
planned | active | paused | completed | archived
```

**Pause semantics**

- `paused`: no new trainee registration into this batch; edit/view of existing roster allowed; resume restores prior meaningful status (prefer previous non-paused value — see Resume below).
- UI Pause from `active` (and optionally `planned`) → `paused`.
- Resume from `paused` → `active` if `start_date <= today`, else `planned` (simple rule; no separate `previous_status` column in v1 unless we hit edge-case pain).

### Trainees

Add `paused` to the status CHECK:

```text
prospect | enrolled | paused | graduated | dropped | alumni
```

**Pause semantics**

- Excluded from default attendance “present” grids / bulk mark actions for “current” trainees.
- Cannot be moved to a new batch while paused (edit other fields OK).
- Resume → `enrolled` if they were training-era, else `prospect` (v1: resume always to `enrolled` when they have a batch, else `prospect`).

### Trainers (profiles)

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
```

**Pause semantics**

- `is_active = false`: block authenticated sessions for that user (client gate after profile load + refuse protected UI; optionally `auth.admin` disable later — v1 is app gate via profile).
- Cannot be newly selected in batch trade trainer dropdowns.
- Existing `batch_trades` rows remain until an editor reassigns.

## Permissions

Reuse existing matrices:

| Entity | Who may edit / pause / delete |
|---|---|
| Batches | Roles with `canEdit('batches')` |
| Trainees | Roles with `canEdit('trainees')` |
| Trainers | Same as Trainers page today (admin + directors who can invite trainers — align with current Trainers/AdminStaff gates; do not invent new roles) |

Delete of own admin account / last remaining admin: **blocked** in app.

## Delete dependency gates (block)

Preflight queries return counts; abort with message if any count > 0.

### Batch

Refuse if any of:

- `trainees` with `batch_id = id`
- `batch_trades` alone is **not** a blocker (owned by the batch; deleted with batch or cleared during delete after checks pass)
- Optional v1 extras if tables are used: `inventory_usage.batch_id`, `attendance` via trainees already covered by trainee count, `production_logs` / `sales` / `financial_transactions` with `batch_id`

**Minimum v1:** trainees count > 0 blocks. Also block if financial/sales/production/usage rows reference the batch (when those tables are readable).

After pass: delete `batch_trades` (or rely on `ON DELETE CASCADE` if present), then delete batch.

### Trainee

Refuse if any of:

- `attendance` rows
- `competency_assessments`
- `case_notes`
- `vulnerability_assessments` (if separate table still used)
- `inventory_usage.trainee_id`
- `starter_kits` / `alumni_follow_ups` / `job_placements`

Message lists which domains have rows.

### Trainer (profile)

Refuse if:

- Any `batch_trades.trainer_id = id`
- Target is the signed-in user
- Target is the only remaining `admin` with `is_active = true`

Hard delete trainer = delete `auth.users` row (cascades profile) via **service-role** serverless endpoint (same pattern as `api/invite-staff.ts`). Client never holds service key. App preflight runs first; endpoint re-checks then deletes.

## Edit: fix batch update

Diagnose and fix production failures in `updateBatch`:

1. Align frontend status options with DB CHECK (include `paused` after migration; never send unknown values).
2. `batch_trades` replace: delete-then-insert must respect RLS (`batch_trades_delete` / insert for coordinator/admin/trainer as already defined). Surface PostgREST errors via `friendlyError`.
3. Do not require every trade to pick a trainer if product decides optional — **current UI requires a trainer per trade**; keep that unless it is the failure mode; if trainers list is empty for paused trainers, filter inactive from selectors but allow keeping currently assigned paused trainer on edit.
4. After success, reload batch via `BATCH_SELECT` (already done).

## UI surfaces

| Surface | Actions |
|---|---|
| `BatchDetail` | Edit (fixed); Pause / Resume; Delete with confirm + dependency summary |
| `Batches` list | Status badge includes paused; optional row actions |
| `TraineeProfile` / `Trainees` | Edit modal or inline; Pause / Resume; Delete |
| `Trainers` | Edit name/phone/trades; Pause / Resume; Delete (via API) |

Confirms: destructive Delete requires typing batch/trainee name or a Confirm dialog with explicit dependency list.

## API / store

New/extended Zustand actions (async, write-then-state):

- `pauseBatch` / `resumeBatch` / `deleteBatch`
- `pauseTrainee` / `resumeTrainee` / `deleteTrainee` (deleteTrainee after preflight)
- Trainer lifecycle may live in page + `api/deactivate-staff.ts` / `api/delete-staff.ts` or a single `api/manage-staff.ts` — prefer thin endpoints: `pause` (is_active) can be profile UPDATE if RLS allows admin/director; delete needs service role.

**RLS note:** confirm whether non-admin can UPDATE `profiles.is_active`. If profiles UPDATE is admin-only today, pause/resume trainers is admin-only **or** we add a narrow policy / RPC. Spec default: **admin-only** for trainer pause/delete; directors keep invite if already allowed.

## Migration

File: `docs/migrations/2026-07-14-entity-lifecycle.sql` (adjust date if needed)

- Drop/replace CHECK on `batches.status` and `trainees.status` to include `paused`.
- Add `profiles.is_active`.
- Update `schema.sql` identically.
- No destructive data changes.

## Testing

- Unit: dependency-count helpers; status resume rules.
- Manual: pause batch → register trainee blocked; pause trainee → attendance exclusion; pause trainer → cannot assign on new trade row; delete paths show blockers then succeed on empty fixtures.
- `tsc -b` + vitest green; push unsticks Vercel.

## Sequencing after this track

1. Track B — remaining domains → Supabase  
2. Track C — PDF templates → auto-fill / generate  

## Open points deferred (not blockers)

- Persisting `previous_status` for richer resume.
- Auth Admin API “ban” for paused trainers (stronger than app gate).
- Soft-delete audit table.

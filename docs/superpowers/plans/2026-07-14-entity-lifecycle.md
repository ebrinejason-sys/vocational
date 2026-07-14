# Entity Lifecycle (Edit / Pause / Delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix batch editing and ship edit / soft-pause / hard-delete (with dependency blocks) for batches, trainees, and trainers.

**Architecture:** Status `paused` on batches/trainees; reuse existing `profiles.active` for trainer pause (no new column). Zustand async actions call Supabase with preflight count helpers; trainer hard-delete goes through a service-role Vercel API mirroring `api/invite-staff.ts`. UI Pause/Resume/Delete on BatchDetail, TraineeProfile/Trainees, and Trainers; enrollment/attendance/assignment gates enforce pause.

**Tech Stack:** Postgres/Supabase RLS, React + Zustand, Vitest, Vercel serverless (`api/`).

**Spec:** `docs/superpowers/specs/2026-07-14-entity-lifecycle-design.md`

## Global Constraints

- Soft pause only — rows stay visible; no soft-delete.
- Hard delete — refuse when dependents exist; never cascade trainee/batch history.
- Pause trainers = `profiles.active = false` (column already exists; **do not** add `is_active`).
- Client never holds `SUPABASE_SERVICE_ROLE_KEY`.
- `schema.sql` + `docs/migrations/` stay in sync; human runs migration in SQL Editor.
- Trainer pause/delete: **admin-only** (matches `profiles_update` / `profiles_delete` RLS). Directors may still invite trainers.
- Expand `batches_delete` / `trainees_delete` RLS to match update roles so `canEdit('batches'|'trainees')` can delete after preflight.
- Tracks B/C (full domain persistence, PDF autofill) are out of scope.

## File map

| File | Responsibility |
|---|---|
| `docs/migrations/2026-07-14-entity-lifecycle.sql` | Live CHECK + RLS changes |
| `schema.sql` | Fresh-install source of truth |
| `vtms-frontend/src/types/index.ts` | `paused` on BatchStatus / TraineeStatus |
| `vtms-frontend/src/lib/lifecycle.ts` | Resume rules + dependency message formatting |
| `vtms-frontend/src/lib/lifecycle.test.ts` | Unit tests for those helpers |
| `vtms-frontend/src/lib/deleteGuards.ts` | Supabase count preflights |
| `vtms-frontend/src/store/index.ts` | pause/resume/delete + batch update hardening |
| `api/delete-staff.ts` | Service-role auth user delete |
| `vtms-frontend/src/pages/BatchDetail.tsx` | Edit fix + lifecycle buttons |
| `vtms-frontend/src/pages/Batches.tsx` | Paused badge; block create into paused later if needed |
| `vtms-frontend/src/pages/Trainees.tsx` | Edit + lifecycle; block register into paused batch |
| `vtms-frontend/src/pages/TraineeProfile.tsx` | Edit + lifecycle |
| `vtms-frontend/src/pages/Trainers.tsx` | Edit/pause/resume/delete |
| `vtms-frontend/src/pages/Attendance.tsx` | Exclude `paused` trainees from mark grid |
| `docs/CURSOR_HANDOFF.md` | Note Track A shipped |

---

### Task 1: Migration + types

**Files:**
- Create: `docs/migrations/2026-07-14-entity-lifecycle.sql`
- Modify: `schema.sql` (batches CHECK, trainees CHECK, `batches_delete` / `trainees_delete` policies)
- Modify: `vtms-frontend/src/types/index.ts`
- Modify: `docs/superpowers/specs/2026-07-14-entity-lifecycle-design.md` (one-line note: use `profiles.active`, not `is_active`)

**Interfaces:**
- Produces: `BatchStatus` and `TraineeStatus` include `'paused'`

- [ ] **Step 1: Write migration SQL**

```sql
-- docs/migrations/2026-07-14-entity-lifecycle.sql
-- Run once in Supabase SQL Editor AFTER deploying client that sends status=paused.

ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE batches
  ADD CONSTRAINT batches_status_check
  CHECK (status IN ('planned','active','paused','completed','archived'));

ALTER TABLE trainees DROP CONSTRAINT IF EXISTS trainees_status_check;
ALTER TABLE trainees
  ADD CONSTRAINT trainees_status_check
  CHECK (status IN ('prospect','enrolled','paused','graduated','dropped','alumni'));

-- profiles.active already exists — no column add.

ALTER POLICY batches_delete ON batches
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

ALTER POLICY trainees_delete ON trainees
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
```

If `DROP CONSTRAINT` fails because the live name differs, discover with:

```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.batches'::regclass AND contype = 'c';
```

- [ ] **Step 2: Mirror in `schema.sql`**

Update the `CHECK` clauses on `batches` and `trainees`, and change `batches_delete` / `trainees_delete` `USING` arrays to match Step 1. Do **not** add `is_active`.

- [ ] **Step 3: Update TypeScript status unions**

In `vtms-frontend/src/types/index.ts`:

```ts
export type BatchStatus = 'planned' | 'active' | 'paused' | 'completed' | 'archived';
export type TraineeStatus = 'prospect' | 'enrolled' | 'paused' | 'graduated' | 'dropped' | 'alumni';
```

- [ ] **Step 4: Spec amend note**

At top of design spec under Trainers, add: “Implementation uses existing `profiles.active` instead of adding `is_active`.”

- [ ] **Step 5: Commit**

```bash
git add docs/migrations/2026-07-14-entity-lifecycle.sql schema.sql \
  vtms-frontend/src/types/index.ts \
  docs/superpowers/specs/2026-07-14-entity-lifecycle-design.md
git commit -m "feat: add paused statuses and expand batch/trainee delete RLS"
```

---

### Task 2: Lifecycle helpers + delete guards (TDD)

**Files:**
- Create: `vtms-frontend/src/lib/lifecycle.ts`
- Create: `vtms-frontend/src/lib/lifecycle.test.ts`
- Create: `vtms-frontend/src/lib/deleteGuards.ts`
- Create: `vtms-frontend/src/lib/deleteGuards.test.ts` (message formatting only; count functions stay thin wrappers)

**Interfaces:**
- Produces:
  - `resumeBatchStatus(startDate: string, today?: string): 'active' | 'planned'`
  - `resumeTraineeStatus(hasBatch: boolean): 'enrolled' | 'prospect'`
  - `formatDependencyBlock(entityLabel: string, counts: Record<string, number>): string`
  - `countBatchDependencies(batchId: string): Promise<Record<string, number>>`
  - `countTraineeDependencies(traineeId: string): Promise<Record<string, number>>`
  - `countTrainerDependencies(profileId: string): Promise<Record<string, number>>`
  - `assertNoDependencies(entityLabel: string, counts: Record<string, number>): void` — throws `Error` with formatted message if any count > 0

- [ ] **Step 1: Write failing tests**

```ts
// vtms-frontend/src/lib/lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import { resumeBatchStatus, resumeTraineeStatus, formatDependencyBlock } from './lifecycle';

describe('resumeBatchStatus', () => {
  it('returns active when start_date is today or earlier', () => {
    expect(resumeBatchStatus('2026-01-01', '2026-07-14')).toBe('active');
    expect(resumeBatchStatus('2026-07-14', '2026-07-14')).toBe('active');
  });
  it('returns planned when start_date is in the future', () => {
    expect(resumeBatchStatus('2026-12-01', '2026-07-14')).toBe('planned');
  });
});

describe('resumeTraineeStatus', () => {
  it('returns enrolled when trainee has a batch', () => {
    expect(resumeTraineeStatus(true)).toBe('enrolled');
  });
  it('returns prospect when no batch', () => {
    expect(resumeTraineeStatus(false)).toBe('prospect');
  });
});

describe('formatDependencyBlock', () => {
  it('lists only positive counts', () => {
    const msg = formatDependencyBlock('Batch', { trainees: 3, inventory_usage: 0, sales: 1 });
    expect(msg).toContain('Cannot delete Batch');
    expect(msg).toContain('trainees: 3');
    expect(msg).toContain('sales: 1');
    expect(msg).not.toContain('inventory_usage');
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `cd vtms-frontend && npx vitest run src/lib/lifecycle.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement helpers**

```ts
// vtms-frontend/src/lib/lifecycle.ts
export function resumeBatchStatus(startDate: string, today = new Date().toISOString().slice(0, 10)): 'active' | 'planned' {
  return startDate <= today ? 'active' : 'planned';
}

export function resumeTraineeStatus(hasBatch: boolean): 'enrolled' | 'prospect' {
  return hasBatch ? 'enrolled' : 'prospect';
}

export function formatDependencyBlock(entityLabel: string, counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}: ${n}`);
  return `Cannot delete ${entityLabel} while linked records exist (${parts.join(', ')}). Remove or reassign them first.`;
}

export function assertNoDependencies(entityLabel: string, counts: Record<string, number>): void {
  if (Object.values(counts).some((n) => n > 0)) {
    throw new Error(formatDependencyBlock(entityLabel, counts));
  }
}
```

- [ ] **Step 4: Implement deleteGuards**

```ts
// vtms-frontend/src/lib/deleteGuards.ts
import { supabase } from './supabase';

async function countEq(table: string, column: string, id: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, id);
  if (error) {
    // Table may be empty/unreadable for role — treat as 0 only when "does not exist";
    // otherwise rethrow so we don't silently delete.
    throw error;
  }
  return count ?? 0;
}

/** Soft count: if RLS/table missing returns 0 and warns — use for optional domains. */
async function countEqSoft(table: string, column: string, id: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, id);
  if (error) {
    console.warn(`deleteGuards: ${table} count skipped`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function countBatchDependencies(batchId: string): Promise<Record<string, number>> {
  const [trainees, inventory_usage, production_logs, sales, financial_transactions] = await Promise.all([
    countEq('trainees', 'batch_id', batchId),
    countEqSoft('inventory_usage', 'batch_id', batchId),
    countEqSoft('production_logs', 'batch_id', batchId),
    countEqSoft('sales', 'batch_id', batchId),
    countEqSoft('financial_transactions', 'batch_id', batchId),
  ]);
  return { trainees, inventory_usage, production_logs, sales, financial_transactions };
}

export async function countTraineeDependencies(traineeId: string): Promise<Record<string, number>> {
  const [attendance, competency_assessments, case_notes, inventory_usage, starter_kits, alumni_follow_ups, job_placements] =
    await Promise.all([
      countEqSoft('attendance', 'trainee_id', traineeId),
      countEqSoft('competency_assessments', 'trainee_id', traineeId),
      countEqSoft('case_notes', 'trainee_id', traineeId),
      countEqSoft('inventory_usage', 'trainee_id', traineeId),
      countEqSoft('starter_kits', 'trainee_id', traineeId),
      countEqSoft('alumni_follow_ups', 'trainee_id', traineeId),
      countEqSoft('job_placements', 'trainee_id', traineeId),
    ]);
  return { attendance, competency_assessments, case_notes, inventory_usage, starter_kits, alumni_follow_ups, job_placements };
}

export async function countTrainerDependencies(profileId: string): Promise<Record<string, number>> {
  const batch_assignments = await countEq('batch_trades', 'trainer_id', profileId);
  return { batch_assignments };
}
```

Note: live DB table for attendance may be `attendance` (schema) — confirm name matches. Competency table name in schema is `competency_assessments`.

- [ ] **Step 5: Run tests — expect pass**

Run: `cd vtms-frontend && npx vitest run src/lib/lifecycle.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add vtms-frontend/src/lib/lifecycle.ts vtms-frontend/src/lib/lifecycle.test.ts \
  vtms-frontend/src/lib/deleteGuards.ts
git commit -m "feat: lifecycle resume helpers and delete dependency guards"
```

---

### Task 3: Store — batches pause/resume/delete + harden updateBatch

**Files:**
- Modify: `vtms-frontend/src/store/index.ts`

**Interfaces:**
- Consumes: `resumeBatchStatus`, `countBatchDependencies`, `assertNoDependencies`
- Produces on `VTMSState`:
  - `pauseBatch: (id: string) => Promise<void>`
  - `resumeBatch: (id: string) => Promise<void>`
  - `deleteBatch: (id: string) => Promise<void>`

- [ ] **Step 1: Extend `VTMSState` interface** with the three methods above.

- [ ] **Step 2: Harden `updateBatch`**

Keep delete-then-insert for trades, but if insert fails after delete, do not leave the batch tradeless without surfacing the error (already throws). Additionally:

1. Only call trade replace when `updates.trades` is defined.
2. After core update, if `error`, throw before touching trades.
3. Ensure status values are cast from `BatchStatus` only (UI task adds `paused` option).

Optional improvement if flaky: wrap trade replace in try/catch and rethrow with `friendlyError` message prefix `Failed to update batch trades:`.

- [ ] **Step 3: Implement pause/resume/delete**

```ts
pauseBatch: async (id) => {
  const { error } = await supabase.from('batches').update({ status: 'paused' }).eq('id', id);
  if (error) throw error;
  set((s) => ({
    batches: s.batches.map((b) => (b.id === id ? { ...b, status: 'paused' as const } : b)),
  }));
},

resumeBatch: async (id) => {
  const current = get().batches.find((b) => b.id === id);
  if (!current) throw new Error(`Batch ${id} not found`);
  const status = resumeBatchStatus(current.startDate);
  const { error } = await supabase.from('batches').update({ status }).eq('id', id);
  if (error) throw error;
  set((s) => ({
    batches: s.batches.map((b) => (b.id === id ? { ...b, status } : b)),
  }));
},

deleteBatch: async (id) => {
  const current = get().batches.find((b) => b.id === id);
  if (!current) throw new Error(`Batch ${id} not found`);
  const counts = await countBatchDependencies(id);
  assertNoDependencies(current.name, counts);
  // batch_trades cascade OR explicit delete first
  const { error: tradesErr } = await supabase.from('batch_trades').delete().eq('batch_id', id);
  if (tradesErr) throw tradesErr;
  const { error } = await supabase.from('batches').delete().eq('id', id);
  if (error) throw error;
  set((s) => ({
    batches: s.batches.filter((b) => b.id !== id),
    activeBatchId: s.activeBatchId === id ? (s.batches.find((b) => b.id !== id)?.id ?? '') : s.activeBatchId,
  }));
},
```

Import helpers from `../lib/lifecycle` and `../lib/deleteGuards`.

- [ ] **Step 4: Typecheck**

Run: `cd vtms-frontend && npx tsc -b --pretty false`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add vtms-frontend/src/store/index.ts
git commit -m "feat: store pause/resume/delete for batches"
```

---

### Task 4: Store — trainees pause/resume/delete

**Files:**
- Modify: `vtms-frontend/src/store/index.ts`

**Interfaces:**
- Consumes: `resumeTraineeStatus`, `countTraineeDependencies`, `assertNoDependencies`
- Produces:
  - `pauseTrainee: (id: string) => Promise<void>`
  - `resumeTrainee: (id: string) => Promise<void>`
  - `deleteTrainee: (id: string) => Promise<void>`

- [ ] **Step 1: Add actions**

```ts
pauseTrainee: async (id) => {
  const { data, error } = await supabase.from('trainees').update({ status: 'paused' }).eq('id', id).select().single();
  if (error) throw error;
  const trainee = traineeFromRow(data as TraineeRow);
  set((s) => ({ trainees: s.trainees.map((t) => (t.id === id ? trainee : t)) }));
},

resumeTrainee: async (id) => {
  const current = get().trainees.find((t) => t.id === id);
  if (!current) throw new Error(`Trainee ${id} not found`);
  const status = resumeTraineeStatus(Boolean(current.batchId?.trim()));
  const { data, error } = await supabase.from('trainees').update({ status }).eq('id', id).select().single();
  if (error) throw error;
  const trainee = traineeFromRow(data as TraineeRow);
  set((s) => ({ trainees: s.trainees.map((t) => (t.id === id ? trainee : t)) }));
},

deleteTrainee: async (id) => {
  const current = get().trainees.find((t) => t.id === id);
  if (!current) throw new Error(`Trainee ${id} not found`);
  const counts = await countTraineeDependencies(id);
  assertNoDependencies(`${current.firstName} ${current.lastName}`, counts);
  const { error } = await supabase.from('trainees').delete().eq('id', id);
  if (error) throw error;
  set((s) => ({ trainees: s.trainees.filter((t) => t.id !== id) }));
},
```

- [ ] **Step 2: Gate `addTrainee`**

At start of `addTrainee`, after resolving batch:

```ts
if (batch.status === 'paused') {
  throw new Error('This batch is paused. Resume it before registering new trainees.');
}
if (batch.status === 'completed' || batch.status === 'archived') {
  throw new Error('Cannot register trainees into a completed or archived batch.');
}
```

- [ ] **Step 3: Gate `updateTrainee` batch moves while paused**

```ts
if (current.status === 'paused' && updates.batchId && updates.batchId !== current.batchId) {
  throw new Error('Resume this trainee before moving them to another batch.');
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd vtms-frontend && npx tsc -b --pretty false
git add vtms-frontend/src/store/index.ts
git commit -m "feat: store pause/resume/delete for trainees"
```

---

### Task 5: Batch UI — edit status + pause/resume/delete

**Files:**
- Modify: `vtms-frontend/src/pages/BatchDetail.tsx`
- Modify: `vtms-frontend/src/pages/Batches.tsx` (`STATUS_CONFIG` add paused)

**Interfaces:**
- Consumes: `pauseBatch`, `resumeBatch`, `deleteBatch`, `updateBatch`, `canEdit`

- [ ] **Step 1: Add `paused` to status badge colors and edit `<select>`**

In edit modal status options: `planned`, `active`, `paused`, `completed`, `archived`.

In header badge, treat `paused` as amber (`bg-amber-100 text-amber-800`).

In `Batches.tsx` `STATUS_CONFIG`:

```ts
paused: { label: 'Paused', color: 'bg-amber-100 text-amber-800', icon: PauseCircle },
```

(Import `PauseCircle` from `lucide-react`.)

- [ ] **Step 2: Lifecycle action buttons** (when `mayEdit`)

Near Edit button:

- If status is `active` or `planned`: **Pause** → `await pauseBatch(id)`
- If `paused`: **Resume** → `await resumeBatch(id)`
- **Delete** → open confirm modal listing dependency preview:

```ts
const counts = await countBatchDependencies(batch.id);
const blocked = Object.values(counts).some((n) => n > 0);
```

Show `formatDependencyBlock` if blocked (Disable confirm). If clear, confirm then `await deleteBatch` and `navigate('/batches')`.

Use `friendlyError` for failures.

- [ ] **Step 3: Trainer dropdown filter**

When listing trainers for assignment, keep `.eq('active', true)` **OR** include the currently assigned trainer id even if inactive:

```ts
const trainerOptions = trainers.filter(
  (t) => t.active || Object.values(editForm.trainersByTrade).includes(t.id)
);
```

- [ ] **Step 4: Manual smoke notes in commit body; commit**

```bash
git add vtms-frontend/src/pages/BatchDetail.tsx vtms-frontend/src/pages/Batches.tsx
git commit -m "feat: batch pause/resume/delete UI and paused status badge"
```

---

### Task 6: Trainee UI — edit + lifecycle

**Files:**
- Modify: `vtms-frontend/src/pages/TraineeProfile.tsx`
- Modify: `vtms-frontend/src/pages/Trainees.tsx` (STATUS_COLORS + register gate)

**Interfaces:**
- Consumes: `updateTrainee`, `pauseTrainee`, `resumeTrainee`, `deleteTrainee`, `canEdit('trainees')`

- [ ] **Step 1: Add `paused` to `STATUS_COLORS`** in Trainees + TraineeProfile (`bg-amber-100 text-amber-800`).

- [ ] **Step 2: On TraineeProfile, when `mayEdit`**

Buttons: Edit (modal), Pause/Resume, Delete.

**Edit modal fields (minimum):** firstName, lastName, phone, address, emergency contacts, batchId (disabled if status===`paused`), trade (options from selected batch), status select (`prospect|enrolled|paused|graduated|dropped|alumni`), dateOfBirth.

Submit: `await updateTrainee(id, { ... })` with `friendlyError`.

**Delete:** same dependency preview pattern as batches using `countTraineeDependencies`, then `deleteTrainee`, navigate to `/trainees`.

- [ ] **Step 3: Block registration UI into paused batches**

In `RegistrationForm` / Trainees register batch `<select>`, disable or filter `batches.filter(b => b.status !== 'paused' && b.status !== 'completed' && b.status !== 'archived')`. If user still picks paused (stale), store throw surfaces via `friendlyError`.

- [ ] **Step 4: Commit**

```bash
git add vtms-frontend/src/pages/TraineeProfile.tsx vtms-frontend/src/pages/Trainees.tsx
git commit -m "feat: trainee edit, pause/resume, and delete with guards"
```

---

### Task 7: Attendance + trainer assignment gates

**Files:**
- Modify: `vtms-frontend/src/pages/Attendance.tsx`
- Modify: `vtms-frontend/src/pages/Batches.tsx` and `BatchDetail.tsx` trainer loaders (already mostly `active=true`)

- [ ] **Step 1: Attendance roster filter**

Where trainees for a batch are listed for marking, exclude paused:

```ts
const markable = batchTrainees.filter(
  (t) => t.status === 'enrolled' || t.status === 'prospect'
);
```

(Do not include `paused`, `dropped`, `graduated`, `alumni`.)

- [ ] **Step 2: Commit**

```bash
git add vtms-frontend/src/pages/Attendance.tsx
git commit -m "fix: exclude paused trainees from attendance marking"
```

---

### Task 8: Trainers — edit, pause/resume via `active`, delete API

**Files:**
- Create: `api/delete-staff.ts`
- Modify: `vtms-frontend/src/pages/Trainers.tsx`
- Optional: `vtms-frontend/src/pages/AdminStaff.tsx` — Pause/Resume/Delete for completeness (admin); at minimum Trainers page

**Interfaces:**
- Produces: `POST /api/delete-staff` body `{ userId: string }`, auth Bearer session
- Pause/Resume: `supabase.from('profiles').update({ active: bool })` — **admin only** (RLS)

- [ ] **Step 1: Create `api/delete-staff.ts`**

Mirror auth pattern from `api/invite-staff.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', callerData.user.id)
    .single();
  if (!callerProfile?.active || callerProfile.role !== 'admin') {
    res.status(403).json({ error: 'Only admins can delete staff' });
    return;
  }

  const { userId } = (req.body ?? {}) as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  if (userId === callerData.user.id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }

  const { data: target } = await admin.from('profiles').select('role, active').eq('id', userId).single();
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { count: batchAssignments } = await admin
    .from('batch_trades')
    .select('*', { count: 'exact', head: true })
    .eq('trainer_id', userId);
  if ((batchAssignments ?? 0) > 0) {
    res.status(409).json({
      error: `Cannot delete: still assigned on ${batchAssignments} batch trade(s). Reassign first.`,
    });
    return;
  }

  if (target.role === 'admin') {
    const { count: otherAdmins } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('active', true)
      .neq('id', userId);
    if ((otherAdmins ?? 0) < 1) {
      res.status(409).json({ error: 'Cannot delete the last active admin' });
      return;
    }
  }

  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  if (delError) {
    res.status(500).json({ error: delError.message });
    return;
  }
  res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Trainers page UI**

- Show Pause / Resume for **admin** only (`profile.role === 'admin'`):  
  `await supabase.from('profiles').update({ active: false|true }).eq('id', id)` then refresh list.
- Edit modal (admin or director — directors already edit `profile_trades`): fullName (admin via profiles update), trades replace like invite flow.
  - Directors: only `profile_trades` replace (existing RLS).
  - Admins: can also `profiles.update({ full_name })`.
- Delete (admin): client runs `countTrainerDependencies`; if clear, `fetch('/api/delete-staff', { method:'POST', headers:{ Authorization: `Bearer ${session.access_token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ userId }) })`.

`RouteGuards` already blocks `!profile.active` — paused trainers cannot use the app.

- [ ] **Step 3: Typecheck API locally if project includes it; commit**

```bash
git add api/delete-staff.ts vtms-frontend/src/pages/Trainers.tsx
git commit -m "feat: trainer pause via active flag and hard delete API"
```

---

### Task 9: Verify + handoff

**Files:**
- Modify: `docs/CURSOR_HANDOFF.md` (Track A done; next Track B)

- [ ] **Step 1: Full verify**

```bash
cd vtms-frontend && npx tsc -b --pretty false && npm test && npm run build
```

Expected: typecheck clean, tests pass, vite build succeeds.

- [ ] **Step 2: Update handoff** — note entity lifecycle shipped; human must run `docs/migrations/2026-07-14-entity-lifecycle.sql` before pause status writes succeed in prod.

- [ ] **Step 3: Commit handoff + push when user asks**

```bash
git add docs/CURSOR_HANDOFF.md
git commit -m "docs: note entity lifecycle Track A complete"
```

- [ ] **Step 4: Manual checklist (human or agent with browser)**

1. Run migration in Supabase SQL Editor.  
2. Edit batch trades/status — succeeds.  
3. Pause batch → register trainee fails with clear message.  
4. Pause trainee → absent from attendance list.  
5. Pause trainer → cannot sign in (inactive screen); cannot pick in new assignment dropdown.  
6. Delete empty batch OK; delete batch with trainees blocked with counts.  
7. Delete trainer with batch_trades blocked; after reassignment, delete OK (admin).

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| `paused` on batches/trainees CHECK | 1 |
| Trainer pause via profile flag | 8 (uses `active`) |
| Fix batch edit | 3 + 5 |
| pause/resume/delete store batches | 3 |
| pause/resume/delete store trainees | 4 |
| Dependency block messages | 2, 5, 6, 8 |
| Batch UI | 5 |
| Trainee UI | 6 |
| Attendance / enrollment gates | 4, 6, 7 |
| Trainer UI + service-role delete | 8 |
| Expand delete RLS | 1 |
| Migration + schema.sql | 1 |
| Tests for resume helpers | 2 |

## Spec amendments applied in plan

- Use **`profiles.active`**, not a new `is_active` column (already wired in AuthContext / RouteGuards / invite-staff).
- Expand `batches_delete` / `trainees_delete` beyond admin so UI matches `canEdit`.

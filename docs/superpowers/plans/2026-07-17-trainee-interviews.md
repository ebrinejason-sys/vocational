# Trainee Interviews & Motivation Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the two-step applicant flow: register as prospect with motivation/availability fields, interview with full VST scoresheet, then manual Enroll/Reject.

**Architecture:** Motivation fields live in `trainees.vulnerability_assessment` JSONB. Interviews are rows in `trainee_interviews` (responses + scores JSONB). Saving Enroll/Reject updates both the interview `decision` and `trainees.status` when decision is `selected`.

**Tech Stack:** React + TypeScript (vtms-frontend), Zustand store, Supabase Postgres + RLS.

## Global Constraints

- Match existing teal / Fraunces / card patterns; no new design system.
- `schema.sql` stays the fresh-install source of truth; live changes go in `docs/migrations/`.
- Do not commit unless the user asks.
- Spec: `docs/superpowers/specs/2026-07-17-trainee-interviews-design.md`.

---

## Already complete (do not redo)

These exist and match the spec — verify only if a later task fails:

| Area | Location |
|------|----------|
| Types (`VulnerabilityAssessment` extras, `TraineeInterview`, scores/responses) | `vtms-frontend/src/types/index.ts` |
| Store load/CRUD + `computeInterviewTotal` | `vtms-frontend/src/store/index.ts` |
| Motivation & Availability section on registration UI | `vtms-frontend/src/pages/Trainees.tsx` |
| Interviews page + scoresheet (Sections B–G) | `vtms-frontend/src/pages/Interviews.tsx` |
| Route + nav | `vtms-frontend/src/App.tsx`, `Layout.tsx` |
| Profile cards | `vtms-frontend/src/pages/TraineeProfile.tsx` |
| Migration + schema + delete guard | `docs/migrations/2026-07-17-trainee-interviews.sql`, `schema.sql`, `deleteGuards.ts` |

---

### Task 1: Register as prospect

**Files:**
- Modify: `vtms-frontend/src/pages/Trainees.tsx` (submit payload + success copy)

**Interfaces:**
- Consumes: `addTrainee({ ..., status })`
- Produces: New trainees created with `status: 'prospect'`

- [ ] **Step 1: Change registration status**

In `RegistrationForm` `handleSubmit`, change:

```ts
status: 'enrolled',
```

to:

```ts
status: 'prospect',
```

- [ ] **Step 2: Update success copy**

Change the success message so staff know the person is a prospect awaiting interview, e.g.:

```tsx
<p className="text-lg font-bold text-gray-900">Applicant Registered</p>
<p className="text-sm text-gray-500 mt-1">
  {form.firstName} {form.lastName} was saved as a prospect. Complete their interview on the Interviews page to enroll.
</p>
```

- [ ] **Step 3: Manual check**

Open Register → submit a test applicant → list/profile shows status **Prospect**, not Enrolled.

---

### Task 2: Enroll / Reject sync trainee status

**Files:**
- Modify: `vtms-frontend/src/pages/Interviews.tsx` (`handleSave` + action buttons)

**Interfaces:**
- Consumes: `addTraineeInterview`, `updateTraineeInterview`, `updateTrainee(id, { status })`
- Produces: On save with `decision === 'selected'`, trainee becomes `enrolled`; Reject sets `decision: 'rejected'` and leaves trainee as `prospect`

- [ ] **Step 1: Pull `updateTrainee` from the store**

```ts
const {
  batches,
  trainees,
  traineeInterviews,
  activeBatchId,
  addTraineeInterview,
  updateTraineeInterview,
  deleteTraineeInterview,
  updateTrainee,
} = useStore();
```

- [ ] **Step 2: Extract shared persist helper**

Replace the body of `handleSave` with a helper that accepts an optional decision override:

```ts
async function persistInterview(decisionOverride?: InterviewDecision) {
  if (!mayEdit) return;
  setSubmitError(null);
  if (!form.traineeId) {
    setSubmitError('Select an applicant.');
    return;
  }
  const trainee = traineeMap[form.traineeId];
  if (!trainee) {
    setSubmitError('Selected trainee not found.');
    return;
  }
  const decision = decisionOverride ?? form.decision;
  setSaving(true);
  try {
    const payload = {
      traineeId: form.traineeId,
      batchId: form.batchId || trainee.batchId,
      interviewDate: form.interviewDate,
      responses: form.responses,
      scores: form.scores,
      panelNotes: form.panelNotes.trim(),
      panelistNames: form.panelistNames.trim(),
      decision,
      createdBy: profile?.id ?? null,
      totalScore,
    };
    if (form.id) {
      await updateTraineeInterview(form.id, payload);
    } else {
      await addTraineeInterview(payload);
    }
    if (decision === 'selected' && trainee.status === 'prospect') {
      await updateTrainee(trainee.id, { status: 'enrolled' });
    }
    setShowForm(false);
    setForm(blankForm(activeBatchId));
  } catch (err) {
    setSubmitError(friendlyError(err, 'Could not save interview.'));
  } finally {
    setSaving(false);
  }
}

async function handleSave(e: React.FormEvent) {
  e.preventDefault();
  await persistInterview();
}
```

- [ ] **Step 3: Add Enroll and Reject buttons next to Save**

In the form actions row (after Cancel, with Save), add:

```tsx
{mayEdit && (
  <>
    <button
      type="button"
      disabled={saving}
      onClick={() => persistInterview('rejected')}
      className="px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60"
    >
      Reject
    </button>
    <button
      type="button"
      disabled={saving}
      onClick={() => persistInterview('selected')}
      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
    >
      Enroll
    </button>
    <button
      type="submit"
      disabled={saving}
      className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
    >
      <Save className="w-4 h-4" />
      {saving ? 'Saving…' : form.id ? 'Update Scoresheet' : 'Save Scoresheet'}
    </button>
  </>
)}
```

Keep the Decision dropdown for `pending` / `waitlist` / manual overrides; Enroll/Reject are shortcuts that also persist.

- [ ] **Step 4: Prefer prospects in the trainee picker**

When opening a new interview, list prospects first:

```ts
const selectableTrainees = useMemo(() => {
  const batchId = form.batchId || activeBatchId;
  return trainees
    .filter((t) => (!batchId || t.batchId === batchId) && t.status !== 'dropped')
    .sort((a, b) => {
      const rank = (s: string) => (s === 'prospect' ? 0 : 1);
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
}, [trainees, form.batchId, activeBatchId]);
```

In the `<option>` label, append ` (prospect)` when `t.status === 'prospect'`.

- [ ] **Step 5: Manual check**

1. Prospect exists → New Interview → fill scores → **Enroll** → trainee status becomes Enrolled, decision Selected.  
2. Another prospect → **Reject** → decision Rejected, status still Prospect.  
3. **Save** with Pending leaves status unchanged.

---

### Task 3: Ensure vulnerability JSON defaults include new fields

**Files:**
- Modify: `vtms-frontend/src/store/index.ts` (defaults / `normalizeVulnerability` if present)
- Verify: `vtms-frontend/src/types/index.ts`

**Interfaces:**
- Consumes: JSONB rows that may lack new keys
- Produces: `whyNeedTraining: ''`, `canAttendDailySixMonths: null`, `reasonForTrade: ''` when missing

- [ ] **Step 1: Confirm defaults**

Ensure whatever maps `vulnerability_assessment` from Supabase (e.g. `emptyVulnerability` / `normalizeVulnerabilityAssessment`) includes:

```ts
whyNeedTraining: raw?.whyNeedTraining ?? '',
canAttendDailySixMonths:
  raw?.canAttendDailySixMonths === true || raw?.canAttendDailySixMonths === false
    ? raw.canAttendDailySixMonths
    : null,
reasonForTrade: raw?.reasonForTrade ?? '',
```

- [ ] **Step 2: Smoke typecheck**

Run from `vtms-frontend`:

```bash
npx tsc --noEmit
```

Expected: exit 0 (or only pre-existing unrelated errors).

---

### Task 4: Migration reminder (ops, not code)

**Files:** none (document only)

- [ ] **Step 1: Confirm remote table**

If Supabase project does not yet have `trainee_interviews`, run `docs/migrations/2026-07-17-trainee-interviews.sql` in the SQL Editor once.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Motivation fields after vulnerability | Already done (Task 3 verifies persistence) |
| Register as prospect | Task 1 |
| Full interview form + scoresheet | Already done |
| Manual Enroll / Reject | Task 2 |
| Profile display | Already done |
| Migration / schema | Already done + Task 4 |

## Plan self-review

- No placeholders; remaining work is concrete file edits.
- Types/names match existing `InterviewDecision`, `updateTrainee`, `persist` patterns.
- Auto shortlist / waitlist ranking correctly omitted (non-goal).

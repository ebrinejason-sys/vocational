# Trainee motivation fields & interview scoresheet — Design

**Date:** 2026-07-17  
**Status:** Approved (two-step flow A; full Word-doc form + scoresheet; manual Enroll/Reject)

## Problem

Registration captures vulnerability but not motivation/availability. There is no staff workflow to screen applicants with the VST Trainee Screening & Assessment Tool before enrollment. Registration currently enrolls immediately, skipping selection.

## Goals

1. After vulnerability asking on registration, capture:
   - Why they need to be part of the training
   - Ability to attend daily for 6 months (Yes/No)
   - Reason for selecting trade
2. Register applicants as **`prospect`** (not enrolled).
3. Add an **Interviews** page with the full Word-doc form (Sections B–G; A prefilled) plus scoring matrix (max 40).
4. Staff **manually Enroll or Reject** from the scoresheet (decision drives trainee status).

## Non-goals (this pass)

- Auto top-N shortlist / waitlist ranking UI
- Duplicate applicant detection across batches
- Separate public applicant portal
- Moving vulnerability fields off `trainees` into a restricted table

## Data model

### Registration fields (on trainee)

Stored inside existing `trainees.vulnerability_assessment` JSONB (no new columns):

| Field | Type | Notes |
|-------|------|--------|
| `whyNeedTraining` | string | Required at register |
| `canAttendDailySixMonths` | boolean \| null | Required Yes/No at register |
| `reasonForTrade` | string | Required at register |

### `trainee_interviews`

| Column | Purpose |
|--------|---------|
| `trainee_id`, `batch_id` | Link to applicant + cohort |
| `interview_date` | Assessment date |
| `responses` (JSONB) | Sections B–F answers + panel observation notes |
| `scores` (JSONB) | Section G criteria scores |
| `total_score` | Computed 0–40 (includes risk-flag deductions) |
| `panel_notes`, `panelist_names` | Panel footer |
| `decision` | `pending` \| `selected` \| `waitlist` \| `rejected` |
| `created_by` | Interviewer profile |

Scoring ranges (from Word sheet): Vulnerability 0–10, Motivation 0–6, Availability 0–6, Age 0–4, Faith 0–4, Conduct 0–5, Risk flags −5–0. Max 40.

## Status flow

```
Register → status = prospect
Interview Save → decision may stay pending / waitlist (status unchanged)
Enroll (decision = selected) → trainee.status = enrolled
Reject (decision = rejected) → trainee.status stays prospect (decision records rejection)
```

## Auth / RLS

Same edit circle as trainee screening work: `trainer`, `case_worker`, `project_coordinator`, `director`, `admin` for SELECT/INSERT/UPDATE. DELETE: `project_coordinator`, `director`, `admin`.

Nav/route gated via existing `trainees` domain permissions.

## UI

1. **Registration** — Motivation & Availability section immediately after Vulnerability; submit as `prospect`.
2. **`/interviews`** — List scoresheets; New/Edit form: header (trainee, batch, date) → livelihood → motivation (prefills from registration) → vulnerability checklist → faith → panel observations → scoring matrix → panel notes + decision; Save / Enroll / Reject.
3. **Trainee profile** — Motivation & Availability card; list of interview scoresheets with link to Interviews.

## Migration

- Live SQL: `docs/migrations/2026-07-17-trainee-interviews.sql`
- Fresh install: `schema.sql` includes `trainee_interviews` + RLS

## Source form

Word doc: *Vocational Skills Training (VST) Trainee Screening & Assessment Tool* (Batch 4 / Khor Wolliang template).

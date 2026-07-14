# Multi-trade batches Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Batches support multiple trades with trainer dropdowns; trainees pick batch + trade; trainers (login profiles) tagged by trade.

**Architecture:** `profile_trades` + `batch_trades` + `trainees.trade`; drop `batches.trade` / `trainer_name`. App store loads batches with nested trade rows; UI updated accordingly.

**Tech Stack:** Postgres/Supabase RLS, React + Zustand store, Vercel `invite-staff` API.

---

### Task 1: Schema + live migration

**Files:** `schema.sql`, `docs/migrations/2026-07-14-multi-trade-batches.sql`

- Add `profile_trades`, `batch_trades`, `trainees.trade`
- Migrate existing batch rows; drop old columns
- RLS + expanded profiles SELECT for active trainers
- Human runs migration in SQL Editor after deploy prep

### Task 2: Types + store

**Files:** `vtms-frontend/src/types/index.ts`, `vtms-frontend/src/store/index.ts`

- `Batch.trades: { trade, trainerId, trainerName }[]`
- `Trainee.trade: TradeType`
- Fetch/insert/update mapping for nested `batch_trades`

### Task 3: Invite + Staff/Trainers UI

**Files:** `api/invite-staff.ts`, `AdminStaff.tsx`, new `Trainers.tsx`, `App.tsx`, `Layout.tsx`, `permissions.ts` if needed

- Invite accepts `trades[]` for trainers
- Trainers page to view/edit trade tags

### Task 4: Batches + Trainees forms

**Files:** `Batches.tsx`, `Trainees.tsx`, related display pages

- Multi-trade batch create; trainee batch→trade cascade
- Update badges/labels that assumed single `batch.trade`

### Task 5: Verify

- `tsc --noEmit`, `npm test`
- Commit when user requests

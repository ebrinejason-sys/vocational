# Multi-trade batches & trainer assignment — Design

**Date:** 2026-07-14  
**Status:** Approved (Option A)

## Problem

SCM cohorts run **multiple trades in one batch** (often 2–4). Today `batches.trade` is a single column and `trainer_name` is free text. Trainees inherit trade only via the batch, so multi-trade cohorts cannot be modelled.

## Goals

1. Create/manage **trainer staff logins** and tag each with **one or more trades**.
2. On **batch create**, select **multiple trades**; for each trade pick a trainer from a **dropdown** of trainers tagged for that trade.
3. On **trainee register**, pick **batch**, then **trade** from that batch’s trades.

## Data model

| Table | Purpose |
|-------|---------|
| `profile_trades (profile_id, trade)` | Which trades a `role=trainer` profile teaches |
| `batch_trades (batch_id, trade, trainer_id)` | Trades offered in a batch + assigned trainer (`profiles.id`) |
| `trainees.trade` | Trainee’s trade within their batch (must be one of that batch’s `batch_trades`) |

Remove from `batches`: `trade`, `trainer_name` (migrated into `batch_trades`).

Trade domain stays: `Carpentry | Tailoring | Masonry | Electricity`.

## Auth / RLS

- `profile_trades`: SELECT for roles that edit batches (trainer, case_worker, project_coordinator, director, admin). INSERT/UPDATE/DELETE: admin (+ director optional).
- `batch_trades`: same shape as `batches` policies.
- Expand `profiles` SELECT so batch editors can read **active trainers’** `id, full_name` (not full staff directory for all roles).
- Invite API accepts optional `trades[]` when `role=trainer` and inserts `profile_trades`.

## UI

1. **Staff invite** — when role is Trainer, show trade checkboxes; persist via invite API.
2. **Trainers page** (`/trainers`) — list trainers, edit trade tags (admin/director); others can view names used in dropdowns via data load.
3. **Batches form** — multi-select trades; per trade, trainer `<select>` filtered by `profile_trades`.
4. **Trainees form** — Batch → then Trade (options from `batch_trades` for that batch).

## Non-goals (this pass)

- Per-trade modules / enrollment caps
- Auto-creating auth users from a separate roster outside Staff invite
- Changing finance/logistics permissions

## Migration

Live SQL in `docs/migrations/`; `schema.sql` updated for fresh installs. Existing batches with a single `trade` become one `batch_trades` row (`trainer_id` null if name doesn’t match a profile).

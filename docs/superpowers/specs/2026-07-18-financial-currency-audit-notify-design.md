# Org currency + editable financial transactions with reason & notify — Design

**Date:** 2026-07-18  
**Status:** Approved (org-wide currency A; notify in-app + email; currency & delete same reason/notify rules as edit)

## Problem

Currency is hardcoded USD in `formatCurrency` and UI labels. Financial transactions are create-only and still browser-local. There is no way to correct a posted transaction with an accountable reason, and no channel to alert admin/director when money records change.

## Goals

1. **Org-wide currency** setting (single code for the whole app), changeable by staff with authority, requiring a reason and notifying admin + director (in-app + email).
2. **Wire financial transactions to Supabase** (load/create/update/delete).
3. **Edit and delete** transactions from Financials UI; every edit/delete requires a non-empty **reason**.
4. On edit/delete (and currency change): write an **audit log** entry and **notify all active admin + director** users in-app and by email, including who changed what and why.

## Non-goals (this pass)

- Per-transaction or multi-currency amounts / FX conversion
- Approving edits before they apply (notify is after-the-fact accountability)
- Full Phase-2 reminder system (meetings, report due dates)
- Wiring sales / production logs in the same pass (transactions + currency only)

## Decisions locked

| Topic | Choice |
|-------|--------|
| Currency scope | One org setting (`currency_code`), default `USD` |
| Who changes currency | `admin` and `director` |
| Who creates/edits/deletes transactions | `finance_officer` and `admin` (match frontend `canEdit('financials')`; expand DELETE RLS to include `finance_officer`) |
| Who is notified | All **active** profiles with role `admin` or `director` |
| Notify channel | In-app `notifications` + email via serverless API |
| Delete | Allowed with same reason + notify rules as edit |
| Currency change | Same reason + notify rules as transaction edit |

## Data model

### `app_settings`

Single-row (or keyed) org settings:

| Column | Purpose |
|--------|---------|
| `id` | PK (fixed id or `key` unique) |
| `currency_code` | ISO-ish code from allowlist, e.g. `USD`, `UGX`, `SSP`, `EUR`, `KES` |
| `updated_at`, `updated_by` | Last currency change metadata |

Allowlist enforced in UI + CHECK constraint. Changing currency does **not** convert historical amounts — it only changes display/labels going forward (document this in UI).

### `financial_transactions` (existing + light touch)

Keep existing columns. Ensure client maps:

| DB | App |
|----|-----|
| `transaction_type` | `type` |
| `transaction_date` | `date` |
| `donor_id` | `donorName` |
| `recorded_by` | set on insert from `auth.uid()` |

Optional: `updated_at`, `updated_by` on the row for last mutator (audit table remains source of truth for history).

### `financial_change_log` (append-only)

| Column | Purpose |
|--------|---------|
| `id` | UUID |
| `action` | `transaction_update` \| `transaction_delete` \| `currency_change` |
| `entity_type` | `financial_transaction` \| `app_settings` |
| `entity_id` | UUID or settings key |
| `old_values` / `new_values` | JSONB snapshots (null delete → only old) |
| `reason` | TEXT NOT NULL |
| `changed_by` | UUID → `profiles` |
| `changed_at` | TIMESTAMPTZ |

No UPDATE/DELETE policies for non-service roles (insert + select only for authorized roles).

### `notifications`

| Column | Purpose |
|--------|---------|
| `id` | UUID |
| `user_id` | Recipient profile |
| `kind` | e.g. `financial_change` |
| `title`, `body` | Short summary including reason |
| `entity_type`, `entity_id` | Optional deep-link context |
| `read_at` | NULL until read |
| `created_at` | TIMESTAMPTZ |

RLS: users SELECT/UPDATE (mark read) their own rows; INSERT via authenticated finance mutators or service role from API.

## Auth / RLS

- `app_settings`: SELECT for roles that see money UI; UPDATE for `admin`/`director`.
- `financial_transactions`: keep SELECT as today; INSERT/UPDATE for `finance_officer`/`admin`; **DELETE** for `finance_officer`/`admin` (change from admin-only).
- `financial_change_log`: INSERT for mutators; SELECT for `admin`/`director`/`finance_officer`.
- `notifications`: SELECT/UPDATE own; INSERT for mutators (or service role for email path).

Frontend: gate Financials form + edit/delete with `canEdit(..., 'financials')`; currency UI with admin/director check. Align `permissions.ts` if a new `settings` domain is cleaner — otherwise currency lives under Admin.

## UI

1. **Admin → Currency** (or Settings card): current code, dropdown from allowlist, required reason, save → audit + notify.
2. **Financials**: list from Supabase; Add (create); Edit modal (fields + required reason); Delete confirm (required reason). Viewers (director, project_coordinator) see list without mutate actions.
3. **Layout**: notification bell for unread count; panel lists recent notifications (mark read).
4. **Labels / format**: `formatCurrency(amount, currencyCode)` and replace hardcoded “USD” strings with the org setting.

## Email

New serverless endpoint (pattern of `api/invite-staff.ts`), e.g. `api/notify-financial-change.ts`:

- Auth: caller must be signed-in finance_officer/admin (or admin/director for currency).
- Body: action, summary, reason, changer id/name, entity ids.
- Looks up active admin/director emails via service role; sends email (same mail stack as invites if present).
- Also ensures in-app notification rows exist (client may insert notifications; email API is mandatory for email fan-out).

## Flow

```
Create transaction → no reason, no notify (normal bookkeeping)
Edit / Delete transaction → reason required → update/delete row → change_log → notifications + email
Change currency → reason required → update app_settings → change_log → notifications + email
```

## Migration

- Live SQL under `docs/migrations/2026-07-18-financial-currency-audit-notify.sql`
- Update `schema.sql` for fresh installs
- Bump store persist version when removing `financialTransactions` from local persist after Supabase wire-up

## Risks / notes

- Historical amounts are **not** converted when currency changes; UI must state this clearly.
- If email provider is unavailable, still persist audit + in-app notifications; surface email failure to the changer.
- Interview/prospect WIP on `main` is unrelated; keep this feature’s commits separate when committing.

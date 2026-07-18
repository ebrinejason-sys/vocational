# Financial currency + editable transactions — Implementation Plan

> **For agentic workers:** Execute inline or via subagent-driven-development. Steps use checkbox syntax.

**Goal:** Org-wide editable currency; Supabase-backed financial transactions with edit/delete requiring a reason; audit log + in-app and email notify to admin/director.

**Architecture:** `app_settings.currency_code` drives display; `financial_transactions` CRUD in store; `financial_change_log` append-only; `/api/notify-financial-change` fans out `notifications` rows + optional Resend email.

**Tech Stack:** React, Zustand, Supabase, Vercel serverless API.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-financial-currency-audit-notify-design.md`
- Currency change does not convert historical amounts
- Create transaction: no reason/notify; edit/delete/currency: reason + notify
- Who changes currency: admin, director
- Who mutates transactions: finance_officer, admin
- Notify: active admin + director

---

### Task 1: Migration + schema
### Task 2: Types, formatCurrency, store wire-up
### Task 3: Financials edit/delete UI + Admin currency
### Task 4: Notifications bell + notify API
### Task 5: Verify tsc / migration note

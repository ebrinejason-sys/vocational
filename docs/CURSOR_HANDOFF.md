# CURSOR HANDOFF PROMPT — SCM VTMS (Vocational Training Management System)

Copy everything below this line into Cursor as the opening prompt.

---

You are taking over an in-progress engineering session on **VTMS**, a vocational-training management system for **Street Children Ministry (SCM)**, an NGO in Juba, South Sudan running a CTVET skills program (Carpentry, Tailoring, Electricity, Masonry) funded by Word and Deed. It manages sensitive data on vulnerable youth (trauma case notes, vulnerability scores), so security is not cosmetic.

## Stack & architecture

- **Frontend**: React 18 + Vite + TypeScript + Tailwind in `vtms-frontend/`. Zustand store (`src/store/index.ts`). React Router. Recharts. PWA via vite-plugin-pwa.
- **Backend**: Supabase (project ref `ujtrnisximixlirwphwh`). Postgres schema + RLS in `schema.sql` (repo root; source of truth for fresh installs). Live-DB migrations in `docs/migrations/`.
- **Auth**: Supabase Auth, email+password, **no public signup**. Admin invites staff via `/admin/staff` → Vercel serverless function `api/invite-staff.ts` (repo root, uses `SUPABASE_SERVICE_ROLE_KEY` from env; the ONLY place the service key is used). `AuthProvider` in `src/contexts/AuthContext.tsx` — `onAuthStateChange` is the SOLE session source (a getSession() race bug was fixed; do not reintroduce a parallel getSession call).
- **RBAC**: 7 roles — `admin, director, project_coordinator, trainer, case_worker, finance_officer, logistics_officer`. Matrix in `src/lib/permissions.ts` mirrors Postgres RLS policies in `schema.sql`. **RLS is the real enforcement; the frontend matrix only drives nav/route/button visibility.** Route guards in `src/components/RouteGuards.tsx`, nav filtering in `src/components/Layout.tsx`.
- **Theming**: class-based dark mode (`darkMode: 'class'`), ThemeProvider in `src/lib/theme.tsx`, toggle component, pre-paint no-flash script in `index.html`. Pages were written light-only; dark mode works via a **CSS retrofit layer** in `src/index.css` (`.dark .bg-white { … }` etc.). When adding NEW UI, keep using the same light utility classes — the retrofit layer handles dark automatically. Fonts: Fraunces (display) + Plus Jakarta Sans (UI) via Google Fonts. Brand lockup `src/components/Brand.tsx`, branded preloader `src/components/Preloader.tsx`, logo `src/assets/scm-logo.jpg`.
- **Data state**: Only `batches` + `trainees` are Supabase-backed (store actions are async, write-then-update-state). The other domains (attendance, competency, case notes, inventory, financials, graduation, alumni) are still **browser-local only** (empty seed arrays in `src/store/seed.ts`) — wiring them to Supabase is planned work.
- Currency is **USD** everywhere (`formatCurrency` in `src/lib/utils.ts`).

## CRITICAL — uncommitted work sitting in the tree RIGHT NOW

A large finished-and-verified changeset is UNCOMMITTED (typecheck clean, 21/21 vitest tests pass, `npm run build` succeeds, visually verified light+dark via Playwright). **Your first task: run `cd vtms-frontend && npx tsc --noEmit && npm test`, then commit ALL of it and push to `main`** (Vercel auto-deploys from main). Suggested message: `feat: SCM roles expansion, demo-data purge, dark-mode fixes, invite redirect, PWA icons`. NEVER commit `.env.local` files or `scripts/core-users.credentials.txt` (all git-ignored — verify with `git status` that no secrets are staged).

The changeset contains:
1. **Demo-data purge**: `src/store/seed.ts` emptied; persist version bumped to 3; `schema.sql` seed INSERTs removed; `Entrepreneurship` trade removed everywhere; fictional staff names replaced with the signed-in profile (`useAuth().profile.fullName`); org renamed Agape→Street Children Ministry.
2. **Two new roles** (`project_coordinator`, `logistics_officer`) across `permissions.ts` (+ new `ROLE_LABELS`), tests, `AdminStaff.tsx`, `api/invite-staff.ts`, and all RLS policy arrays in `schema.sql`.
3. **`docs/migrations/2026-07-13-roles-and-data-cleanup.sql`** — for the LIVE DB: Step 1 (enum ADD VALUEs) must run alone before Step 2 (data purge + trade CHECK + ~30 ALTER POLICY statements). The human runs this in Supabase SQL Editor.
4. **Invite redirect fix**: `api/invite-staff.ts` now passes `redirectTo: ${siteUrl}/welcome` (from `PUBLIC_SITE_URL` env or `x-forwarded-host`); new public route/page `src/pages/Welcome.tsx` where invited staff set their password (session arrives via URL hash; `supabase.auth.updateUser({password})`).
5. **Security hardening**: `RequireAuth` now renders an explicit "Account not set up" screen (with sign-out) for session-without-profile instead of hanging on the loader; `friendlyError()` in utils masks raw RLS/Postgres errors; New Batch / Register Trainee buttons hidden for view-only roles via `canEdit()`.
6. **Dark-mode glitch fixes**: retrofit pass 2 in `index.css` (semantic badge tints, `bg-white/90`/`95` header, primary-100, colored borders).
7. **PWA icons** `pwa-192x192.png`/`pwa-512x512.png` generated from the crest (fixes manifest 404); workbox `skipWaiting`+`clientsClaim`+`cleanupOutdatedCaches` (fixes stale-bundle-after-deploy).
8. **Recharts** `minWidth={0}` + `min-w-0` container fixes (kills the width(-1) console spam). `Financials.tsx`: added "Application Form Fees" income category.
9. **`scripts/create-core-users.mjs`** — creates one account per role (plus-addressed gmail), writes passwords to git-ignored `scripts/core-users.credentials.txt`. Run AFTER the migration. Reads root `.env.local`.

## Human runbook (tell the user; you cannot do these)

1. Supabase SQL Editor: run migration Step 1, then Step 2 (separate executions).
2. Supabase Dashboard → Authentication → URL Configuration: Site URL = `https://vocational-sigma.vercel.app`; add `https://vocational-sigma.vercel.app/welcome` and `http://localhost:5173/welcome` to Redirect URLs.
3. Vercel env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and now `PUBLIC_SITE_URL=https://vocational-sigma.vercel.app`.
4. `node scripts/create-core-users.mjs` from repo root, distribute passwords privately, delete the file.
5. **Rotate the Supabase service-role + anon keys soon** (they were pasted in a chat session) and update `.env.local` files + Vercel.

## Known security findings (verified; address as you go)

- ✅ RLS matrix and profiles policies are sound (profiles UPDATE is admin-only — no self-escalation). Base GRANTs were missing once; now in schema.sql §0.
- ⚠️ Trainee rows carry `vulnerability_score`/`vulnerability_assessment` readable by every role with trainee SELECT (finance, logistics). Consider moving sensitive fields to a restricted table or a column-limited view in the pipeline rework.
- ⚠️ Local-only domains (case notes!) persist unencrypted in localStorage — real safeguarding gap until wired to Supabase with RLS. Prioritize case notes when wiring domains.
- ⚠️ No rate limiting on `api/invite-staff` (admin-gated, acceptable short-term).
- ⚠️ No password-reset UI (only invite flow). Add a "Forgot password" flow (`resetPasswordForEmail` → reuse `/welcome` or a `/reset` page).

## Your mission after committing (in priority order)

1. **Wire remaining domains to Supabase** one at a time, following the exact pattern in `src/store/index.ts` for batches/trainees (row-mapper + async actions + RLS already in place). Order: case notes (sensitive!), attendance, competency+modules, inventory/procurement, financials/sales/production, graduation/alumni. Bump store persist version when removing a domain from local persistence.
2. **Auth improvements**: forgot-password flow; deactivate/reactivate staff + role editing on the Staff page (service-role endpoint like invite); optional session-expiry toast.
3. **UI polish**: empty-state illustrations/CTAs for the now-empty modules; loading skeletons instead of spinners; mobile audit of tables (they overflow — wrap in `overflow-x-auto`); accessibility pass (labels, focus traps in the sidebar drawer).
4. **Phase 2 features** (each needs its own schema + RLS + UI; user has paper forms digitized in the repo's chat history — ask them to re-share PDFs if needed): per-batch **trades[] array** (batches 1–3 had 2 trades; 4–5 have 4) + per-trade module management; **Applicant Pipeline** (application intake → duplicate/repeat-applicant flagging by name+phone+DOB across batches → interview scoring rubric → auto-selection top-N per trade with waitlist → one-click enrollment); **Project Charter** per batch (goals/risks/roles/milestones) feeding a **Progress/Phase Tracker** timeline (Mobilization→Selection→Enrollment→Training M1–6→Midpoint→Graduation→Follow-up, auto-highlight current phase by date); **Meetings** (monthly×6 + midpoint + endpoint; minutes, action items with owner/due/status); **Reports** (Batch→Month 1–6 monthly report matching their template, PDF export for donors); **Follow-Up** (internship/attachment place + end date); **Document Storage** per trainee (Supabase Storage: ID, birth cert, recommendation, photos; consent flag; access-controlled); **Notifications/Reminders** (report due dates, meetings, attachment end dates); **Data Export** (CSV/XLSX of raw tables for donors).
5. Keep tests green (`npm test`), typecheck clean, and follow the existing visual language (teal primary, Fraunces/Jakarta, existing card/badge patterns). Verify UI changes in BOTH themes.

Rules: never expose the service-role key client-side; every new table gets RLS matching `permissions.ts` (update both together + migration file in `docs/migrations/`); schema.sql stays the fresh-install source of truth; commit in small reviewed steps and push to `main`.

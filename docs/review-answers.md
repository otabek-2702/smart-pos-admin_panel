# Smart POS admin — review answers

**Owner:** Otabek
**Last refreshed:** 2026-05-17
**Branch reviewed:** `main` (post backend-sync + loyalty + idempotency)

> The questionnaire predates a complete backend rewrite + 30+ feature
> commits. This document is the live status — most of what was open
> on 2026-04-30 has shipped. Open items at the bottom under
> "Remaining work".

---

## Q0 — Documentation ✅

- README rewritten as Smart POS overview (commands, env vars, architecture, path aliases).
- `package.json` renamed to `smart-pos-admin-panel @ 0.1.0`.
- `docs/` folder contains BACKEND_FEEDBACK, FRONTEND_TODO, and this file.
- Footer no longer shows ThemeSelection / Sneat branding.

## Q1 — Backend URL & environment ✅

- `src/plugins/axios.ts` uses `import.meta.env.VITE_API_HOST` (empty in dev).
- Dev: Vite proxy forwards `/api/*` to `:8000` (no CORS issue).
- Prod: set `VITE_API_HOST` env var per deployment.
- `.env.example` checked in.
- Five axios instances exported: default (admin), `stockApi`, `hrApi`, `discountsApi`, `notificationsApi`. All share the same Bearer interceptor.
- Idempotency-Key auto-attached on `/orders` (POST), `/orders/{id}/pay`, `/orders/{id}/cancel`, `/inkassa/perform`, `/loyalty/accounts/{phone}/redeem/` — backend dedupes retries via `@idempotent`.

## Q2 — Authentication & session ✅

- `POST /api/admins/auth-login` → opaque session key, stored in localStorage as Bearer token.
- Logout calls `POST /auth-logout` before clearing local state.
- 401 → wipe localStorage + redirect to `/login`.
- LocalStorage token is acceptable for an internal admin tool. Moving to httpOnly cookie is post-release follow-up if customer-facing PWA is ever required.

## Q3 — Access control (CASL) ✅

- Abilities built from `user.permissions` returned by `/auth-login`. ADMIN role gets `['*']` → manage-all.
- Backend is still the source of truth (`@admin_required` + `@permission_required` on every endpoint). CASL only gates UI element visibility.

## Q4 — Users ✅

- Native `/api/admins/users` CRUD shipped on the backend on 2026-05-08.
- Frontend `src/pages/users/index.vue` rewritten to use it: list with role + status filters, create/edit/delete, password change, suspend toggle.

## Q5 — Categories ✅

REST endpoints (`POST /categories`, `PATCH /categories/{id}`, `DELETE /categories/{id}`) wired. Reorder uses dedicated `/categories/reorder`.

## Q6 — Products ✅

REST endpoints wired. Bulk delete/restore UI still backlog (backend supports it).

## Q7 — Orders ✅

- List with status/payment/date/search filters
- Pay/cancel actions
- Stats card row from `/orders/stats`
- Status enum aligned to backend's `CANCELED` (one L)
- Expandable rows with line items
- **1C export** download added (calls `/exports/1c?from=&to=`)
- Item-level edit dialog still backlog (backend has `/orders/{id}/add-item`, `items/{id}/update`, etc.)

## Q8 — Inkassa ✅

- Native `/api/admins/inkassa/{balance,stats,history,perform}` shipped on backend; frontend re-pointed off the HR cash stopgap.
- Cashier performance card surfaced from `/inkassa/stats`.

## Q9 — Template & navigation surface ✅

- Demo template surface deleted (`src/views/`, `src/pages/pages/`, `src/navigation/horizontal/`, `src/pages/access-control.vue`, `src/pages/register.vue`).
- `[...all].vue` and `not-authorized.vue` rewritten as standalone Vuetify components (no broken image references).
- Nav restructured into Dashboard / Management / HR / Stock / Analytics / System.

## Q10 — Internationalization & UX ✅

- 3 active locales: uz (default), ru, en. ~280 translation keys cover every page.
- Vuetify built-in strings translate via `createVueI18nAdapter`. Uzbek overrides for high-visibility strings (`noDataText`, pagination labels).
- Backend error literals mapped to i18n keys via `src/composables/useApiError.ts`.

## Q11 — Quality & automation ✅

- `yarn lint:ci` — app-code-only, `--max-warnings 0`. Passes clean.
- `yarn ci` — lint:ci + build.
- `yarn smoke` — Playwright smoke test (login + visit every nav route, assert no console errors).
- `.github/workflows/ci.yml` runs lint:ci + build on every PR / push to main. Uploads `dist/` artifact.
- Smoke test job is `workflow_dispatch` until a staging backend is reachable from GH runners.

## Q12 — Build & deploy 🔲

**Still open.** Needs an infra decision.

- Dev: `yarn dev` → http://localhost:5181 + Vite proxy. ✅
- Build: `yarn build` → ~2 MB / 600 KB gzip static SPA bundle. ✅
- **Need decisions on:**
  - Hosting target (Nginx same-domain? S3+CloudFront? subdomain?)
  - `base:` path in vite.config.ts if served from a sub-path
  - Production CORS — backend needs `django-cors-headers` for the deployed origin (tracked in `docs/BACKEND_FEEDBACK.md §2`).
  - Per-environment `VITE_API_HOST` injection in CI deploy step.

Frontend half is ~1 day once the hosting decision is made.

## Q13 — Scope ✅ for v1; future backlog in `docs/FRONTEND_TODO.md`

## Q14 — "Good enough to ship" — 9 of 10 done

| # | Criterion | Status |
|---|---|---|
| 1 | Every page in the active nav loads without console errors | ✅ |
| 2 | CRUD works end-to-end for primary modules | ✅ |
| 3 | Stats / dashboard reflects real data | ✅ |
| 4 | Login + logout work; 401 redirects to `/login` | ✅ |
| 5 | Locale switching works on every page | ✅ |
| 6 | No template-leftover routes accessible | ✅ |
| 7 | README accurately describes how to run | ✅ |
| 8 | CI passes (lint + build); smoke test runs locally | ✅ |
| 9 | Deploy target chosen and at least one staging environment reachable | 🔲 (Q12) |
| 10 | Backend has shipped the original 3 blockers | ✅ |

Only Q12 (deploy infrastructure) blocks shipping.

## Q15 — Process notes

- Backend ships ahead of frontend most weeks; we re-audit `WHATS_NEW.md` per release.
- Updated priorities:
  1. **P0** — Q12 deploy infrastructure decision.
  2. **P1** — Stable `error_code` field on responses (`docs/BACKEND_FEEDBACK.md §1`).
  3. **P1** — Production CORS configuration on backend (`docs/BACKEND_FEEDBACK.md §2`).
  4. **P2** — `docs/FRONTEND_TODO.md §3` backlog: order detail dialog with item editing, bulk ops, telegram-bot text editor admin.
  5. **P3** — Promote smoke test from workflow_dispatch to PR-gating once staging backend is reachable from CI runners.

---

## Remaining work checklist (everything not crossed off)

| Area | Item | Owner | Estimate |
|---|---|---|---|
| Deploy | Pick hosting target + nginx/SPA-rewrite config | infra | 1 day |
| Deploy | Wire `VITE_API_HOST` per environment in CI | us | 2 hrs (after infra decision) |
| Backend | `django-cors-headers` for prod domain | backend | 1 hr |
| Backend | Stable `error_code` field on responses | backend | half-day |
| Frontend | Order detail dialog (item-level add/update/remove/ready/unready) | us | 1 day |
| Frontend | Bulk delete/restore for categories/products/users | us | half-day |
| Frontend | Notifications template editor admin | us | half-day |
| Frontend | Telegram bot text editor admin (uses notification templates) | us | half-day |
| Frontend | Promote Playwright smoke to PR-gating | us | half-day after staging backend exists |

The full feature backlog of unwired endpoints is `docs/FRONTEND_TODO.md §3`.

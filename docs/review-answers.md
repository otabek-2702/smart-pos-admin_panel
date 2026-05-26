# Smart POS admin — review answers

**Owner:** Otabek
**Date completed:** 2026-04-30
**Branch reviewed:** `main` @ `f1e7ebf` (post-migration + Q0/Q9 cleanup)

> Important context the questionnaire predates: the backend was rewritten and
> renamed `alpha_pos`. The panel was migrated 2026-04-29. All URL references
> in the questionnaire (e.g. `/admins-api/login`) are out of date — the new
> mount is `/api/admins/` and login is `/api/admins/auth-login`. See
> `docs/BACKEND_FEEDBACK.md` and `docs/FRONTEND_TODO.md` for the full audit.

---

## Q0 — Documentation

**Status: ✅ Done** (commit `f1e7ebf`).

- `README.md` rewritten as a Smart POS overview: stack, dev/build/lint commands, dev port (5181), Vite proxy & `VITE_API_HOST` env var, login credentials for local dev, architecture summary, path aliases, docs links.
- `package.json`: name → `smart-pos-admin-panel`, version → `0.1.0`, description added.
- `docs/BACKEND_FEEDBACK.md`, `docs/FRONTEND_TODO.md`, `docs/review-answers.md` moved under `docs/` and linked from README.
- Footer in `src/layouts/components/Footer.vue` no longer shows ThemeSelection / License / Documentation links — replaced with a simple `© Smart POS`.

**Still on the followup list:** add `.env.example` documenting `VITE_API_HOST` and any future env variables (tracked under Q1 since it's the same surface).

---

## Q1 — Backend URL & environment

**Status: ✅ Mostly done.** Current `src/plugins/axios.ts`:

```ts
const API_HOST = import.meta.env.VITE_API_HOST ?? ''
const axiosIns = axios.create({ baseURL: `${API_HOST}/api/admins` })
export const stockApi          = ... `${API_HOST}/api/admins/stock`
export const hrApi             = ... `${API_HOST}/api/admins/hr`
export const discountsApi      = ... `${API_HOST}/api/admins/discounts`
export const notificationsApi  = ... `${API_HOST}/api/admins/notifications`
```

In dev, `VITE_API_HOST` is unset so requests are relative-path; `vite.config.ts → server.proxy` forwards `/api → http://127.0.0.1:8000`. This means **no CORS in dev** without changing the backend.

**Remaining work:**
- Add `.env.example` documenting `VITE_API_HOST`.
- Wire CI to inject env per environment (rolls into Q12).

**Target:** half-day, alongside Q12 deploy decisions.

---

## Q2 — Authentication & session

**Implemented (current state):**
- `POST /api/admins/auth-login` returns `{ data: { token, user: { id, email, first_name, last_name, role, status, branch_id, permissions } } }`.
- Token is a 20-char opaque hex session key (not a JWT) generated server-side and stored in `Session` table.
- Stored as `localStorage.accessToken` (JSON-stringified), `userData`, `userAbilities`.
- Axios interceptor attaches `Authorization: Bearer <token>` on every request.
- Backend also accepts cookie `session_key=<token>` — we don't use that path.
- 401 response triggers localStorage clear + redirect to `/login`.
- Logout: best-effort `POST /auth-logout` before clearing local state.

**Long-term plan:**
- LocalStorage is acceptable for an internal admin tool given the threat model (single-tenant, single-user-per-device). It's not appropriate for a customer-facing PWA.
- Future work: move token to `httpOnly` cookie so XSS can't exfiltrate. The backend already sets `session_key` cookie on login — we just need to add `withCredentials: true` to axios and drop the localStorage path.
- `JSON.stringify`/`JSON.parse` round-trip on the token is leftover from the Sneat template (it stores `userData` as an object). Will be removed when token storage moves to cookie.

**Target:** post-release follow-up, after first internal users are onboarded.

---

## Q3 — Access control (CASL)

**Status: ✅ Done.** No longer `manage / all` for everyone. Updated in `src/pages/login.vue` during migration:

```ts
const perms: string[] = Array.isArray(user?.permissions) ? user.permissions : []
const userAbilities = perms.includes('*')
  ? [{ action: 'manage', subject: 'all' }]
  : perms.map(p => {
      const [subject, action] = p.split('.')
      return { action: action || 'read', subject: subject || 'all' }
    })
```

ADMIN role ships with `permissions=['*']` → maps to manage-all. Other roles get
fine-grained abilities derived from backend permission strings like
`category.create`, `order.update`, etc.

**Backend is still the source of truth.** CASL only gates UI element visibility
(buttons, nav items); every endpoint re-validates via `@admin_required` +
`@permission_required('foo.bar')` decorators server-side.

**Caveat:** seed admin users currently have `permissions=[]`. We patched our
local test user to `['*']`. Backend dev needs to ship admins with `['*']` by
default — flagged in `docs/BACKEND_FEEDBACK.md`.

---

## Q4 — Users

**Repurposed during migration.** The new backend (`alpha_pos`) doesn't have admin
user CRUD endpoints — `/users/*` is gone. HR `employees` endpoints are the closest
equivalent.

`src/pages/users/index.vue` now points at `hrApi /employees/` and lets you:
- list employees with department + contract-type filters
- create/edit employee profiles (position, department, hire date, contract type, base salary, payment frequency, phone, address, notes)
- soft-delete employees
- view stats (total, active, departments, total salary)

**Gap:** can't create a *user* (login account) from the admin panel — only an
*employee* profile attached to an existing user. Requires a backend endpoint
to create users. Flagged in `docs/BACKEND_FEEDBACK.md §1.1`.

**Status:** good enough for milestone if "managing employees" is the goal.
Not good enough if "creating new admin/cashier login accounts" is required —
needs backend work first.

---

## Q5 — Categories

**Status: ✅ Done.** Migrated to new REST URLs:
- `GET /api/admins/categories` (list with search, stats)
- `POST /api/admins/categories` (create)
- `PATCH /api/admins/categories/{id}` (update)
- `DELETE /api/admins/categories/{id}` (soft delete)
- `POST /api/admins/categories/reorder` (drag-drop reorder uses dedicated endpoint)

Color picker, drag-drop, stats card row all working.

---

## Q6 — Products

**Status: ✅ Done for milestone.** Migrated to REST URLs (`POST /products`,
`PATCH /products/{id}`, `DELETE /products/{id}`). Category filter, price input,
color picker working.

**Gap:** no bulk delete / restore UI even though backend supports
`/products/bulk-delete` and `/products/bulk-restore`. Tracked in `docs/FRONTEND_TODO.md`.

---

## Q7 — Orders

**Status: ✅ Done for read-only + payment lifecycle.** Migrated:
- `GET /orders` with status/payment/date/search filters
- `POST /orders/{id}/pay` and `/cancel`
- Stats endpoint wired (`/orders/stats`)
- Status enum aligned to backend (`CANCELLED` two L's)
- Expandable row showing line items

**Gaps (deferred):** order detail dialog with item-level editing (`/orders/{id}/add-item`,
`/items/{id}/update`, `/items/{id}/remove`, `/items/{id}/ready`, `/items/{id}/unready`)
— backend supports these, frontend doesn't expose them yet. Tracked in `docs/FRONTEND_TODO.md §3`.

---

## Q8 — Inkassa

**Status: ✅ Done (repurposed).** The new backend doesn't expose `/inkassa/*`
URLs (the model exists but isn't routed). Page now points at HR cash endpoints:
- `GET /api/admins/hr/cash/balance/`
- `GET /api/admins/hr/cash/` (history)
- `POST /api/admins/hr/cash/deposit/` and `/withdraw/`

UI: three KPI cards (balance, total deposits, total withdrawals) + history
table with separate Deposit/Withdraw buttons.

Nav entry renamed "Inkassa" → "Cash Register" in `src/navigation/vertical/management.ts`.

---

## Q9 — Template & navigation surface

**Status: ✅ Done** (commit `f1e7ebf`).

Deleted in this cleanup pass:
- `src/navigation/horizontal/` (entire directory — never imported)
- `src/navigation/vertical/app-and-pages.ts` (never imported)
- `src/pages/pages/misc/` — 5 files (coming-soon, internal-server-error, not-authorized, not-found, under-maintenance)
- `src/pages/access-control.vue` and `src/pages/register.vue` (unused demo auth pages)
- `src/views/` — entire directory (only contained Sneat demo content)

Rewrote in-place:
- `src/pages/[...all].vue` (catch-all 404) — now standalone Vuetify layout + i18n keys. Previously referenced `@images/pages/page-misc-error-*.png` which **never existed in this repo** and would have crashed at runtime.
- `src/pages/not-authorized.vue` — same treatment.

Build verified: `yarn build → ✓ built in 31s`.

**Not done (future cleanup):** Many components under `src/@core/components/` are still Sneat demo components (carousels, charts, etc.). Removing them is finicky because some are auto-loaded by Vuetify config and the typings live in `components.d.ts`. Defer until they show up as actual problems.

---

## Q10 — Internationalization & UX

**Status:**
- 3 active locales: `uz` (default), `ru`, `en` (fallback). `ar` and `fr` exist but are not exposed in the navbar switcher.
- ~210 translation keys cover every page added/changed during the migration plus the new 404 / 401 pages.
- Vuetify built-in strings translate via `createVueI18nAdapter` wired in `src/plugins/vuetify/index.ts`. Vuetify ships en + ru packs out of the box; for Uzbek we override the most user-visible strings (`noDataText: "Ma'lumotlar mavjud emas"`, pagination, "Sahifada:", etc.) and fall back to en for the rest.
- Login error messages map backend literals to localized keys via `src/composables/useApiError.ts`.

**Gaps for follow-up:**
- The "PAST" priority chip on AI assistant suggestions is the legitimate Uzbek translation of "low" → "past" rendered uppercase by VChip styling. Working as designed but caused user confusion — may want a different word ("kichik") or lowercase chip variant.
- Some less-visited Vuetify dialogs may still surface English strings — fixable by adding to the `uzOverrides` map in `src/plugins/vuetify/index.ts` as they're noticed.

**Sufficient for release.** Translation completeness will only need real attention when we onboard non-Uzbek-speaking users.

---

## Q11 — Quality & automation

**Current state:**
- `yarn lint` — exits non-zero. Remaining errors are inside `src/@core/` and `src/@layouts/` (template internals). Application code under `src/pages/`, `src/composables/`, `src/plugins/`, `src/navigation/` is lint-clean.
- `yarn typecheck` — same shape: errors live in template internals; application code passes.
- `yarn build` — works (verified end of Q9 commit).
- No `test` script. No E2E. No unit tests.

**Minimum bar for next release (proposal):**
1. **CI typecheck + lint gate** — scoped to non-template paths only (e.g. `eslint src/pages src/composables src/plugins src/navigation src/layouts/components --max-warnings 0`). ~half-day to wire into GitHub Actions.
2. **One Playwright smoke test** — login → dashboard loads → click each top-level nav item without console errors. ~1 day to set up, runs in <30 sec.
3. **No unit tests this milestone.** They're high-effort for an admin panel that mostly proxies HTTP. We'll add them if logic gets complex enough to warrant it.

**Target:** 1–2 days. Unblocked now that Q9 is done.

---

## Q12 — Build & deploy

**Dev:** `yarn dev` → http://localhost:5181 with Vite proxy to backend at `:8000`.

**Build:** `yarn build` produces a static SPA bundle in `dist/` (~2 MB, ~600 KB gzip).

**Deploy:** **not configured for any environment yet.** No CI/CD, no hosting target chosen, no Dockerfile, no nginx config.

**Gaps before release:**
1. Decide static hosting target (Nginx behind same domain as backend? S3 + CloudFront? Subdomain like `admin.example.com`?).
2. If served from a sub-path, add `base: '/admin/'` to `vite.config.ts` and configure SPA history-mode rewrites.
3. Production CORS — backend needs `django-cors-headers` configured for the admin panel's deployed origin. Documented in `docs/BACKEND_FEEDBACK.md §4b`.
4. Add `.env.example` and set `VITE_API_HOST` per environment.
5. CI workflow: install → typecheck → lint → build → publish artifact / deploy.

**Target:** depends on infra decisions. Need a meeting with backend/devops to decide hosting topology before timeline is meaningful.

---

## Q13 — Release alignment: scope

**In scope for this milestone (status today):**
- ✅ Migration work to `alpha_pos` (commit `073a239`).
- ✅ Categories, Products, Orders read + basic actions.
- ✅ Employees, Departments, Salaries, Expenses, Leaves, Contracts, Attendance (HR module).
- ✅ Places & Tables, Discounts, Shifts, Notifications, App Settings.
- ✅ Stock module (items, levels, batches, suppliers, recipes, purchase orders, production orders, transfers, counts, etc.).
- ✅ AI Assistant.
- ✅ Cash Register (HR-backed).
- ✅ README / package.json cleanup (Q0).
- ✅ Demo page cleanup (Q9).
- 🔲 CI typecheck + lint + smoke test (Q11).
- 🔲 Deploy story (Q12) — at least decided, even if not fully automated.

**Explicitly deferred:**
- Admin user account creation (blocked on backend — needs `/users` CRUD).
- Order item-level editing UI (backend ready, no UI yet).
- Bulk operations across categories/products/users.
- Roles management page.
- Auth sessions management (revoke active sessions).
- Move token to `httpOnly` cookie.
- Stock advanced features: adjust dialog, reservations, barcode lookup, receiving flow, recipe cost analysis, batch consumption.
- Localization for ar/fr (uz/ru/en is the agreed set).

Full list of unwired endpoints with prioritization: `docs/FRONTEND_TODO.md §3`.

---

## Q14 — "Good enough to ship" criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Every page in the active nav loads without console errors against the real backend | ✅ |
| 2 | CRUD works end-to-end for the 6 primary modules: Categories, Products, Orders (pay/cancel), Employees, Cash Register, Discounts | ✅ |
| 3 | Stats / dashboard reflects real data | ✅ |
| 4 | Login + logout work; 401 redirects to `/login` | ✅ |
| 5 | Locale switching (uz/ru/en) works on every page | ✅ |
| 6 | No template-leftover routes accessible | ✅ |
| 7 | README accurately describes how to run, build, and deploy | ✅ |
| 8 | CI passes (typecheck + lint + smoke) | 🔲 |
| 9 | Deploy target chosen and at least one staging environment reachable | 🔲 |
| 10 | Backend has shipped fixes for the 3 blockers in `docs/BACKEND_FEEDBACK.md §6` ("Hell no" wording, status spelling alignment, admin seed `permissions=['*']`) | 🔲 (backend) |

7 of 10 done. Remaining 3: Q11 (CI), Q12 (deploy infra), backend blockers.

---

## Q15 — Process notes

- This file (`docs/review-answers.md`) is ready to translate into tickets.
- Updated priorities (highest → lowest):
  1. **P0** — Backend blockers in `docs/BACKEND_FEEDBACK.md §6` (3 items, ~half-day each on backend side).
  2. **P1** — Q12 deploy story (depends on infra decision; min 2 days once decided).
  3. **P1** — Q11 CI + smoke test (1–2 days; unblocked now Q9 is done).
  4. **P2** — `docs/FRONTEND_TODO.md §3` backlog as separate tickets (order detail dialog and bulk ops are the highest-value picks).
- Questionnaire completion date: **2026-04-30**.

---

## Additional features & issues (not covered above)

- **Vite dev proxy is required** until backend ships `django-cors-headers`. Documented in `vite.config.ts` and `docs/BACKEND_FEEDBACK.md §4b`.
- **Order status spelling drift** — model declares `CANCELED` (1 L), service writes `CANCELLED` (2 L). Frontend aligned with service spelling. Backend still needs to pick one and migrate data.
- **`"Hell no"` literal in 403 responses** — visible to end users in three places (`auth_service.py:49`, `:102`, `permissions.py:24`). Cosmetic but unprofessional.
- **`branch_id` enforcement** — backend `auth_service.py` checks `settings.BRANCH_ID` against user's branch but no documentation on how this is configured. Needs clarification before multi-branch deploys.
- **Translation by error code, not literal string** — currently we map English error strings to i18n keys (`src/composables/useApiError.ts`). Fragile — any backend wording change silently breaks translations. Requested stable `error_code` field in `docs/BACKEND_FEEDBACK.md §4c`.
- **`PAST` chip on AI suggestions** — caused user confusion; it's the legitimate Uzbek translation of "low" priority rendered uppercase by VChip. Consider lowercase chip variant or different word ("kichik").
- **CASL warning in console about `localStorage` being editable** — known limitation; backend enforcement is the real gate.
- **Memory of seeded test data** — local SQLite has 115 orders for testing (yesterday + today). Production deploys should start clean.

# Frontend TODO — Smart POS Admin

Last refreshed: 2026-05-17

This file used to be the migration plan from `smart_pos-main` → `alpha_pos`.
That migration is done. What's left is the feature backlog: backend
endpoints that exist but the panel doesn't surface yet, plus polish work.

For status of the questionnaire questions (Q0–Q15), see
`docs/review-answers.md`.

---

## 1. What's wired and working

Every page in the active nav loads against the alpha_pos backend.
`yarn ci` (lint:ci + build) passes clean.

**Modules covered end-to-end:**

| Section | Pages |
|---|---|
| Dashboard | Today snapshot (`/dashboard/today`), AI Assistant |
| Management | Users, Categories, Products, Orders, Places & Tables, Discounts, Shifts, Cash Register, Loyalty |
| HR | Departments, Salaries, Expenses, Attendance, Leaves, Contracts |
| Stock | Items, Levels, Batches, Categories, Units, Locations, Suppliers, Purchase Orders, Recipes, Production Orders, Transfers, Stock Counts, Transactions, Product Links, Variance Codes, Settings |
| Analytics | Menu Engineering, Demand Forecast, Audit Log |
| System | Notifications, App Settings |

**Cross-cutting features:**

- CASL abilities built from `user.permissions`.
- 3 locales (uz/ru/en) with ~280 keys.
- `Idempotency-Key` auto-attached on order create/pay/cancel, inkassa/perform, loyalty/redeem.
- 1C export download from the orders page.
- Shift performance scorecard dialog from the shifts page.
- Backend-error translation via `src/composables/useApiError.ts`.

---

## 2. P1 — Backend-blocked

| Item | Backend ask | Tracked in |
|---|---|---|
| Localized error messages remain stable as backend wording changes | Stable `code` field on every error response | `docs/BACKEND_FEEDBACK.md §1` |
| Production deploy | `django-cors-headers` for the deployed admin origin | `docs/BACKEND_FEEDBACK.md §2` |
| Generated TS types instead of hand-typed `any` | OpenAPI / drf-spectacular endpoint | `docs/BACKEND_FEEDBACK.md §3` |
| Multi-branch deployment story | Document `BRANCH_ID` enforcement contract | `docs/BACKEND_FEEDBACK.md §4` |

---

## 3. P2 — Frontend backlog (backend ready)

The backend already exposes these; we just haven't wired the UI yet.
Ordered by user-visible impact.

### Order item-level editing dialog
Backend ready: `/orders/{id}/add-item`, `PATCH /orders/{id}/items/{item_id}`,
`DELETE /orders/{id}/items/{item_id}/remove`,
`/orders/{id}/items/{item_id}/{ready,unready}`.
Today the orders page is list + pay/cancel only.

### Bulk ops UI
Backend has `/categories/bulk-{delete,restore}`,
`/products/bulk-{delete,restore}`. No frontend yet.

### Notifications template editor
Backend ready: `GET/PUT /api/admins/notifications/templates/{id}` plus
the sandboxed template formatter. We list templates but don't edit them.

### Telegram bot text editor
Same data path as the notifications template editor — every message the
customer bot sends is a notification template under the same admin API.
Once the template editor lands this is a free win.

### Stock advanced features
- Item barcode lookup (`/items/barcode/{barcode}`)
- Adjust dialog (`/levels/adjust`)
- Reservations (`/levels/reserve`, `/levels/release-reservation`)
- Batch consumption (`/batches/{id}/consume`, `/batches/auto-consume`)
- Recipe cost analysis (`/recipes/{id}/cost`)
- Purchase order receiving flow (`/purchase-orders/{id}/receive`)
- Low-stock view (currently just a count on the dashboard — make a dedicated page)

### Roles management page
Backend has `User.RoleChoices` but no roles-CRUD endpoint. List is
hard-coded today (`ADMIN`, `CASHIER`, `WAITER`, `USER`). Acceptable for
v1; build a real page only if roles become dynamic.

### Auth sessions management
`GET /auth-sessions`, revoke session, `POST /auth-logout-all`. No UI.
Profile page would be the right home.

### Licensing setup wizard
Backend has `/api/licensing/setup` (one-time invite → license exchange)
and kill-switch middleware. Today operators run this from CLI. Worth a
dedicated bootstrap page if non-technical operators self-serve.

### Move auth token to httpOnly cookie
Backend already sets `session_key` cookie on login. Frontend uses the
Bearer header / localStorage path. Switching is `withCredentials: true`
+ drop localStorage. Defer until first customer-facing PWA.

---

## 4. P3 — Polish

- Confirm dialogs everywhere instead of `confirm()` / `prompt()`.
- Replace remaining `any` types once OpenAPI lands.
- Promote `yarn smoke` (Playwright) from `workflow_dispatch` to PR-gating once staging backend is reachable from CI runners.
- Per-page accessibility pass (keyboard nav, focus management on dialogs).
- Bundle-size pass (current dist is ~2 MB / 640 KB gzip — biggest wins are dropping unused Vuetify components and code-splitting heavy stock pages).

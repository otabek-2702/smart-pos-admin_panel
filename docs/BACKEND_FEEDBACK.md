# Backend Feedback — Smart POS / alpha_pos

Last reviewed: 2026-05-17 against backend commit `b72eab0`
Frontend: `c:/Users/Jason/Desktop/Projects/smart-pos-admin_panel/` @ `main`
Backend: `C:/Users/Jason/Desktop/Projects/alpha_pos/`

This doc tracks open requests we have for the backend team. Items get
crossed off as they ship; new ones get appended at the bottom.

---

## ✅ Resolved since the 2026-04-29 audit

The backend team has shipped most of the original blockers. For the
record:

- **Admin user CRUD** — `/api/admins/users` GET/POST + `/users/{id}` GET/PATCH/DELETE shipped. Frontend re-pointed.
- **Native Inkassa endpoints** — `/api/admins/inkassa/{balance,stats,history,perform,{id}}` shipped. Frontend re-pointed off the HR cash stopgap.
- **Order status spelling** — normalized to `CANCELED` (one L) across stock + hr + orders. Frontend aligned.
- **Idempotency** — `@idempotent` decorator added on order create/pay/cancel and inkassa/perform and loyalty/redeem. Frontend axios interceptor now auto-attaches `Idempotency-Key`.
- **Audit log** — `GET /api/admins/audit-log` shipped. Frontend page wired.
- **1C export** — `GET /api/admins/exports/1c?from=&to=` shipped. Frontend download button wired.
- **Owner dashboard snapshot** — `GET /api/admins/dashboard/today`. Frontend home page rewritten.
- **Menu engineering analytics** — `GET /api/admins/analytics/menu-engineering`. Frontend page wired.
- **Shift performance scorecard** — `GET /api/admins/analytics/shifts/{id}`. Frontend dialog wired.
- **Demand forecast** — `GET /api/admins/forecast/tomorrow`. Frontend page wired.
- **Loyalty program** — `/notifications/loyalty/{settings,accounts,redeem}` shipped. Frontend page wired.
- **CORS** — backend now gates credentials and is reachable from the panel in dev via the Vite proxy. Production CORS config still TBD per deployment.

Many quiet wins too: drf-spectacular-style typing, audit trail on sensitive mutations, idempotency, cache-on-singleton-load, prefetch fixes, the Telegram bot, QR self-order, licensing kill-switch.

---

## 🟡 Still open

### 1. Stable `error_code` on every error response

Today error payloads look like:

```json
{ "success": false, "message": "Invalid credentials" }
```

The frontend translates `message` to the user's locale by matching the
English literal against a hard-coded map in
`src/composables/useApiError.ts`. That works but is fragile — changing
the wording from `"Invalid credentials"` to `"Login failed"` silently
breaks every translation.

**Request:** add a stable `code` field on every error response:

```json
{ "success": false, "code": "INVALID_CREDENTIALS", "message": "Invalid credentials" }
```

Suggested codes (current literals → codes):

| Current `message` | Suggested `code` |
|---|---|
| Invalid credentials | `INVALID_CREDENTIALS` |
| Account is suspended | `ACCOUNT_SUSPENDED` |
| Admin access required | `ADMIN_REQUIRED` |
| You are not authorized for this branch | `WRONG_BRANCH` |
| Authentication required / Missing token | `AUTH_REQUIRED` |
| Invalid or expired session / Token expired | `SESSION_EXPIRED` |
| Invalid token | `INVALID_TOKEN` |
| You don't have permission to perform this action | `NO_PERMISSION` |
| Current password is incorrect | `WRONG_PASSWORD` |
| Validation failed | `VALIDATION_FAILED` |
| Too many … attempts | `RATE_LIMITED` |
| (record not found) | `NOT_FOUND` |
| (duplicate name/code/slug) | `DUPLICATE` |

Implementation hint: most of these flow through
`ServiceResponse.error / unauthorized / forbidden / validation_error`
in `base/helpers/response.py`. Adding a `code` parameter to those
helpers and threading it through the call sites centralises the change.

For validation errors specifically, please keep the per-field error map:

```json
{
  "success": false,
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "errors": { "email": "Required", "password": "Must be at least 6 characters" }
}
```

### 2. Production CORS configuration

In dev we proxy `/api/*` through Vite, so no CORS issue. In staging /
production the panel will be on a different origin from the API. Please
configure `django-cors-headers` with the deployed admin panel origin(s):

```python
INSTALLED_APPS += ['corsheaders']
MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware', ...]
CORS_ALLOWED_ORIGINS = [
    'https://admin.example.com',
]
CORS_ALLOW_CREDENTIALS = True  # needed because the panel can authenticate via session_key cookie
```

This unblocks Q12 (deploy) on our side.

### 3. OpenAPI / typed schema

`postman_collection.json` is a great manual reference. A live OpenAPI
endpoint (e.g. `drf-spectacular`) would let us generate TypeScript
types for every endpoint instead of hand-typing them as `any`. Would
let us turn `@typescript-eslint/no-explicit-any` back on in
`lint:ci`. Nice-to-have, not urgent.

### 4. `branch_id` enforcement documentation

`auth_service.py:54-56` enforces `settings.BRANCH_ID` against the
user's `branch_id`. Please document:
- How `BRANCH_ID` is configured per deployment (env var? settings file?)
- What the user-facing error looks like (currently lumped under "forbidden")
- Whether the admin panel needs to send a branch header on every request

This becomes important when multi-branch deploys land.

### 5. Pagination key consistency (nice to have)

Different endpoints expose pagination totals under different keys:

- `pagination.total_orders` (orders)
- `pagination.total_users` (users)
- `pagination.total_products` (products)
- `pagination.total_items` (most stock + hr)
- `pagination.total` (some HR endpoints)

The frontend handles all of them, but a single `pagination.total`
across the board would simplify generated client code if/when the
OpenAPI schema lands.

---

## 6. Confirmed working — please don't change unannounced

Frontend code depends on these response shapes. Renames are fine but
please mention them in `WHATS_NEW.md` so we can sync.

| Endpoint | Key fields the frontend reads |
|---|---|
| `POST /api/admins/auth-login` | `data.token`, `data.user.{id, email, first_name, last_name, role, status, branch_id, permissions}` |
| `GET /api/admins/dashboard/today` | `data.today.{revenue, orders, paid_orders, cancelled, open}`, `data.top_products_today[]`, `data.low_stock_count`, `data.clocked_in[]` |
| `GET /api/admins/orders/stats` | `data.total_orders`, `paid_orders`, `preparing_orders`, `ready_orders`, `total_revenue` |
| `GET /api/admins/inkassa/{balance,stats,history}` | `data.balance`, `data.stats.{today,cashier_performance,top_products}`, `data.inkassas[]` |
| `GET /api/admins/users` | `data.users[]`, `data.pagination.total_users` |
| `GET /api/admins/analytics/menu-engineering` | `data.items[].{class, qty_sold, revenue, margin_per_unit, margin_pct, profit}`, `data.summary.{stars, plowhorses, puzzles, dogs, avg_qty, window_days}` |
| `GET /api/admins/analytics/shifts/{id}` | `data.{user_name, status, duration_minutes, orders_total, orders_completed, orders_cancelled, orders_paid, cancel_rate_pct, revenue, avg_prep_seconds, orders_per_hour, revenue_per_hour}` |
| `GET /api/admins/forecast/tomorrow` | `data.predictions[].{product_id, product_name, predicted_quantity, confidence?}`, `data.reason?` |
| `GET /api/admins/audit-log` | `data.logs[].{created_at, actor, action, target_type, target_id, metadata}` |
| `GET /api/admins/exports/1c` | binary XML stream (already correct) |
| `GET /api/admins/notifications/loyalty/settings/` | `data.{is_enabled, stamps_per_completed_order, stamps_per_reward, reward_description}` |
| `GET /api/admins/notifications/loyalty/accounts/` | `data[].{phone_number, stamps_balance, stamps_earned_total, stamps_redeemed_total, updated_at}` |

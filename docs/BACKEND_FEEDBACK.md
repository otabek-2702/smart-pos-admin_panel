# Backend Feedback — Smart POS / alpha_pos

Date: 2026-04-29
New backend: `C:/Users/Jason/Desktop/Projects/alpha_pos/`
Frontend: `c:/Users/Jason/Desktop/Projects/smart-pos-admin_panel/`

This is a **near-total rewrite** of the backend, not a renewal. The base
path, the URL conventions, the auth token, and several endpoint sets all
changed. This document captures the things the **backend** team needs to
know about — gaps, bugs, and inconsistencies the admin panel ran into
while trying to talk to it.

---

## 1. Endpoints the admin panel needs but the new backend does NOT expose

These exist in the frontend today and the backend has **no equivalent at
all**. The relevant pages cannot work until these are provided.

### 1.1 User (admin) CRUD — completely missing

The old backend had `/users` + create/update/delete/status/role. The new
admin-side has **no users endpoints**. HR has `employees`, but those are
not the same concept (employee != login user; HR has no role/password
fields).

Frontend impact: `src/pages/users/index.vue` is dead.

**Requested:**
- `GET    /api/admins/users` (list with `page`, `per_page`, `search`, `role`, `status`)
- `GET    /api/admins/users/{id}`
- `POST   /api/admins/users` (create — `first_name`, `last_name`, `email?`, `password`, `role`, `status`)
- `PATCH  /api/admins/users/{id}` (update profile, role, status, password)
- `DELETE /api/admins/users/{id}` (soft delete)
- `POST   /api/admins/users/{id}/restore`
- `GET    /api/admins/users/stats` (totals by role/status)

### 1.2 Inkassa endpoints — model exists, no URLs

The `Inkassa` model and `InkassaService` exist in
`base/services/inkassa_service.py` and the order service writes to it on
pay/unpay, but no public URL surfaces them.

Frontend impact: `src/pages/inkassa/index.vue` is dead. The dashboard's
"balance" and "today's collection" cards are also dead.

**Requested:**
- `GET  /api/admins/inkassa/balance` → `{ balance, last_collected_at }`
- `GET  /api/admins/inkassa/stats` → `{ today_total, week_total, month_total }` (accept `date_from`/`date_to`)
- `GET  /api/admins/inkassa/history` → paginated list of inkassa records
- `POST /api/admins/inkassa/perform` → `{ amount, notes }` to record a collection / withdrawal
- `GET  /api/admins/inkassa/{id}` → single record detail

If this is intentionally moving into HR cash (`hr/cash/...`), please
confirm — we'll re-point the inkassa page at `cash/balance/`,
`cash/deposit/`, `cash/withdraw/` instead and drop the request above.

### 1.3 Roles management — gone

Old backend had `/roles`, `/roles/{code}/permissions`, etc. The frontend
users page reads `/roles` to populate the role dropdown.

**Requested:** at minimum a `GET /api/admins/roles` returning `[{code, name, permissions[]}]`. Even a hard-coded list works for now. Without it the user dialog has no way to pick a role.

### 1.4 Order create endpoint on the admin side

Admin order URLs accept `POST /api/admins/orders` (the
`require_http_methods(["GET","POST"])` on `orders` view supports it),
but the `create_order_request` validator requires a `user_id` that the
admin panel doesn't know about. Either:
- Document what `user_id` should be (the customer? the cashier?), **or**
- Provide a parallel endpoint that takes `cashier_id` and works without a customer.

Right now we can't build "create order from admin panel" because the
contract is unclear.

---

## 2. Bugs / inconsistencies in the new backend

### 2.1 Order status spelling — backend internal mismatch (still present)

- Model: `base/models.py` declares the order status enum.
- Service: `admins/services/order_service.py:10` →
  `ALLOWED_STATUSES = ['PREPARING', 'READY', 'CANCELLED', 'COMPLETED']` (two Ls).
- View: `admins/views/order_views.py:225` →
  `AdminOrderService.update_order_status(order_id, 'CANCELLED')`.

Please confirm the model's `Order.Status` choices use `'CANCELLED'` (two Ls)
to match the service. If the model still uses `'CANCELED'` (one L) like
the previous backend, this will silently store an unknown enum value.
Frontend will follow whichever spelling lands.

### 2.2 `Hell no` is shipping in production responses

- `admins/services/auth_service.py:49` → `ServiceResponse.forbidden("Hell no")`
- `base/security/permissions.py:24` → same string
- `admins/services/auth_service.py:102` → same string

This message is rendered to end users when a non-admin tries to log in.
Recommend `"Admin access required"` or similar.

### 2.3 `branch_id` enforcement is not documented

`auth_service.py:54-56`:
```python
branch_id = getattr(settings, 'BRANCH_ID', '')
if branch_id and user.branch_id and user.branch_id != branch_id:
    return ServiceResponse.forbidden("You are not authorized for this branch")
```

Please document:
- How `settings.BRANCH_ID` is configured per deployment.
- What the user-facing error should look like (currently lumped under "forbidden").
- Whether the admin panel needs to send a branch header on every request.

### 2.4 Session token vs old JWT — opaque tokens

Login now returns `secrets.token_hex(10)` (a 20-char opaque string) rather
than a JWT. Confirm this is final — frontend currently stores it in
`localStorage.accessToken` and sends `Authorization: Bearer <token>`. Both
the cookie path (`session_key`) and the header path are supported, so we
should be fine, but please flag if the cookie path is preferred.

---

## 3. Response-shape contracts the admin panel reads

The frontend only consumes a small slice of each endpoint's response.
These keys are load-bearing — please don't rename them without telling us:

| Endpoint | Shape relied on |
|---|---|
| `POST /api/admins/auth-login` | `data.token`, `data.user.{id, email, first_name, last_name, role, status}` |
| `GET /api/admins/categories` | `data.categories[]`, `pagination.{total_categories, total_pages, page}` |
| `GET /api/admins/categories/stats` | top-level fields like `total_categories`, `active_categories` |
| `GET /api/admins/products` | `data.products[]`, `pagination.total_products` |
| `GET /api/admins/products/stats` | dashboard cards |
| `GET /api/admins/orders` | `data.orders[]`, `pagination.total_orders` |
| `GET /api/admins/orders/stats` | `total_orders`, `paid_orders`, `preparing_orders`, `ready_orders`, `total_revenue` |
| `GET /api/admins/orders/stats/dashboard` | currently unused, but we'd like to switch the dashboard to it |
| `GET /api/admins/stock/items/` | `data.items[]`, `pagination.total_items` |
| `GET /api/admins/stock/recipes/` | `data.recipes[]`, pagination |
| (etc. for every stock list endpoint) | |

Pagination total keys are currently inconsistent across endpoints
(`total_orders`, `total_users`, `total_products`, etc.). A single
`pagination.total` would simplify the client. Not blocking, just noting.

---

## 4. Conventions worth aligning

The new backend uses two URL conventions side by side:

- **REST-style** in stock / hr / discounts / notifications: trailing slash,
  HTTP method does the work.
  - `GET/POST /api/admins/stock/items/`
  - `GET/PUT/PATCH/DELETE /api/admins/stock/items/{id}/`
- **Verb-suffix-style** in admins: no trailing slash, `/foo`, `/foo/{id}`,
  custom action paths.
  - `GET/POST /api/admins/categories`
  - `GET/PUT/PATCH/DELETE /api/admins/categories/{id}`
  - `POST /api/admins/categories/{id}/toggle`

Inside `admins/` itself the convention is consistent. The mismatch with
`stock/` is awkward but not a blocker.

---

## 4b. CORS — required for production

Currently the backend ships **no CORS headers**, so the browser blocks every cross-origin request from the admin panel. In dev we work around it via a Vite proxy (`vite.config.ts → server.proxy`) that makes requests look same-origin. **In production this won't apply** and the panel will fail to reach the API.

Please install and configure `django-cors-headers`:

```bash
pip install django-cors-headers
```

In `alpha_pos/settings.py`:

```python
INSTALLED_APPS = [..., 'corsheaders', ...]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # ↑ before CommonMiddleware
    'django.middleware.security.SecurityMiddleware',
    ...
]

# In dev: allow the local admin panel
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5181',
    'http://127.0.0.1:5181',
]
CORS_ALLOW_CREDENTIALS = True  # required since the panel can authenticate via session_key cookie
```

For production, replace `CORS_ALLOWED_ORIGINS` with the deployed admin panel URL.

## 4c. Error responses — please return a stable `error_code`

Right now error responses look like this:
```json
{ "success": false, "message": "Invalid credentials" }
```

The frontend wants to translate that message to Uzbek / Russian / English so the user sees their language. Today we do this by matching the **English literal** of `message` against a hard-coded map in [src/composables/useApiError.ts](src/composables/useApiError.ts). That works but is fragile — if you change the wording from `"Invalid credentials"` to `"Login failed"`, every translation breaks silently.

**Please add a stable `error_code` field on every error response:**

```json
{ "success": false, "code": "INVALID_CREDENTIALS", "message": "Invalid credentials" }
```

Suggested codes (existing literals → codes):

| Current `message` | Suggested `code` |
|---|---|
| Invalid credentials | `INVALID_CREDENTIALS` |
| Account is suspended | `ACCOUNT_SUSPENDED` |
| Hell no / Admin access required | `ADMIN_REQUIRED` |
| You are not authorized for this branch | `WRONG_BRANCH` |
| Authentication required / Missing token | `AUTH_REQUIRED` |
| Invalid or expired session / Token expired | `SESSION_EXPIRED` |
| Invalid token | `INVALID_TOKEN` |
| You don't have permission to perform this action | `NO_PERMISSION` |
| Current password is incorrect | `WRONG_PASSWORD` |
| Validation failed | `VALIDATION_FAILED` |
| Invalid JSON / Expected JSON object | `INVALID_JSON` |
| Too many login attempts. Try again in 15 minutes | `RATE_LIMITED` |
| (record not found, e.g. category/product/user) | `NOT_FOUND` |
| (duplicate name/code/slug) | `DUPLICATE` |

Implementation hint: most of these flow through `ServiceResponse.error(...)` / `ServiceResponse.unauthorized(...)` / `ServiceResponse.forbidden(...)` / `ServiceResponse.validation_error(...)` in [base/helpers/response.py](C:/Users/Jason/Desktop/Projects/alpha_pos/base/helpers/response.py). Adding a `code` parameter to those helpers and threading it through the call sites would centralise the change.

For validation errors specifically, also include the per-field error map you already have:

```json
{
  "success": false,
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "errors": { "email": "Required", "password": "Must be at least 6 characters" }
}
```

Once the codes ship, we'll switch the frontend map from "literal → key" to "code → key" — won't need to redeploy the panel for backend wording changes.

## 5. Endpoints we'd like added (nice-to-have)

These would unlock features without us reinventing them client-side:

- `GET /api/admins/auth-permissions` (or have `/auth-me` return the full
  permission catalogue, not just the user's own permissions). This would
  let us build CASL abilities from real backend data instead of hardcoding
  `[{action: 'manage', subject: 'all'}]`.
- `GET /api/admins/orders/{id}/timeline` — single endpoint that returns
  status changes + payment events for the order detail dialog.
- `OPTIONS` / OpenAPI schema — old backend had `drf-spectacular` at
  `/api/docs/`. The new backend has `postman_collection.json` — useful
  but static. A live `/api/schema/` would let us auto-generate types.

---

## 6. Summary of what we're asking for

| # | Severity | Ask |
|---|---|---|
| 1.1 | **Blocker** | Provide admin user CRUD endpoints (`/api/admins/users`) |
| 1.2 | **Blocker** | Expose Inkassa endpoints (`/api/admins/inkassa/...`) — or confirm we should pivot to `hr/cash/*` |
| 1.3 | **Blocker** | Provide a roles list endpoint (even hard-coded) |
| 1.4 | High | Document or simplify the admin `POST /orders` contract |
| 2.1 | High | Confirm model status spelling matches `'CANCELLED'` |
| 2.2 | Low | Replace `"Hell no"` with a professional error message |
| 2.3 | Low | Document `BRANCH_ID` setup |
| 2.4 | Low | Confirm Bearer header is officially supported (not just cookie) |

Once the three blockers in §1 land, every page in the admin panel can be
re-pointed at the new backend. Everything else is polish.

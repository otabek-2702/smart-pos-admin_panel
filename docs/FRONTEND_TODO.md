# Frontend TODO — Smart POS Admin

Date: 2026-04-29
New backend: `C:/Users/Jason/Desktop/Projects/alpha_pos/`

The new backend (`alpha_pos`) is structurally a different project from the
old one (`smart_pos-main`), not a refactor. **Almost every URL in the
admin panel needs updating.** This file is the migration plan.

---

## 1. The blast radius (read this first)

| Change | Frontend files affected |
|---|---|
| All admin endpoints moved from `/` to `/api/admins/` | `src/plugins/axios.ts` (baseURL or interceptor) + every page that uses an admin URL |
| Login moved from `/admins-api/login` → `/api/admins/auth-login` | `src/pages/login.vue` |
| Stock endpoints moved from `/items/`, `/recipes/`, … → `/api/admins/stock/items/`, `/api/admins/stock/recipes/`, … | every page under `src/pages/stock/**` |
| URL convention changed: old verbs `/users/create`, `/users/{id}/update`, `/users/{id}/delete` no longer exist — new pattern is `POST /resource`, `PATCH /resource/{id}`, `DELETE /resource/{id}` | categories, products, orders pages |
| Order status spelling: backend now uses `'CANCELLED'` (two Ls); frontend uses `'CANCELED'` (one L) | `src/pages/orders/index.vue:29,299,310`, `src/types/order.ts:1`, `src/constants/statusColors.ts:6` |
| Token type: backend now returns an opaque random hex string instead of a JWT — Bearer flow still works, but anything that decodes the JWT will break | check `src/router/utils.ts`, `src/plugins/casl/*` |
| Removed entirely from backend: `/users/*`, `/roles/*`, `/inkassa/*` | `src/pages/users/index.vue`, `src/pages/inkassa/index.vue`, role dropdown — see `BACKEND_FEEDBACK.md` §1 for what we asked for |

---

## 2. Migration plan (do these in order)

### Step 1 — change baseURL (single edit, unblocks most pages)

`src/plugins/axios.ts`: change
```ts
baseURL: 'http://127.0.0.1:8000'
```
to
```ts
baseURL: 'http://127.0.0.1:8000/api/admins'
```

Then, only stock pages need a `/stock/...` prefix. Every other page
already uses paths that align with the new layout once the baseURL changes
— for example `/categories` becomes `/api/admins/categories`, `/orders`
becomes `/api/admins/orders`.

### Step 2 — fix login

`src/pages/login.vue:37`: change
```ts
axiosIns.post('/admins-api/login', {...})
```
to (with the new baseURL above)
```ts
axiosIns.post('/auth-login', {...})
```

Response shape is unchanged (`data.token`, `data.user`).

### Step 3 — fix CRUD URL pattern (categories, products, orders)

The new backend uses REST-style on the same URL with different methods.
Replace these:

**Categories:**
| Old | New |
|---|---|
| `POST /categories/create` | `POST /categories` |
| `PUT  /categories/{id}/update` | `PATCH /categories/{id}` |
| `DELETE /categories/{id}/delete` | `DELETE /categories/{id}` |

Files: `src/pages/categories/index.vue:237, 241, 264`.

**Products:**
| Old | New |
|---|---|
| `POST /products/create` | `POST /products` |
| `PUT  /products/{id}/update` | `PATCH /products/{id}` |
| `DELETE /products/{id}/delete` | `DELETE /products/{id}` |

Files: `src/pages/products/index.vue:177, 181, 203`.

**Orders:** the old `update`/`delete` paths weren't used. Pay/cancel still
work — verify URL paths only:
| Old | New |
|---|---|
| `POST /orders/{id}/pay` | `POST /orders/{id}/pay` (unchanged) |
| `POST /orders/{id}/cancel` | `POST /orders/{id}/cancel` (unchanged) |

Files: `src/pages/orders/index.vue:92, 104` — only need the baseURL change.

### Step 4 — fix order status spelling

Backend now standardises on `'CANCELLED'` (two Ls). Replace `'CANCELED'`
in three places:
- `src/pages/orders/index.vue:29` — `orderStatuses` array
- `src/pages/orders/index.vue:299` — `v-if="!item.raw.is_paid && item.raw.status !== 'CANCELED'"`
- `src/pages/orders/index.vue:310` — `v-if="item.raw.status !== 'CANCELED' && ..."`
- `src/types/order.ts:1` — type union
- `src/constants/statusColors.ts:6` — `CANCELED` key (and remove the duplicate `CANCELLED` key already there)

### Step 5 — re-prefix stock pages

For every page under `src/pages/stock/**` that uses `/items/`, `/units/`,
`/locations/`, `/categories/`, `/suppliers/`, `/recipes/`,
`/production-orders/`, `/purchase-orders/`, `/transfers/`,
`/transactions/`, `/batches/`, `/levels/`, `/counts/`, `/variance-codes/`,
`/product-links/`, `/settings/`, `/ai/...`, change the path to add a
`/stock/` prefix.

Cleanest approach: introduce a helper composable (or a second axios
instance with `baseURL: '/api/admins/stock'`) so every stock page imports
it instead of editing 17 files. Recommended:

```ts
// src/plugins/axios.ts
export const stockApi = axios.create({ baseURL: 'http://127.0.0.1:8000/api/admins/stock' })
// (mount the same request/response interceptors)
```

Then in stock pages:
```ts
import { stockApi } from '@/plugins/axios'
stockApi.get('/items/', { params })
```

This way the URLs inside the page files don't need to change at all — they
already match the new backend's stock layout, just with an extra prefix
that `stockApi` injects.

### Step 6 — disable/remove broken pages until backend ships them

Pages with no backend equivalent (see `BACKEND_FEEDBACK.md` §1):

- `src/pages/users/index.vue` — admin user CRUD endpoints don't exist in alpha_pos. Options: hide the nav entry (`src/navigation/vertical/management.ts`), or repoint it at `/api/admins/hr/employees/`.
- `src/pages/inkassa/index.vue` — inkassa URLs don't exist. Either wait for backend or repoint to `/api/admins/hr/cash/{balance,deposit,withdraw}` and the cash list. The HR cash module looks like a viable replacement.
- The `loadRoles()` call on the users page reads `/roles` which no longer exists. Until a roles endpoint lands, hard-code the role list from the User model (`ADMIN`, `CASHIER`, `WAITER`, etc.) on the client.

### Step 7 — verify response shapes

After the URL fixes, the data the pages already render (`data.items[]`,
`pagination.total_items`, etc.) should still work because the new backend
uses the same `ServiceResponse.success(data=...)` envelope. But spot-check
each page in the browser before claiming it's done.

---

## 3. New backend modules worth adopting (after step 6)

The new backend ships with a lot of features the old one didn't. These
are real new pages we can build:

### High-value

- **HR module** (`/api/admins/hr/...`) — employees, departments, salaries, expenses, contracts, attendance, leaves, documents, reviews, goals, events. Probably its own top-level navigation section.
- **Discounts** (`/api/admins/discounts/...`) — discount types, discount validation, apply/remove, secret-word validation. Add to the order page; new "Discounts" page for management.
- **Notifications** (`/api/admins/notifications/...`) — settings, types, templates, queue, logs. New "Notifications" page.
- **Places & tables** (`/api/admins/places`, `/api/admins/tables`) — needed for HALL orders. New "Floor plan" page.
- **Shifts** (`/api/admins/shifts`, `/api/admins/shift-templates`) — cashier shift management.
- **Order stats expansion** — `/orders/stats/{daily,monthly,yearly,cashiers,statuses,order-types,top-products,least-sold,categories,hourly,dashboard}`. The dashboard page should switch from cobbling stats together to using `orders/stats/dashboard` directly.
- **App settings** — `/api/admins/app-settings`. Settings page.

### Medium

- **Sync system** (`/api/sync/...`) — for offline / multi-branch sync. Probably a maintenance page.
- **Auth sessions** (`/api/admins/auth-sessions`) — list active sessions, revoke. Profile page.
- **Auth change password** (`/api/admins/auth-change-password`) — Profile page.

### Skip for the admin panel

- `/api/waiters/...` — waiter role uses a different client (the desktop POS).
- `/` (customers app) — for customer-facing display app, not the admin panel.

---

## 4. Permissions (CASL)

The new backend ships a per-permission system. `/auth-me` and login both
return `user.permissions: string[]`. For ADMIN role this is `['*']`.

Currently the frontend hard-codes
`localStorage.userAbilities = [{action: 'manage', subject: 'all'}]`. This
keeps working for ADMIN users. When we start onboarding non-ADMIN roles,
build the abilities from `user.permissions` instead — each permission
string is `<resource>.<action>` (e.g. `category.create`, `order.update`).

Update site: `src/pages/login.vue:47-49`.

---

## 5. Suggested order of work

1. (10 min) Step 1 — change baseURL.
2. (10 min) Step 2 — login URL.
3. (30 min) Steps 3 & 4 — categories/products/orders URL pattern + status spelling.
4. (1 hr) Step 5 — stock pages get a `stockApi` instance.
5. (30 min) Step 6 — hide users/inkassa nav entries until backend ships them. Update memory.
6. (variable) Step 7 — smoke-test every page in browser.
7. After core flows work: pick from §3 to add new pages.

Each step is independently shippable. Step 1 unblocks visual debugging on
every other page (you'll see 404s for the URL patterns that still need
updating).

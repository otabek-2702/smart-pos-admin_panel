# Backend tasks — Alpha POS Admin Panel

Living list of backend work needed for the admin panel FE. Delete an item once verified done (FE consumes it correctly, contract tests pass).

Backend repo: `C:\Users\Jason\Desktop\Projects\alpha_pos\` (Django REST). Admin endpoint mount: `/api/admins/*`.

---

## Open

### 1. Date-filterable dashboard endpoint
**Why:** FE topbar exposes a date range. Today only `/dashboard/today` exists — single snapshot, no range support.

**Need:** `GET /dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` returning the same shape as `/dashboard/today` but aggregated across the range (revenue, orders, paid_orders, top_products, low_stock_count, clocked_in). Defaults to today when params absent.

### 2. Sidebar counts endpoint (single batched call)
**Why:** FE polls `/shifts/active` + `/orders/stats?date_from=today&date_to=today` every 90s to fill nav badges. Two requests, both per-tab, multiplies on every page load.

**Need:** `GET /sidebar-counts` returning `{ active_shifts: N, today_orders: N, today_revenue: "decimal" }`. One round trip.

### 3. AI conversation persistence
**Why:** FE stores chat history in localStorage only (40-cap, browser-bound). User loses history when clearing cookies / switching devices.

**Need:**
- `GET /ai/conversations` → list `[{id, title, updated_at, message_count}]`
- `GET /ai/conversations/{id}` → `{id, title, messages: [{id, role, content, ts}]}`
- `POST /ai/conversations` → create empty, returns id
- `PATCH /ai/conversations/{id}` → `{ title? }`
- `DELETE /ai/conversations/{id}`
- Modify `POST /ai/query/` to accept optional `conversation_id`; if present, persist user + assistant messages to that conversation. If absent, behave as today (anonymous).

### 4. Stable order display number
**Why:** `display_id` is a kitchen-handoff counter that wraps at `DISPLAY_ID_WRAP_AT` (~100). Two orders can share `display_id=1`. FE currently shows `#{o.id}` (DB PK) as primary which is correct but exposes internal sequence.

**Need:** Decide one of:
- (a) Add a non-wrapping `order_number` field to Order model + serializer (per-day or per-shift sequence that doesn't reset until you choose).
- (b) Document `display_id` as kitchen-only, keep FE on `o.id`. No code change, just confirm.

Tag the answer here so we close the loop.

### 5. Orders list — include items inline OR provide cheap detail endpoint
**Why:** FE shift-handover quick-view modal lazy-fetches `/orders/{id}` to show line items. Each receipt row click = one request. List view also expands rows to show items via `o.items` field if present.

**Need:** Either (preferred):
- (a) `/orders` list response include `items: [{product__name, quantity, price}]` inline (LIGHT serializer — name + qty + price only, no nested product objects).
- (b) Or confirm `GET /orders/{id}` returns `data.items` array w/ those fields. Currently FE expects `data.items` or `data.order.items`.

### 6. Sales stats by payment method
**Why:** Orders page may add payment-method breakdown KPIs (Cash vs Card vs Digital). Today's `/orders/stats` returns totals only.

**Need:** Add `payment_breakdown: { CASH: { count, revenue }, CARD: {…}, … }` to existing `/orders/stats` response. Same date filter behavior.

---

## Done — verified
*(none yet)*

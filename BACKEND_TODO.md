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

### 7. AI system prompt: instruct markdown output
**Why:** FE now renders AI replies as full markdown (headings, bold, lists, tables, fenced code w/ syntax highlight). BE system prompt currently says "Use simple text formatting with dashes and line breaks" — FE wants richer formatting.

**Need:** In `stock/services/ai_assistant_service.py` SYSTEM_PROMPT, replace the formatting line w/:
> Format your responses in Markdown. Use headings, **bold**, bullet and numbered lists, tables, and fenced code blocks with a language tag where relevant. Keep formatting purposeful, not excessive.

Plus: keep dates ISO, money w/ space-thousands separator (FE post-processes commas → spaces), units suffix (kg, g, dona).

### 8. Business-day boundary setting (configurable day start)
**Why:** Restaurants run overnight shifts past midnight. Splitting by calendar midnight assigns sales to wrong day.

**Need:**
- Add per-restaurant setting `business_day_start` (TimeField, default `03:00`).
- Helper: given a calendar date + day-start + restaurant timezone, return window `[date @ start, date+1 @ start)`. Tashkent = UTC+5 fixed, no DST.
- ALL dashboard / statistics / shift queries currently filtering by date use this window. Single source of truth.
- Expose `business_day_start` on `/auth/me` (or settings endpoint) so FE can compute the current business date for the preset chips.

**Acceptance:** selecting June 25 → BE returns `2026-06-25 03:00 → 2026-06-26 03:00`. Overnight shift past midnight on the 25th counts toward the 25th.

### 6. Sales stats by payment method
**Why:** Orders page may add payment-method breakdown KPIs (Cash vs Card vs Digital). Today's `/orders/stats` returns totals only.

**Need:** Add `payment_breakdown: { CASH: { count, revenue }, CARD: {…}, … }` to existing `/orders/stats` response. Same date filter behavior.

### 9. Products / Menu performance analytics (Products dashboard)
**Why:** New FE page `src/pages/dash/products.vue` ports the v3 Products & Menu performance dashboard (KPI row + revenue treemap + category donut + pareto + 14-day sparkline trends table). It needs four BE endpoints. Currently the page soft-degrades to an empty state when these 404.

**Need:**
- `GET /analytics/products/overview?range=30d` →
  `{ menuItems: int, categoryCount: int, bestSellerName: str, bestSellerUnits: int, units30d: int, units30dDelta: float|null, menuRevenue: decimal, menuRevenueDelta: float|null }`
- `GET /analytics/products/categories?range=30d` →
  `[{ label: str, value: decimal, color?: str }]` (top 6 used; revenue per category over the range)
- `GET /analytics/products/pareto?range=30d` →
  `[{ label: str, value: decimal }]` (per-product revenue; FE sorts + cumulates to 80% reference)
- `GET /analytics/products/trends?days=14` →
  `[{ name: str, units: int, revenue: decimal, delta: float, spark: [int x days] }]` (top movers; `spark` is per-day units, length = `days`)

`range` accepts the same tokens as other analytics endpoints (`30d`, `7d`, etc.); calendar boundaries should respect the `business_day_start` setting from item #8 above when that lands.

### 10. Staff performance endpoint (Staff & Shifts dashboard)
**Why:** FE page `src/pages/dash/staff.vue` (v3 port) renders a 4-tile KPI strip + leaderboard + skill-radar + orders-vs-revenue scatter + hours/punctuality stacked bar. Currently consumes the static fixture in `src/pages/dash/_mock/dashdata.ts` (`staff` array). No BE endpoint exists.

**Need:** `GET /staff/performance?range=30d` →
`[{ id: int, name: str, initials: str, revenue: decimal, orders: int, aov: decimal, hours: int, speed: int (0-100), accuracy: int (0-100), upsell: int (0-100), attendance: int (0-100) }]`

Rows pre-sorted by `revenue` desc preferred but FE re-sorts defensively. `range` accepts the same tokens as other analytics endpoints (`30d`, `7d`, etc.); calendar boundaries should respect the `business_day_start` setting from item #8 when that lands.

Stretch (future): aggregated `/staff/performance/summary?range=30d` returning `{ active_count, top_performer: {name, revenue}, avg_accuracy: pct, total_hours: int }` for the KPI tiles so FE doesn't recompute on the client.

---

## Done — verified
*(none yet)*

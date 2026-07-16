# Backend tasks — Alpha POS Admin Panel

Living list of backend work needed for the admin panel FE. Delete an item once verified done (FE consumes it correctly, contract tests pass).

Backend repo: `C:\Users\Jason\Desktop\Projects\alpha_pos_server\` (Django REST). Admin endpoint mount: `/api/admins/*`.

---

## Recent updates from Abrorbek (2026-06-25 + 2026-06-27)

**2026-06-25:** items **1, 2, 3, 5, 6, 7, 8, 9, 10** shipped.
**2026-06-27:** items **4** (order_number — assigned + exposed), **11** (shift fields + filters), **12** (sales dashboard), **13** (product affinity / chord), **14** (orders include_items) shipped. Verified locally end-to-end against a 827-order / 30-day seed:
- Item 4: `/orders` payload exposes `order_number` (null on pre-migration rows); FE renders `#order_number ?? #display_id`.
- Item 11: all 14 fields present in `/shifts` list; active shift correctly rolls up live (Nico shift = 6 orders / 1.24M gross / 84k cash / 1.155M card).
- Item 12: `/dashboard/sales` keys exact spec match; hub Sotuvlar tab populated.
- Item 13: chord diagram renders pairs (Classic Combo #61 + House Cheesecake #76).
- Item 14: `/orders` list response includes `items[]` inline; no more N+1.

**Repo clarification:** canonical backend is `C:\Users\Jason\Desktop\Projects\alpha_pos_server\`. The older `C:\Users\Jason\Desktop\Projects\alpha_pos\` monolith on `prelaunch-fixes` is superseded.

Open questions sent back to Abrorbek (msg 35):
- Shift status enum: `OPEN` vs `ACTIVE` for running shifts (`_serialize_shift` checks `status == 'ACTIVE'`).
- `/shifts/active` returns 0 items while `/shifts` list returns running rows.

---

## Done — from full QA pass (items 18-22, shipped by Abrorbek 2026-07-02, deploy 51db311 / core cdb1ada, migration 0035)
All five verified end-to-end against prod BE with real data, FE wired + merged to main (7bd55aa).

- **18. `/users` created_at** ✅ — was a missing column, added + backfilled all 11 (ISO-8601 +00:00). FE "Yaratilgan" column renders dates.
- **19. `/categories` product_count** ✅ — live count excludes soft-deleted. FE card shows "{n} ta mahsulot" (was the meaningless sort_order "#0").
- **20. `/orders/stats` status_counts + payment_counts** ✅ — global/windowed. FE OrdersInsights now uses them (verified Tayyor 6614, paid 6828 — full set, not page). NOTE from BE: PAID/UNPAID reuse paid_orders/unpaid_orders semantics (UNPAID excludes OPEN & CANCELED). Fine for our card; ping BE if a pure is_paid split is ever wanted.
- **21. `/dashboard/operations` prepByCategory.mins** ✅ — avg prep float minutes + target (15-min placeholder SLA, no config field yet). Was a key-name gap (BE emitted avg_prep_seconds, FE reads mins — both present now). Prep card shows real bars.
- **22. `/dashboard?from&to` category_stats** ✅ — added to range payload, same shape as category_stats_today. Exec category card now tracks the picker (30d Lavashlar 59.89M).

### Verified working (no BE action) — 2026-07-02
- `POST /shifts/{id}/end` exists and works (200). FE was not calling it — fixed on FE (end-shift button now closes the shift, refreshes to awaiting-cash). `POST /shifts/{id}/reconcile` already wired correctly.

---

## Open

### 24. Canonical 07:00–03:00 reporting window and exact custom datetimes
**Why:** Alfa POS operates from 07:00 on business date `D` until 03:00 on
`D+1`. The current backend helper models a 24-hour same-cutover window
(`business_day_start` → the same time next day), and `tod_from` / `tod_to` is
repeated for every day in a range. Neither can represent the required default
window or an exact multi-day custom interval.

**Need:**

- Default date `D`: `[D 07:00, D+1 03:00)`; range `D1..D2`:
  `[D1 07:00, D2+1 03:00)`. The closed 03:00–07:00 interval must not enter
  default reporting.
- Add unambiguous continuous custom datetime parameters (for example
  `from_at` / `to_at`, ISO-8601) for an exact `[from_at, to_at)` window. Do
  not use the existing repeated per-day `tod_from` / `tod_to` semantics for
  this case.
- Use one canonical helper for every date-driven dashboard/stat/summary:
  dashboard, sales, operations, product/staff/shift analytics, orders and
  order stats, shifts, exports, and KPIs.
- Include effective `start_at` / `end_at` in returned range metadata. Preserve
  equal-length previous-period comparison (N selected business dates vs the
  immediately preceding N).
- Add boundary tests at 06:59, 07:00 and 03:00; a four-day previous-period
  comparison; and 10 Jul 10:00 → 11 Jul 22:00 custom selection.

**Status:** Sent to Abrorbek for implementation and production deployment on
2026-07-16 (dev-bot message 100). Not verified; frontend must not claim this
is live until the backend branch is reviewed and tested.

### 1. Date-filterable dashboard endpoint
**Why:** FE topbar exposes a date range. Today only `/dashboard/today` exists — single snapshot, no range support.

**Need:** `GET /dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` returning the same shape as `/dashboard/today` but aggregated across the range (revenue, orders, paid_orders, top_products, low_stock_count, clocked_in). Defaults to today when params absent.

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-25). FE wiring in progress.

### 2. Sidebar counts endpoint (single batched call)
**Why:** FE polls `/shifts/active` + `/orders/stats?date_from=today&date_to=today` every 90s to fill nav badges. Two requests, both per-tab, multiplies on every page load.

**Need:** `GET /sidebar-counts` returning `{ active_shifts: N, today_orders: N, today_revenue: "decimal" }`. One round trip.

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-25). FE wiring in progress.

### 3. AI conversation persistence
**Why:** FE stores chat history in localStorage only (40-cap, browser-bound). User loses history when clearing cookies / switching devices.

**Need:**
- `GET /ai/conversations` → list `[{id, title, updated_at, message_count}]`
- `GET /ai/conversations/{id}` → `{id, title, messages: [{id, role, content, ts}]}`
- `POST /ai/conversations` → create empty, returns id
- `PATCH /ai/conversations/{id}` → `{ title? }`
- `DELETE /ai/conversations/{id}`
- Modify `POST /ai/query/` to accept optional `conversation_id`; if present, persist user + assistant messages to that conversation. If absent, behave as today (anonymous).

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-25). FE wiring in progress.

### 4. Stable order display number
**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-27, commit da234fb). Added non-wrapping `order_number` PositiveIntegerField + migration 0034. FE wired (orders list + confirm dialog prefer `order_number ?? display_id`). Verified locally.

### 5. Orders list — include items inline OR provide cheap detail endpoint
**Why:** FE shift-handover quick-view modal lazy-fetches `/orders/{id}` to show line items. Each receipt row click = one request. List view also expands rows to show items via `o.items` field if present.

**Need:** Either (preferred):
- (a) `/orders` list response include `items: [{product__name, quantity, price}]` inline (LIGHT serializer — name + qty + price only, no nested product objects).
- (b) Or confirm `GET /orders/{id}` returns `data.items` array w/ those fields. Currently FE expects `data.items` or `data.order.items`.

**Status:** ✅ Verified in `alpha_pos_server/admins/services/order_service.py` `_serialize_order_list` — the `/orders` list response already includes an inline `items` array with `product__name`, `quantity`, `price` (plus `id`, `product__id`, `product__category__id`, `product__category__name`, `detail`, `ready_at`). Awaiting confirmation — check /orders list response for items[] field. FE wiring in progress.

### 7. AI system prompt: instruct markdown output
**Why:** FE now renders AI replies as full markdown (headings, bold, lists, tables, fenced code w/ syntax highlight). BE system prompt currently says "Use simple text formatting with dashes and line breaks" — FE wants richer formatting.

**Need:** In `stock/services/ai_assistant_service.py` SYSTEM_PROMPT, replace the formatting line w/:
> Format your responses in Markdown. Use headings, **bold**, bullet and numbered lists, tables, and fenced code blocks with a language tag where relevant. Keep formatting purposeful, not excessive.

Plus: keep dates ISO, money w/ space-thousands separator (FE post-processes commas → spaces), units suffix (kg, g, dona).

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-25). FE wiring in progress.

### 8. Business-day boundary setting (configurable day start)
**Why:** Restaurants run overnight shifts past midnight. Splitting by calendar midnight assigns sales to wrong day.

**Need:**
- Add per-restaurant setting `business_day_start` (TimeField, default `03:00`).
- Helper: given a calendar date + day-start + restaurant timezone, return window `[date @ start, date+1 @ start)`. Tashkent = UTC+5 fixed, no DST.
- ALL dashboard / statistics / shift queries currently filtering by date use this window. Single source of truth.
- Expose `business_day_start` on `/auth/me` (or settings endpoint) so FE can compute the current business date for the preset chips.

**Acceptance:** selecting June 25 → BE returns `2026-06-25 03:00 → 2026-06-26 03:00`. Overnight shift past midnight on the 25th counts toward the 25th.

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-25). FE wiring in progress.

### 6. Sales stats by payment method
**Why:** Orders page may add payment-method breakdown KPIs (Cash vs Card vs Digital). Today's `/orders/stats` returns totals only.

**Need:** Add `payment_breakdown: { CASH: { count, revenue }, CARD: {…}, … }` to existing `/orders/stats` response. Same date filter behavior.

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-25). FE wiring in progress.

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

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-25). FE wiring in progress.

### 10. Staff performance endpoint (Staff & Shifts dashboard)
**Why:** FE page `src/pages/dash/staff.vue` (v3 port) renders a 4-tile KPI strip + leaderboard + skill-radar + orders-vs-revenue scatter + hours/punctuality stacked bar. Currently consumes the static fixture in `src/pages/dash/_mock/dashdata.ts` (`staff` array). No BE endpoint exists.

**Need:** `GET /staff/performance?range=30d` →
`[{ id: int, name: str, initials: str, revenue: decimal, orders: int, aov: decimal, hours: int, speed: int (0-100), accuracy: int (0-100), upsell: int (0-100), attendance: int (0-100) }]`

Rows pre-sorted by `revenue` desc preferred but FE re-sorts defensively. `range` accepts the same tokens as other analytics endpoints (`30d`, `7d`, etc.); calendar boundaries should respect the `business_day_start` setting from item #8 when that lands.

Stretch (future): aggregated `/staff/performance/summary?range=30d` returning `{ active_count, top_performer: {name, revenue}, avg_accuracy: pct, total_hours: int }` for the KPI tiles so FE doesn't recompute on the client.

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-25). FE wiring in progress.

### 11. Shifts list — extra reconciliation + perf fields for v3 card UI
**Why:** FE `src/pages/shifts/index.vue` was rewritten to a v3 single card grid (KPI strip + filter toolbar + per-cashier ShiftCard + ReceiveCashModal). The card surfaces several fields the current `/shifts` / `/shifts/active` payloads do not return, so those cells render `—` until BE supplies them.

**Need:** Add the following per-shift fields to both `GET /shifts/active` and `GET /shifts` response items (snake_case, consistent w/ existing nested shape):
- `gross_revenue` (decimal) — gross sales for the shift (kept separate from `total_orders_revenue` if differentiation exists; otherwise alias is fine).
- `net_revenue` (decimal) — gross minus refunds/cancellations/expenses, whatever BE considers "net".
- `card_collected` (decimal) — non-cash payments tendered during the shift.
- `expenses_total` (decimal) — sum of drawer expenses recorded against the shift.
- `cancelled_count` (int) — number of cancelled orders during the shift.
- `cancelled_amount` (decimal) — total monetary value of those cancelled orders.
- `expected_cash` (decimal) — what the drawer SHOULD contain (cash_collected − expenses_total), so FE doesn't recompute and drift.
- `variance` (decimal, nullable) — once reconciled: `actual_cash − expected_cash`.
- `reported` (decimal, nullable) — the `actual_cash` value passed in the reconcile POST, echoed back on subsequent reads.
- `reported_by` (string or `{ name }`) — manager who confirmed the handover.
- `avg_ticket` (decimal) — gross_revenue / total_orders.
- `items_sold` (int) — total quantity across all order lines in the shift.
- `avg_prep_time` (seconds, nullable) — average kitchen prep duration.
- `peak_hour` (string, e.g. `"13:00–14:00"`) — busiest hour of the shift.
- `is_live_stats` (bool) — true while the shift is still OPEN and stats stream live (already returned on `/shifts/active`, please also return on `/shifts` so history view can mark in-progress rows).

**Status enum:** FE renders three buckets — `active` (status `OPEN` or `is_live_stats`), `awaiting` (status `AWAITING_CASH` or `ENDED`), `reconciled` (status `CLOSED`, `COMPLETED`, `RECONCILED`, or `reported` truthy). Confirm canonical enum + transitions so we can simplify the FE mapping.

**Dropped from FE pending separate decisions** (do NOT remove BE endpoints — FE will re-consume later):
- Shift templates CRUD (`/shift-templates` GET/POST/PUT/DELETE) — UI removed, BE retained.
- Drawer-expense management on the shift card (`/shifts/{id}/expenses/`, `/categories/`, `/recipients/search/` via cashboxApi) — UI removed, BE retained.
- Per-shift performance scorecard (`GET /analytics/shifts/{id}`) — UI removed, BE retained.

If any of those endpoints are slated for deprecation, tag here and we'll wire up the replacement.

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-27, commit f3a3cef). All 14 fields confirmed present in `/shifts` list response; live aggregation works for ACTIVE shifts. **Open question to BE:** canonical `status` enum (`OPEN` vs `ACTIVE` for running, etc.) — sent via dev-bot.

---

### 17. Operations dashboard endpoint
**Why:** Operations tab of the new dashboards hub (`src/pages/dash/operations.vue`) renders empty state today. Mock arrays were stripped. Needs operational metrics for tables/funnel/prep/hours.

**Need:** `GET /api/admins/dashboard/operations?from=&to=` returning:
```
{
  tableGrid: [{ id: int, label: str, status: 'free'|'occupied'|'ready', orders: int }],
  funnel: [{ status: str, count: int }],
  prepByCategory: [{ category: str, count: int, avg_prep_seconds: int|null }],
  ordersByHour: [{ hour: '09'..'22', orders: int }]
}
```

Window defaults to today; respects `business_day_start` (item 8).

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek, commit `ac87544`). `/dashboard/operations` returns 200 on prod; FE `dash/operations.vue` consumes funnel + ordersByHour + prepByCategory + tableGrid. Verified live 2026-07-02.
**Data-quality follow-ups (open, resent 2026-07-02 msg 63):** `prepByCategory[].mins` is 0 for every category (avg prep not computed) — FE now zero-suppresses the card until real values arrive. Funnel `%` display bug was FE-side (dividing by first stage → 8950%) and is fixed on FE.

---

### 12. Sales & Revenue dashboard endpoint (last mock-data page)
**Why:** FE page `src/pages/dash/sales.vue` is the last page still showing mock data (heatmap, channel split, 30-day revenue/expense, gross margin). User wants 100% real data. Mock import has been removed — page now renders empty state until BE provides the data.

**Need:** `GET /api/admins/dashboard/sales?range=30d` (or `?from=&to=` to match other dashboards) returning:
```
{
  monthRevenue: decimal,
  grossMargin: float (0..1),
  revenue30: [decimal x days],
  expense30: [decimal x days],
  lastMonthRev: [decimal x days],
  dayLabels: [str x days],     // e.g. ["May 27", "May 28", ...]
  HM_DAYS: [str x 7],          // ["Mon","Tue",...]
  HM_HOURS: [str x N],         // e.g. ["09","10","11",...]
  heatMatrix: [[int x len(HM_HOURS)] x len(HM_DAYS)],  // order volume by day×hour
  channelDays: [{ day: str, hall: int, delivery: int, pickup: int }],
}
```

`range` should respect `business_day_start` (item 8) when computing the window.

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-27, commit f3a3cef). All 11 response keys verified to match the spec. Hub Sotuvlar tab renders 30-day revenue chart + 7×14 heatmap + 30-day channel stacked bars from live BE data.

### 13. Product affinity (market-basket / co-occurrence) endpoint
**Why:** New "Frequently bought together" card embedded in `src/pages/dash/products.vue` (between the treemap/donut row and the pareto/sparkline row) needs product co-occurrence data that no existing endpoint exposes. The existing `/analytics/products/*` endpoints return per-product KPIs only (units, revenue, deltas) — they don't surface which products are bought together. Computing co-occurrence server-side requires scanning all `order_items` grouped by `order_id` within the window and counting unordered pairs `(a, b)` where `a < b`. `limit` caps the number of products returned (top-N by orders) so the chord / matrix stays readable (design uses 10).

**Need:** `GET /api/admins/analytics/products/affinity?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=10` returning:
```
{
  products: [
    { id: int, name: str, color: str|null, orders: int, price: decimal }
  ],
  pairs: [
    { a: int (index into products[]), b: int (index into products[]), count: int (orders containing both) }
  ],
  totalOrders: int  // total orders in window — used as N in the lift calculation count*N/(A.orders*B.orders)
}
```

FE constraints:
- `a < b`, `count > 0` only.
- `products` sorted by `orders` desc.
- `color` optional — FE falls back to palette `--c1..--c5` when null.
- Window defaults to last 30 days when params absent.

Until this endpoint ships, the FE card renders an empty state (DashSection wrapper) and degrades gracefully.

**Status:** ✅ Shipped on alpha_pos_server (Abrorbek 2026-06-27, commit a9316bc). Response shape (`range, products, pairs, totalOrders`) verified. Chord diagram in Mahsulotlar dashboard renders pairs from live BE data.

## Done — verified
- **Item 4** — `order_number` field on Order (migration 0034, commit da234fb). FE wired (`orders/index.vue`, `types/order.ts`).
- **Item 11** — Shift list 14-field expansion (commit f3a3cef). FE consumes via shifts/index.vue. Open: confirm canonical status enum.
- **Item 12** — `/dashboard/sales` 11-key endpoint (commit f3a3cef). FE consumes via dash/sales.vue + composables/useDashboardData.ts.
- **Item 13** — `/analytics/products/affinity` chord endpoint (commit a9316bc). FE consumes via components/design/Affinity.vue.
- **Item 14** — `/orders` list response includes inline `items[]` (commit f3a3cef). FE shift-handover modal no longer N+1.

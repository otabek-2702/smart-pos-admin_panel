# Design ↔ Hand-edit Conflicts

Living log. Whenever the new design (handoff v3) would alter or remove existing custom code, an entry is added here instead of overwriting. Jason reviews each.

Branch: `feat/design-handoff-v3`. Handoff source: `.tmp-handoff-v3/pos-admin-panel/project/`.

---

## Hand-edited areas to preserve (ground truth)

These were custom-coded after the prior design ports (`.tmp-alpha-design/`, `.tmp-cal-design/`, `.tmp-mobile-design/`) and must not be silently overwritten:

- **`src/layouts/components/DesignSidebar.vue`** — nav badges via Pinia `navCounts` store; mobile drawer (`is-open` + `sidebar__close` X); nav-go emit.
- **`src/layouts/components/DesignTopbar.vue`** — `showDate = false` (DateRange filter hidden globally per Jason); breadcrumbs hidden on mobile; `.ai-pill` for off-page generation.
- **`src/layouts/components/MobileTabBar.vue`** — bottom tabbar (Home / Orders / Shifts / AI / Menu).
- **`src/layouts/default.vue` + `design.vue`** — `onToggleSidebar` viewport-aware (drawer on ≤768, collapse on desktop); `page-shell` padding stepped to `--sp-5/--sp-6` w/ mobile shrinks; `nav-scrim` overlay.
- **`src/components/design/DataTable.vue`** — sort/select/expand internals; expand chevron col removed (row-click expands); `min-height:100%` rule on `.aithread__inner`; per-page Select wider (96px); fmtNum uses space sep.
- **`src/components/design/Select.vue`** — custom popup rewrite (replaced native `<select>`), Teleport menu, `.select__menu`/`.select__opt` styles in design-shell.css.
- **`src/components/design/Kpi.vue`** — string→number coercion (BE returns Decimal as string); uses `useFormatMode` (full vs short).
- **`src/components/design/DateRangePicker.vue`** — 1:1 port of v2 handoff datepicker.jsx + pointerdown-outside fix (not click-outside via Teleport).
- **`src/components/design/utils/format.ts`** — `useFormatMode()` composable persisted to `localStorage.numberFormat`.
- **`src/composables/useFormatters.ts`** — `formatCurrency` respects `useFormatMode`; abbr for ≥10000 in short mode.
- **`src/pages/orders/index.vue`** — `loadStats()` accepts date/cashier filters + refetches on every filter change; quick-view modal for shift receipts (separate page); KPI strip; chip clear-all; `display_id` shown as secondary muted label (primary uses `o.id`); show-deleted switch + 1C export REMOVED per Jason; new `DateRangePicker` swapped in; payment status as segctl (always visible).
- **`src/pages/analytics/shift-handover.vue`** — products `productsShown` limited to 10 + Show more/less; receipt row click → quick-view Modal lazy-fetching `/orders/{id}`; `receiptId(r)` falls back to `order_id ?? id ?? display_id`.
- **`src/pages/ai-assistant/index.vue`** — composer footer hint removed; `aihist__toggle` mobile drawer; per-chat draft persistence via `store.setDraft`; `selectChat()` closes drawer; `spaceifyNumbers()` pre-pass in mdInline; auto-scroll bottom.
- **`src/stores/aiAssistant.ts`** — `Chat.draft` field + `setDraft(id, text)` action; chats persist to `localStorage.alphapos-ai-chats-v1` (40-cap).
- **`src/stores/navCounts.ts`** — new Pinia store polling `/shifts/active` + `/orders/stats?today` every 90s.
- **`src/styles/design-shell.css`** — `.page` no max-width; `.row-actions { opacity: 1 }` always; `.select__menu` popup; `.chip.is-active` segctl styles; mobile overrides moved to design-responsive.css; `.kpi` slim padding.
- **`src/styles/design-responsive.css`** — 1:1 port of v2 responsive.css (sidebar drawer, mobile-tabbar, modal sheets, KPI 2-up, toolbars stack, .aihist mobile drawer).
- **`src/styles/design-aichat.css`** — `.aithread__inner { min-height: 100% }`; `main.page-shell:has(.aiwrap) { padding: 0 }` to kill outer scrollbar.
- **`src/styles/design-datepicker.css`** — 1:1 port of datepicker.css.
- **`.env` / `.env.production`** — `VITE_API_HOST=https://pos.78.111.90.65.nip.io`.
- **`src/plugins/i18n/locales/*.json`** — ~500 context-aware uz/ru/en keys added across audit sweeps. Do not flatten or reorder.
- **`src/pages/orders/index.vue` — `includeDeleted` ref + 1C export — REMOVED per Jason. New design must not re-introduce these.**

---

## Conflicts

*Format per entry:*
```
### N. <file path> — <what>
**Lines / region:** …
**New design specifies:** …
**Current code does:** …
**Recommendation:** …
```

### 1. `src/components/design/DateRangePicker.vue` — v3 reverts dual-pane → single-pane; bundles new time-of-day mode
**Lines / region:** Whole file. Specifically:
- v3 `<DateRangePicker>` renders a **single** `<MonthGrid month={view} />` (handoff line 246).
- v3 `presetRange(key, today)` uses raw `today` (handoff line 24), not business-day-shifted today.
- v3 click-outside uses `document.addEventListener("mousedown", h)` (handoff line 154).
- v3 labels are hardcoded English: `"Today"`, `"From "`, `"Select a start date"`, `"Previous month"`, etc.
- v3 ADDS a `mode` state (`date` | `time`) with a segmented control (`drp-modebar` / `seg__btn`), new `TIME_PRESETS` (Open hours / Lunch / Dinner / Late night / All day), `fromTime`/`toTime` state, an `applyTime()` emit path with extended value shape `{ from, to, preset, mode, fromTime, toTime }`, a clock-vs-calendar trigger icon based on `valMode`, and a new `enableTime` prop (default `true`).
- v3 also references a `<TimeRange from to onFrom onTo />` sub-component that is NOT defined in `datepicker.jsx` (probably lives in another v3 file — not surveyed yet).

**New design specifies:**
- Single calendar pane with prev/next nav between months.
- Raw `today` (no business-day shift) for preset boundaries.
- English-only labels.
- New "Time of day" mode side-by-side with date-range mode, exposing `mode`/`fromTime`/`toTime` on the emitted value.

**Current code does:**
- Renders **two** month grids side-by-side (`view` + `nextView`) per CONFLICTS.md hand-edit note.
- Uses `businessToday()` from `@/composables/useBusinessDay` so presets respect cashier shift-day.
- Click-outside via `pointerdown` listener in **capture** phase (handles Teleported menus inside the popover).
- All labels routed through `t()` with keys like `Today`, `From`, `Select a start date`, `Previous month`, `wd_Mo`…`wd_Su`, `MONTHS[...]`.
- Emits `{ from, to, preset? }` only — no `mode`/`fromTime`/`toTime`.

**Recommendation:**
- DO NOT overwrite. Keep current FE component (dual-pane + businessToday + i18n + pointerdown capture).
- If Jason wants the **time-of-day filter** from v3, port it as a SEPARATE additive task:
  1. Extend `DateRangeValue` with optional `mode?: 'date' | 'time'`, `fromTime?: string`, `toTime?: string`.
  2. Add the `drp-modebar` segmented header + `drp-time` block as a sibling of the existing date-range body, gated behind a new `:enable-time` prop **defaulting to `false`** (opposite of v3 default) so existing call-sites are unaffected.
  3. Port the `<TimeRange>` sub-component once located in v3 sources (search `.tmp-handoff-v3/.../app/` for its definition before porting).
  4. Add new i18n keys: `Time of day`, `Date range`, `Filter by time of day`, `Open hours`, `Lunch`, `Dinner`, `Late night`, `All day`, `Custom`, `Any time`.
  5. Add corresponding CSS to `src/styles/design-datepicker.css` (`.drp-modebar`, `.drp-time*`, `.seg`, `.seg__btn`, `.drp-timechip`).
- Reject the single-pane, raw-today, English-literal, mousedown-bubble reverts.

### 2. `src/components/design/DataTable.vue` — v3 reintroduces dedicated expand-chevron column
**Lines / region:** Handoff v3 `app/table.jsx`:
- Line 76: `colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0) + (renderExpand ? 1 : 0)` — adds expand col to total.
- Line 94: `{renderExpand && <th style={{ width: 40 }} />}` — empty header cell, 40px wide.
- Lines 126–132: per-row `<td>` containing `<button className="iconaction" onClick={(e) => { e.stopPropagation(); toggleExpand(id); }} title="Expand">` with a chevright `<Icon>` that rotates 90deg when open.
- Line 142: `{renderExpand && isOpen && <tr className="row-expand"><td colSpan={colCount}>…` (uses expand-augmented colCount).

Current FE `DataTable.vue`:
- Lines 282–286: `colCount` deliberately omits the expand column term.
- Lines 388–425 (`<thead>`): no expand `<th>`.
- Lines 484–548 (data-row template): no expand `<td>` / chevron button. Row click handler `emitRowClick(r)` (line 492) calls `toggleExpand(idOf(row))` for the whole row when `props.expandable`.
- Lines 535–547: expansion `<tr class="row-expand">` rendered directly when `expanded.has(idOf(r))`, using the no-chevron `colCount`.

**New design specifies:** Per-row 40px chevron column whose button toggles expand; chevron rotates 90deg on open; click `stopPropagation` so it does not bubble to `onRowClick`; the colspan of `.row-expand` accommodates the extra column.

**Current code does:** Expand chevron column was removed intentionally in the v2 port. The whole row is the toggle target — clicking anywhere on the row both fires `row-click` and toggles the expand state when `expandable` is set. CONFLICTS.md ground-truth explicitly preserves this: *"expand chevron col removed (row-click expands)"*.

**Recommendation:** Keep FE as-is. Do NOT port the v3 chevron column or its rotating-icon button. If a future ticket wants per-row affordance discoverability, add a CSS-only cue (e.g. a faint chevron in the first cell) rather than a dedicated column — discuss with Jason before any change.

### 3. `src/components/design/DataTable.vue` — v3 delegates per-page picker to `<Pagination>` (narrow native select)
**Lines / region:** Handoff v3 `app/table.jsx` lines 151–154 — pagination is rendered by a separate `<Pagination page pages perPage total onPage onPerPage />` component (per the prior v2 handoff, that component used a compact native `<select>` ~64–72px wide). Current FE `DataTable.vue` lines 554–613 — pagination is inlined into the DataTable template with a `96px`-wide wrapper around a custom `Select.vue` instance.

**New design specifies:** Compact, externally-rendered per-page selector (delegated to `Pagination` partial).

**Current code does:** Inlined pagination footer with `style="width: 96px;"` wrapper and the custom Teleport-popup `Select.vue` (not a native `<select>`). Both are hand-edits per ground-truth: *"per-page Select wider (96px)"* and the project-wide *"custom popup rewrite (replaced native `<select>`)"*.

**Recommendation:** Keep current FE inlined pagination + 96px wrapper + custom Select. Do not extract or shrink. If we ever consolidate into a separate Pagination component, it must use the same custom Select and 96px wrapper.

### 4. `src/components/design/DataTable.vue` — v3 pagination total uses `toLocaleString()` (comma sep)
**Lines / region:** Handoff v3 `app/table.jsx` line 152 passes raw `total={sorted.length}` to `<Pagination>`, which (per v2 handoff conventions) formats the total via `toLocaleString()` producing comma-separated thousands (e.g. `1,234`). Current FE `DataTable.vue` lines 214–221 define `fmtNum(n)` using `.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')` — thin/regular space separator. Used at line 573: `{{ rangeStart }}–{{ rangeEnd }} {{ t('of') }} {{ fmtNum(totalItems) }}`.

**New design specifies:** Comma-separated thousands in the pagination range total.

**Current code does:** Space-separated thousands (`1 234`) to match the project-wide convention (Kpi, AI markdown `spaceifyNumbers`, `useFormatters.formatCurrency`). Listed as ground-truth hand-edit: *"fmtNum uses space sep"*.

**Recommendation:** Keep space separator. Do not switch to `toLocaleString()`. Any other place we surface totals should also use space sep for consistency.

### 5. `src/layouts/components/DesignTopbar.vue` — v3 adds `<SettingsMenu />` between DateRange and theme toggle, and reverts avatar/lang switcher
**Lines / region:** Handoff v3 `app/shell.jsx` lines 236–261 (Topbar function). Current FE `DesignTopbar.vue` lines 247–428 — right-side action cluster after `topbar__spacer`.
**New design specifies:** Render `<SettingsMenu />` (gear popover with business-day-start `TimeField` + week-start `Select`, persisted to `localStorage.alphapos-daystart` / `alphapos-weekstart`) between `<DateRange>` and the theme-toggle `iconbtn`. Source topbar also has a bare `<div class="avatar">RL</div>` (no dropdown) and no language switcher button.
**Current code does:** No SettingsMenu. Keeps hand-edited language switcher (uz/ru/en) and avatar dropdown (name/role/email + Logout). `showDate` is hard-locked to `false` per Jason.
**Recommendation:** Port `SettingsMenu` separately as a standalone `src/components/design/SettingsMenu.vue` (additive — see shell.jsx lines 192–233). Do NOT wire it into the topbar automatically — Jason confirms placement (topbar gear, or in a settings page). Keep language switcher + avatar dropdown verbatim (per "Hand-edited areas to preserve" list). Keep `showDate = false`. Also note: `<SettingsMenu>` references `TimeField` and `Select` components — `Select.vue` exists (hand-edited custom popup), `TimeField` does NOT exist in FE and would need porting first.

### 6. `src/layouts/components/DesignSidebar.vue` — v3 introduces `SidebarLiveWidget` ambient "Today" card pinned in sidebar
**Lines / region:** Handoff v3 `app/shell.jsx` lines 137–162 (`SidebarLiveWidget` function). Source App component pins it inside sidebar below the nav. Current FE `DesignSidebar.vue` sidebar ends at `<nav class="sidebar__nav">` (line 159).
**New design specifies:** Always-visible live widget below nav: revenue ticker (UZS, polls every 4.2s with random `+Math.floor(Math.random()*40000)` delta), 12-point `Sparkline`, orders count, delta pill (+12.4%). Click jumps to `dashboard`. Hidden when `props.collapsed`. Markup uses `.sidewidget`, `.sidewidget__label`, `.sidewidget__value`, `.sidewidget__unit`, `.sidewidget__spark`, `.sidewidget__meta`, `.livedot`, `.delta.is-up` classes — most not present in current `design-shell.css`.
**Current code does:** Sidebar ends at the nav. No ambient widget. Nav has already been expanded heavily with HR/Stock/Settings/Notifications sections; remaining vertical space is tight, especially on smaller laptops.
**Recommendation:** Port `SidebarLiveWidget` as standalone `src/components/design/SidebarLiveWidget.vue` (additive). Do NOT insert into `DesignSidebar.vue` automatically — Jason picks placement (sidebar foot, dashboard hero card, or floating). Replace simulated `setInterval` + `Math.random` with real data: revenue from `/orders/stats?today` (already polled by `navCounts` store), spark from `/orders/stats?series=revenue30` (or `window.DASH.revenue30` fallback in source). Also requires new CSS block in `design-shell.css` for `.sidewidget*` + `.livedot` + `.delta.is-up` selectors.

### 7. `src/pages/index.vue` — v3 replaces single-page "Today's Snapshot" landing with a 5-tab dashboards hub
**Lines / region:** Handoff v3 `.tmp-handoff-v3/pos-admin-panel/project/pages/Dashboard.jsx` (whole file, 76 lines). Maps the root dashboard route to a `DashboardPage` that:
- Defines `DASH_VIEWS = [exec, sales, ops, products, staff]` — 5 sub-dashboards loaded from `window.ExecutiveDashboard`, `SalesDashboard`, `OperationsDashboard`, `ProductsDashboard`, `StaffDashboard` (each defined in `pages/dash/*.jsx`).
- Renders a `.page__head` with `<h1>Dashboards</h1>` + per-view subtitle, a `<DateRangePicker>` (date range `{from, to, preset:"30d"}`), Refresh button, Export button.
- Renders a `.dashtabs` tablist (5 buttons) below the head; selected tab persists to `localStorage["alphapos-dashview"]` (default `"exec"`).
- Mounts the chosen sub-dashboard component, passing `loading` while a 520 ms artificial spinner runs after each tab/date-range switch.
- Calls `window.replayMotion()` to re-trigger entrance animation on view switch.
- Subtitles via `dashSubtitle(view)`: "Executive snapshot · the headline numbers at a glance", "Revenue, margins and where sales come from", "Live operations · orders, kitchen and floor", "Menu performance · what sells and what doesn't", "Team performance · cashiers and shifts".

**New design specifies:** The `/` (root) dashboard becomes a tabbed hub that switches between 5 distinct dashboard views — not a single snapshot page. Date range filter sits in the page head and drives all sub-views. Selected view persists across reloads. Each sub-view (Executive/Sales/Operations/Products/Staff) is its own component file.

**Current code does:** `src/pages/index.vue` is a hand-built "Today's Snapshot" page hitting `GET /dashboard/today`, rendering:
- Page head `<h1>{{ t("Today's Snapshot") }}</h1>` + today's formatted date + Refresh button (no date range filter — globally suppressed per the `showDate = false` hand-edit in `DesignTopbar.vue`).
- 4 KPI tiles (Today's Revenue / Orders Today / Avg Order Value / Low Stock Items) using `.kpi-card` markup + `formatCurrency` + `currency_short` i18n unit + sk-box skeletons.
- Click on Low Stock tile navigates to `/stock/items` (`router.push`).
- Secondary mini-cards (Open Orders / Cancelled / Paid %) + Top Products + Clocked-in lists further down.
- Uses Vuetify components (`VRow`, `VCol`, `VCard`, `VBtn`, `VIcon`) rather than the design-system primitives.
- No tab switcher, no per-view persistence, no `replayMotion`, no Export button.

**Recommendation:**
- DO NOT overwrite `src/pages/index.vue`. The current snapshot view is wired to a real BE endpoint (`/dashboard/today`), has tested skeleton/loading patterns, navigates to `/stock/items`, and uses the project's i18n keys. Replacing it with a 520 ms-fake-spinner tabbed hub regresses real functionality.
- If Jason wants the v3 hub, port it as an ADDITIVE_NEW page at `src/pages/dash/index.vue` (route `/dash`) so it can coexist with the current `/` snapshot until Jason decides which becomes the landing route. The 5 sub-dashboards (`pages/dash/Executive.jsx`, `Sales.jsx`, `Operations.jsx`, `Products.jsx`, `Staff.jsx`) port to `src/pages/dash/{executive,sales,operations,products,staff}.vue` and are mounted as child components rather than the `<Comp loading />` dynamic from `window.*` pattern.
- Hub-specific concerns to resolve before porting:
  1. Date range picker: must use the hand-edited `src/components/design/DateRangePicker.vue` (dual-pane + `businessToday` + i18n + pointerdown capture) — see Conflict #1. Do NOT pull v3's `align="right"` or `placeholder="Last 30 days"` literal.
  2. `DesignTopbar.vue` has `showDate = false` globally. The hub head exposing its own DateRangePicker is a per-page exception — explicitly local to `pages/dash/index.vue`, not the global topbar slot.
  3. Strings via `t()`: new i18n keys needed — `Dashboards`, `Overview`, `Sales & Revenue`, `Operations`, `Products`, `Staff & Shifts`, `Refresh`, `Export`, `Executive snapshot...`, `Revenue, margins...`, `Live operations...`, `Menu performance...`, `Team performance...`, `Dashboard refreshed`, `Updated {datetime}`.
  4. Drop the 520 ms artificial `setTimeout`-spinner — each sub-dashboard does its own real load. The hub-level `loading` flag is meaningful only during real refresh.
  5. Drop `window.replayMotion()` — no analog in current FE. Tab switch via Vue `<Transition>` is acceptable but optional.
  6. `localStorage["alphapos-dashview"]` key fine to keep as-is for persistence.
  7. Tabs: render as buttons matching the `.dashtab` / `.dashtab.is-active` CSS from handoff v3 — add styles to a new `src/styles/design-dashtabs.css` (or fold into `design-shell.css`).
  8. Icons: handoff uses `<Icon name="dashboard|trend|clock|box|users" />`. Current FE uses Boxicons (`bx-*`) inside `VIcon`. Map: `dashboard→bx-grid-alt`, `trend→bx-trending-up`, `clock→bx-time-five`, `box→bx-package`, `users→bx-group`.
- Decision for THIS file: defer to Jason. Until he confirms the hub should replace `/`, leave `src/pages/index.vue` alone and treat each sub-dashboard handoff file (Executive.jsx, Sales.jsx, etc.) as ADDITIVE_NEW into `src/pages/dash/`.

### 8. `src/pages/orders/index.vue` — v3 re-introduces "Export to 1C" PageHeader action
**Lines / region:** Handoff v3 `pages/Orders.jsx` line 119:
```jsx
<PageHeader title="Orders" subtitle="Track, settle and reconcile every order"
  actions={<Button variant="primary" icon="download">Export to 1C</Button>} />
```
Current FE `src/pages/orders/index.vue` lines 414–418:
```vue
<PageHeader
  :title="t('Orders')"
  :subtitle="t('Track, settle and reconcile every order')"
>
</PageHeader>
```
**New design specifies:** Primary `Export to 1C` button rendered in the PageHeader actions slot.
**Current code does:** No actions slot — 1C export was deliberately removed.
**Recommendation:** Reject. Ground truth (line 34): *"includeDeleted ref + 1C export — REMOVED per Jason. New design must not re-introduce these."* Do NOT port the button.

### 9. `src/pages/orders/index.vue` — v3 Order # column drops `display_id` secondary label
**Lines / region:** Handoff v3 `pages/Orders.jsx` line 61 — `render: (o) => <span className="cell-strong mono">#{o.id}</span>`. Current FE lines 698–701:
```vue
<template #cell.id="{ row: o }">
  <span class="cell-strong mono">#{{ o.id }}</span>
  <span v-if="o.display_id" class="cell-muted mono" style="margin-left: 4px; font-size: 11px;">· {{ o.display_id }}</span>
</template>
```
**New design specifies:** Single `#id` mono cell, no secondary label.
**Current code does:** Primary `#id` + muted secondary `display_id` (commit `8a278f1`).
**Recommendation:** Reject. Keep both. Ground truth (line 23): *"display_id shown as secondary muted label (primary uses o.id)."*

### 10. `src/pages/orders/index.vue` — v3 narrows status enum (drops `OPEN`, uses `CANCELLED` spelling)
**Lines / region:** Handoff v3 `pages/Orders.jsx` line 132 — `options={["PREPARING", "READY", "COMPLETED", "CANCELLED"]}`. Current FE line 78 — `const orderStatuses = ['OPEN', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED']` and FE-wide `STATUS_TONE` map (lines 83–89) normalises both `CANCELLED` and `CANCELED` (BE returns `CANCELED`).
**New design specifies:** Status options [PREPARING, READY, COMPLETED, CANCELLED]; badge text reads `CANCELLED`.
**Current code does:** Status options include `OPEN`; spelling is `CANCELED` (matches Django BE enum). i18n keys `order_status_OPEN` / `order_status_CANCELED` already exist in `uz/ru/en.json`.
**Recommendation:** Reject. BE is canonical — do not rename `CANCELED → CANCELLED`. Do not drop `OPEN`.

### 11. `src/pages/orders/index.vue` — v3 toolbar collapses multi-status / cashier / category / type filters into two single-value `<Select>`s
**Lines / region:** Handoff v3 `pages/Orders.jsx` lines 128–137 — single search + status `<Select>` + payment `<Select>` + right-aligned `<DateRangePicker>`. Current FE lines 460–610 — search + multi-status popover + order-type Select + cashier Select + multi-category popover + `filterstrip` row (DateRangePicker + payment `segctl` segmented control).
**New design specifies:** Two single-value Selects (Status, Payment) + Search + DateRangePicker.
**Current code does:** Hand-built toolbar with multi-select status/category popovers, cashier Select, order-type Select, and a segmented control for payment (always visible). Filters map to BE `/orders` query params: `status[]`, `cashier_id`, `category_id[]`, `order_type`, `from`, `to`, `payment`. Ground truth (line 23): *"payment status as segctl (always visible)"*.
**Recommendation:** Reject as a wholesale replacement. If v3's compact look is wanted, restyle the existing controls via `design-shell.css` — do not remove filter capability.

### 12. `src/pages/orders/index.vue` — v3 bulk-action set adds "Export" CSV button
**Lines / region:** Handoff v3 `pages/Orders.jsx` lines 105–114 — bulk actions = `Mark paid` + `Cancel` + `Export`. Current FE lines 760–781 — bulk actions = `Mark paid` + `Cancel` only.
**New design specifies:** Third bulk button `Export` calling `toast({ tone: "info", title: "Exporting N orders…" })`.
**Current code does:** Only the two state-changing bulk actions.
**Recommendation:** Skip. No BE endpoint for CSV order export today (see BACKEND_TODO.md). Port if/when `/orders/export` ships.

### 13. `src/pages/shifts/index.vue` — v3 redesigns Shifts as card-grid + ReceiveCashModal; FE has 3-tab Vuetify page wired to real BE
**Lines / region:** Whole page. Handoff v3 `pages/Shifts.jsx`:
- Lines 192–302 (`ShiftsPage`): single card-grid view (`grid` with `minmax(430px, 1fr)`), no tabs; KPI strip (Active now / Awaiting cash / Cash to receive / Net variance); filter toolbar with cashier `Select`, status `Select`, date from/to, `liveOnly` switch, chip clear-all.
- Lines 93–178 (`ShiftCard`): bespoke card with avatar + initials, time strip (`Fmt.dateTime(s.start) → s.end`), Orders/Gross/Net mini-stats, reconciliation hero block (`Cash to receive` / `Cash received` with `VarPill`), `PayRow` breakdown (cash sales / card / expenses / cancelled), footer meta (avg ticket / items / avg prep / peak), state-dependent action row (`active` → Live report + End shift; `awaiting` → Receive cash + Report; `reconciled` → "Handover complete" + Report).
- Lines 39–90 (`ReceiveCashModal`): manager-side cash count flow with expected-breakdown box, counted input, live variance computed `parsed − s.expectedCash`, color-tinted variance row, `VarPill`, note textarea, `Confirm handover` action.
- Lines 8–36: helpers `shiftState()`, `VarPill`, `MiniStat`, `PayRow`.
- Mock data fields: `s.cashier`, `s.expectedCash`, `s.gross`, `s.net`, `s.cash`, `s.card`, `s.expenses`, `s.cancelled`, `s.cancelledAmount`, `s.variance`, `s.reported`, `s.reportedBy`, `s.durationLabel`, `s.avgTicket`, `s.items`, `s.avgPrep`, `s.peak`, `s.initials`, `s.template`, `s.live`.

Current FE `src/pages/shifts/index.vue`:
- 3-tab structure (`Active` / `History` / `Templates`) built on Vuetify (`VTabs` / `VWindow` / `VDataTableServer`).
- Active tab: card grid (`VRow` / `VCol`) showing user, started time, orders, cash collected; `Drawer Expense` + `End Shift` buttons per card.
- History tab: `VDataTableServer` (server-paginated) with date filters + status filter + `DataTableFooter`; `Performance` + `Reconcile` row actions.
- Templates tab: `VList` of shift templates with edit/delete; `New Template` button + dialog with name/start_time/end_time.
- Wired to real BE: `GET /shifts/active`, `GET /shifts`, `GET /shift-templates`, `POST /shifts/{id}/end`, `POST /shifts/{id}/reconcile`, `GET /analytics/shifts/{id}`, `cashboxApi GET /shifts/{id}/expenses/`, `cashboxApi POST /shifts/{id}/expenses/`, `cashboxApi GET /recipients/search/`.
- BE field shape: `s.user.name`, `s.start_time`, `s.end_time`, `s.cash_collected`, `s.total_orders`, `s.status`, `s.is_live_stats` — NOT the v3 mock names.
- Reconcile dialog is a simple `VDialog` with `actual_cash` number input + notes textarea (no live variance pill, no expected breakdown).
- Drawer-expense dialog (P4 cashbox feature) with recipient search + categorized rows + per-shift running total — entirely absent from v3.
- Performance scorecard dialog (`/analytics/shifts/{id}`) with KPI cards (revenue, orders, orders/hour, cancel rate) + breakdown rows — entirely absent from v3.

**New design specifies:** Replace tabs with a single card-grid; introduce `ReceiveCashModal` with expected-breakdown box, counted-cash input, live variance computation + `VarPill`; KPI strip summarising active count / awaiting / cash to receive / net variance; bespoke `ShiftCard` with sales mini-stats + reconciliation hero + state-dependent footer actions.

**Current code does:** Mature 3-tab Vuetify page tied to real BE endpoints with three sibling flows the v3 design has no concept of (shift-templates CRUD, drawer-expenses dialog, performance scorecard). Reconcile is a minimal Vuetify dialog; end-shift is a separate flow.

**Recommendation:**
- DO NOT overwrite. Keep current 3-tab Vuetify implementation, real BE bindings, drawer-expense dialog, performance scorecard, and shift-templates CRUD.
- If Jason wants the v3 manager-side cash-handover UX, port it as a SEPARATE additive enhancement on top of the existing `reconcileDialog`:
  1. Enrich the current `reconcileDialog` body with the v3 expected-breakdown box (`Cash sales`, `Cash expenses paid`, divider, `Expected in drawer`), the live-variance row (color-tinted neutral / success / error), and a `VarPill` indicator — keep using `POST /shifts/{id}/reconcile` with `actual_cash` + `notes`.
  2. Map BE fields onto v3 expected shape: `expectedCash` ← server-computed value (request from BE if not already exposed — likely needs a new BACKEND_TODO entry); `cash` ← `cash_collected`; `expenses` ← drawer-expense total already fetched in P4 flow.
  3. Add `VarPill` as a tiny reusable Vue component at `src/components/design/VarPill.vue` consuming a numeric `value` and rendering `Exact` / `Over +N` / `Short −N` with neutral / success / error tone.
  4. Add i18n keys: `Receive cash`, `count the drawer and confirm the handover`, `Cash sales`, `Cash expenses paid`, `Expected in drawer`, `Counted cash`, `Enter the amount you physically counted from the till`, `Variance`, `Enter counted amount`, `Exact`, `Over`, `Short`, `Reason for any difference, deposits, etc.`, `Confirm handover`, `Handover complete`.
- Reject the card-grid / no-tabs / mock-data-shape rewrite. The 3-tab structure is what Jason expects in production; tabs surface drawer-expenses + templates + performance which v3 has no equivalent for.
- KPI strip (Active now / Awaiting cash / Cash to receive / Net variance) is a candidate for a separate ADDITIVE port on top of the Active tab — but `expectedCash`, `variance` need BE support first; log as BACKEND_TODO before porting.

### 14. `src/styles/design-datepicker.css` — v3 reverts dual-pane calendar widths + bundles new time-of-day mode CSS
**Lines / region:** Handoff v3 `project/styles/datepicker.css` (whole file, 148 lines). Three categories of change vs current FE `src/styles/design-datepicker.css` (130 lines):

(A) **Destructive — single-pane revert (v3 lines 72, 74–75, 84):**
- v3 `.drp-cal { padding: var(--sp-4); flex: 1; min-width: 0; }` — drops the hand-edited fixed `width: 588px`.
- v3 `.drp-cal__titles { justify-content: center; }` + `.drp-cal__titles span { text-align: center; }` (no `width: 50%`).
- v3 `.drp-month { width: 100%; }` (was `width: 50%`).
These widths are what make the FE's dual-pane `DateRangePicker.vue` render two months side-by-side. Reverting them collapses the layout to v3's single-pane (which CONFLICTS #1 already rejected at the component level).

(B) **Additive but feature-gated — time-of-day mode (v3 lines 28, 36–55):**
- v3 `.drp-pop { z-index: 200 }` (current FE: 50). Pure z-index bump.
- NEW selectors not in current FE: `.drp-pop--col`, `.drp-modebar`, `.drp-body`, `.drp-time`, `.drp-time__customRow`, `.drp-time__label`, `.drp-time__chips`, `.drp-timechip`, `.drp-timechip.is-active`, `.drp-time__custom`, `.drp-time__customlabel`.
These power the v3 "Time of day" mode that's the subject of CONFLICTS #1 (currently rejected as a wholesale `DateRangePicker.vue` replacement, but earmarked for a future opt-in `:enable-time` prop).

(C) **Already in current FE:**
- All `.drp-trigger*`, `.drp-presets`, `.drp-preset`, `.drp-wd`, `.drp-grid`, `.drp-cell` (in-range / is-edge / is-today / is-disabled), `.drp-foot`, `.drp-foot__draft`, `.drp-foot__actions`, `.drp-clear`, and the `@media (max-width: 768px)` mobile block — byte-for-byte identical between v3 and current FE.

**New design specifies:** Single-pane datepicker (one month grid in a flex-1 cal pane) + optional time-of-day mode pane sharing a 480px column-layout popover.

**Current code does:** Dual-pane layout (`.drp-cal` fixed 588px, `.drp-month` 50% wide × 2). No time-mode selectors. Per ground-truth line 31: *"design-datepicker.css: 1:1 port of datepicker.css"* — but that was relative to the v2 (`.tmp-cal-design/.../datepicker.css`) handoff, not v3.

**Recommendation:**
- DO NOT overwrite. The width changes in (A) are destructive — they break the hand-edited dual-pane `DateRangePicker.vue` (CONFLICTS #1).
- The z-index bump in (B) (`50 → 200`) is safe to cherry-pick if/when needed; currently no reported overlap issue, so defer.
- The new `.drp-pop--col` / `.drp-modebar` / `.drp-time*` / `.drp-timechip` selectors should only be added when the time-of-day mode feature lands per CONFLICTS #1 recommendation (gated behind a new `:enable-time` prop defaulting to `false`). Port them together with the component change, not standalone.
- For THIS file: leave `src/styles/design-datepicker.css` untouched. When the time-of-day feature is approved, APPEND (not replace) the time-mode block as a new section at the end of the file, retaining the existing `.drp-cal { width: 588px }` and `.drp-month { width: 50% }` rules.

### 1. src/components/design/DateRangePicker.vue — v3 single-pane revert + new time-of-day mode bundle
**Lines / region:** Whole file — month grid count, preset day source, click-outside listener, i18n wrapping, and emit value shape. v3 also bundles a brand-new time-of-day mode (drp-modebar segctl + TIME_PRESETS + fromTime/toTime + clock-icon trigger + enableTime prop default true + TimeRange sub-component reference).
**New design specifies:** Single MonthGrid pane (view only, no nextView). presetRange uses raw startOfDay(today). Click-outside via document mousedown bubble. English-literal labels (Today, From, Select a start date, Previous month, etc.). Adds mode state (date|time), TIME_PRESETS, fromTime/toTime, applyTime() emitting extended value { from, to, preset, mode, fromTime, toTime }, calendar-vs-clock trigger icon based on valMode, new enableTime prop (default true), drp-pop--col layout, drp-modebar seg control, drp-time block with custom <TimeRange> sub-component (definition not in this file).
**Current code does:** Dual-pane: renders both <MonthGrid month=view> AND <MonthGrid month=nextView> side by side per CONFLICTS.md hand-edit note. presetRange wraps startOfDay(businessToday()) from @/composables/useBusinessDay so presets honor cashier shift-day. Click-outside via document.addEventListener('pointerdown', ..., true) capture phase (fixes Teleport menus). All labels via t(): preset labels, 'From', 'Select a start date', 'Previous month', 'Next month', wd_Mo..wd_Su, MONTHS[...] keys. DateRangeValue = { from, to, preset? } only. No time-of-day mode.
**Recommendation:** DO NOT overwrite. Keep current FE (dual-pane + businessToday + i18n + pointerdown capture). If the time-of-day feature is wanted, port it as a SEPARATE additive task: extend DateRangeValue with optional mode/fromTime/toTime; add drp-modebar + drp-time block as a sibling of the existing date-range body gated by a new :enable-time prop defaulting to FALSE (opposite of v3 default) so existing call-sites (orders/index.vue, shift-handover.vue) are unaffected; locate and port the <TimeRange> sub-component from another v3 file (not defined in datepicker.jsx); add i18n keys (Time of day, Date range, Filter by time of day, Open hours, Lunch, Dinner, Late night, All day, Custom, Any time); add CSS to src/styles/design-datepicker.css (.drp-modebar, .drp-time*, .seg, .seg__btn, .drp-timechip). Reject all reverts (single-pane, raw today, English literals, mousedown-bubble).

### 2. c:/Users/Jason/Desktop/Projects/smart-pos-admin_panel/src/components/design/DataTable.vue — v3 expand col + external Pagination + comma totals revert
**Lines / region:** Three regions: (a) colCount + thead + per-row body for the dedicated expand-chevron column (v3 lines 76, 94, 126-132, 142 vs FE lines 282-286, 388-425, 484-548); (b) per-page selector (v3 line 152-154 delegates to <Pagination> with a narrow native <select> vs FE lines 554-613 inlines a 96px-wide custom Select.vue); (c) totals number formatting (v3 <Pagination> uses toLocaleString comma sep on `total={sorted.length}` vs FE fmtNum at lines 214-221 + line 573 uses space sep).
**New design specifies:** (a) Reintroduce a 40px expand column with a chevron <button class='iconaction'> that toggles expand and stops propagation, plus rotating chevron icon; colCount + colspan grow by 1. (b) Render pagination via the external <Pagination> partial with a compact native per-page <select>. (c) Format the pagination total with comma thousand separators via toLocaleString().
**Current code does:** (a) Expand chevron column deliberately removed in the v2 port — `emitRowClick(r)` toggles expand for the whole row when `expandable` is set; `colCount` omits the expand term; <tr class='row-expand'> renders directly under the data row. (b) Pagination is inlined into the DataTable template; per-page picker uses the custom Teleport-popup `Select.vue` wrapped in a 96px-wide div. (c) `fmtNum()` uses a space thousand separator to match the project-wide spaceifyNumbers / Kpi / formatCurrency convention.
**Recommendation:** Do not port v3 changes. All three deltas are explicit Jason hand-edits called out in CONFLICTS.md ground-truth: 'expand chevron col removed (row-click expands)', 'per-page Select wider (96px)', 'fmtNum uses space sep'. Three entries (#2, #3, #4) appended to CONFLICTS.md for Jason's review. Leave FE DataTable.vue untouched.

### 3. src/pages/index.vue — v3 swaps "Today's Snapshot" for 5-tab Dashboards hub
**Lines / region:** Whole file. Handoff v3 Dashboard.jsx is a 5-tab dashboards hub (Executive/Sales/Operations/Products/Staff) mounted at the root dashboard route, with its own DateRangePicker, Refresh + Export buttons, persisted view selection via localStorage["alphapos-dashview"], and 520 ms artificial loading spinner per tab/date-range change. Current FE root page is a single-page "Today's Snapshot" wired to GET /dashboard/today.
**New design specifies:** Tabbed hub at /: page__head (Dashboards title + per-view subtitle + DateRangePicker + Refresh + Export); .dashtabs row of 5 buttons (Overview, Sales & Revenue, Operations, Products, Staff & Shifts); dynamic mount of selected sub-dashboard component; selection persists across reloads; window.replayMotion() called on view switch.
**Current code does:** src/pages/index.vue is hand-built: page-head with t("Today's Snapshot") + formatted today date + Refresh button (no DateRange, no Export — DesignTopbar.vue has showDate=false globally per hand-edit); 4 KPI tiles (Today's Revenue, Orders Today, Avg Order Value, Low Stock Items); Low Stock tile click navigates to /stock/items; secondary mini-cards (Open Orders, Cancelled, Paid %); Top Products + Clocked-in lists; Vuetify components (VRow/VCol/VCard/VBtn/VIcon) + .kpi-card + .sk-box skeletons; hits real BE endpoint /dashboard/today.
**Recommendation:** DO NOT overwrite src/pages/index.vue. Real BE wiring + skeleton/loading + /stock/items routing + i18n keys would regress under a 520 ms-fake-spinner hub. If Jason wants the hub, port it as ADDITIVE_NEW at src/pages/dash/index.vue (route /dash) coexisting with current /. Sub-dashboards (pages/dash/Executive.jsx, Sales.jsx, Operations.jsx, Products.jsx, Staff.jsx) port to src/pages/dash/{executive,sales,operations,products,staff}.vue as child components. Hub must (1) reuse hand-edited DateRangePicker.vue (not v3's reverted single-pane variant — see Conflict #1); (2) drop window.replayMotion + 520 ms fake spinner; (3) route every string via t() with new i18n keys (Dashboards, Overview, Sales & Revenue, Operations, Products, Staff & Shifts, Export, dashSubtitle keys, Dashboard refreshed, Updated {datetime}); (4) keep localStorage["alphapos-dashview"] persistence; (5) add .dashtab/.dashtab.is-active styles to design-shell.css or new design-dashtabs.css; (6) map handoff icon names to bx-* (dashboard→bx-grid-alt, trend→bx-trending-up, clock→bx-time-five, box→bx-package, users→bx-group); (7) leave global DesignTopbar showDate=false untouched — the hub's DateRangePicker is local to this page only. Defer the route-replacement decision to Jason.

### 4. src/pages/shifts/index.vue — v3 card-grid + ReceiveCashModal rewrite vs FE 3-tab Vuetify page with real BE
**Lines / region:** Whole page. v3 ShiftsPage (lines 192-302) is a single card-grid view with KPI strip + filter toolbar; v3 ShiftCard (lines 93-178) is a bespoke shift card with avatar/time-strip/Orders-Gross-Net mini-stats/reconciliation hero/PayRow breakdown/footer meta/state-dependent actions; v3 ReceiveCashModal (lines 39-90) is a manager cash-handover modal with expected-breakdown box + live variance + VarPill + note; helpers shiftState/VarPill/MiniStat/PayRow (lines 8-36). Mock data field names (s.cashier, s.expectedCash, s.gross, s.net, s.cash, s.card, s.expenses, s.cancelled, s.variance, s.reported, s.reportedBy, s.durationLabel, s.avgTicket, s.items, s.avgPrep, s.peak, s.initials, s.template, s.live) do NOT match BE shape.
**New design specifies:** Replace tabs with a single card-grid; introduce ReceiveCashModal with expected-breakdown box, counted-cash input, live variance computation + VarPill; KPI strip (Active now / Awaiting cash / Cash to receive / Net variance); bespoke ShiftCard with sales mini-stats + reconciliation hero + state-dependent footer actions (Live report+End shift / Receive cash+Report / Handover complete+Report).
**Current code does:** Mature 3-tab Vuetify page (Active / History / Templates) wired to real BE endpoints. Active tab is card grid showing user.name + start_time + total_orders + cash_collected with Drawer Expense + End Shift buttons. History tab is VDataTableServer (server-paginated) with date+status filters and Performance + Reconcile row actions. Templates tab is VList of shift-templates with edit/delete + New Template dialog. Uses GET /shifts/active, GET /shifts, GET /shift-templates, POST /shifts/{id}/end, POST /shifts/{id}/reconcile, GET /analytics/shifts/{id}, cashboxApi /shifts/{id}/expenses/, cashboxApi /recipients/search/. BE field shape: s.user.name, s.start_time, s.end_time, s.cash_collected, s.total_orders, s.status, s.is_live_stats. Reconcile dialog is a minimal VDialog with actual_cash + notes (no live variance / no expected breakdown). Drawer-expense dialog (P4 cashbox feature) and performance scorecard dialog are entirely absent from v3.
**Recommendation:** DO NOT overwrite. Keep current 3-tab Vuetify implementation, real BE bindings, drawer-expense dialog, performance scorecard, and shift-templates CRUD. If Jason wants the v3 cash-handover UX, port it as a SEPARATE additive enhancement on top of the existing reconcileDialog: (1) enrich reconcileDialog body with v3 expected-breakdown box (Cash sales / Cash expenses paid / divider / Expected in drawer) + live-variance row (neutral/success/error tinted) + VarPill — keep using POST /shifts/{id}/reconcile with actual_cash+notes; (2) map BE fields to v3 shape: expectedCash from server (new BACKEND_TODO item), cash from cash_collected, expenses from drawer-expense total; (3) add VarPill as src/components/design/VarPill.vue (numeric value → Exact / Over +N / Short −N with neutral/success/error tone); (4) add i18n keys for Receive cash / Cash sales / Cash expenses paid / Expected in drawer / Counted cash / Variance / Enter counted amount / Exact / Over / Short / Confirm handover / Handover complete / etc. Reject card-grid + no-tabs + mock-data-shape rewrite. KPI strip is a separate ADDITIVE candidate gated on BE support for expectedCash + variance.

### 5. src/styles/design-shell.css — v3 overlaps multiple hand-edited regions + additive new blocks
**Lines / region:** Whole file — multiple regions overlap hand-edits and additive blocks. Specifically: .page (line 678), .dtable .row-actions (line 851), .selectmenu vs FE .select__menu (lines 1139-1164), responsive @media blocks (lines 946-948).
**New design specifies:** v3 styles/app.css adds: .page max-width 1440px + margin auto; .dtable .row-actions opacity:0 hover-reveal; .selectmenu/.selectopt custom dropdown (duplicates FE .select__menu); 720px single-column collapse for .cols-4/.cols-2; PLUS purely additive new blocks (.sidewidget*, .setmenu*, .kpi__spark, .kpi--accent, .control--time, .iconbtn.is-active, .control--select :focus-visible / .is-open / .chev rotation).
**Current code does:** design-shell.css already contains ~90% of v3 styles/app.css verbatim from prior ports. Hand-edits per CONFLICTS.md ground-truth: .page has no max-width; .row-actions opacity:1 always; custom select popup uses .select__menu / .select__opt classes (Teleport); mobile breakpoints split at 1100/420 with mid-tier moved to design-responsive.css.
**Recommendation:** DO NOT overwrite design-shell.css. Log Conflict #13 (.page max-width), #14 (.row-actions hover-reveal), #15 (.selectmenu duplication), #16 (720px collapse). Defer additive-new blocks (sidewidget, setmenu, kpi--accent, control--time) until their consuming components (SidebarLiveWidget, SettingsMenu, TimeField) are approved per existing Conflicts #5, #6. The only safe-to-apply-now additive: .control--select :focus-visible / .is-open / .chev rotation polish + .kpi__foot { min-height: 30px } stabiliser — pending Jason confirmation.

### 6. src/styles/design-datepicker.css — v3 destructive single-pane revert + additive time-of-day selectors
**Lines / region:** Whole file. Specifically: (A) destructive single-pane revert at v3 lines 72 (.drp-cal: flex:1; min-width:0 — drops fixed 588px), 74-75 (.drp-cal__titles justify-content:center, span text-align:center — drops 50% width), 84 (.drp-month: width:100% — was 50%); (B) additive feature-gated time-of-day selectors at v3 lines 28 (.drp-pop z-index:200 vs current 50), 36-55 (NEW .drp-pop--col, .drp-modebar, .drp-body, .drp-time, .drp-time__customRow, .drp-time__label, .drp-time__chips, .drp-timechip, .drp-timechip.is-active, .drp-time__custom, .drp-time__customlabel); (C) all .drp-trigger*, .drp-presets, .drp-preset, .drp-wd, .drp-grid, .drp-cell*, .drp-foot*, .drp-clear, and the @media (max-width: 768px) mobile block are byte-for-byte identical to current FE.
**New design specifies:** Single-pane calendar (.drp-cal flex:1 with no fixed width; .drp-month 100% wide) so only one month grid renders, plus a sibling time-of-day mode pane (.drp-pop--col 480px column layout, .drp-modebar mode toggle, .drp-body 384px min-height container, .drp-time panel with .drp-timechip preset chips for Open hours / Lunch / Dinner / Late night / All day). z-index bumped from 50 to 200.
**Current code does:** Dual-pane layout: .drp-cal fixed at width:588px; .drp-month at width:50% renders two months side-by-side; .drp-cal__titles uses justify-content:space-around with two 50%-wide title spans. No .drp-pop--col / .drp-modebar / .drp-time* / .drp-timechip selectors exist. .drp-pop z-index:50. The current file is a 1:1 verbatim port of the v2 .tmp-cal-design/.../datepicker.css and is locked in CONFLICTS.md ground-truth line 31 as a hand-edited area to preserve, tied to the dual-pane DateRangePicker.vue (also hand-edited, see CONFLICTS #1).
**Recommendation:** DO NOT overwrite. The width/justify-content/.drp-month changes in (A) are destructive — they break the hand-edited dual-pane DateRangePicker.vue (CONFLICTS #1, already rejected at component level). The z-index bump in (B) is safe but no current overlap issue, so defer. The new .drp-pop--col / .drp-modebar / .drp-time* / .drp-timechip selectors should ONLY be added when the time-of-day mode feature is approved per CONFLICTS #1 recommendation point 5 (gated behind a new :enable-time prop defaulting to false). When that lands, APPEND the time-mode block at the end of the file — do not replace the dual-pane width rules. Logged as CONFLICTS.md entry #14.


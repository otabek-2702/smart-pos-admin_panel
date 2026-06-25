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


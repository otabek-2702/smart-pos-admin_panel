# Overnight Page Improvements — Consolidated Review

Branch: `overnight-improvements` (based on `origin/dev`)

24 overnight page-improvement branches were merged into this single review branch.
**All 24 landed cleanly — zero merge conflicts, zero skipped.** i18n locale files
(`uz.json` / `ru.json` / `en.json`) auto-merged as a union of keys (no keys dropped),
and all three validate as parseable JSON.

Every change across every page is **additive and non-breaking**: existing axios calls,
refs, computeds, watchers, dialogs and behaviors were preserved. All new UI strings were
translated by meaning into Uzbek, Russian and English.

---

## Core

### Dashboard hub — `src/pages/index.vue`
- **Data-freshness clock** in the header ("Updated N min ago"), driven by the composable's `lastFetchedAt`, ticking every 15s.
- **Opt-in auto-refresh (live wall-board mode)** — play/pause toggle that silently re-fetches the shared dashboard payload every 60s, Page-Visibility aware (pauses on hidden tab, catches up on return), preference persisted to localStorage. No new endpoints.
- **Inline error banner with Retry** — surfaces the shared fetch's soft-degraded failure state that was previously silent on initial-load errors.
- **Keyboard shortcuts 1-5** to switch views (ignored while typing), plus proper `tablist`/`tab`/`aria-selected` roles and per-tab shortcut hints.

### Orders — `src/pages/orders/index.vue`
- **Mark ready** row action (check icon) for OPEN/PREPARING orders -> `POST /orders/{id}/ready`, with the per-row `actingOnId` guard against duplicate POSTs.
- **Reverse payment (unpay)** row action for paid, non-canceled orders -> `POST /orders/{id}/unpay`, routed through the confirm-modal because it's financially sensitive (returns cash to drawer, reverses stock).
- **Removed** the dead "More" action that rendered a tooltip but had no click handler.

### Products — `src/pages/products/index.vue`
- **Catalog KPI strip** (In-catalog / Categories / Deleted) powered by the previously-unused `GET /products/stats`, auto-refreshed after every mutation.
- **Clickable Deleted KPI** doubles as a one-click toggle of the include-deleted view (keyboard accessible, active-state outline).
- **Escape-to-close** for the create/edit modal (honoring the dirty-guard) and the delete-confirm modal (guarded while a request is in flight).
- **Removed** a stale unused `headers` constant that had drifted from the real columns.

### Categories — `src/pages/categories/index.vue`
- **Per-card quick status toggle** — the status badge is now a button -> `POST /categories/{id}/toggle`, optimistic with revert-on-error. Previously there was **no way in the UI** to change a category's active/inactive state.
- **Status switch in the create/edit modal** (Visible / Hidden on the POS) — the form now sends `status` in the payload.
- **Fourth "Deleted" KPI** surfaces the existing-but-unused `stats.deleted_categories` and fills the previously-imbalanced cols-4 grid.
- **Sort dropdown** wired to the backend `order_by` param (Manual / Name A-Z / Name Z-A / Newest / Oldest); drag-to-reorder is disabled under a non-manual sort so a misleading order can't be saved.

### Users / Staff Accounts — `src/pages/users/index.vue`
- **CHEF role support** — backend-supported role that was hidden from the UI (forcing operators into Django admin). Now selectable in the dialog and role filter, distinct "warning" badge, and correctly handled as a passwordless/non-login account (credential field replaced by an explanatory note, PIN/email not required).
- **Dormant-account signal** — never-logged-in staff now show a warning-toned "Never" badge with tooltip in the Last login column.

### Shifts — `src/pages/shifts/index.vue`
- **Manual Refresh button** + relative "Updated Nm ago" freshness indicator.
- **Background auto-poll (60s)** that fires only while shifts are active, the tab is visible, and no modal/action is in progress; never flashes the skeleton.
- **Live-ticking duration labels** for still-running shifts (30s clock); ended shifts keep their frozen label.
- **Priority sort** floating awaiting-cash shifts to the top, plus Newest / Oldest / Highest gross / Cashier A-Z, and a "Showing N of M shifts" count.

### Inkassa (cash collection) — `src/pages/inkassa/index.vue`
- **Smarter Perform-Inkassa modal** mirroring the backend cash-vs-card split: shows available register cash, a "Collect all" quick-fill, an insufficient-cash guard (inline error + disabled Confirm), and a Cash-to-safe / Cards-to-bank / Total-collected breakdown.
- **Row detail modal** (receipt action) exposing the collection period (`period_start -> period_end`), balance before/after, orders and revenue covered — using data the history payload already carries (no extra fetch).
- **"Last updated" timestamp** under the Cash Balance KPI using the balance endpoint's previously-ignored `last_updated` field.

### Treasury — `src/pages/treasury/index.vue`
- **Total treasury KPI** summing SAFE + BANK (money on hand at a glance), with its own skeleton state; KPI grid switched to 3 responsive columns.
- **Export CSV** of the filtered ledger (UTF-8 BOM, matching the Orders export convention).
- **Record Expense guardrails** — client-side insufficient-balance guard (backend debits amount + fee), live "Total debited" and "Balance after this expense" preview, disabled submit when short.
- **Swap-direction pill** in the Transfer dialog + disabled submit when insufficient or from==to.
- **Clear-filters button** and an honest "showing n of total on this page" count when client-side search/date filters are active.

### Discounts — `src/pages/discounts/index.vue`
- **Lifecycle status badge** beyond raw `is_active`: Active / Inactive / Scheduled / Expired / Limit reached, with a schedule hint — so a dead promo is never mistaken for live.
- **Usage column** with a progress bar toward the redemption cap (green/amber/red), "Unlimited" when uncapped.
- **Discount-type filter** + refresh button in the toolbar.
- **Expanded create/edit form** exposing previously-unmanageable backend fields: max discount amount, total usage limit, per-customer limit, stackable, staff-only, description — blank caps normalized to `null` (unlimited), not 0.
- **Per-discount stats modal** powered by the real `/discounts/{id}/stats/` endpoint (total redemptions, order count, total discount given, top-customers leaderboard), with skeleton loading and empty state.

### Loyalty — `src/pages/loyalty/index.vue`
- **Direct phone lookup** via `GET /loyalty/accounts/{phone}/` so a cashier can pull up and redeem for **any** customer at the till, not just the top-100 by balance — with 404/error handling and post-redeem re-sync.
- **KPI summary row** (Members / Redeemable now / Stamps outstanding / Redeemed stamps) with shimmer skeletons.
- **Reward-progress bar** in the Balance column (turns green + check when redeemable), plus sortable Balance/Earned/Redeemed/Last-activity columns.
- **Client-side search filter** + "Only redeemable" toggle.
- **Proper UX states** — distinct empty states, an error + Retry block, and an inline "look up directly" prompt; save guard mirroring the backend's positive-integer 422 rule.

### Places & Tables — `src/pages/places/index.vue`
- **KPI overview strip** — Total Tables, Available, live Occupancy % (with occupied/reserved breakdown), Total Seats — computed client-side over the loaded set.
- **Status filter** as a segmented row of clickable count chips (All / Available / Occupied / Reserved / Out of Service).
- **Table search by number** (client-side, clearable) and a **Refresh** button.
- **Distinct empty/edge states** — places-empty with an Add Place CTA, "no tables match filters" with Clear-filters, and an "add a place first" hint.
- **Dialog hardening** — save loading/disabled to block double-submit, client-side required validation, per-status icons, and action-button tooltips.

---

## Stock

### Stock Items — `src/pages/stock/items/index.vue`
- **KPI strip** from the real `GET /items/stats/` (Total Items, Low Stock, Raw Materials, Uncategorized); the **Low Stock KPI is a clickable filter toggle** (active ring, keyboard accessible).
- **Active-filter chips** with per-filter remove and Clear all; **context-aware empty state** (Clear filters vs. Add Item CTA).
- **Barcode column** added to the catalog grid.
- **Bug fix** — active/inactive toggle now uses DELETE/PUT (the detail route rejected PATCH with 405, so every toggle silently failed); surfaces the backend's stock-on-hand deactivation guard.
- **PageHeader** with title/subtitle; stats refresh alongside the table after every mutation.

### Suppliers — `src/pages/stock/suppliers/index.vue`
- **Pay modal upgrade** — "Pay full" prefill, live preview (Total charge = amount + bank fee, Fee, Owed-after-payment, Credit indicator on overpay); commission correctly gated to BANK payments only.
- **Detail modal enrichment** — currency-formatted, color-coded balance (owed/credit/settled), supplier Code, Credit limit, a 3-tile Purchase summary (from the already-returned but unused `include_stats`), Notes, and "View full profile" deep-link.
- **Ledger modal** — real pagination (wired the previously-unused `ledgerPage/PerPage/Total`), a Source column (SAFE/BANK/DRAWER + bank fee), and fixed raw missing-i18n-key references (`ref_TreasuryPayment` -> translated labels).
- **Notes field** added to create/edit.

### Purchase Orders — `src/pages/stock/purchase-orders/index.vue`
- **Bug fix: broken Receive action** — the inline button POSTed `/purchase-orders/{id}/receive/` which the action endpoint rejects (only send/confirm/cancel). Now routes to the dedicated `/stock/receiving` flow with the PO id.
- **Supplier made required** (asterisk + client-side validation) — the backend requires it and 404'd confusingly when omitted while the form stripped it.
- **Filter chips + result count** sub-bar with Clear-filters and a context-aware empty state.
- **Currency Select** (UZS/USD/EUR/RUB) instead of free text; Expected-date validated against Order date.
- **Bug fix** — confirm-modal `@click="doAction"` passed the MouseEvent as the success message; changed to `() => doAction()`.

### Recipes — `src/pages/stock/recipes/index.vue` + `RecipeDetailDialog.vue`
- **Bug fix: quick-view always showed "No ingredients"** — the list endpoint returns a brief serialization with no ingredients. The dialog now fetches the full recipe on open (`GET /recipes/:id/?include_cost=true`).
- **Bug fix: 6 blank/invisible icons** that referenced names missing from the design icon set — swapped for real icons.
- **"Can I make this now?" availability check** inside the dialog (`/recipes/:id/availability/` with a batch-multiplier input, per-ingredient required-vs-in-stock verdict).
- **Estimated cost** surfaced via `include_cost=true`, plus difficulty and prep time.
- **Wired into the drill-down page** (clickable name, chevright row action, "Open full recipe" button); results-count bar + one-click Reset filters.
- **Rebuilt RecipeDetailDialog** on the shared design-system Modal (loading skeleton, error+retry, theme-aware, responsive tables).

### Production Orders — `src/pages/stock/production-orders/index.vue`
- **Bug fix: Complete now works** — the shared `doAction` posts no body, but `complete()` requires `actual_output_qty`, so completing always failed silently. Added a dedicated Complete modal (prefilled expected output, required actual qty, quality PASSED/FAILED/PENDING, notes, live variance chip) posting the correct body.
- **Inline expandable BOM + Outputs row** — lazily fetches the detail into a per-row cache; ingredients (planned/actual + allocation-status badge) and outputs (primary/by-product/waste + quality badge). Also removed a reference to a non-existent `chevup` icon.
- **Cancel/Hold reason capture** forwarded to the backend, upgraded confirm modal, and a contextual Clear-filters button.

### Stock Levels — `src/pages/stock/levels/index.vue`
- **CSV Export** of the filtered view — paginates all matching rows (per_page=100, capped) and downloads a BOM-prefixed CSV; shared `filterParams()` keeps load and export identical.
- **Active filter chips** (search / location / category / item-type / low-stock) each individually removable + Clear filters.
- **Reserve/Release guardrails** — max reservable/releasable hint, "Use max" quick-fill, exceeds-limit inline error, Save disabled/blocked when invalid (Adjust intentionally unbounded).
- Richer modal context (Pending In when > 0); **bug fix** — empty-state clear-filters button was mislabeled "Cancel".

### Stock Counts — `src/pages/stock/counts/index.vue`
- **Scoped-count creation** — New Count modal now exposes an optional Category filter, Include-zero-stock and Auto-adjust-on-approval switches (all backed by `StockCountService.create` params but previously unreachable).
- **Live progress bar + Variance-cost KPI** in the detail modal; per-line variance cost.
- **Bug fix: stale summary** — KPI counters and progress now derive from an in-memory `liveSummary` computed, updating instantly as each line is recorded.
- **Cancel with reason** modal (`POST /counts/{id}/cancel/`) and a **Complete Count** footer button (disabled until all lines recorded).

---

## HR

### Employees — `src/pages/hr-employees/index.vue`
- **Bug fix: broken filters/search** — the `/employees/` list view ignores search/department/contract/is_active params, so filtering did nothing. Moved filtering **client-side**: `load()` pages through all employees, and a `filteredEmployees` computed applies filters reactively; DataTable now sorts/paginates the full filtered set (previously only the current server page).
- **Real Average salary KPI** + Monthly payroll subtext computed from active employees (the stats endpoint omits `avg_salary`).
- **Export CSV** of the filtered set (client-side, timestamped).
- **Filtered-count indicator** ("shown of total") in the active-filters row.

### Salaries / Payroll — `src/pages/hr-salaries/index.vue`
- **CSV export** of loaded payroll rows (reusing the Orders CSV pattern), stamped with the selected period.
- **Bulk "Approve selected"** over multi-row selection, looping the per-row `POST /salaries/{id}/approve/` (skips non-pending, tolerates failures, reloads + clears selection).
- **Employee position subline** in the name cell; **headcount** surfaced on the Total-net KPI.
- **Contextual empty state** with a Generate CTA when there's no payroll for the period.

### Attendance — `src/pages/hr-attendance/index.vue`
- **Daily-summary KPI strip** (Present / Late / Absent / On leave + total) via `GET /attendance/daily-report/`, following the date filter.
- **Manual "Record attendance" modal** posting to `/attendance/check-in/` and `/attendance/check-out/` — lets a supervisor log staff who forgot to badge.
- **Per-row quick "Check out now"** for today's still-open sessions.
- **Bug fix** — the status tone map used `danger`, but the design system only defines `error`, so Absent badges rendered unstyled. Also overtime hours are now emphasized.

### Expenses — `src/pages/hr-expenses/index.vue`
- **Spend-by-category breakdown** (ChartCard + HBarChart, top 6) driven by the previously-unused `stats.by_category`.
- **Receipt image support** — a receipt-image-URL field in the form (the backend already supported `receipt_image_url`) and a "View receipt" row action that opens the scan in a new tab.
- **Total KPI count subtitle** (`stats.count`) and a Save guard against amount <= 0 (which the backend rejects).

---

## Analytics & AI

### Menu Engineering — `src/pages/analytics/menu-engineering.vue`
- **2x2 Kasavana-Smith matrix** (margin x popularity quadrants) replacing the flat KPI strip — Star / Puzzle / Plowhorse / Dog in their correct quadrants, tone-tinted dark-mode-aware cards, per-class action recommendations, click/keyboard filtering with a dim-non-selected state and labeled axis rails.
- **Client-side CSV export** of the filtered rows (Excel-safe UTF-8 BOM + escaping).
- **Live aggregate totals** (total revenue, total profit, avg quantity) over the filtered set in the results meta row.

### AI Assistant — `src/pages/ai-assistant/index.vue`
- **Live BE-driven suggestions** in the empty state — wired the already-existing but unused `/ai/suggestions/` endpoint (reason text, priority dot, loading shimmer, localized static fallback).
- **Inline chat rename** via editable header title (hover pencil + double-click, Enter/Escape), wiring the previously-orphaned `store.renameChat`.
- **Two-step delete confirmation** in the history sidebar.
- **Jump-to-latest floating button** (reads "New messages" while streaming).
- **Markdown export** of the active conversation.

---

## Skipped

None. All 24 branches merged cleanly with no conflicts and no aborts.

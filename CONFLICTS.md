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

*(none recorded yet)*

# Smart POS Admin Panel — Agent Guide

Last reviewed against the active `dev` branch: 2026-07-15.

This file is the durable project context for coding agents. Read it before
changing the repository. When it conflicts with current code or a newer
explicit user decision, current code/newer decision wins.

## Source-of-truth order

1. Current source code and the user's latest explicit decision.
2. This file and the durable feedback under `.claude/.../memory/`.
3. `SUMMARY.md` for the July 2026 page-improvement work now merged into `dev`.
4. Approved dated specs under `docs/superpowers/specs/`.
5. `MONEY_SHIFT_SPEC.md` as desired target state, not proof of implementation.
6. `CONFLICTS.md` as historical decision context only.
7. `README.md`, `CLAUDE.md`, and older TODO/review docs as background only.

`CLAUDE.md` is materially stale: it describes the old Sneat default shell,
obsolete auth/API details, five locales, the removed `@axios` alias, and no
tests. Do not copy those claims without checking current source.

## User priorities — non-negotiable

- UX/UI quality is the top priority. After every UI change, inspect text
  truncation/overflow, spacing, alignment, responsive behavior, keyboard/focus
  behavior, loading/error/empty states, and both light and dark themes.
- A feature merely working is not sufficient; it must look deliberate and
  consistent with the rest of the product.
- Dialogs are minimalist:
  - no redundant Cancel button when the X already closes the dialog;
  - no colored or gradient dialog headers;
  - price inputs use integers unless fractional pricing is a real requirement;
  - inputs and controls use consistent sizing/density.
- A reported UI pattern should be corrected globally, not only on the named
  page. Search the active codebase for the same pattern before finishing.
- Restyling must preserve API calls, fields, route behavior, permissions,
  translations, filters, table columns, and actions. Flag any required logic
  change instead of silently removing behavior.
- All visible strings must work in Uzbek, Russian, and English. Update all
  three files under `src/plugins/i18n/locales/` together.
- Prefer real backend data and honest UI states. Never invent live-looking
  business values. Compare Periods is the approved, visibly labeled demo-data
  exception until its backend endpoint exists.
- Use tabular figures for money/quantities and the existing UZS formatting
  helpers (narrow no-break-space grouping). Do not fork number formatters.

Original durable feedback lives in:

- `.claude/projects/-home-dev-Desktop-Projects-smart-pos-admin-panel/memory/feedback_ux_ui_priority.md`
- `.claude/projects/-home-dev-Desktop-Projects-smart-pos-admin-panel/memory/feedback_dialog_design.md`

## What this project is

Smart POS / Alpha POS restaurant-administration SPA covering:

- dashboards, analytics, forecasting, audit, and AI assistance;
- users, categories, products, orders, places/tables, discounts, and loyalty;
- shifts, settlement, inkassa, treasury, and cashbox flows;
- stock, suppliers, purchasing, receiving, recipes, production, transfers,
  counts, reservations, alerts, and adjustments;
- HR employees, payroll, attendance, leave, contracts, expenses, reviews,
  documents, goals, events, and HR cash;
- notifications, QR codes, fiscalization, sessions, settings, roles, and
  licensing.

The frontend is Vue 3 + TypeScript + Vite 4 with Vuetify 3, custom Alpha design
primitives, Pinia, Axios, CASL, vue-i18n, Sonner, and file-based routing.

The current backend repository referenced by the newest project notes is
`C:\Users\Jason\Desktop\Projects\alpha_pos_server`. Older docs referring to
`alpha_pos` are stale. Do not modify the backend unless it is explicitly in
scope.

## Runtime architecture

- Boot: `src/main.ts`
  - installs Vuetify, Pinia, router, layouts, i18n, CASL, and optional Sentry;
  - imports the icon bundle and global design styles.
- Root: `src/App.vue`
  - renders routed content, command palette, shortcut help, scroll-to-top, and
    the global Sonner toaster.
- Active layout: `src/layouts/default.vue`
  - custom `DesignSidebar` + `DesignTopbar` + `MobileTabBar` Alpha shell;
  - `src/layouts/design.vue` is currently a duplicate;
  - `src/layouts/sneat.vue` and `DefaultLayoutWithVerticalNav.vue` are
    legacy/alternate surfaces, not the active default.
- Routes: `vite-plugin-pages` reads `src/pages/**`; layouts are applied with
  `vite-plugin-vue-layouts`; guards live in `src/router/index.ts`.
- `/` is the authenticated five-view dashboard hub. `/dashboard` redirects to
  `/`. The old dashboard page still exists but is not canonical.
- Most domain state and HTTP logic live directly inside large page SFCs. Shared
  state is limited mainly to the AI store, nav-count store, and singleton
  dashboard/business-day/page-context composables.

### File-based routing caution

Files placed under `src/pages` become route candidates. Page-local components
currently located there (`ItemFormDialog.vue`, `RecipeDetailDialog.vue`, and
`UserStatsRow.vue`) may generate unintended routes. Put new helpers under
`src/components` or configure explicit route exclusions; do not add more
non-page files under `src/pages` casually.

### Navigation has multiple sources

The following are independent and can drift:

- desktop sidebar: `src/layouts/components/DesignSidebar.vue`;
- mobile tabs: `src/layouts/components/MobileTabBar.vue`;
- topbar breadcrumb labels: `src/layouts/components/DesignTopbar.vue`;
- command palette: legacy arrays under `src/navigation/vertical/`.

When adding, renaming, or removing a user-facing route, audit every applicable
source. The active desktop sidebar intentionally exposes only a curated subset
of valid routes.

## API and authentication

Axios clients are defined in `src/plugins/axios.ts`:

- default: `/api/admins`
- stock: `/api/admins/stock`
- HR: `/api/admins/hr`
- discounts: `/api/admins/discounts`
- notifications: `/api/admins/notifications`
- cashbox: `/api/admins/cashbox`
- fiscalization: `/api/fiscalization`
- unauthenticated licensing: `/api/licensing`

Host resolution is `localStorage.apiHost`, then `VITE_API_HOST`, then relative
same-origin. Dev `/api` proxy target uses `VITE_BACKEND_HOST`.

Authenticated clients attach a Bearer token stored as JSON in
`localStorage.accessToken`. A 401 clears local auth and redirects to `/login`.
License-related 503 responses redirect to licensing setup.

Current login contract:

- `POST /api/admins/auth-login` with `{ email, password }`;
- response expected as `{ data: { token, user } }`;
- `/auth-me` and `/app-settings` hydrate business-day/working-hour settings.

Current frontend authorization is intentionally broad: every authenticated
user receives CASL `manage/all`. Backend permission checks are the real
security boundary. Do not claim that current UI routes are role-restricted.

Backend response envelopes and pagination shapes vary. Existing pages often
normalize with `res.data?.data ?? res.data` and tolerate multiple collection or
total keys. Check the actual page and backend contract before simplifying.

### API risks to remember

- Runtime API-host override currently permits an operator-supplied origin and
  will send the Bearer token there. Treat changes around this as a security
  boundary.
- The interceptor generates a fresh idempotency key for every request. That
  does not deduplicate two independent clicks; a stable per-operation key is
  needed for true double-submit protection.
- Compare Periods currently falls back to demo data on any API error, which can
  hide auth/outage/contract failures. Preserve the visible demo label and avoid
  expanding this pattern.
- `saveBusinessSettings` can update local state even when server persistence
  fails. Do not assume the visible value proves a successful PUT.

## Design system and frontend conventions

- Canonical custom primitives live under `src/components/design/`.
- Many older pages still use Vuetify directly; the codebase is intentionally
  hybrid during migration. Reuse the established pattern for the area instead
  of creating a third UI vocabulary.
- Raw design tokens: `src/styles/tokens.css`.
- Vuetify token mirror: `src/plugins/vuetify/theme.ts`.
- Global style order: `src/styles/styles.scss`.
- Typography: Hanken Grotesk for UI and JetBrains Mono for KPI/money figures.
- Reusable page recipe:
  `PageHeader -> KPI row -> filters -> DataTable -> Modal -> notifications`.
- Use the shared `DataTable`, `Modal`, `DateRangePicker`, form primitives,
  state fills, status badges, skeletons, and `useNotify` where appropriate.
- Status semantics are split between `statusTones.ts` and `statusColors.ts`;
  use the convention already established by the target surface.
- Do not introduce another chart library. Existing code includes custom SVG
  charts, ApexCharts, Chart.js, and the explicitly approved ECharts-based
  Compare Periods implementation. The older "ApexCharts only" document is no
  longer a complete description of current decisions.
- The global topbar date picker is intentionally hidden. Pages may own a local
  date range.
- The sidebar live widget is intentionally hidden per the user's later choice.
- Full-width, moderately dense pages are the later direction; the original
  handoff's comfortable 1440px maximum is not universally authoritative.

Auto-imports include Vue, Vue Router, VueUse, vue-i18n, and Pinia composables.
Vuetify components are auto-resolved. Custom Alpha design components normally
use explicit imports. Current aliases are defined in `vite.config.ts`; there is
no `@axios` alias—import `@/plugins/axios`.

## Important domain decisions

- Business day defaults to 03:00 Asia/Tashkent and supports backend-owned
  `business_day_start`, `business_open`, and `business_close`.
- Backend order status spelling is `CANCELED` (one L).
- Public order identity prefers `order_number`, then `display_id`.
- Keep 1C export removed from Orders.
- Preserve the rich Orders status/cashier/category/type filters.
- Compare Periods is an approved ECharts exception and may use deterministic,
  clearly labeled demo data while `/analytics/comparison` is unavailable.
- The shift receive-money flow currently blind-counts CASH/HUMO/UZCARD/PAYME,
  reveals expected/variance, and settles cash to SAFE and cards/Payme to BANK.
- `MONEY_SHIFT_SPEC.md` is a target-state document. It calls for per-shift
  drawers and removal of Inkassa, but current code still exposes and recently
  improved Inkassa. Do not delete Inkassa or perform structural money-model
  changes without reconfirming the product decision.
- Some cash-sale paths may not create `OrderPayment`; shift reconciliation has
  a defensive `expected_cash` fallback. Do not remove it without backend proof.
- Running shift status is defensively mapped across `OPEN`/`ACTIVE`; confirm
  the backend contract before narrowing it.

## Known implementation drift worth checking

- Broken or ineffective deep links exist from Treasury, stock barcode lookup,
  and secret-word order lookup.
- Supplier-item removal on the supplier detail page is UI-only.
- Shift report contains a "coming soon" stub even though handover analytics
  exists elsewhere.
- Some list filters operate only on the current server page while displaying
  global totals.
- Receiving uses an N+1 purchase-order detail workaround.
- Licensing plan state flags currently resolve every plan to AVAILABLE.
- Theme persistence is split between `alphapos-theme`, Vuetify settings, and
  command-palette behavior; verify both raw-token and Vuetify themes together.
- Notification, dashboard, shift analytics, chart, page-header, and toast
  surfaces have overlapping old/new implementations. Identify the canonical
  surface for the requested task before consolidating anything.
- QR generation uses an external service and sends the encoded menu URL/token
  to that service. Treat it as a privacy and availability dependency.

## Commands and verification

The declared package manager is Yarn 1:

```bash
yarn dev          # Vite on 0.0.0.0:5181
yarn dev:local    # localhost only
yarn build        # Vite production build only; does NOT type-check
yarn typecheck    # vue-tsc --noEmit
yarn lint:ci      # scoped CI lint; does not cover all active source folders
yarn smoke        # Playwright; needs a real backend
yarn ci           # lint:ci + build, still no vue-tsc
```

Three lockfiles are currently committed. Docker chooses Yarn first. Do not
regenerate or update another lockfile incidentally.

Before handing off a change:

1. Inspect `git status` and preserve unrelated user changes.
2. Run the narrowest relevant lint/type checks available.
3. For UI work, verify desktop/mobile, light/dark, keyboard/focus, long Uzbek/
   Russian labels, loading, error, empty, and populated states.
4. Update all three locales for new visible text.
5. For mutations, verify duplicate-submit protection and server error display.
6. Never report a check as passing if it did not execute successfully.

Current testing is thin: one real-backend Playwright smoke file visits only 18
routes and checks mainly for console errors. There are no unit/component tests.
CI runs scoped lint plus Vite build, not `vue-tsc`. Its smoke job checks for
`workflow_dispatch`, but the workflow currently does not declare that trigger.

The 2026-07-14/15 review could not establish a passing typecheck: `vue-tsc`
did not finish after more than 12 minutes in the managed environment. Lint was
blocked before ESLint started by filesystem sandboxing. Treat health as
unverified, not failed or passing.

## Repository hygiene

- Do not expose values from `.env` files. Discuss environment variable names
  only unless the user explicitly requests otherwise.
- `.tmp-*`, `files.zip`, and historical design bundles are provenance/archive,
  not current application source. Do not edit or delete them without request.
- Treat `src/@layouts` and most Sneat template internals as framework/legacy
  code; change them only for a demonstrated layout bug.
- Preserve the user's dirty worktree and avoid unrelated formatting churn.
- Keep comments and docs aligned with current behavior when the touched code
  makes an old claim false.

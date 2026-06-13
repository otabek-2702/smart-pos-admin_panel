# Alpha POS — Design System Spec

**Source:** Claude Design handoff bundle (`Alpha POS Admin.html`), snapshot 2026-06-13.
The handoff URL is a one-time snapshot; this doc is the durable source of truth.

**Bundle preserved (local, untracked):** `.tmp-design-bundle/` — original HTML/JSX/CSS for reference until the redesign rollout is complete, then delete.

## Brand direction

- **Accent (designer pick):** `#3A5BDB` indigo-blue, light theme. Calmer/higher-contrast refinement of the prior Sneat default `#696CFF`.
- **Dark theme primary:** `#6E8BFF` (lifted for legibility on dark surfaces).
- **Density:** comfortable — generous whitespace, calmer, **not** compact.
- **Style:** high-contrast minimalism, restrained elevation, ample type-scale headroom.

## Typography

| Role | Family | Weights | Notes |
|------|--------|---------|-------|
| Sans | Hanken Grotesk | 400 / 500 / 600 / 700 | body, headings, UI |
| Mono | JetBrains Mono | 400 / 500 / 600 / 700 | KPI values, monetary, code |

Fonts loaded via Google Fonts `<link>` in `index.html`. `font-feature-settings: "tnum" 1` on `.mono` for fixed-width digits. `.num` utility class for `font-variant-numeric: tabular-nums` on regular sans text.

### Type scale (px / line-height)

| Token | Size | Line-height | Usage |
|-------|------|-------------|-------|
| `--fs-display` | 32 | 40 | hero KPI on dashboard |
| `--fs-h1` | 24 | 32 | page title |
| `--fs-h2` | 19 | 28 | modal title, card insight |
| `--fs-h3` | 15 | 22 | card title |
| `--fs-body` | 14 | 22 | body |
| `--fs-sm` | 13 | 20 | secondary body, table |
| `--fs-label` | 12 | 16 | field label, badge, table head |
| `--fs-micro` | 11 | 14 | section nav-title, deltas |
| `--fs-kpi` | 30 | 36 | standard KPI value |
| `--fs-kpi-lg` | 34 | 40 | hero KPI value |

Weights: 400 regular, 500 medium, 600 semibold, 700 bold. Tracking on labels: `0.06em`.

## Spacing (4px base)

`--sp-1`=4, `--sp-2`=8, `--sp-3`=12, `--sp-4`=16, `--sp-5`=20, `--sp-6`=24, `--sp-7`=32, `--sp-8`=40, `--sp-9`=48, `--sp-10`=64.

Page padding `--sp-7` (32px). Card head `--sp-5 --sp-5 --sp-4`. Card body `0 --sp-5 --sp-5`. KPI card padding `--sp-5`.

## Radii

`--r-xs`=6, `--r-sm`=8, `--r-md`=10, `--r-lg`=14, `--r-xl`=20, `--r-pill`=999.

Cards `--r-lg`. Modals `--r-xl`. Buttons / inputs / selects `--r-sm`. Badges `--r-xs`. Chips `--r-pill`.

## Color tokens (light → dark)

### Surfaces & lines

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#F4F6F8` | `#0E1219` |
| `--bg-subtle` | `#EEF1F4` | `#0A0D13` |
| `--surface` | `#FFFFFF` | `#161B24` |
| `--surface-2` | `#F8FAFB` | `#1B212C` |
| `--surface-inset` | `#F1F4F7` | `#11161E` |
| `--border` | `#E4E7EC` | `#262E3B` |
| `--border-strong` | `#D3D8E0` | `#323C4C` |
| `--overlay` | `rgba(15,23,34,.42)` | `rgba(3,6,12,.6)` |

### Text

| Token | Light | Dark |
|-------|-------|------|
| `--text` | `#0F1722` | `#E8EBF1` |
| `--text-secondary` | `#586172` | `#9AA4B2` |
| `--text-tertiary` | `#8A929E` | `#6B7585` |
| `--text-disabled` | `#B4BAC4` | `#4B5563` |
| `--text-on-accent` | `#FFFFFF` | `#FFFFFF` |

### Brand primary

| Token | Light | Dark |
|-------|-------|------|
| `--primary` | `#3A5BDB` | `#6E8BFF` |
| `--primary-hover` | `#2E49B8` | `#819AFF` |
| `--primary-active` | `#263EA0` | `#5C7BF5` |
| `--primary-weak` | `#EDF0FD` | `#1C2640` |
| `--primary-weak-2` | `#DEE4FB` | `#243154` |
| `--primary-border` | `#C7D1F7` | `#34467A` |
| `--primary-ring` | `rgba(58,91,219,.28)` | `rgba(110,139,255,.34)` |
| `--on-primary` | `#FFFFFF` | `#0B1020` |

### Semantic (AA on white, soft tints)

| Family | Strong | Base | Weak | Border |
|--------|--------|------|------|--------|
| Success (light) | `#0F7A4A` | `#15935A` | `#E6F4EC` | `#BDE3CD` |
| Success (dark)  | `#45CE8C` | `#36C07E` | `#14271E` | `#1F4733` |
| Warning (light) | `#8A5200` | `#B26A00` | `#FBF0DD` | `#F0D7A6` |
| Warning (dark)  | `#F0B557` | `#E5A53B` | `#2A2113` | `#4A3A1B` |
| Error (light)   | `#A82C21` | `#C8372A` | `#FBEBE9` | `#F1C8C3` |
| Error (dark)    | `#F48376` | `#EF6A5B` | `#2C1714` | `#50271F` |
| Info (light)    | `#0E6A9E` | `#1180BE` | `#E6F3FA` | `#BCE0F1` |
| Info (dark)     | `#5FB7EA` | `#45A8E0` | `#11242F` | `#1E3D4F` |

Neutral: `--neutral-weak` `#EEF1F4`/`#1E2530`, `--neutral-border` `#DCE1E8`/`#2C3543`.

### Chart palette — FIXED semantics

| Token | Light | Dark | Always represents |
|-------|-------|------|-------------------|
| `--chart-revenue` | `#3A5BDB` | `#6E8BFF` | revenue / primary series |
| `--chart-expense` | `#E0823C` | `#E89A5C` | expenses / cost |
| `--chart-cash` | `#15935A` | `#36C07E` | cash payments |
| `--chart-card` | `#3A5BDB` | `#6E8BFF` | card payments |
| `--chart-grid` | `#EAEDF1` | `#232B38` | gridlines |
| `--chart-axis` | `#9AA2AE` | `#5B6572` | axis labels |
| `--chart-track` | `#EEF1F5` | `#222A36` | unfilled bar / donut track |
| `--chart-target` | `#8A929E` | `#6B7585` | target / reference line |

Categorical (up to 5, e.g. payment-mix donut):
`--c1` blue, `--c2` green, `--c3` orange, `--c4` light blue, `--c5` neutral grey.

**Hard rule:** charts standardize on ApexCharts (already a project dep). Series colors **always** pull from the chart-* tokens — never invent new colors per-chart.

### Elevation

| Token | Value (light) |
|-------|---------------|
| `--shadow-xs` | `0 1px 2px rgba(16,24,40,.05)` |
| `--shadow-sm` | `0 1px 3px rgba(16,24,40,.07), 0 1px 2px rgba(16,24,40,.04)` |
| `--shadow-md` | `0 6px 16px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.04)` |
| `--shadow-lg` | `0 16px 40px rgba(16,24,40,.14), 0 4px 10px rgba(16,24,40,.06)` |
| `--shadow-focus` | `0 0 0 3px var(--primary-ring)` |

Dark uses larger black-alpha values (see `src/styles/tokens.css`).

## Layout dims

`--sidebar-w: 256px` expanded · 74px collapsed. `--topbar-h: 64px`. Max page width: 1440px, centered. Page padding: `--sp-7` (32px). Mobile breakpoints: 1100 collapses 4-col grids to 2-col; 720 collapses 2-col to 1-col.

## Token → Vuetify key mapping

The bundle's tokens.css names are kept verbatim in `src/styles/tokens.css`. The same values are also exposed as Vuetify theme colors (CSS var `--v-theme-<key>`) in `src/plugins/vuetify/theme.ts`.

| Raw token (`--*`) | Vuetify key (use in templates as `color="<key>"` or `bg-<key>`) |
|-------------------|----------------------------------------------------------------|
| `--primary` | `primary` |
| `--on-primary` | `on-primary` |
| `--bg` | `background` |
| `--surface` | `surface` |
| `--text` | `on-surface` / `on-background` |
| `--surface-2` | `surface-2` |
| `--surface-inset` | `surface-inset` |
| `--bg-subtle` | `bg-subtle` |
| `--border` | `border` |
| `--border-strong` | `border-strong` |
| `--text-secondary` | `text-secondary` |
| `--text-tertiary` | `text-tertiary` |
| `--text-disabled` | `text-disabled` |
| `--primary-weak` | `primary-weak` |
| `--primary-weak-2` | `primary-weak-2` |
| `--primary-border` | `primary-border` |
| `--primary-hover` | `primary-hover` |
| `--primary-active` | `primary-active` |
| `--success` | `success` |
| `--success-strong` / `-weak` / `-border` | `success-strong` / `success-weak` / `success-border` |
| `--warning`, `--error`, `--info` | same convention |
| `--chart-revenue` … `--chart-target` | `chart-revenue` … `chart-target` |
| `--c1` … `--c5` | `c1` … `c5` |

In SCSS / styles, use either form interchangeably:
- raw token: `background: var(--surface-2)`
- vuetify var: `background: rgb(var(--v-theme-surface-2))`

Templates should prefer Vuetify's `color="..."` / `bg-..." ` / `text-...` props where they exist; drop to raw `--*` for custom CSS (cards, dividers, charts, etc.).

## Component archetypes (recurring in this codebase)

| Archetype | Reference design file | Use for |
|-----------|----------------------|---------|
| **Dashboard** | `pages/Dashboard.jsx` | KPI strip + revenue/expense chart + payment donut + orders/hour bars + small panels |
| **Analytics** | `pages/Analytics.jsx` | per-shift KPI strip + donut + vertical/horizontal bars + breakdown tables (handover-style) |
| **Cards grid** | `pages/Shifts.jsx` | per-entity cards (cashier shifts) with filter bar + summary strip |
| **List + table** | `pages/Orders.jsx` | toolbar filters + sortable sticky table + filter chips + row + bulk actions + pagination + states |
| **Settings / form-page** | `pages/DesignSystem.jsx` + Orders toolbar | panel sections, sticky save bar |
| **Form / dialog** | New-user modal in `pages/Users.jsx` | modal head + body grid + foot, full validation |

Each archetype's visual contract is in the corresponding bundle file. When restyling existing pages, match the visual contract, **never** the JSX structure.

## Hard rules — every restyle MUST follow

1. **Presentation only.** API calls, Pinia stores, vue-router routing, CASL permissions, i18n strings, table columns, dialog fields, button actions — all unchanged. If a visual change implies a logic change, stop and flag it.
2. **Reuse existing `@core/components`.** No parallel patterns.
3. **Charts:** ApexCharts only. Series colors **must** come from `--chart-*` tokens — never raw hex per chart.
4. **Number formatting:** UZS with U+202F (narrow no-break space) thousands grouping. Abbreviate large values (1 240 000 → `1.24M`). Helpers ported into `src/composables/useFormatters.ts` (existing) — extend, don't fork.
5. **Tabular numbers** on all monetary / quantitative figures (`.num` or `.mono` class).
6. **Status pill colors** follow `STATUS_TONE` from `app/ui.jsx`:
   - success: ACTIVE / COMPLETED / READY / PAID
   - warning: PREPARING / PENDING
   - error: CANCELLED / UNPAID
   - info: CASHIER / DELIVERY
   - primary: MANAGER / ADMIN / PICKUP
   - neutral: USER / HALL / INACTIVE
7. **Dark mode parity:** every restyled component visually verified in both light and dark before commit.

## Files where this system lives

- `src/styles/tokens.css` — raw `--*` token mirror
- `src/plugins/vuetify/theme.ts` — Vuetify color keys + variables
- `src/@core/scss/template/libs/vuetify/_variables.scss` — body font registered (`Hanken Grotesk` first in the stack)
- `index.html` — Google Fonts `<link>` for Hanken Grotesk + JetBrains Mono
- `docs/design-system.md` — this doc

## Bundle reference (until rollout complete)

Source files preserved at `.tmp-design-bundle/project/`:
- `styles/tokens.css` — original tokens
- `styles/app.css` — original component CSS
- `app/shell.jsx` — sidebar, topbar, page-header model
- `app/ui.jsx` — Button, Field, Input, Select, Switch, Segmented, Checkbox, Card, KPI, Badge, Modal, Toast, Pagination
- `app/charts.jsx` — chart wrappers (SVG; we map → ApexCharts)
- `app/table.jsx` — sortable, expandable DataTable contract
- `app/format.js` — `Fmt.num`, `Fmt.moneyAbbr`, etc.
- `pages/DesignSystem.jsx` — every component in every state
- `pages/Dashboard.jsx`, `Analytics.jsx`, `Orders.jsx`, `Users.jsx`, `Shifts.jsx` — page archetypes
- `chats/chat1.md` — design intent / decisions transcript

**Delete `.tmp-design-bundle/` after the redesign is fully rolled out and verified.**

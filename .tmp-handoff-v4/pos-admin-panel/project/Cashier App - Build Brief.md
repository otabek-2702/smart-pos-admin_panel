# Alpha POS — Cashier Desktop App · Build Brief

> Paste this whole document into a new chat. It contains the complete design
> system used by the **Alpha POS Admin Panel** so the cashier desktop app
> matches it exactly. Build the cashier app as a **fully clickable HTML/React
> prototype** using these tokens, type, components and conventions verbatim.
> Do not invent new colors, fonts, radii or shadows — only use what's below.

---

## 0. What to build

A **touch-friendly desktop POS app for cashiers** (not the manager admin panel).
It runs full-screen on a counter terminal. Primary jobs, in order of how often
they're used:

1. **Order builder** — pick category → tap products into a cart → adjust qty →
   choose order type (Hall / Delivery / Pickup) + table → checkout.
2. **Payment** — split between Cash / Uzcard / Humo / Payme; compute change for cash.
3. **Open orders / tables** — see active orders, reopen, mark ready/served.
4. **Shift** — clock in / clock out, open & close the cash drawer, see my shift total.

Design it as a **left product area + right cart/checkout panel** layout (the
classic POS split), with a slim left icon-rail for navigation. Optimised for
**mouse + touch**, big hit targets (min 44px, prefer 56px+ for product tiles and
the numeric keypad). Same visual language as the admin panel below.

**Currency & numbers (match the admin panel exactly):** UZS, space thousands
separators (`1 240 000`), abbreviate big values in summaries (`1.24M`, `320K`).
Use the mono font with tabular figures for every number.

---

## 1. Design language

**High-contrast minimalism. Light-first, dark supported via a `[data-theme="dark"]`
attribute on `<html>`.** Neutral surfaces, one indigo-blue accent. Color and
depth signal state, priority and action — never decoration. Generous whitespace,
AA contrast, one clear primary action per screen.

- **Accent:** indigo-blue `#3A5BDB`.
- **Fonts:** `Hanken Grotesk` for UI, `JetBrains Mono` (tabular) for all numbers.
  Load from Google Fonts: `Hanken+Grotesk:wght@400;500;600;700` and
  `JetBrains+Mono:wght@400;500;600;700`.
- **Icons:** stroke icons on a 24px grid, `currentColor`, 1.7 stroke width,
  round caps/joins. (Reuse the admin panel's inline-SVG icon set — same style.)
- Avoid: gradients, emoji, heavy shadows, rounded-corner-with-left-accent-border
  cards, rainbow chart colors.

---

## 2. Design tokens — paste this CSS verbatim into `styles/tokens.css`

```css
:root {
  /* Type families */
  --font-sans: "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

  /* Type scale (px / line-height) */
  --fs-display: 32px;  --lh-display: 40px;
  --fs-h1: 24px;       --lh-h1: 32px;
  --fs-h2: 19px;       --lh-h2: 28px;
  --fs-h3: 15px;       --lh-h3: 22px;
  --fs-body: 14px;     --lh-body: 22px;
  --fs-sm: 13px;       --lh-sm: 20px;
  --fs-label: 12px;    --lh-label: 16px;
  --fs-micro: 11px;    --lh-micro: 14px;
  --fs-kpi: 30px;      --lh-kpi: 36px;
  --fs-kpi-lg: 34px;   --lh-kpi-lg: 40px;
  --fw-regular: 400; --fw-medium: 500; --fw-semibold: 600; --fw-bold: 700;
  --tracking-label: 0.06em;

  /* Spacing scale (4px base) */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-7: 32px; --sp-8: 40px;
  --sp-9: 48px; --sp-10: 64px;

  /* Radii */
  --r-xs: 6px; --r-sm: 8px; --r-md: 10px; --r-lg: 14px; --r-xl: 20px; --r-pill: 999px;

  /* LIGHT THEME (default) — Surfaces & lines */
  --bg: #F4F6F8; --bg-subtle: #EEF1F4; --surface: #FFFFFF; --surface-2: #F8FAFB;
  --surface-inset: #F1F4F7; --border: #E4E7EC; --border-strong: #D3D8E0;
  --overlay: rgba(15, 23, 34, 0.42);

  /* Text */
  --text: #0F1722; --text-secondary: #586172; --text-tertiary: #8A929E;
  --text-disabled: #B4BAC4; --text-on-accent: #FFFFFF;

  /* Brand accent (primary) */
  --primary: #3A5BDB; --primary-hover: #2E49B8; --primary-active: #263EA0;
  --primary-weak: #EDF0FD; --primary-weak-2: #DEE4FB; --primary-border: #C7D1F7;
  --primary-ring: rgba(58, 91, 219, 0.28); --on-primary: #FFFFFF;

  /* Semantic (text-safe AA on white) + soft tints */
  --success: #15935A; --success-strong: #0F7A4A; --success-weak: #E6F4EC; --success-border: #BDE3CD;
  --warning: #B26A00; --warning-strong: #8A5200; --warning-weak: #FBF0DD; --warning-border: #F0D7A6;
  --error: #C8372A; --error-strong: #A82C21; --error-weak: #FBEBE9; --error-border: #F1C8C3;
  --info: #1180BE; --info-strong: #0E6A9E; --info-weak: #E6F3FA; --info-border: #BCE0F1;
  --neutral-weak: #EEF1F4; --neutral-border: #DCE1E8;

  /* Chart palette — fixed semantics across ALL charts */
  --chart-revenue: #3A5BDB; --chart-expense: #E0823C; --chart-cash: #15935A; --chart-card: #3A5BDB;
  --chart-grid: #EAEDF1; --chart-axis: #9AA2AE; --chart-track: #EEF1F5; --chart-target: #8A929E;
  --c1: #3A5BDB; --c2: #15935A; --c3: #E0823C; --c4: #6E8BFF; --c5: #9AA3B2;

  /* Elevation — restrained */
  --shadow-xs: 0 1px 2px rgba(16, 24, 40, 0.05);
  --shadow-sm: 0 1px 3px rgba(16, 24, 40, 0.07), 0 1px 2px rgba(16, 24, 40, 0.04);
  --shadow-md: 0 6px 16px rgba(16, 24, 40, 0.08), 0 2px 4px rgba(16, 24, 40, 0.04);
  --shadow-lg: 0 16px 40px rgba(16, 24, 40, 0.14), 0 4px 10px rgba(16, 24, 40, 0.06);
  --shadow-focus: 0 0 0 3px var(--primary-ring);

  --sidebar-w: 256px; --topbar-h: 64px;
}

[data-theme="dark"] {
  --bg: #0E1219; --bg-subtle: #0A0D13; --surface: #161B24; --surface-2: #1B212C;
  --surface-inset: #11161E; --border: #262E3B; --border-strong: #323C4C;
  --overlay: rgba(3, 6, 12, 0.6);
  --text: #E8EBF1; --text-secondary: #9AA4B2; --text-tertiary: #6B7585;
  --text-disabled: #4B5563; --text-on-accent: #FFFFFF;
  --primary: #6E8BFF; --primary-hover: #819AFF; --primary-active: #5C7BF5;
  --primary-weak: #1C2640; --primary-weak-2: #243154; --primary-border: #34467A;
  --primary-ring: rgba(110, 139, 255, 0.34); --on-primary: #0B1020;
  --success: #36C07E; --success-strong: #45CE8C; --success-weak: #14271E; --success-border: #1F4733;
  --warning: #E5A53B; --warning-strong: #F0B557; --warning-weak: #2A2113; --warning-border: #4A3A1B;
  --error: #EF6A5B; --error-strong: #F48376; --error-weak: #2C1714; --error-border: #50271F;
  --info: #45A8E0; --info-strong: #5FB7EA; --info-weak: #11242F; --info-border: #1E3D4F;
  --neutral-weak: #1E2530; --neutral-border: #2C3543;
  --chart-revenue: #6E8BFF; --chart-expense: #E89A5C; --chart-cash: #36C07E; --chart-card: #6E8BFF;
  --chart-grid: #232B38; --chart-axis: #5B6572; --chart-track: #222A36; --chart-target: #6B7585;
  --c1: #6E8BFF; --c2: #36C07E; --c3: #E89A5C; --c4: #9DB0FF; --c5: #7E8A9C;
  --shadow-xs: 0 1px 2px rgba(0,0,0,.4);
  --shadow-sm: 0 1px 3px rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.4);
  --shadow-md: 0 6px 16px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.4);
  --shadow-lg: 0 16px 40px rgba(0,0,0,.6), 0 4px 10px rgba(0,0,0,.4);
  --shadow-focus: 0 0 0 3px var(--primary-ring);
}
```

---

## 3. Type, spacing, radius rules

- **Page title** `--fs-h1`/700. **Section/card title** `--fs-h3`/600.
  **Body/tables** `--fs-body`/400. **Labels** `--fs-label`/600 uppercase with
  `letter-spacing: var(--tracking-label)`.
- **All numbers** use `font-family: var(--font-mono); font-variant-numeric: tabular-nums;`
  and slight negative tracking (`-0.02em`) for big figures. Totals/prices are mono.
- Spacing: use the `--sp-*` scale only. Cards padded `--sp-5`. Page padding `--sp-7`.
- Radius: controls/buttons `--r-sm`, cards `--r-lg`, modals `--r-xl`, pills `--r-pill`.
- Use **flex/grid with `gap`** for all groupings — never bare inline siblings.

---

## 4. Component spec (match these exactly)

**Buttons** — height 40px (sm 32, lg 46), radius `--r-sm`, weight 600, `gap --sp-2`:
- `primary`: bg `--primary`, text `--on-primary`; hover `--primary-hover`; active `--primary-active`.
- `secondary`: bg `--surface`, border `--border-strong`, text `--text`; hover bg `--surface-2`.
- `ghost`: transparent, text `--text-secondary`; hover bg `--surface-2`.
- `danger`: bg `--error`; `danger-soft`: bg `--error-weak`, text `--error`, border `--error-border`.
- Focus: `box-shadow: var(--shadow-focus)`. Loading: spinner, content hidden. Disabled: opacity .5.
- **For POS:** add a big `lg`/touch variant (≥56px tall) for the keypad and "Charge" button.

**Inputs / controls** — height 42px, radius `--r-sm`, border `--border-strong`,
bg `--surface`. Hover border `--text-tertiary`; focus border `--primary` +
`--shadow-focus`. Error: border `--error`. Disabled: bg `--surface-inset`.
Selects have a chevron-down on the right. Include: text input, select, switch
(40×22, on = `--primary`), checkbox (18px, checked = `--primary`), segmented control.

**Cards** — bg `--surface`, border `--border`, radius `--r-lg`, `--shadow-xs`.
Header row: title (`--fs-h3`/600) + optional sub (`--fs-sm`, `--text-secondary`) +
right-aligned actions.

**Badges / status pills** — height 22px, radius `--r-xs`, `--fs-label`/600, soft
tint bg + matching border. Optional leading dot. **Status → tone mapping:**
`ACTIVE/COMPLETED/READY/PAID → success`, `PREPARING/PENDING → warning`,
`CANCELLED/UNPAID → error`, `HALL → neutral`, `DELIVERY → info`, `PICKUP → primary`,
`INACTIVE → neutral`.

**KPI stat** — icon chip (38px, tinted bg per tone) + label + big mono value +
delta pill (`is-up` green / `is-down` red / `is-flat` neutral with arrow).

**Modal** — scrim `--overlay`, panel bg `--surface`, radius `--r-xl`, `--shadow-lg`;
header (title `--fs-h2`/700 + close), body, footer (right-aligned ghost + primary).
Esc and click-outside close. Use for payment, void confirmation, discount entry.

**Toasts** — bottom-right, `--surface` card, 3px left border in tone color, icon +
title + message, auto-dismiss ~4.2s. Fire on every action (added to cart, paid,
voided, shift opened/closed).

**Data table** (for open orders / shift receipts) — sticky header bg `--surface-2`,
uppercase `--fs-label` headers, 14px row padding, hover bg `--surface-2`, selected
bg `--primary-weak`, sortable columns, right-aligned numeric (mono) columns.

**States** — always design **loading (skeleton shimmer)**, **empty** (icon +
title + sub + action), and **error** (red-tinted) for every async surface.

---

## 5. Layout & navigation

- **Left icon-rail** (~74px), not the full 256px sidebar — cashiers need screen
  space for products. Icons only, active item = `--primary-weak` bg + `--primary`
  icon + 3px left accent bar. Items: New Order, Open Orders / Tables, Shift, (Settings, Logout at bottom).
- **Top bar** 64px: current order context / table, search products, theme toggle,
  cashier avatar + name, live clock, connection status dot.
- **Main split:** left = category tabs + product tile grid; right = **cart panel**
  (fixed ~380–420px) with line items, qty steppers, subtotal/discount/total, and a
  full-width primary **Charge {total}** button pinned to the bottom.
- **Numeric keypad** for payment: 56px+ keys, mono digits, `surface` tiles with
  `--border`, primary "Enter", `danger-soft` "Clear".

---

## 6. Build instructions (same architecture as the admin panel)

- React 18.3.1 + Babel standalone, pinned versions with integrity hashes.
- Split into small files: `app/format.js` (number/UZS formatter — see below),
  `app/data.js` (mock products/categories/orders), `app/icons.jsx`, `app/ui.jsx`
  (primitives), `app/shell.jsx` (rail + topbar + router), then one file per screen
  under `pages/`. Each `type="text/babel"` file re-declares the hooks it uses
  (`const { useState, useEffect } = React;`) and exports via `Object.assign(window, {...})`.
- Persist cart + current shift to `localStorage` so a refresh doesn't lose state.
- Keep `[data-theme]` on `<html>`, default light, toggle in the top bar, persist choice.

**Formatter (reuse verbatim — `window.Fmt`):** `num()` groups with narrow no-break
space (`1 240 000`), `abbr()` → `1.24M`/`320K`, `money(n, {unit})`, `pct()`,
`delta()` (signed), `date()`/`dateTime()`/`time()` as `DD.MM.YYYY` / `HH:MM`.

---

## 7. Data the backend provides (use as the mock-data shape)

**Product / catalog** — products have: `name`, `price` (UZS), `category`,
optional `image`. Categories are flat tabs. Real product names from this tenant:
`Pitsa tovuqli katta` (85 000), `Non kabob big` (56 000), `Lavash halapino`
(36 000), `Toster` (28 000), `Lester` (20 000), `Hot Dog Halapeno` (18 000),
`Hot Dog karalevskiy` (34 000), `Lavash katta` (72 000), `Non kabob standart`
(60 000), `Tandir Lavash` (38 000). Make ~24–30 products across 5–6 categories.

**Order** — `id`, `type` (HALL / DELIVERY / PICKUP), `info` (table e.g. "Hall 4"
for hall orders, "—" otherwise), `status` (PREPARING / READY / COMPLETED /
CANCELLED), `payment` (PAID / UNPAID), `total`, `items` (count), `at` (timestamp),
and `lines[]` of `{ name, qty, price }`.

**Payment methods** — Cash, Uzcard, Humo, Payme (+ "Mixed" for split). A cash
payment captures tendered amount and computes change.

**Shift (cashier-facing)** — `id`, `cashier`, `start`, `end`, `durationLabel`,
`orders` count, `gross`, `net`, `cash`, `card`, `expenses`, `cancelled` +
`cancelledAmount`, `expectedCash` (= cash − expenses), `avgTicket`, `items`,
`peak`. On the cashier app, the **Shift** screen shows *my* running totals and the
**open/close drawer** action; the manager reconciles the counted cash on the admin
side, so the cashier screen just needs: open shift, live shift total, close shift
(which reports the drawer count up to the manager).

---

## 8. Acceptance checklist

- [ ] Tokens pasted verbatim; light + dark both work via `[data-theme]`.
- [ ] Hanken Grotesk + JetBrains Mono loaded; every number is mono + tabular + UZS-formatted.
- [ ] POS split layout: product grid left, cart panel right, big "Charge" button.
- [ ] Add-to-cart, qty steppers, order-type + table picker all interactive.
- [ ] Payment modal with keypad, split methods, cash change calculation.
- [ ] Open Orders table (sortable, status/payment pills, reopen/mark-ready).
- [ ] Shift screen: open/close drawer, live totals, toast feedback.
- [ ] Loading / empty / error states on every async surface.
- [ ] Touch targets ≥44px (keypad & product tiles ≥56px).
- [ ] No invented colors/fonts/radii — only the tokens above.
```
```
```

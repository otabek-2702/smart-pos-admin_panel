# Full-app QA — findings (2026-07-02)

## Test setup
- **Prod**: smart-pos-admin-panel-phi.vercel.app → BE pos.78.111.90.65.nip.io — login `admin@alpha.local` / `SmartPos1234`
- **Local BE**: alpha_pos Django `127.0.0.1:8000`, started `DEBUG=true LICENSE_DEV_BYPASS=1` (Jason-approved). Login `reese.lewis@inbox.uz` / `123` (local sqlite pw reset).
- **Local FE**: `yarn dev` :5181. Read-only checks on prod; create/delete on local dev.
- NOTE: prod Vercel build is BEHIND current source — several already-fixed issues still show on prod, will clear on next deploy.

## Coverage — every page walked
Dashboard hub (5 tabs) · orders · users · categories · products · places · discounts · kassa · treasury · loyalty · sessions · all 11 HR pages · 4 stock pages · AI assistant (live query ✓) · shifts-analytics · QR codes · 4 notification pages · settings dialog · dark mode · anomaly bell.

## Mutation tests (local)
- Category CREATE via full UI → POST 201 (count 15→16) ✓
- Category DELETE → 200, cleaned up ✓
- Local dev UI is HMR-flaky (component state resets on interaction under Vite dev) — but this is a DEV-ONLY artifact; prod build filters/search/pagination all work correctly (verified on prod: orders status filter, product search, category search all fire + stick).

## FE FIXED this session (committed, NOT merged to main)
1. Loyalty subtitle was English "Stamps program and top customers" → added uz/ru/en i18n.
2. Places subtitle was English "Manage hall layout, tables and seat capacity" → added uz/ru/en i18n.
3. Staff KPI uz typo "Jami soat (30k)" → "Jami soat (30 kun)".
4. Products trends table header used `t('Units')` (=O'lchov birliklari, measurement units) → `t('Units sold')`.
5. Ops funnel showed impossible "8950%" — divided by first stage's count. Now: badge = share-of-total, bar width = share-of-max (never >100%).
6. Ops "Avg prep time by category" rendered ~12 rows of "0.0m / 0m" when BE hasn't computed prep — now zero-suppressed (card hides when all zero).
7. Ops layout hole — funnel row reserved 3 columns but 2 neighbours are permanently disabled placeholders, leaving blank space. Moved "Orders by hour" chart up beside the funnel (balanced 2-col).
8. Categories cards were all identical grey blobs (BE `colors:[]`). Added deterministic hash-colour fallback by name.

## FE already-fixed in current code (prod just stale — will clear on deploy)
- Products toolbar "Выбрано: 0" (RU leaking into uz) — uz.json already correct "{n} ta tanlandi".
- Loyalty "Top mijozlar" pagination showing raw "{0}-{1} / {2}" — table already has `hide-default-footer` in current source.

## FE deferred (documented, not changed — need a decision or bigger refactor)
- **Orders "Statuslar bo'yicha taqsimot" + "To'lov holati" cards are page-scoped** (OrdersInsights computes from the 10 loaded rows, not global). Proper fix needs global per-status counts → see BE ask #3. Low risk to leave; misleading label.
- **Orders MIJOZ column shows the staff creator** (`o.user.name`), not a customer. Only customer-ish field is `phone_number` (mostly empty). Judgment call — retitle column to "Kassir/Yaratdi" OR show phone. Left for Jason.
- **Products dash donut/treemap show top-6 only**; centre total (270M) ≠ full menu revenue (326M) → percentages understate. Add an aggregated "Boshqalar" (Others) slice.
- **Hub hero KPI labels hardcoded "(30 KUN)"** even when picker = Kecha/custom. (exec + sales tabs.)
- **Sales tab labels** "SHU OY", "Kanal · 7 kun", "Oxirgi 30 kun" stay literal when picker changes; 1-day range → main area chart blank (needs ≤2-point fallback).
- **DateRangePicker** default highlights "Barcha vaqt" while trigger says "Oxirgi 30 kun".
- **Native date inputs** (treasury, shifts-analytics: дд.мм.гггг) vs the custom DateRangePicker elsewhere — design inconsistency.
- **Login/all pages**: two `/assets/<uuid>` 404s (missing hashed assets in Vercel build). Cosmetic (no visible break); track down the dangling import.

## Verified GOOD (no action)
- AI assistant: live `/ai/query` returns full markdown tables + recommendations in Uzbek. Excellent.
- Dark mode: sidebar `rgb(22,27,36)` is intended surface elevation, not a light-mode leak (was a false alarm).
- All HR + stock + notification pages: translated, no raw i18n tokens, render clean.
- Orders filters (statuses=PREPARING), row-expand, pagination — work on prod.

## BE asks for Abrorbek (dev-bot, project smart-pos) — see draft below
1. `/users` — `created_at` null for all users → "Yaratilgan" column dead.
2. `/categories` — add `product_count` per category (all cards show "#0").
3. `/orders/stats` — add full `status_counts{OPEN,PREPARING,READY,COMPLETED,CANCELED}` + `payment_counts{PAID,UNPAID}` (global) so the orders insights strip can show real distribution, not just the current page.
4. `/dashboard/operations` `prepByCategory` — all `mins:0` (prep time not computed). Compute avg prep seconds per category, or drop the field.
5. `/dashboard?from&to` (range) — payload has no `category_stats`; exec tab silently falls back to today's categories while heroes show the range.

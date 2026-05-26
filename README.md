# Smart POS — Admin Panel

Vue 3 + Vuetify 3 admin panel for the Smart POS / alpha_pos restaurant
management system. Manages categories, products, orders, employees, stock,
discounts, shifts, places & tables, notifications, and HR (salaries,
expenses, attendance, leaves, contracts).

> Talks to the Django backend at `C:/Users/Jason/Desktop/Projects/alpha_pos/`.
> See [docs/BACKEND_FEEDBACK.md](docs/BACKEND_FEEDBACK.md) for the API audit.

---

## Quick start

```bash
yarn install
yarn dev          # http://localhost:5181
```

Login at `/login` with `admin@gmail.com` / `123` (local dev seed user).

---

## Commands

| Command | Purpose |
|---|---|
| `yarn dev` | Start Vite dev server on port `5181` (auto-increments if busy) |
| `yarn build` | Type-check + build static SPA bundle into `dist/` |
| `yarn preview` | Preview production build on port `5050` |
| `yarn lint` | ESLint with auto-fix (lints the whole tree, including template internals) |
| `yarn lint:ci` | Scoped lint — app code only, errors-only. Used by CI. |
| `yarn ci` | Local equivalent of CI: `lint:ci` + `build`. Run before pushing. |
| `yarn typecheck` | TypeScript check only, no emit |
| `yarn smoke` | Playwright smoke test — login + visit every nav route. Needs backend + dev server running. |
| `yarn smoke:install` | One-time: install Playwright's Chromium browser. |

### CI

GitHub Actions runs `lint:ci` + `build` on every PR / push to `main`
(`.github/workflows/ci.yml`). The Playwright smoke test job is opt-in via
`workflow_dispatch` until we have a staging backend reachable from CI runners.

---

## Backend & environment

### Dev: Vite proxy (no CORS configuration needed)

`vite.config.ts` proxies `/api/*` to `http://127.0.0.1:8000`. Axios uses
relative paths (`/api/admins/...`) so the browser sees same-origin requests.

### Other environments: `VITE_API_HOST` env var

```bash
# .env.production
VITE_API_HOST=https://api.example.com
```

When set, axios prefixes every request with this host (CORS must be
configured on the backend — see `docs/BACKEND_FEEDBACK.md §4b`).

### Default backend mount points

| Frontend instance | Mounts at |
|---|---|
| `axios` (default) | `${VITE_API_HOST}/api/admins` |
| `stockApi` | `${VITE_API_HOST}/api/admins/stock` |
| `hrApi` | `${VITE_API_HOST}/api/admins/hr` |
| `discountsApi` | `${VITE_API_HOST}/api/admins/discounts` |
| `notificationsApi` | `${VITE_API_HOST}/api/admins/notifications` |

All four import from `src/plugins/axios.ts` and share the same Bearer
interceptor (token in `localStorage.accessToken`) and 401 handler.

---

## Architecture

- **Routing** — file-based via `vite-plugin-pages`. Pages live in
  `src/pages/`. Each declares its route meta in a `<route lang="yaml">`
  block at the bottom of the file.
- **Layouts** — `src/layouts/default.vue` (app shell with nav) and
  `blank.vue` (auth pages).
- **Navigation** — five sections in `src/navigation/vertical/`: dashboard,
  management, hr, stock, system.
- **i18n** — `vue-i18n` with locales `uz` (default), `ru`, `en` in
  `src/plugins/i18n/locales/`. Persisted to `localStorage.appLocale`.
  Backend error messages translated via `src/composables/useApiError.ts`.
- **Auth** — CASL abilities built from `user.permissions` array returned
  by `/auth-login`. ADMIN role gets `['*']` → manage-all. Backend enforces
  per-endpoint via `@admin_required` + `@permission_required` decorators.
- **Auto-imports** — `unplugin-auto-import` brings in `ref`, `computed`,
  `useRouter`, `useI18n`, `defineStore`, etc. without explicit imports.
  Vuetify components (`VCard`, `VBtn`, ...) auto-imported via
  `unplugin-vue-components`.

See [`CLAUDE.md`](CLAUDE.md) for developer notes and patterns
(skeleton/loading, pagination, action buttons, status colors).

---

## Path aliases

| Alias | Resolves to |
|---|---|
| `@` | `src/` |
| `@core` | `src/@core/` |
| `@layouts` | `src/@layouts/` |
| `@images` | `src/assets/images/` |
| `@styles` | `src/styles/` |
| `@axios` | `src/plugins/axios.ts` |
| `@validators` | `src/@core/utils/validators.ts` |
| `@themeConfig` | `themeConfig.ts` (root) |

---

## Docs

- [`docs/BACKEND_FEEDBACK.md`](docs/BACKEND_FEEDBACK.md) — backend bugs, missing endpoints, requested error codes, CORS setup
- [`docs/FRONTEND_TODO.md`](docs/FRONTEND_TODO.md) — migration plan + backlog of unwired endpoints
- [`docs/review-answers.md`](docs/review-answers.md) — answers to the 2026-04-30 technical review questionnaire
- [`CLAUDE.md`](CLAUDE.md) — developer guide / patterns

---

## Stack

Vue 3 · TypeScript · Vuetify 3 (labs `VDataTable` / `VDataTableServer`) ·
Pinia · vue-i18n 9 · CASL · Axios · Vite 4 · file-based routing
(`vite-plugin-pages`) · layout engine (`vite-plugin-vue-layouts`).

Originally based on the Sneat Vue admin template; most template
components have been replaced or removed (see `docs/review-answers.md` Q9).

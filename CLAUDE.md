# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # Start dev server (default port 5181, auto-increments if in use)
yarn build        # Type-check + build for production
yarn preview      # Preview production build on port 5050
yarn lint         # ESLint with auto-fix
yarn typecheck    # TypeScript check only (no emit)
```

There are no tests configured in this project.

## Architecture Overview

This is a **Vue 3 + Vuetify 3 admin dashboard** (Sneat template) connected to a Django REST backend at `http://127.0.0.1:8000`.

### Routing — file-based via `vite-plugin-pages`
Pages in `src/pages/` are auto-registered as routes. Every page file uses a `<route lang="yaml">` block at the bottom to declare route meta:
```yaml
meta:
  layout: blank        # omit for default layout
  action: read         # CASL action required
  subject: Auth        # CASL subject required
  redirectIfLoggedIn: true
```
The `src/router/index.ts` guards all navigation using CASL: unauthenticated users are redirected to `/login`; authenticated users accessing auth-only pages are redirected to `/`.

### Layouts — `vite-plugin-vue-layouts`
Two layouts live in `src/layouts/`:
- `default.vue` — full app shell with vertical nav, navbar, footer
- `blank.vue` — bare wrapper for auth pages

The default layout is `DefaultLayoutWithVerticalNav.vue` inside `src/layouts/components/`.

### Auto-imports
**Do not manually import** Vue composables, VueUse, vue-router, vue-i18n, or pinia — they are all auto-imported via `unplugin-auto-import`. This includes `ref`, `computed`, `watch`, `useRouter`, `useRoute`, `useI18n`, `defineStore`, etc. Vuetify components (`VCard`, `VBtn`, etc.) are also auto-imported.

### Path aliases
| Alias | Resolves to |
|-------|-------------|
| `@` | `src/` |
| `@core` | `src/@core/` |
| `@layouts` | `src/@layouts/` |
| `@images` | `src/assets/images/` |
| `@styles` | `src/styles/` |
| `@axios` | `src/plugins/axios.ts` |
| `@validators` | `src/@core/utils/validators.ts` |
| `@themeConfig` | `themeConfig.ts` (root) |

### Authentication
- Login: `POST /admins-api/login` → `{ email, password }`
- On success, store in `localStorage`: `accessToken` (JSON-stringified), `userData`, `userAbilities`
- ADMIN role gets abilities: `[{ action: 'manage', subject: 'all' }]`
- The axios interceptor in `src/plugins/axios.ts` auto-attaches `Authorization: Bearer <token>` on every request
- Logout is handled in `src/layouts/components/UserProfile.vue` — clears localStorage and resets CASL ability to `initialAbility`

### CASL Authorization
- Ability types are in `src/plugins/casl/AppAbility.ts`: Actions = `create|read|update|delete|manage`, Subjects = `Auth|Admin|AclDemo|all`
- The `canNavigate()` function in `src/@layouts/plugins/casl/index.ts` checks route `meta.action` + `meta.subject` against the current ability
- In templates use `$can('action', 'subject')` to conditionally render elements

### i18n
- Locales: `src/plugins/i18n/locales/` — `uz.json` (default), `ru.json`, `en.json` (fallback), `ar.json`, `fr.json`
- Selected locale is persisted to `localStorage` key `appLocale`
- The navbar language switcher lives in `src/layouts/components/NavBarI18n.vue` and uses the `@core/components/I18n.vue` component — update the `i18nCompLanguages` array there to add/remove languages from the navbar dropdown
- Use `useI18n({ useScope: 'global' })` in components; translation keys are flat strings (e.g. `t('Email')`, `t('login_btn')`)

### Navigation menus
Vertical nav items are declared in `src/navigation/vertical/` as plain arrays and merged in `src/navigation/vertical/index.ts`. Each item can have `title`, `to` (route name), `icon`, `action`, `subject`, and optionally `children`.

### Theming & styles
- Global theme config: `themeConfig.ts` (root) — controls app title, layout nav type, skin, RTL, transitions
- Theme settings (skin, dark/light) persist to `localStorage` under keys prefixed with the app title (`pos system-theme`, `pos system-skin`, etc.)
- SCSS variables: `src/styles/variables/` — `_vuetify.scss` overrides Vuetify tokens

### `src/@core` vs `src/@layouts`
- `@core` — project-specific reusable components (`CardStatistics*`, `AppDateTimePicker`, etc.), composables (`useThemeConfig`, `useSkins`), and utilities
- `@layouts` — layout engine primitives (nav rendering, CASL plugin, layout types). Treat these as read-only framework internals unless fixing a layout bug

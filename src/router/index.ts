import { setupLayouts } from 'virtual:generated-layouts'
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteLocationNormalized } from 'vue-router'
import { isUserLoggedIn } from './utils'
import routes from '~pages'
import { canNavigate } from '@layouts/plugins/casl'
import { armMotion, replayMotion } from '@/composables/useAlphaMotion'
import axiosIns, { getCurrentApiHost } from '@/plugins/axios'
import { hydrateBusinessSettings, setBusinessDayStart } from '@/composables/useBusinessDay'
import { getStoredToken, getStoredUserData } from '@/utils/storage'
import { hasLoginLink } from '@/bootstrap/loginLink'
import { readUserAccess } from '@/composables/useUserAccess'
import { warehousePathAllowed } from '@/navigation/access'
import { OPERATOR_HOME, canHydrateBusinessSettings, operatorPathAllowed } from '@/navigation/operatorAccess'

function hydrateAuthMe(res: any) {
  const me = res?.data?.data ?? {}

  const bds: unknown = me?.business_day_start
    ?? me?.user?.business_day_start
    ?? me?.restaurant?.business_day_start

  if (typeof bds === 'string' && /^\d{1,2}:\d{2}/.test(bds))
    setBusinessDayStart(bds.slice(0, 5))
  if (me && typeof me === 'object') {
    try {
      const prev = getStoredUserData()

      localStorage.setItem('userData', JSON.stringify({ ...prev, ...me }))
      window.dispatchEvent(new Event('user-access-changed'))
    }
    catch { /* Non-fatal cached session refresh. */ }
  }
}

// Hydrate business_day_start from /auth-me at app boot for users who logged
// in BEFORE the BE started exposing the field. Cached userData from those
// sessions has no business_day_start, so date presets would silently use the
// 03:00 default and could be off-by-one for tenants on a custom cutover.
// Only runs when logged in; one-shot per page load; failures are non-fatal.
function hydrateBusinessDayStart() {
  if (hasLoginLink() || !isUserLoggedIn())
    return

  // Operating-hours settings (day-start + working open/close) are owned by the
  // backend at /app-settings; pull all three on every authenticated boot so the
  // working-hours window reflects the server, not just the cached day-start.
  if (canHydrateBusinessSettings(readUserAccess().role))
    void hydrateBusinessSettings()

  // Skip if we already have a cached value to avoid a request on every reload.
  // Login + Settings update keep this localStorage key fresh.
  try {
    const cached = localStorage.getItem('businessDayStart')
    if (cached && /^\d{1,2}:\d{2}$/.test(cached))
      return
  }
  catch { /* noop */ }

  const token = getStoredToken()
  const host = getCurrentApiHost()

  axiosIns.get('/auth-me').then(res => {
    if (getStoredToken() === token && getCurrentApiHost() === host)
      hydrateAuthMe(res)
  }).catch(() => { /* noop — non-fatal */ })
}

hydrateBusinessDayStart()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Logged-out → /login. Logged-in → render the index.vue Dashboards hub.
    // (per v3 design decision #7).
    {
      path: '/',
      redirect: to => hasLoginLink()
        ? { name: 'login' }
        : isUserLoggedIn()
          ? (readUserAccess().isOperator
            ? { path: OPERATOR_HOME }
            : readUserAccess().isWarehouse
              ? { path: '/warehouse', query: to.query }
              : { name: 'index', query: to.query })
          : { name: 'login', query: to.query },
    },

    // Old /dashboard snapshot page is hidden — redirect anyone landing on it to the hub.
    { path: '/dashboard', redirect: '/' },

    // One canonical shift-money reconciliation surface. The read-only handover
    // report remains a separate file-based route; it does not post settlement.
    {
      path: '/shifts',
      redirect: to => ({ path: '/shifts-analytics', query: to.query, hash: to.hash }),
    },
    {
      path: '/shift-analytics',
      redirect: to => ({ path: '/shifts-analytics', query: to.query, hash: to.hash }),
    },
    {
      path: '/hr-attendance',
      redirect: to => ({ path: '/audit', query: { ...to.query, tab: 'attendance' }, hash: to.hash }),
    },
    ...setupLayouts(routes),
  ],
})

// Arm the page-entrance motion as early as possible (bundle parity:
// `armMotion` adds html.anim then html.anim.rin after 1200ms; transitions
// resolve to the visible state even in hidden tabs).
armMotion()

// Replay the page-level entrance on every route change so KPI cards +
// chart cards re-stagger their reveal — mirrors shell.jsx useEffect.
router.afterEach(() => {
  replayMotion()
})

function hasRoutePermissions(to: RouteLocationNormalized, access: ReturnType<typeof readUserAccess>): boolean {
  const required = Array.isArray(to.meta.anyPermission) ? to.meta.anyPermission.map(String) : []
  const requiredAll = Array.isArray(to.meta.allPermissions) ? to.meta.allPermissions.map(String) : []

  return (!required.length || access.hasAny(required)) && (!requiredAll.length || access.hasAll(requiredAll))
}

function restrictedRouteDecision(to: RouteLocationNormalized) {
  const access = readUserAccess()

  // Operators never enter the admin shell. Their own blank-layout page owns
  // permission-denied/pending states, so lack of permission cannot loop here.
  if (access.isOperator)
    return operatorPathAllowed(to.path) ? true : { path: OPERATOR_HOME }
  if (to.path.replace(/\/$/, '') === OPERATOR_HOME && !access.isAdministrator)
    return { name: 'not-authorized' }
  if (!hasRoutePermissions(to, access))
    return { name: 'not-authorized' }

  // Preserve the warehouse's existing permission-mapped CASL bypass.
  if (access.isWarehouse)
    return warehousePathAllowed(to.path, access) ? true : { name: 'not-authorized' }
}

router.beforeEach(to => {
  // A saved token (expired or otherwise) must never bypass a credential link.
  if (hasLoginLink())
    return to.path.replace(/\/$/, '') === '/login' ? true : { name: 'login' }
  const isLoggedIn = isUserLoggedIn()

  if (!isLoggedIn && to.path.replace(/\/$/, '') === OPERATOR_HOME)
    return { name: 'login' }
  if (isLoggedIn) {
    const restriction = restrictedRouteDecision(to)
    if (restriction !== undefined)
      return restriction
  }

  if (!canNavigate(to)) {
    if (isLoggedIn)
      return { name: 'not-authorized' }
    return { name: 'login', query: { to: to.name !== 'index' ? to.fullPath : undefined } }
  }
  if (to.meta.redirectIfLoggedIn && isLoggedIn)
    return '/'
})

export default router

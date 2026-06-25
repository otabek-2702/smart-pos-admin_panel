import { setupLayouts } from 'virtual:generated-layouts'
import { createRouter, createWebHistory } from 'vue-router'
import { isUserLoggedIn } from './utils'
import routes from '~pages'
import { canNavigate } from '@layouts/plugins/casl'
import { armMotion, replayMotion } from '@/composables/useAlphaMotion'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Logged-out → /login. Logged-in → render the index.vue Dashboards hub.
    // (per v3 design decision #7).
    {
      path: '/',
      redirect: to => isUserLoggedIn()
        ? { name: 'index', query: to.query }
        : { name: 'login', query: to.query },
    },
    // Old /dashboard snapshot page is hidden — redirect anyone landing on it to the hub.
    { path: '/dashboard', redirect: '/' },
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

router.beforeEach(to => {
  const isLoggedIn = isUserLoggedIn()

  if (canNavigate(to)) {
    if (to.meta.redirectIfLoggedIn && isLoggedIn)
      return '/'
  }
  else {
    if (isLoggedIn)
      return { name: 'not-authorized' }
    else
      return { name: 'login', query: { to: to.name !== 'index' ? to.fullPath : undefined } }
  }
})

export default router

import { setupLayouts } from 'virtual:generated-layouts'
import { createRouter, createWebHistory } from 'vue-router'
import { isUserLoggedIn } from './utils'
import routes from '~pages'
import { canNavigate } from '@layouts/plugins/casl'
import { armMotion, replayMotion } from '@/composables/useDesignMotion'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ℹ️ We are redirecting to different pages based on role.
    // NOTE: Role is just for UI purposes. ACL is based on abilities.
    {
      path: '/',
      redirect: to => {
        if (isUserLoggedIn())
          return { name: 'dashboard', query: to.query }

        return { name: 'login', query: to.query }
      },
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

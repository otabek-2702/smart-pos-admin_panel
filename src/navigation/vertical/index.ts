import dashboard from './dashboard'
import management from './management'
import hr from './hr'
import stock from './stock'
import analytics from './analytics'
import system from './system'
import type { VerticalNavItems } from '@/@layouts/types'

export default [
  {
    title: 'Compare Periods',
    icon: { icon: 'bx-git-compare' },
    to: 'analytics-compare',
    action: 'manage',
    subject: 'all',
  },
  ...dashboard,
  ...management,
  ...hr,
  ...stock,
  ...analytics,
  ...system,
] as VerticalNavItems

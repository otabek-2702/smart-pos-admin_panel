import dashboard from './dashboard'
import management from './management'
import hr from './hr'
import stock from './stock'
import system from './system'
import type { VerticalNavItems } from '@/@layouts/types'

export default [
  ...dashboard,
  ...management,
  ...hr,
  ...stock,
  ...system,
] as VerticalNavItems

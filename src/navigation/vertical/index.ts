import dashboard from './dashboard'
import management from './management'
import type { VerticalNavItems } from '@/@layouts/types'

export default [...dashboard, ...management] as VerticalNavItems

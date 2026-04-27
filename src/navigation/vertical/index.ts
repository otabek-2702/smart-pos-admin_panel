import dashboard from './dashboard'
import management from './management'
import stock from './stock'
import type { VerticalNavItems } from '@/@layouts/types'

export default [...dashboard, ...management, ...stock] as VerticalNavItems

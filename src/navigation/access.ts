import type { ReturnTypeReadUserAccess } from './accessTypes'

export const AUDIT_PERMISSIONS = [
  'attendance.view',
  'discipline.rule.view',
  'discipline.case.view',
  'prep.audit.view',
]

export const EXPENSE_REQUEST_PERMISSIONS = [
  'expense.request.view_all',
  'expense.request.view_own',
  'expense.request.create',
]

export const EXPENSE_CATEGORY_PERMISSIONS = [
  'expense.category.view',
  'expense.category.manage',
]

interface WarehouseRouteRule {
  prefix: string
  anyPermission?: string[]
}

const WAREHOUSE_ROUTE_RULES: WarehouseRouteRule[] = [
  { prefix: '/warehouse' },
  { prefix: '/stock/items', anyPermission: ['stock.catalog.view'] },
  { prefix: '/stock/levels', anyPermission: ['stock.level.view'] },
  { prefix: '/stock/batches', anyPermission: ['stock.batch.view'] },
  { prefix: '/stock/suppliers', anyPermission: ['stock.supplier.view'] },
  { prefix: '/stock/purchase-orders', anyPermission: ['stock.purchase.view'] },
  { prefix: '/stock/receiving', anyPermission: ['stock.purchase.view'] },
  { prefix: '/stock/counts', anyPermission: ['stock.count.view'] },
  { prefix: '/stock/adjustment-requests', anyPermission: ['stock.adjustment.request'] },
  { prefix: '/stock/transfers', anyPermission: ['stock.transfer.view'] },
  { prefix: '/audit', anyPermission: AUDIT_PERMISSIONS },
  { prefix: '/hr-expenses', anyPermission: EXPENSE_REQUEST_PERMISSIONS },
  { prefix: '/hr-expense-categories', anyPermission: EXPENSE_CATEGORY_PERMISSIONS },
]

export function warehousePathAllowed(path: string, access: ReturnTypeReadUserAccess): boolean {
  if (['/login', '/not-authorized'].includes(path) || path.startsWith('/licensing/'))
    return true

  const rule = WAREHOUSE_ROUTE_RULES.find(candidate => path === candidate.prefix || path.startsWith(`${candidate.prefix}/`))
  if (!rule)
    return false
  if (!rule.anyPermission?.length)
    return true

  return access.hasAny(rule.anyPermission)
}

import type { ReturnTypeReadUserAccess } from './accessTypes'

export const AUDIT_PERMISSIONS = [
  'attendance.view',
  'discipline.rule.view',
  'discipline.case.view',
  'prep.audit.view',
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

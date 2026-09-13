import axiosIns, { getCurrentApiHost } from '@/plugins/axios'
import { readUserAccess } from '@/composables/useUserAccess'
import { collectRetentionSnapshot } from '@/services/customerRetentionSnapshot'
import { analyzeRetentionSnapshot, normalizeRetentionPhone } from '@/utils/customerRetention'
import type { OperatorCustomer, OperatorItem, OperatorOrder, OperatorQueue } from '@/types/operatorCalls'
import type { RetentionCollectionProgress } from '@/types/customerRetention'

const DAY = 86_400_000
const MAX_CUSTOMERS = 2000
const MAX_ORDERS = 5000
const TYPES = ['HALL', 'DELIVERY', 'PICKUP']
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function fail(code = 'oc_error_contract'): never { throw new Error(code) }

export function operatorCalendarDate(now = Date.now()): string {
  return new Date(now + 5 * 3_600_000).toISOString().slice(0, 10)
}

export function operatorDayWindow(date: string, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2026-08-01' || date > operatorCalendarDate(now))
    return fail('oc_error_date')
  const from = Date.parse(`${date}T00:00:00+05:00`)
  if (!Number.isFinite(from) || operatorCalendarDate(from) !== date || from >= now)
    return fail('oc_error_date')

  return { from_at: new Date(from).toISOString(), to_at: new Date(Math.min(from + DAY, now)).toISOString() }
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !ISO.test(value) || !Number.isFinite(Date.parse(value)))
    return fail()
  return value
}

function text(value: unknown, max = 200): string | null {
  if (value == null || value === '')
    return null
  if (typeof value !== 'string' || value.length > max)
    return fail()
  return value
}

function positiveId(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0)
    return fail()
  return Number(value)
}

export function parseOperatorItems(raw: unknown): OperatorItem[] {
  if (!Array.isArray(raw) || raw.length > 500)
    return fail()
  return raw.map(item => {
    const name = text(item?.name)
    if (!['number', 'string'].includes(typeof item?.quantity))
      return fail()
    const quantity = Number(item?.quantity)
    if (!name || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000)
      return fail()
    return { name, quantity }
  })
}

function correctQueueEnd(from: number, to: number, expectedTo: number, requestedAt: number): boolean {
  const fullDayEnd = from + DAY
  if (fullDayEnd <= requestedAt)
    return to === fullDayEnd
  return to <= fullDayEnd && to <= expectedTo + 5000
}

/** A minimal, server-authorized queue; never forwards unrelated order fields. */
export function parseOperatorQueue(body: any, date: string, requestedAt = Date.now()): OperatorQueue {
  const raw = body?.data
  const bounds = operatorDayWindow(date, requestedAt)
  if (body?.success !== true || raw?.date !== date || raw.time_zone !== 'Asia/Tashkent'
    || !Array.isArray(raw.customers) || raw.customers.length > MAX_CUSTOMERS
    || raw.total_customers !== raw.customers.length)
    return fail()
  const fromAt = timestamp(raw.from_at)
  const toAt = timestamp(raw.to_at)
  const from = Date.parse(fromAt)
  const to = Date.parse(toAt)
  const snapshotId = text(raw.snapshot_id)
  if (!snapshotId || from !== Date.parse(bounds.from_at) || to <= from || !correctQueueEnd(from, to, Date.parse(bounds.to_at), requestedAt))
    return fail()
  const keys = new Set<string>()
  const phones = new Set<string>()
  const ids = new Set<number>()

  const customers: OperatorCustomer[] = raw.customers.map((customer: any) => {
    const key = text(customer?.key)
    const phone = normalizeRetentionPhone(customer?.phone)
    if (!key || !phone || phone !== customer.phone || keys.has(key) || phones.has(phone)
      || !Array.isArray(customer.orders) || !customer.orders.length)
      return fail()
    keys.add(key)
    phones.add(phone)

    const orders: OperatorOrder[] = customer.orders.map((order: any) => {
      const id = positiveId(order?.id)
      const createdAt = timestamp(order.created_at)
      if (ids.has(id) || !TYPES.includes(order.order_type)
        || Date.parse(createdAt) < from || Date.parse(createdAt) >= to)
        return fail()
      ids.add(id)
      if (ids.size > MAX_ORDERS)
        return fail()
      return {
        id,
        order_number: text(order.order_number, 64),
        created_at: createdAt,
        order_type: order.order_type,
        place_label: text(order.place_label),
        items: parseOperatorItems(order.items),
      }
    })

    return { key, phone, name: text(customer.name), orders }
  })

  return {
    date,
    time_zone: 'Asia/Tashkent',
    from_at: fromAt,
    to_at: toAt,
    snapshot_id: snapshotId,
    total_customers: customers.length,
    customers,
  }
}

function contextStamp(): string {
  const access = readUserAccess()
  if (access.userId == null || !(access.isAdministrator || (access.isOperator && access.has('operator.call_queue.view'))))
    return fail('oc_error_permission')
  return JSON.stringify([access.userId, access.role, access.serverRole, access.email, getCurrentApiHost()])
}

function checkContext(stamp: string, signal?: AbortSignal) {
  if (signal?.aborted)
    return fail('oc_error_canceled')
  if (contextStamp() !== stamp)
    return fail('oc_error_context')
}

function transportError(error: any): never {
  if (error?.code === 'ERR_CANCELED' || error?.name === 'AbortError')
    return fail('oc_error_canceled')
  const status = error?.response?.status
  if (status === 401 || status === 403)
    return fail('oc_error_permission')
  const code = error?.response?.data?.code
  if (['INVALID_DATE', 'OBSERVATION_BEFORE_CUTOFF', 'FUTURE_DATE'].includes(code))
    return fail('oc_error_date')
  if (code === 'OPERATOR_QUEUE_LIMIT_EXCEEDED')
    return fail('oc_error_limit')
  if (code === 'OPERATOR_QUEUE_NOT_READY')
    return fail('oc_error_backend')
  if (status === 404 || status === 405 || status === 501)
    return fail('oc_error_backend')
  return fail('oc_error_network')
}

export async function loadOperatorQueue(date: string, options: {
  signal?: AbortSignal
  onProgress?: (progress: RetentionCollectionProgress) => void
} = {}): Promise<OperatorQueue> {
  const stamp = contextStamp()
  const requestedAt = Date.now()
  const bounds = operatorDayWindow(date, requestedAt)

  checkContext(stamp, options.signal)
  if (readUserAccess().canReadOperatorOrders) {
    // Only an actual backend ADMIN can use Orders, including an email-selected
    // operator workspace. Prefix matching never grants backend permissions.
    const snapshot = await collectRetentionSnapshot({ fromAt: bounds.from_at, toAt: bounds.to_at, ...options })

    checkContext(stamp, options.signal)
    if (snapshot.record_count > MAX_ORDERS)
      return fail('oc_error_limit')

    const customers = analyzeRetentionSnapshot(snapshot).customers.map(customer => ({
      key: customer.key,
      name: customer.name,
      phone: customer.phone,
      orders: customer.orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        created_at: order.created_at,
        order_type: order.order_type as OperatorOrder['order_type'],
        place_label: null,
        items: null,
      })),
    })).sort((a, b) => Date.parse(b.orders[0].created_at) - Date.parse(a.orders[0].created_at)
      || b.orders[0].id - a.orders[0].id || a.key.localeCompare(b.key))

    if (customers.length > MAX_CUSTOMERS)
      return fail('oc_error_limit')
    return {
      date,
      time_zone: 'Asia/Tashkent',
      ...bounds,
      snapshot_id: `admin-preview:${snapshot.collected_at}`,
      total_customers: customers.length,
      customers,
      admin_preview: true,
    }
  }
  let response
  try { response = await axiosIns.get('/operator/call-queue', { params: { date }, signal: options.signal }) }
  catch (error) { return transportError(error) }
  checkContext(stamp, options.signal)
  return parseOperatorQueue(response.data, date, requestedAt)
}

export async function loadAdminOrderItems(order: OperatorOrder, signal?: AbortSignal): Promise<OperatorItem[]> {
  const stamp = contextStamp()

  checkContext(stamp, signal)
  if (!readUserAccess().canReadOperatorOrders)
    return fail('oc_error_permission')
  let response
  try { response = await axiosIns.get(`/orders/${positiveId(order.id)}`, { signal }) }
  catch (error) { return transportError(error) }
  checkContext(stamp, signal)

  const detail = response?.data?.data?.order
  if (response?.data?.success !== true || detail?.id !== order.id || !Array.isArray(detail.items)
    || Date.parse(detail.created_at) !== Date.parse(order.created_at))
    return fail()
  return parseOperatorItems(detail.items.map((item: any) => ({ name: item?.product?.name, quantity: item?.quantity })))
}

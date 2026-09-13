import axiosIns, { getCurrentApiHost } from '@/plugins/axios'
import type { RetentionCollectionProgress, RetentionOrder, RetentionSnapshot } from '@/types/customerRetention'
import { retentionAmountCents } from '@/utils/customerRetention'
import { readUserAccess } from '@/composables/useUserAccess'

export const MAX_RETENTION_IMPORT_BYTES = 32 * 1024 * 1024
export const MAX_RETENTION_ORDERS = 100_000
export const RETENTION_FROM_AT = '2026-08-01T00:00:00+05:00'
const PER_PAGE = 100
const STATUSES = new Set(['OPEN', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED'])
const TYPES = new Set(['HALL', 'DELIVERY', 'PICKUP'])
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

export class RetentionCollectionError extends Error {
  constructor(public readonly code: string, public readonly details?: Record<string, string | number>) {
    super(code)
    this.name = 'RetentionCollectionError'
  }
}

function fail(code: string, details?: Record<string, string | number>): never {
  throw new RetentionCollectionError(code, details)
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !ISO_WITH_ZONE.test(value) || !Number.isFinite(Date.parse(value)))
    return fail('cr_error_invalid_snapshot')

  return value
}

function optionalText(value: unknown, maxLength = 200): string | null {
  if (value == null || value === '')
    return null
  if (typeof value !== 'string' || value.length > maxLength)
    return fail('cr_error_invalid_snapshot')

  return value
}

function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    return fail('cr_error_invalid_snapshot')

  return value
}

function canonicalOrder(raw: any, from: number, to: number, imported = false): RetentionOrder {
  if (!raw || typeof raw !== 'object' || typeof raw.is_paid !== 'boolean' || !STATUSES.has(raw.status) || !TYPES.has(raw.order_type))
    return fail('cr_error_invalid_snapshot')
  const createdAt = timestamp(raw.created_at)
  const createdMs = Date.parse(createdAt)
  if (createdMs < from || createdMs >= to)
    return fail('cr_error_window')

  const customer = imported
    ? {
      id: raw.customer_id,
      name: raw.customer_name,
      phone: raw.customer_phone,
      is_staff: raw.customer_is_staff,
    }
    : raw.customer

  if (customer?.is_staff != null && typeof customer.is_staff !== 'boolean')
    return fail('cr_error_invalid_snapshot')
  const amount = typeof raw.total_amount === 'number' ? String(raw.total_amount) : raw.total_amount
  if (typeof amount !== 'string')
    return fail('cr_error_invalid_snapshot')
  try { retentionAmountCents(amount) }
  catch { return fail('cr_error_invalid_snapshot') }
  const number = raw.order_number ?? (imported ? null : raw.display_id)

  return {
    id: positiveId(raw.id),
    order_number: number == null ? null : optionalText(String(number), 64),
    customer_id: customer?.id == null ? null : positiveId(customer.id),
    customer_name: optionalText(customer?.name),
    customer_phone: optionalText(customer?.phone, 64),
    customer_is_staff: customer?.is_staff === true,
    phone_number: optionalText(raw.phone_number, 64),
    created_at: createdAt,
    updated_at: raw.updated_at == null ? null : timestamp(raw.updated_at),
    order_origin: optionalText(raw.order_origin, 64),
    status: raw.status,
    is_paid: raw.is_paid,
    order_type: raw.order_type,
    total_amount: amount,
  }
}

function windowBounds(fromAt: string, toAt: string): [number, number] {
  const from = Date.parse(timestamp(fromAt))
  const to = Date.parse(timestamp(toAt))
  if (from < Date.parse(RETENTION_FROM_AT) || to <= from)
    return fail('cr_error_window')

  return [from, to]
}

function sourceApi(): string {
  const host = getCurrentApiHost() || window.location.origin

  return `${new URL(host).origin}/api/admins`
}

function isAbort(error: any, signal?: AbortSignal): boolean {
  return !!signal?.aborted || error?.code === 'ERR_CANCELED' || error?.name === 'AbortError'
}

interface PageResult {
  orders: RetentionOrder[]
  total: number
  pages: number
  perPage: number
}

function transportFailure(error: any, signal?: AbortSignal): never {
  if (isAbort(error, signal))
    return fail('cr_error_canceled')
  const status = error?.response?.status

  const codes: Record<number, string> = {
    401: 'cr_error_auth',
    403: 'cr_error_forbidden',
    429: 'cr_error_rate_limit',
    404: 'cr_error_contract',
    405: 'cr_error_contract',
    422: 'cr_error_contract',
  }

  return fail(codes[status] ?? 'cr_error_network')
}

function parsePage(body: any, page: number, from: number, to: number): PageResult {
  const data = body?.data
  const pagination = data?.pagination
  const filters = data?.filters
  if (body?.success !== true || !Array.isArray(data?.orders) || !pagination || !filters)
    return fail('cr_error_contract')
  if (Date.parse(filters.start_at) !== from || Date.parse(filters.end_at) !== to)
    return fail('cr_error_window')
  const { total_orders: total, total_pages: pages, per_page: perPage } = pagination

  const validCounts = [total, pages, perPage, pagination.current_page].every(value => Number.isSafeInteger(value))
    && total >= 0 && pages >= 1 && perPage === PER_PAGE

  const correctPage = pages === Math.max(1, Math.ceil(total / perPage)) && pagination.current_page === page
  const correctFlags = pagination.has_next === (page < pages) && pagination.has_previous === (page > 1)
  const expectedLength = Math.min(perPage, Math.max(0, total - (page - 1) * perPage))
  if (!validCounts || !correctPage || !correctFlags || data.orders.length !== expectedLength)
    return fail('cr_error_pagination', { reason: 'page_metadata', requested_page: page, returned_page: Number(pagination.current_page), total: Number(total), per_page: Number(perPage), received_rows: data.orders.length, expected_rows: expectedLength })
  if (total > MAX_RETENTION_ORDERS)
    return fail('cr_error_limit')

  return { orders: data.orders.map((order: unknown) => canonicalOrder(order, from, to)), total, pages, perPage }
}

async function requestOrderPage(page: number, context: {
  fromAt: string
  toAt: string
  from: number
  to: number
  signal?: AbortSignal
  check: () => void
}): Promise<PageResult> {
  context.check()
  let response
  try {
    response = await axiosIns.get('/orders', {
      params: {
        page,
        per_page: PER_PAGE,
        order_by: 'id',
        include_items: false,
        datetime_from: context.fromAt,
        datetime_to: context.toAt,
      },
      signal: context.signal,
    })
  }
  catch (error: any) {
    return transportFailure(error, context.signal)
  }
  context.check()

  return parsePage(response.data, page, context.from, context.to)
}

function appendPage(result: PageResult, first: PageResult, orders: RetentionOrder[]) {
  if (result.total !== first.total || result.pages !== first.pages || result.perPage !== first.perPage)
    fail('cr_error_pagination', { reason: 'changed_totals', expected_total: first.total, received_total: result.total, loaded: orders.length })
  let previousId = orders.at(-1)?.id ?? 0
  for (const order of result.orders) {
    if (order.id <= previousId)
      fail('cr_error_pagination', { reason: 'not_unique_ascending', loaded: orders.length })
    previousId = order.id
    orders.push(order)
  }
}

function actorStamp(): string {
  const actor = readUserAccess()
  if (!actor.has('customer.retention.view') && !(actor.isOperator && actor.canReadOperatorOrders))
    return fail('cr_error_forbidden')
  if (actor.userId == null)
    return fail('cr_error_auth')

  return JSON.stringify([actor.userId, actor.role, actor.serverRole, actor.email])
}

async function collectWindow(options: {
  fromAt: string
  toAt?: string
  signal?: AbortSignal
  onProgress?: (progress: RetentionCollectionProgress) => void
}): Promise<RetentionSnapshot> {
  const { fromAt, signal, onProgress } = options
  const toAt = options.toAt ?? new Date().toISOString()
  const [from, to] = windowBounds(fromAt, toAt)
  const source = sourceApi()
  const actorKey = actorStamp()

  function checkContext() {
    if (signal?.aborted)
      fail('cr_error_canceled')
    if (sourceApi() !== source)
      fail('cr_error_source_changed')
    if (actorStamp() !== actorKey)
      fail('cr_error_source_changed')
  }

  const getPage = (page: number) => requestOrderPage(page, { fromAt, toAt, from, to, signal, check: checkContext })

  const first = await getPage(1)
  const orders: RetentionOrder[] = []
  let last = first
  const progress = (page: number) => onProgress?.({ phase: 'collecting', loaded: orders.length, total: first.total, page, total_pages: first.pages })

  appendPage(first, first, orders)
  progress(1)
  for (let page = 2; page <= first.pages; page += 1) {
    // Sequential requests keep load bounded and make progress/cancel predictable.
    last = await getPage(page)
    appendPage(last, first, orders)
    progress(page)
  }
  if (orders.length !== first.total)
    fail('cr_error_pagination')
  onProgress?.({ phase: 'verifying', loaded: orders.length, total: first.total, page: first.pages, total_pages: first.pages })

  const firstCheck = await getPage(1)
  const lastCheck = first.pages === 1 ? firstCheck : await getPage(first.pages)
  if (JSON.stringify(firstCheck) !== JSON.stringify(first) || JSON.stringify(lastCheck) !== JSON.stringify(last))
    fail('cr_error_changed')
  checkContext()

  return {
    schema_version: 1,
    from_at: fromAt,
    to_at: toAt,
    collected_at: new Date().toISOString(),
    source_api: source,
    scope: 'authenticated_account',
    record_count: orders.length,
    total_pages: first.pages,
    consistency: 'pagination_verified_not_transactional',
    orders,
  }
}

async function collectStableWindow(options: Parameters<typeof collectWindow>[0]): Promise<RetentionSnapshot> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await collectWindow(options) }
    catch (error) {
      if (attempt === 2 || !(error instanceof RetentionCollectionError)
        || !['cr_error_changed', 'cr_error_pagination'].includes(error.code))
        throw error
    }
  }

  return fail('cr_error_pagination')
}

function mergePartition(part: RetentionSnapshot, orders: RetentionOrder[], ids: Set<number>) {
  for (const order of part.orders) {
    if (ids.has(order.id))
      return fail('cr_error_changed')
    ids.add(order.id)
    orders.push(order)
  }
  if (orders.length > MAX_RETENTION_ORDERS)
    return fail('cr_error_limit')
}

/**
 * Date partitions isolate late POS sync from already verified historical days.
 * Only an inconsistent day is retried, at most twice; no partial result is accepted.
 * This remains a nontransactional read, not a claim of database snapshot isolation.
 */
export async function collectRetentionSnapshot(options: {
  fromAt: string
  toAt?: string
  signal?: AbortSignal
  onProgress?: (progress: RetentionCollectionProgress) => void
}): Promise<RetentionSnapshot> {
  const toAt = options.toAt ?? new Date().toISOString()
  const [from, to] = windowBounds(options.fromAt, toAt)
  const dayMs = 86_400_000
  const windowCount = Math.ceil((to - from) / dayMs)

  // Keep accidental future/oversized ranges bounded before making any request.
  if (windowCount > 366)
    return fail('cr_error_limit')
  const source = sourceApi()
  const actor = actorStamp()
  const orders: RetentionOrder[] = []
  const ids = new Set<number>()
  const windows: NonNullable<RetentionSnapshot['collection_windows']> = []
  for (let start = from; start < to; start += dayMs) {
    if (sourceApi() !== source || actorStamp() !== actor)
      return fail('cr_error_source_changed')
    const end = Math.min(start + dayMs, to)

    const part = await collectStableWindow({
      fromAt: new Date(start).toISOString(),
      toAt: new Date(end).toISOString(),
      signal: options.signal,
      onProgress: progress => options.onProgress?.({
        ...progress,
        completed_windows: windows.length,
        total_windows: windowCount,
        verified_orders: orders.length,
      }),
    })

    mergePartition(part, orders, ids)
    windows.push({ from_at: part.from_at, to_at: part.to_at, record_count: part.record_count, total_pages: part.total_pages })
    options.onProgress?.({
      phase: 'verifying',
      loaded: part.record_count,
      total: part.record_count,
      page: part.total_pages,
      total_pages: part.total_pages,
      completed_windows: windows.length,
      total_windows: windowCount,
      verified_orders: orders.length,
    })
  }
  if (options.signal?.aborted)
    return fail('cr_error_canceled')
  if (sourceApi() !== source || actorStamp() !== actor)
    return fail('cr_error_source_changed')

  return {
    schema_version: 1,
    from_at: options.fromAt,
    to_at: toAt,
    collected_at: new Date().toISOString(),
    source_api: source,
    scope: 'authenticated_account',
    record_count: orders.length,
    total_pages: windows.reduce((sum, item) => sum + item.total_pages, 0),
    collection_windows: windows,
    consistency: 'pagination_verified_not_transactional',
    orders,
  }
}

function parseWindows(raw: any, orders: RetentionOrder[], from: number, to: number) {
  if (raw.collection_windows === undefined)
    return undefined
  if (!Array.isArray(raw.collection_windows) || !raw.collection_windows.length || raw.collection_windows.length > 366)
    return fail('cr_error_invalid_snapshot')
  let boundary = from
  let total = 0
  let pages = 0

  const windows = raw.collection_windows.map((part: any) => {
    const start = Date.parse(timestamp(part?.from_at))
    const end = Date.parse(timestamp(part?.to_at))
    if (start !== boundary || end <= start || end > to
      || !Number.isSafeInteger(part.record_count) || part.record_count < 0
      || part.total_pages !== Math.max(1, Math.ceil(part.record_count / PER_PAGE)))
      return fail('cr_error_invalid_snapshot')
    const count = orders.filter(order => Date.parse(order.created_at) >= start && Date.parse(order.created_at) < end).length
    if (count !== part.record_count)
      return fail('cr_error_invalid_snapshot')
    boundary = end
    total += count
    pages += part.total_pages

    return { from_at: part.from_at, to_at: part.to_at, record_count: count, total_pages: part.total_pages }
  })

  if (boundary !== to || total !== raw.record_count || pages !== raw.total_pages)
    return fail('cr_error_invalid_snapshot')

  return windows
}

/** Imports are untrusted: whitelist fields, validate coverage, IDs and money. */
export function parseRetentionSnapshot(text: string): RetentionSnapshot {
  if (new Blob([text]).size > MAX_RETENTION_IMPORT_BYTES)
    return fail('cr_error_import_size')
  let raw: any
  try { raw = JSON.parse(text) }
  catch { return fail('cr_error_invalid_snapshot') }
  if (!raw || raw.schema_version !== 1 || raw.scope !== 'authenticated_account'
    || raw.consistency !== 'pagination_verified_not_transactional' || !Array.isArray(raw.orders)
    || raw.orders.length !== raw.record_count || !Number.isSafeInteger(raw.record_count)
    || raw.record_count < 0 || raw.record_count > MAX_RETENTION_ORDERS
    || !Number.isSafeInteger(raw.total_pages) || raw.total_pages < 1)
    return fail('cr_error_invalid_snapshot')
  const [from, to] = windowBounds(raw.from_at, raw.to_at)
  let url: URL
  try { url = new URL(raw.source_api) }
  catch { return fail('cr_error_invalid_snapshot') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/api/admins')
    return fail('cr_error_invalid_snapshot')
  const ids = new Set<number>()

  const orders = raw.orders.map((order: unknown) => {
    const canonical = canonicalOrder(order, from, to, true)
    if (ids.has(canonical.id))
      return fail('cr_error_invalid_snapshot')
    ids.add(canonical.id)

    return canonical
  })

  return {
    schema_version: 1,
    from_at: raw.from_at,
    to_at: raw.to_at,
    collected_at: timestamp(raw.collected_at),
    source_api: `${url.origin}/api/admins`,
    scope: 'authenticated_account',
    record_count: orders.length,
    total_pages: raw.total_pages,
    consistency: 'pagination_verified_not_transactional',
    collection_windows: parseWindows(raw, orders, from, to),
    orders,
  }
}

/**
 * Client-side product-sales aggregation for the paginated admin Orders API.
 *
 * `grossItemSales` is historical line-price × quantity. It is deliberately
 * not called net revenue: the order-list payload has no per-line discount or
 * refund allocation.
 */

export const PRODUCT_SALES_DEFAULT_TIME_ZONE = 'Asia/Tashkent'

/** The canonical service day closes at 03:00, so earlier timestamps belong to yesterday. */
export const PRODUCT_SALES_BUSINESS_DAY_CLOSE_HOUR = 3

export interface ProductSalesOrderItem {
  id?: unknown
  product__id?: unknown
  product_id?: unknown
  product__name?: unknown
  product_name?: unknown
  product?: {
    id?: unknown
    name?: unknown
    category?: {
      id?: unknown
      name?: unknown
    } | null
    category_id?: unknown
  } | null
  product__category__id?: unknown
  product__category__name?: unknown
  category_id?: unknown
  category_name?: unknown
  quantity?: unknown
  price?: unknown
}

/** The relevant, deliberately permissive subset of a GET /orders row. */
export interface ProductSalesOrder {
  id?: unknown
  is_paid?: unknown
  status?: unknown
  order_type?: unknown
  created_at?: unknown
  paid_at?: unknown
  items?: unknown
}

export interface ProductSalesAnalyticsOptions {
  productIds?: Iterable<string | number>
  categoryIds?: Iterable<string | number>
  timeZone?: string
}

export interface ProductSalesProductRow {
  id: string | null
  name: string
  categoryId: string | null
  categoryName: string
  units: number
  grossItemSales: number
  orderCount: number
  avgUnitPrice: number
}

export interface ProductSalesCategoryRow {
  id: string | null
  name: string
  units: number
  grossItemSales: number
  orderCount: number
  avgUnitPrice: number
}

export interface ProductSalesDailyRow {

  /** YYYY-MM-DD in the reporting business day; 00:00–02:59 belongs to yesterday. */
  date: string
  units: number
  grossItemSales: number
  orderCount: number
}

export interface ProductSalesHourlyRow {

  /** Actual local hour (0–23), not shifted to the business date. */
  hour: number
  label: string
  units: number
  grossItemSales: number
  orderCount: number
}

export interface ProductSalesOrderTypeRow {
  orderType: string
  units: number
  grossItemSales: number
  orderCount: number
}

export interface ProductSalesTotals {
  sourceOrders: number
  eligibleOrders: number
  cancelledOrders: number
  matchedOrders: number
  matchedLines: number
  units: number
  grossItemSales: number
  avgUnitPrice: number
}

export interface ProductSalesAnalytics {
  timeZone: string
  products: ProductSalesProductRow[]
  categories: ProductSalesCategoryRow[]
  daily: ProductSalesDailyRow[]
  hourly: ProductSalesHourlyRow[]
  orderTypes: ProductSalesOrderTypeRow[]
  totals: ProductSalesTotals
}

interface AggregateBucket {
  units: number
  grossItemSales: number
  orderIds: Set<string>
}

interface ProductBucket extends AggregateBucket {
  id: string | null
  name: string
  categoryId: string | null
  categoryName: string
}

interface CategoryBucket extends AggregateBucket {
  id: string | null
  name: string
}

interface TimeParts {
  date: string
  hour: number
}

interface TimeFormatter {
  formatter: Intl.DateTimeFormat
  resolvedTimeZone: string
}

interface NormalizedItem {
  productId: string | null
  productName: string
  categoryId: string | null
  categoryName: string
  units: number
  grossItemSales: number
}

interface OrderContext {
  id: string
  orderType: string
  timestamp: TimeParts | null
}

interface AggregationState {
  formatter: Intl.DateTimeFormat
  productFilter: Set<string>
  categoryFilter: Set<string>
  products: Map<string, ProductBucket>
  categories: Map<string, CategoryBucket>
  daily: Map<string, AggregateBucket>
  hourly: Map<number, AggregateBucket>
  orderTypes: Map<string, AggregateBucket>
  matchedOrderIds: Set<string>
  totals: ProductSalesTotals
}

const UNKNOWN_PRODUCT_ID = '__unknown_product__'
const UNCATEGORIZED_ID = '__uncategorized__'
const UNKNOWN_PRODUCT_NAME = 'Unknown product'
const UNCATEGORIZED_NAME = 'Uncategorized'
const UNKNOWN_ORDER_TYPE = 'UNKNOWN'

function identifier(value: unknown): string | null {
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : null

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized || null
  }

  return null
}

function text(value: unknown, fallback: string): string {
  if (typeof value !== 'string')
    return fallback

  return value.trim() || fallback
}

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : fallback

  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

function lineQuantity(value: unknown): number {
  if (value === null || value === undefined || value === '')
    return 1

  return Math.max(0, finiteNumber(value))
}

function linePrice(value: unknown): number {
  return Math.max(0, finiteNumber(value))
}

function isPaid(value: unknown): boolean {
  return value === true
    || value === 1
    || (typeof value === 'string' && ['true', '1'].includes(value.trim().toLowerCase()))
}

function isCancelled(value: unknown): boolean {
  const status = text(value, '').toUpperCase()
  return status === 'CANCELED' || status === 'CANCELLED'
}

function itemList(order: ProductSalesOrder): ProductSalesOrderItem[] {
  if (!Array.isArray(order.items))
    return []

  return order.items.filter((item): item is ProductSalesOrderItem => !!item && typeof item === 'object')
}

function normalizeItem(item: ProductSalesOrderItem): NormalizedItem {
  const product = item.product
  const category = product?.category
  const productId = identifier(item.product__id) ?? identifier(item.product_id) ?? identifier(product?.id)

  const categoryId = identifier(item.product__category__id)
    ?? identifier(item.category_id)
    ?? identifier(product?.category_id)
    ?? identifier(category?.id)

  const units = lineQuantity(item.quantity)

  return {
    productId,
    productName: text(item.product__name, text(item.product_name, text(product?.name, UNKNOWN_PRODUCT_NAME))),
    categoryId,
    categoryName: text(item.product__category__name, text(item.category_name, text(category?.name, UNCATEGORIZED_NAME))),
    units,
    grossItemSales: linePrice(item.price) * units,
  }
}

function selectedIds(values: Iterable<string | number> | undefined): Set<string> {
  const ids = new Set<string>()
  if (!values)
    return ids

  for (const value of values) {
    const normalized = identifier(value)
    if (normalized)
      ids.add(normalized)
  }

  return ids
}

function itemMatchesFilters(item: NormalizedItem, state: AggregationState): boolean {
  const productMatches = state.productFilter.size === 0
    || (item.productId !== null && state.productFilter.has(item.productId))

  const categoryMatches = state.categoryFilter.size === 0
    || (item.categoryId !== null && state.categoryFilter.has(item.categoryId))

  return productMatches && categoryMatches
}

function createFormatter(timeZone: string): TimeFormatter {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', options)
    return { formatter, resolvedTimeZone: formatter.resolvedOptions().timeZone }
  }
  catch {
    const formatter = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' })
    return { formatter, resolvedTimeZone: 'UTC' }
  }
}

function timestampParts(value: unknown, formatter: Intl.DateTimeFormat): TimeParts | null {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date))
    return null

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime()))
    return null

  const parts = new Map(formatter.formatToParts(date).map(part => [part.type, part.value]))
  const year = parts.get('year')
  const month = parts.get('month')
  const day = parts.get('day')
  const rawHour = Number(parts.get('hour'))
  const hour = rawHour === 24 ? 0 : rawHour
  if (!year || !month || !day || !Number.isInteger(hour) || hour < 0 || hour > 23)
    return null

  return { date: `${year}-${month}-${day}`, hour }
}

function previousDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime()))
    return date

  parsed.setUTCDate(parsed.getUTCDate() - 1)
  return parsed.toISOString().slice(0, 10)
}

function businessDate(timestamp: TimeParts): string {
  return timestamp.hour < PRODUCT_SALES_BUSINESS_DAY_CLOSE_HOUR
    ? previousDate(timestamp.date)
    : timestamp.date
}

function createBucket(): AggregateBucket {
  return { units: 0, grossItemSales: 0, orderIds: new Set<string>() }
}

function addBucket(bucket: AggregateBucket, orderId: string, units: number, grossItemSales: number) {
  bucket.units += units
  bucket.grossItemSales += grossItemSales
  bucket.orderIds.add(orderId)
}

function productBucket(item: NormalizedItem, state: AggregationState): ProductBucket {
  const key = item.productId ?? UNKNOWN_PRODUCT_ID
  const existing = state.products.get(key)
  if (existing)
    return existing

  const created: ProductBucket = {
    ...createBucket(),
    id: item.productId,
    name: item.productName,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
  }

  state.products.set(key, created)
  return created
}

function categoryBucket(item: NormalizedItem, state: AggregationState): CategoryBucket {
  const key = item.categoryId ?? UNCATEGORIZED_ID
  const existing = state.categories.get(key)
  if (existing)
    return existing

  const created: CategoryBucket = {
    ...createBucket(),
    id: item.categoryId,
    name: item.categoryName,
  }

  state.categories.set(key, created)
  return created
}

function temporalBuckets(context: OrderContext, item: NormalizedItem, state: AggregationState) {
  if (!context.timestamp)
    return

  const date = businessDate(context.timestamp)
  const day = state.daily.get(date) ?? createBucket()

  state.daily.set(date, day)
  addBucket(day, context.id, item.units, item.grossItemSales)

  const hour = state.hourly.get(context.timestamp.hour) ?? createBucket()

  state.hourly.set(context.timestamp.hour, hour)
  addBucket(hour, context.id, item.units, item.grossItemSales)
}

function orderTypeBucket(context: OrderContext, item: NormalizedItem, state: AggregationState) {
  const bucket = state.orderTypes.get(context.orderType) ?? createBucket()

  state.orderTypes.set(context.orderType, bucket)
  addBucket(bucket, context.id, item.units, item.grossItemSales)
}

function recordMatchingItem(item: ProductSalesOrderItem, context: OrderContext, state: AggregationState) {
  const normalized = normalizeItem(item)
  if (!itemMatchesFilters(normalized, state))
    return

  addBucket(productBucket(normalized, state), context.id, normalized.units, normalized.grossItemSales)
  addBucket(categoryBucket(normalized, state), context.id, normalized.units, normalized.grossItemSales)
  temporalBuckets(context, normalized, state)
  orderTypeBucket(context, normalized, state)

  state.matchedOrderIds.add(context.id)
  state.totals.matchedLines++
  state.totals.units += normalized.units
  state.totals.grossItemSales += normalized.grossItemSales
}

function recordOrder(order: ProductSalesOrder, sourceIndex: number, state: AggregationState) {
  if (!isPaid(order.is_paid))
    return

  if (isCancelled(order.status)) {
    state.totals.cancelledOrders++
    return
  }

  state.totals.eligibleOrders++

  const context: OrderContext = {
    id: identifier(order.id) ?? `row:${sourceIndex}`,
    orderType: text(order.order_type, UNKNOWN_ORDER_TYPE).toUpperCase(),
    timestamp: timestampParts(order.created_at ?? order.paid_at, state.formatter),
  }

  for (const item of itemList(order))
    recordMatchingItem(item, context, state)
}

function averageUnitPrice(bucket: Pick<AggregateBucket, 'units' | 'grossItemSales'>): number {
  return bucket.units > 0 ? bucket.grossItemSales / bucket.units : 0
}

function compareMetrics(a: Pick<AggregateBucket, 'units' | 'grossItemSales'>, b: Pick<AggregateBucket, 'units' | 'grossItemSales'>): number {
  if (b.grossItemSales !== a.grossItemSales)
    return b.grossItemSales - a.grossItemSales

  return b.units - a.units
}

function productRows(products: Map<string, ProductBucket>): ProductSalesProductRow[] {
  return [...products.values()]
    .sort((a, b) => compareMetrics(a, b) || a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)))
    .map(product => ({
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      units: product.units,
      grossItemSales: product.grossItemSales,
      orderCount: product.orderIds.size,
      avgUnitPrice: averageUnitPrice(product),
    }))
}

function categoryRows(categories: Map<string, CategoryBucket>): ProductSalesCategoryRow[] {
  return [...categories.values()]
    .sort((a, b) => compareMetrics(a, b) || a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)))
    .map(category => ({
      id: category.id,
      name: category.name,
      units: category.units,
      grossItemSales: category.grossItemSales,
      orderCount: category.orderIds.size,
      avgUnitPrice: averageUnitPrice(category),
    }))
}

function dailyRows(daily: Map<string, AggregateBucket>): ProductSalesDailyRow[] {
  return [...daily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      units: bucket.units,
      grossItemSales: bucket.grossItemSales,
      orderCount: bucket.orderIds.size,
    }))
}

function hourlyRows(hourly: Map<number, AggregateBucket>): ProductSalesHourlyRow[] {
  if (hourly.size === 0)
    return []

  return Array.from({ length: 24 }, (_, hour) => {
    const bucket = hourly.get(hour)
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      units: bucket?.units ?? 0,
      grossItemSales: bucket?.grossItemSales ?? 0,
      orderCount: bucket?.orderIds.size ?? 0,
    }
  })
}

function orderTypeRows(orderTypes: Map<string, AggregateBucket>): ProductSalesOrderTypeRow[] {
  return [...orderTypes.entries()]
    .map(([orderType, bucket]) => ({
      orderType,
      units: bucket.units,
      grossItemSales: bucket.grossItemSales,
      orderCount: bucket.orderIds.size,
    }))
    .sort((a, b) => compareMetrics(a, b) || a.orderType.localeCompare(b.orderType))
}

function createState(
  orders: readonly ProductSalesOrder[] | null | undefined,
  options: ProductSalesAnalyticsOptions,
): { state: AggregationState; timeZone: string } {
  const { formatter, resolvedTimeZone } = createFormatter(options.timeZone || PRODUCT_SALES_DEFAULT_TIME_ZONE)
  return {
    timeZone: resolvedTimeZone,
    state: {
      formatter,
      productFilter: selectedIds(options.productIds),
      categoryFilter: selectedIds(options.categoryIds),
      products: new Map<string, ProductBucket>(),
      categories: new Map<string, CategoryBucket>(),
      daily: new Map<string, AggregateBucket>(),
      hourly: new Map<number, AggregateBucket>(),
      orderTypes: new Map<string, AggregateBucket>(),
      matchedOrderIds: new Set<string>(),
      totals: {
        sourceOrders: orders?.length ?? 0,
        eligibleOrders: 0,
        cancelledOrders: 0,
        matchedOrders: 0,
        matchedLines: 0,
        units: 0,
        grossItemSales: 0,
        avgUnitPrice: 0,
      },
    },
  }
}

/**
 * Aggregate all fetched `/orders` pages. Product and category selections
 * intersect, so a matching line must belong to both selected sets.
 */
export function aggregateProductSales(
  orders: readonly ProductSalesOrder[] | null | undefined,
  options: ProductSalesAnalyticsOptions = {},
): ProductSalesAnalytics {
  const { state, timeZone } = createState(orders, options)
  for (const [index, order] of (orders ?? []).entries())
    recordOrder(order, index, state)

  state.totals.matchedOrders = state.matchedOrderIds.size
  state.totals.avgUnitPrice = averageUnitPrice(state.totals)

  return {
    timeZone,
    products: productRows(state.products),
    categories: categoryRows(state.categories),
    daily: dailyRows(state.daily),
    hourly: hourlyRows(state.hourly),
    orderTypes: orderTypeRows(state.orderTypes),
    totals: state.totals,
  }
}

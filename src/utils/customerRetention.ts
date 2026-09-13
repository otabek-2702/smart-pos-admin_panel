import type { RetentionAnalysis, RetentionCustomer, RetentionOrder, RetentionRules, RetentionSnapshot } from '@/types/customerRetention'

const DAY_MS = 86_400_000
export const DEFAULT_RETENTION_RULES: Readonly<RetentionRules> = Object.freeze({
  one_time_days: 5,
  repeat_min_days: 7,
  repeat_gap_multiplier: 2,
})

/** Local Uzbek numbers and explicit E.164 numbers only; never guess a country. */
export function normalizeRetentionPhone(input: unknown): string | null {
  if (typeof input !== 'string' || !/^[+\d\s().-]+$/.test(input))
    return null
  const compact = input.replace(/[\s().-]/g, '').replace(/^00/, '+')
  if (/^(?:\+?998)?0{9}$/.test(compact))
    return null
  if (/^\d{9}$/.test(compact))
    return `+998${compact}`
  if (/^998\d{9}$/.test(compact))
    return `+${compact}`
  if (/^\+998\d{9}$/.test(compact))
    return compact
  if (/^\+(?!998)[1-9]\d{7,14}$/.test(compact))
    return compact

  return null
}

export function validRetentionRules(rules: RetentionRules): boolean {
  return [rules.one_time_days, rules.repeat_min_days].every(value => Number.isInteger(value) && value >= 1 && value <= 365)
    && Number.isFinite(rules.repeat_gap_multiplier)
    && rules.repeat_gap_multiplier >= 1
    && rules.repeat_gap_multiplier <= 10
}

/** Preserve cents while collecting; use the project's shared formatter in UI. */
export function retentionAmountCents(amount: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount))
    throw new Error('cr_error_invalid_snapshot')
  const [whole, fraction = ''] = amount.split('.')
  const cents = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')))
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new Error('cr_error_invalid_snapshot')

  return cents
}

function median(values: number[]): number | null {
  if (!values.length)
    return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Asia/Tashkent +05:00, visit date changes at 03:00. Does not exclude quiet hours. */
function visitDateNumber(iso: string): number {
  return Math.floor((Date.parse(iso) + 2 * 3_600_000) / DAY_MS)
}

function hasPhone(value: string | null): boolean {
  return !!value?.trim() && value.trim() !== '+998'
}

function orderPhoneForAnalysis(order: RetentionOrder, metrics: RetentionAnalysis['metrics']): string | null {
  const orderPhone = normalizeRetentionPhone(order.phone_number)
  const customerPhone = normalizeRetentionPhone(order.customer_phone)
  if (orderPhone && customerPhone && orderPhone !== customerPhone)
    metrics.phone_conflict_orders += 1

  // Preserve the historical phone. Invalid populated numbers never redirect calls.
  const phone = hasPhone(order.phone_number) ? orderPhone : customerPhone
  if (!phone) {
    if (hasPhone(order.phone_number) || hasPhone(order.customer_phone))
      metrics.invalid_phone_orders += 1
    else
      metrics.anonymous_orders += 1
  }

  return phone
}

function groupOrders(orders: RetentionOrder[], metrics: RetentionAnalysis['metrics']): Map<string, RetentionOrder[]> {
  const buckets = new Map<string, RetentionOrder[]>()
  for (const order of orders) {
    if (!order.is_paid || order.status === 'CANCELED')
      continue
    if (order.customer_is_staff) {
      metrics.staff_orders += 1
      continue
    }
    metrics.eligible_orders += 1

    const phone = orderPhoneForAnalysis(order, metrics)
    if (!phone)
      continue
    metrics.identified_orders += 1

    const bucket = buckets.get(phone) ?? []

    bucket.push(order)
    buckets.set(phone, bucket)
  }

  return buckets
}

function customerFromOrders(phone: string, unsorted: RetentionOrder[], rules: RetentionRules, asOf: number): RetentionCustomer {
  const orders = [...unsorted].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id)
  const first = orders[0]
  const last = orders[orders.length - 1]
  const visitDates = [...new Set(orders.map(order => visitDateNumber(order.created_at)))].sort((a, b) => a - b).slice(-10)
  const gaps = visitDates.slice(1).map((day, index) => day - visitDates[index])
  const gap = median(gaps)
  const repeatThreshold = Math.max(rules.repeat_min_days, gap === null ? rules.repeat_min_days : Math.ceil(rules.repeat_gap_multiplier * gap))
  const threshold = orders.length === 1 ? rules.one_time_days : repeatThreshold
  const inactiveDays = Math.max(0, Math.floor((asOf - Date.parse(last.created_at)) / DAY_MS))
  let cents = 0
  for (const order of orders) {
    cents += retentionAmountCents(order.total_amount)
    if (!Number.isSafeInteger(cents))
      throw new Error('cr_error_invalid_snapshot')
  }
  const inactiveSegment = orders.length === 1 ? 'ONE_TIME_INACTIVE' : 'REPEAT_INACTIVE'

  return {
    key: phone,
    phone,
    name: [...orders].reverse().find(order => order.customer_name)?.customer_name ?? null,
    order_count: orders.length,
    first_order_at: first.created_at,
    last_order_at: last.created_at,
    inactive_days: inactiveDays,
    median_gap_days: gap,
    inactive_after_days: threshold,
    overdue_days: Math.max(0, inactiveDays - threshold),
    segment: inactiveDays < threshold ? 'ACTIVE' : inactiveSegment,
    cadence_confidence: visitDates.length >= 3 ? 'OBSERVED' : 'LIMITED',
    total_spent: cents / 100,
    order_types: [...new Set(orders.map(order => order.order_type))].sort(),
    orders: orders.reverse(),
  }
}

export function analyzeRetentionSnapshot(snapshot: RetentionSnapshot, rules: RetentionRules = DEFAULT_RETENTION_RULES): RetentionAnalysis {
  if (!validRetentionRules(rules))
    throw new Error('cr_error_invalid_rules')
  const asOf = Date.parse(snapshot.to_at)
  if (!Number.isFinite(asOf))
    throw new Error('cr_error_invalid_snapshot')

  const metrics: RetentionAnalysis['metrics'] = {
    collected_orders: snapshot.orders.length,
    eligible_orders: 0,
    identified_orders: 0,
    anonymous_orders: 0,
    invalid_phone_orders: 0,
    staff_orders: 0,
    phone_conflict_orders: 0,
    customers: 0,
    one_time_inactive: 0,
    repeat_inactive: 0,
    active: 0,
  }

  const buckets = groupOrders(snapshot.orders, metrics)

  const customers: RetentionCustomer[] = []
  for (const [phone, unsorted] of buckets) {
    const customer = customerFromOrders(phone, unsorted, rules, asOf)

    customers.push(customer)
    if (customer.segment === 'ONE_TIME_INACTIVE')
      metrics.one_time_inactive += 1
    else if (customer.segment === 'REPEAT_INACTIVE')
      metrics.repeat_inactive += 1
    else
      metrics.active += 1
  }
  metrics.customers = customers.length

  // Inactive customers first, then most overdue, then previously most frequent.
  customers.sort((a, b) => Number(a.segment === 'ACTIVE') - Number(b.segment === 'ACTIVE')
    || b.overdue_days - a.overdue_days || b.order_count - a.order_count || a.phone.localeCompare(b.phone))

  return { customers, metrics }
}

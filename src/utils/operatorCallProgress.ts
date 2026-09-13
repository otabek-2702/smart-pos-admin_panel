export interface OperatorCallProgressScope {
  userId: string | number | null
  apiHost: string
}

export interface OperatorCallProgress {
  date: string
  orderId: number
  finished: boolean
  totalCustomers: number
}

const KEY_PREFIX = 'operator-call-progress:v1:'
const FIRST_DATE = '2026-08-01'

function userScope(value: unknown): string | null {
  if (typeof value === 'number')
    return (Number.isSafeInteger(value) && value > 0) ? String(value) : null
  if (typeof value !== 'string')
    return null
  const id = value.trim()
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
    return null
  if (/^\d+$/.test(id))
    return userScope(Number(id))
  return id
}

function hostScope(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048)
    return null
  const origin = value.trim() || (typeof window !== 'undefined' ? window.location.origin : '')
  const url = new URL(origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.search || url.hash || url.pathname !== '/')
    return null
  return url.origin
}

function storageKey(scope: OperatorCallProgressScope): string | null {
  const user = userScope(scope?.userId)
  const host = hostScope(scope?.apiHost)
  if (!user || !host)
    return null
  return `${KEY_PREFIX}${encodeURIComponent(host)}:${encodeURIComponent(user)}`
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}

function validateProgress(raw: any, today: string): OperatorCallProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
    || !calendarDate(today) || !calendarDate(raw.date) || raw.date < FIRST_DATE || raw.date > today
    || !Number.isSafeInteger(raw.orderId) || raw.orderId <= 0
    || typeof raw.finished !== 'boolean'
    || !Number.isSafeInteger(raw.totalCustomers) || raw.totalCustomers < 1 || raw.totalCustomers > 2000)
    return null
  return { date: raw.date, orderId: raw.orderId, finished: raw.finished, totalCustomers: raw.totalCustomers }
}

/** A navigation bookmark only: never stores phones, customer keys or call outcomes. */
export function readOperatorCallProgress(scope: OperatorCallProgressScope, today: string): OperatorCallProgress | null {
  try {
    const key = storageKey(scope)
    if (!key)
      return null
    const stored = localStorage.getItem(key)
    if (!stored || stored.length > 512)
      return null
    const raw = JSON.parse(stored)
    if (raw?.version !== 1)
      return null
    return validateProgress(raw, today)
  }
  catch {
    // Private browsing, unavailable storage and corrupt old bookmarks are safe to ignore.
    return null
  }
}

/** Call only after loading a matching authorized queue; it is not authorization evidence. */
export function saveOperatorCallProgress(scope: OperatorCallProgressScope, progress: OperatorCallProgress): boolean {
  try {
    const key = storageKey(scope)
    const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)
    const valid = validateProgress(progress, today)
    if (!key || !valid)
      return false
    localStorage.setItem(key, JSON.stringify({ version: 1, ...valid }))
    return true
  }
  catch {
    return false
  }
}

/**
 * Business-day + operating-hours settings — single source of truth.
 *
 * Restaurants run overnight shifts past midnight. Each "business day" starts at
 * `business_day_start` (default 03:00 local): sales after midnight count toward
 * the previous day until this time. "Working hours" is the operating window
 * (`business_open`..`business_close`, default 09:00..23:00) used by the date
 * picker's time-of-day filter.
 *
 * All three values are owned by the backend (`AppSettings`, exposed at
 * GET/PUT /api/admins/app-settings). We hydrate on login and persist on change,
 * with a localStorage mirror so presets work offline / before the first fetch.
 *
 * NOTE: this replaces the old two-key split (`businessDayStart` here vs
 * `alphapos-daystart` in SettingsMenu) — everything now reads these refs.
 */
import { computed, ref } from 'vue'
import axiosIns from '@/plugins/axios'

const HHMM = /^\d{1,2}:\d{2}$/
const DEFAULT_START = '03:00'
const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '23:00'

function readLs(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key)
    if (v && HHMM.test(v)) return v
  }
  catch { /* noop */ }
  return fallback
}
function writeLs(key: string, val: string) {
  try { localStorage.setItem(key, val) }
  catch { /* noop */ }
}

const _start = ref<string>(readLs('businessDayStart', DEFAULT_START))
const _open = ref<string>(readLs('businessOpen', DEFAULT_OPEN))
const _close = ref<string>(readLs('businessClose', DEFAULT_CLOSE))

export function setBusinessDayStart(hhmm: string) {
  if (!HHMM.test(hhmm)) return
  _start.value = hhmm
  writeLs('businessDayStart', hhmm)
}
export function setBusinessOpen(hhmm: string) {
  if (!HHMM.test(hhmm)) return
  _open.value = hhmm
  writeLs('businessOpen', hhmm)
}
export function setBusinessClose(hhmm: string) {
  if (!HHMM.test(hhmm)) return
  _close.value = hhmm
  writeLs('businessClose', hhmm)
}

/** Pull the operating-day settings from the backend (call after login). */
export async function hydrateBusinessSettings() {
  try {
    const res = await axiosIns.get('/app-settings')
    const s = res.data?.settings ?? res.data?.data?.settings ?? {}
    if (s.business_day_start) setBusinessDayStart(String(s.business_day_start).slice(0, 5))
    // business_open/business_close land once BE ships them; tolerate absence.
    if (s.business_open) setBusinessOpen(String(s.business_open).slice(0, 5))
    if (s.business_close) setBusinessClose(String(s.business_close).slice(0, 5))
  }
  catch { /* keep localStorage/defaults */ }
}

/** Persist the operating-day settings to the backend (PUT ignores unknown keys). */
export async function saveBusinessSettings(patch: {
  business_day_start?: string
  business_open?: string
  business_close?: string
}) {
  // Persist first. The visible/global values must never claim a setting was
  // saved when the server rejected or could not receive the update.
  await axiosIns.put('/app-settings', patch)
  if (patch.business_day_start) setBusinessDayStart(patch.business_day_start)
  if (patch.business_open) setBusinessOpen(patch.business_open)
  if (patch.business_close) setBusinessClose(patch.business_close)
}

function startHourMin(): [number, number] {
  const [h, m] = _start.value.split(':').map(Number)
  return [Number.isFinite(h) ? h : 3, Number.isFinite(m) ? m : 0]
}

/**
 * Today as a BUSINESS calendar date (YYYY-MM-DD).
 * If wall-clock < day-start, returns yesterday.
 * Example: at 02:30 w/ start=03:00 → returns yesterday's date.
 */
export function businessToday(now: Date = new Date()): Date {
  const [h, m] = startHourMin()
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m))
    d.setDate(d.getDate() - 1)
  return d
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Resolve a preset key → { from, to } in YYYY-MM-DD using business days.
 * BE expands each calendar date to its [date @ start, date+1 @ start) window.
 */
export function businessPreset(key: string): { from: string, to: string } {
  const today = businessToday()
  if (key === 'today') return { from: ymd(today), to: ymd(today) }
  if (key === 'yesterday') {
    const y = new Date(today); y.setDate(today.getDate() - 1)
    return { from: ymd(y), to: ymd(y) }
  }
  if (key === '7d') {
    const s = new Date(today); s.setDate(today.getDate() - 6)
    return { from: ymd(s), to: ymd(today) }
  }
  if (key === '30d') {
    const s = new Date(today); s.setDate(today.getDate() - 29)
    return { from: ymd(s), to: ymd(today) }
  }
  if (key === 'month')
    return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) }
  if (key === 'prevmonth') {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const e = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: ymd(s), to: ymd(e) }
  }
  if (key === 'year')
    return { from: ymd(new Date(today.getFullYear(), 0, 1)), to: ymd(today) }
  return { from: '', to: '' }
}

/**
 * Build request params from a picker value. The backend already offsets each
 * bare date to its business-day window (business_day_start), so we send bare
 * dates PLUS an optional time-of-day filter and a granularity hint:
 *   - tod_from/tod_to (HH:MM): only include this slice of EACH day. Omitted =
 *     whole day. ("Working hours" sends business_open..business_close.)
 *   - granularity: 'hour' for a single business-day (→ hourly chart), else 'day'.
 * `orders:true` swaps the date param names to date_from/date_to.
 */
export interface DateParamInput {
  from?: string
  to?: string
  fromTime?: string
  toTime?: string
}
export function buildDateParams(
  range: DateParamInput | null | undefined,
  opts: { orders?: boolean } = {},
): Record<string, string> {
  const p: Record<string, string> = {}
  if (!range) return p
  const fromKey = opts.orders ? 'date_from' : 'from'
  const toKey = opts.orders ? 'date_to' : 'to'
  if (range.from) p[fromKey] = range.from
  if (range.to) p[toKey] = range.to
  if (range.fromTime && range.toTime) {
    p.tod_from = range.fromTime
    p.tod_to = range.toTime
  }
  if (range.from && range.to)
    p.granularity = range.from === range.to ? 'hour' : 'day'
  return p
}

export function useBusinessDay() {
  return {
    start: computed(() => _start.value),
    open: computed(() => _open.value),
    close: computed(() => _close.value),
    setStart: setBusinessDayStart,
    setOpen: setBusinessOpen,
    setClose: setBusinessClose,
    save: saveBusinessSettings,
    hydrate: hydrateBusinessSettings,
    today: businessToday,
    preset: businessPreset,
    buildParams: buildDateParams,
  }
}

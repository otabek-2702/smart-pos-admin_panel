/**
 * Business-day boundary helper.
 *
 * Restaurants run overnight shifts past midnight. We treat each "business day"
 * as starting at `business_day_start` (default 03:00 local). BE owns the
 * window expansion when querying — this helper exposes JUST the calendar-date
 * computation used by FE date presets.
 *
 * Until BE exposes the value, default = 03:00. Override via:
 *   localStorage.setItem('businessDayStart', '04:30')
 *   OR
 *   setBusinessDayStart('04:30') after fetching /auth/me.
 */
import { computed, ref } from 'vue'

const DEFAULT_START = '03:00'

function readStart(): string {
  try {
    const v = localStorage.getItem('businessDayStart')
    if (v && /^\d{1,2}:\d{2}$/.test(v)) return v
  }
  catch { /* noop */ }
  return DEFAULT_START
}

const _start = ref<string>(readStart())

export function setBusinessDayStart(hhmm: string) {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return
  _start.value = hhmm
  try { localStorage.setItem('businessDayStart', hhmm) }
  catch { /* noop */ }
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

export function useBusinessDay() {
  return {
    start: computed(() => _start.value),
    setStart: setBusinessDayStart,
    today: businessToday,
    preset: businessPreset,
  }
}

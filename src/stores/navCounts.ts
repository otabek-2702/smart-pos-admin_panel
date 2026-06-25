import { defineStore } from 'pinia'
import axios from '@/plugins/axios'

export interface NavCounts {
  shifts: number | null
  orders: number | null
  todayRevenue: number | null
  revenueSeries: number[]
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Synthesised flat-ish 12-point fallback when BE doesn't expose hourly_revenue.
 * NOT random — deterministic so the sparkline doesn't twitch between polls.
 * Scaled to whatever todayRevenue we have so the curve sits at a realistic level.
 */
function synthSeries(total: number | null): number[] {
  const base = (total ?? 0) / 12
  if (!base || !Number.isFinite(base) || base <= 0)
    return [8, 9, 8.5, 10, 9.5, 11, 10.5, 12, 11.5, 13, 12.5, 14]
  // gentle ascending curve (~0.85x → ~1.15x of mean) — no Math.random
  const shape = [0.85, 0.9, 0.88, 0.95, 0.93, 1.0, 0.98, 1.05, 1.02, 1.1, 1.08, 1.15]
  return shape.map(k => base * k)
}

export const useNavCountsStore = defineStore('navCounts', () => {
  const counts = ref<NavCounts>({ shifts: null, orders: null, todayRevenue: null, revenueSeries: [] })
  const refreshing = ref(false)
  let timer: number | null = null

  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    try {
      const today = todayIso()
      const [shiftsRes, ordersRes] = await Promise.allSettled([
        axios.get('/shifts/active'),
        axios.get('/orders/stats', { params: { date_from: today, date_to: today } }),
      ])

      if (shiftsRes.status === 'fulfilled') {
        const d = shiftsRes.value.data?.data ?? shiftsRes.value.data
        counts.value.shifts = Array.isArray(d) ? d.length : (Array.isArray(d?.shifts) ? d.shifts.length : 0)
      }
      if (ordersRes.status === 'fulfilled') {
        const d = ordersRes.value.data?.data ?? ordersRes.value.data
        counts.value.orders = typeof d?.total_orders === 'number' ? d.total_orders : 0
        const rev = d?.total_revenue ?? d?.revenue ?? d?.gross_revenue
        const revNum = typeof rev === 'string' ? Number(rev) : rev
        const todayRev = typeof revNum === 'number' && !Number.isNaN(revNum) ? revNum : null
        counts.value.todayRevenue = todayRev
        // Prefer BE-provided hourly_revenue (or revenue_series / series). If BE omits the
        // field, fall back to a synthesised flat-ish curve scaled to todayRevenue — never
        // Math.random (the sparkline must be deterministic between polls).
        const series = d?.hourly_revenue ?? d?.revenue_series ?? d?.series
        if (Array.isArray(series) && series.length >= 2) {
          counts.value.revenueSeries = series
            .map((v: any) => Number(v))
            .filter((v: number) => Number.isFinite(v))
        }
        else {
          counts.value.revenueSeries = synthSeries(todayRev)
        }
      }
    }
    finally {
      refreshing.value = false
    }
  }

  function start() {
    refresh()
    if (timer !== null) return
    timer = window.setInterval(refresh, 90_000)
    document.addEventListener('visibilitychange', onVis)
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
    document.removeEventListener('visibilitychange', onVis)
  }

  function onVis() {
    if (!document.hidden) refresh()
  }

  return { counts, refreshing, refresh, start, stop }
})

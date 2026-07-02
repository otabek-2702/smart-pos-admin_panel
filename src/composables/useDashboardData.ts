/* ============================================================
   ALPHA POS — shared dashboard data composable
   ------------------------------------------------------------
   Hub (src/pages/index.vue) hydrates a single source-of-truth for
   range-aware headline metrics and exposes them to sub-dashboards
   via this composable. Endpoints (confirmed against
   alpha_pos_server/admins/urls.py + dashboard_views.py):

     GET /dashboard/today                           → today snapshot
     GET /dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD   → range snapshot

   Both return `{ success, data: {...} }`. We unwrap to the inner `data`.

   Sub-dashboards can call `useDashboardData()` and read `.shared`
   reactively. The hub also exposes a `refresh()` to re-fetch with the
   current range.
   ============================================================ */
import { computed, ref } from 'vue'
import axiosIns from '@/plugins/axios'

export interface DashRange {
  from: string
  to: string
  preset?: string
}

// Today payload shape (subset — only the fields FE consumes today).
export interface DashTodayPayload {
  today?: {
    revenue?: string | number
    paid_orders?: number
    orders?: number
    cancelled?: number
    open?: number
    units_sold?: number
    peak_hour?: number | null
    avg_prep_seconds?: number | null
    money_entered?: string | number
  }
  payment_breakdown_today?: Record<string, string | number>
  category_stats_today?: Array<{
    category_id?: number
    category?: string
    quantity?: number
    revenue?: string | number
  }>
  top_products_today?: Array<{
    product_id?: number
    product_name?: string
    quantity?: number
    revenue?: string | number
  }>
  low_stock_count?: number | null
  clocked_in?: Array<{
    shift_id?: number
    user_id?: number
    name?: string | null
    start_time?: string | null
  }> | null
}

// Range payload shape (subset — only the fields FE consumes today).
export interface DashRangePayload {
  range?: { from: string; to: string }
  revenue?: string | number
  paid_orders?: number
  orders?: number
  cancelled?: number
  units_sold?: number
  payment_breakdown?: Record<string, string | number>
  top_products?: Array<{
    product_id?: number
    product_name?: string
    quantity?: number
    revenue?: string | number
  }>
}

// Union type — sub-dashboards inspect what they need defensively.
export type DashSharedPayload = DashTodayPayload & DashRangePayload & {
  __source?: 'today' | 'range'
}

// Module-level singletons so every consumer reads the SAME refs.
const shared = ref<DashSharedPayload | null>(null)
const loading = ref(false)
const error = ref<unknown>(null)
const lastFetchedAt = ref<number | null>(null)
// Latest range the hub picked. Sub-dashboards watch this and re-fetch their
// own dedicated endpoints (/dashboard/sales, /analytics/products/*, …) when it
// changes. Kept as a plain object so consumers can watch (r.from, r.to).
const currentRange = ref<DashRange | null>(null)

function hasRange(range: DashRange | null | undefined): boolean {
  return !!(range && (range.from || range.to))
}

async function fetchShared(range: DashRange | null | undefined): Promise<void> {
  loading.value = true
  error.value = null
  currentRange.value = range ?? null
  try {
    if (hasRange(range)) {
      // /dashboard?from=&to=
      const params: Record<string, string> = {}
      if (range?.from) params.from = range.from
      if (range?.to) params.to = range.to
      const res = await axiosIns.get('/dashboard', { params })
      const data = res.data?.data ?? res.data ?? {}
      shared.value = { ...data, __source: 'range' }
    }
    else {
      const res = await axiosIns.get('/dashboard/today')
      const data = res.data?.data ?? res.data ?? {}
      shared.value = { ...data, __source: 'today' }
    }
    lastFetchedAt.value = Date.now()
  }
  catch (err) {
    error.value = err
    // Soft-degrade: keep the previous payload so the UI doesn't flash empty.
    if (!shared.value) shared.value = { __source: hasRange(range) ? 'range' : 'today' }
  }
  finally {
    loading.value = false
  }
}

export function useDashboardData() {
  return {
    shared: computed(() => shared.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    lastFetchedAt: computed(() => lastFetchedAt.value),
    range: computed(() => currentRange.value),
    fetchShared,
    hasRange,
  }
}

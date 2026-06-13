<script setup lang="ts">
import axios from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

// ============================================================
// Inline formatters (UZS, narrow no-break space grouping, K/M abbr)
// ============================================================
const NB = ' '
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const neg = n < 0
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB)
  return (neg ? '-' : '') + s
}
function fmtAbbr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const a = Math.abs(n)
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, '')
  const trim1 = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  let out: string
  if (a >= 1e9) out = `${trim(a / 1e9)}B`
  else if (a >= 1e6) out = `${trim(a / 1e6)}M`
  else if (a >= 1e3) out = `${trim1(a / 1e3)}K`
  else out = String(Math.round(a))
  return (n < 0 ? '-' : '') + out
}
function fmtDelta(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const s = Math.abs(n).toFixed(1).replace(/\.0$/, '') + '%'
  return (n > 0 ? '+' : n < 0 ? '−' : '') + s
}
function fmtTime(d: string | null | undefined): string {
  if (!d) return '—'
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  const p = (v: number) => v < 10 ? `0${v}` : `${v}`
  return `${p(x.getHours())}:${p(x.getMinutes())}`
}
function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  const p = (v: number) => v < 10 ? `0${v}` : `${v}`
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}, ${p(x.getHours())}:${p(x.getMinutes())}`
}

// ============================================================
// Data wiring
// ============================================================
const loading = ref(true)
const data = ref<any>(null)
const recentOrders = ref<any[]>([])
const recentOrdersLoading = ref(true)

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/dashboard/today')
    data.value = res.data?.data ?? res.data
  }
  catch { data.value = null }
  finally { loading.value = false }
}
async function loadRecentOrders() {
  recentOrdersLoading.value = true
  try {
    const res = await axios.get('/orders', { params: { per_page: 5, page: 1 } })
    const d = res.data?.data ?? res.data
    recentOrders.value = d?.orders ?? d?.items ?? (Array.isArray(d) ? d : [])
  }
  catch { recentOrders.value = [] }
  finally { recentOrdersLoading.value = false }
}

onMounted(() => { load(); loadRecentOrders() })
function refresh() { load(); loadRecentOrders() }

const today = computed(() => data.value?.today ?? null)
const paymentBreakdown = computed(() => data.value?.payment_breakdown_today ?? {})
const topProducts = computed<any[]>(() => data.value?.top_products_today ?? [])
const lowStockCount = computed(() => data.value?.low_stock_count ?? null)
const lowStockItems = computed<any[]>(() => data.value?.low_stock_items ?? [])
const clockedIn = computed<any[]>(() => data.value?.clocked_in ?? [])
const ordersByHour = computed<any[]>(() => data.value?.orders_by_hour ?? [])
const revenueTrend = computed<any[]>(() => data.value?.revenue_trend ?? [])
const revenueTarget = computed<number>(() => Number(data.value?.revenue_target ?? 0))
const deltas = computed(() => data.value?.deltas ?? null)

const aov = computed(() => {
  if (!today.value) return null
  const paid = Number(today.value.paid_orders) || 0
  const rev = Number(today.value.revenue) || 0
  return paid ? Math.round(rev / paid) : 0
})
const paidPct = computed(() => {
  if (!today.value) return null
  const total = Number(today.value.orders) || 0
  return total ? Math.round(((Number(today.value.paid_orders) || 0) / total) * 100) : 0
})

const PAYMENT_PALETTE = ['#15935A', '#3A5BDB', '#6E8BFF', '#E0823C', '#9AA3B2', '#8A929E']
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', UZCARD: 'UzCard', HUMO: 'Humo',
  PAYME: 'Payme', CLICK: 'Click', MIXED: 'Mixed',
}
const paymentMix = computed(() => {
  return Object.entries(paymentBreakdown.value)
    .map(([k, v], i) => ({
      label: PAYMENT_LABELS[k] ?? k,
      value: Number(v) || 0,
      color: PAYMENT_PALETTE[i % PAYMENT_PALETTE.length],
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)
})
const paymentTotal = computed(() => paymentMix.value.reduce((a, b) => a + b.value, 0))
const paymentInsight = computed(() => {
  if (!paymentMix.value.length) return 'No paid orders yet'
  const t = paymentTotal.value || 1
  const top = paymentMix.value[0]
  return `${top.label} leads at ${Math.round(top.value / t * 100)}%`
})

const topProductsForChart = computed(() =>
  topProducts.value.slice(0, 5).map((p: any) => ({
    name: p.product_name,
    value: Number(p.revenue) || 0,
    units: Number(p.quantity) || 0,
  })),
)
const topProductInsight = computed(() =>
  topProductsForChart.value.length
    ? `${topProductsForChart.value[0].name} leads revenue`
    : 'No sales yet today',
)
const topProductMax = computed(() => Math.max(1, ...topProductsForChart.value.map(p => p.value)))

const peakHourLabel = computed(() => {
  // Prefer the full orders_by_hour list (one of the bars marked peak); fall
  // back to the legacy bare-int peak_hour field if BE didn't ship the series.
  const series = ordersByHour.value
  if (series.length) {
    const p = series.find((b: any) => b.peak)
    if (p) return p.label
  }
  const h = today.value?.peak_hour
  if (h === null || h === undefined) return null
  return `${String(h).padStart(2, '0')}:00`
})
const ordersByHourInsight = computed(() =>
  peakHourLabel.value ? `Peak trade at ${peakHourLabel.value}` : 'No orders today yet',
)
const ordersByHourTotal = computed(() => ordersByHour.value.reduce((a, b: any) => a + (b.orders || 0), 0))

const revenueTrendTotal = computed(() => revenueTrend.value.reduce((a, b: any) => a + (b.revenue || 0), 0))
const lastWeekRevenueTotal = computed(() => {
  const t = revenueTrend.value
  if (t.length < 14) return 0
  return t.slice(0, 7).reduce((a, b: any) => a + (b.revenue || 0), 0)
})
const revenueInsight = computed(() => {
  if (!revenueTrend.value.length) return 'Trend data not yet available'
  const lastWeek = lastWeekRevenueTotal.value
  const thisWeek = revenueTrend.value.slice(-7).reduce((a, b: any) => a + (b.revenue || 0), 0)
  if (!lastWeek) return 'Revenue trend'
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  if (pct === 0) return 'Revenue flat vs last week'
  const sign = pct > 0 ? 'up' : 'down'
  return `Revenue is ${sign} ${Math.abs(pct)}% vs last week`
})
const revenueLatest = computed(() => {
  const t = revenueTrend.value
  return t.length ? Number(t[t.length - 1].revenue) || 0 : 0
})
const expenseLatest = computed(() => {
  const t = revenueTrend.value
  return t.length ? Number(t[t.length - 1].expense) || 0 : 0
})

const todayDateLine = computed(() => `Today's snapshot · ${fmtDateTime(new Date())}`)

// ============================================================
// Donut arcs
// ============================================================
const DONUT_SIZE = 188
const donutHover = ref<number | null>(null)
const donutArcs = computed(() => {
  const R = DONUT_SIZE / 2, r = R * 0.62, cx = R, cy = R, gap = 0.018
  let acc = -0.25
  const total = paymentTotal.value || 1
  return paymentMix.value.map(d => {
    const frac = d.value / total
    const a0 = acc * 2 * Math.PI + gap * Math.PI
    const a1 = (acc + frac) * 2 * Math.PI - gap * Math.PI
    acc += frac
    const big = (a1 - a0) > Math.PI ? 1 : 0
    const p = (ang: number, rad: number) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]
    const o0 = p(a0, R), o1 = p(a1, R), i1 = p(a1, r), i0 = p(a0, r)
    return {
      path: `M${o0[0]} ${o0[1]} A${R} ${R} 0 ${big} 1 ${o1[0]} ${o1[1]} L${i1[0]} ${i1[1]} A${r} ${r} 0 ${big} 0 ${i0[0]} ${i0[1]} Z`,
      pct: Math.round(frac * 100),
      d,
    }
  })
})

// ============================================================
// Status pill tone
// ============================================================
function statusTone(v: string): string {
  const u = (v || '').toUpperCase()
  if (['ACTIVE', 'COMPLETED', 'READY', 'PAID'].includes(u)) return 'success'
  if (['PREPARING', 'PENDING'].includes(u)) return 'warning'
  if (['CANCELLED', 'CANCELED', 'UNPAID', 'FAILED'].includes(u)) return 'error'
  if (['CASHIER', 'DELIVERY'].includes(u)) return 'info'
  if (['MANAGER', 'ADMIN', 'PICKUP'].includes(u)) return 'primary'
  return 'neutral'
}
function titleCase(v: any): string {
  if (!v) return '—'
  const s = String(v)
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// ============================================================
// nice tick algo (line + bar Y axis)
// ============================================================
function niceTicks(max: number, count: number) {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const norm = (raw || 1) / mag
  let step: number
  if (norm <= 1) step = 1
  else if (norm <= 2) step = 2
  else if (norm <= 2.5) step = 2.5
  else if (norm <= 5) step = 5
  else step = 10
  step *= mag
  const top = Math.ceil((max || 1) / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v)
  return { ticks, top }
}

// ============================================================
// LineArea chart math (revenue + expense)
// ============================================================
const LINE_W = ref(800)
const LINE_H = 260
const linePadL = 56, linePadR = 20, linePadT = 16, linePadB = 30
const lineHover = ref<number | null>(null)
const lineRef = ref<HTMLElement | null>(null)

watch(lineRef, (el, _, onCleanup) => {
  if (!el) return
  const ro = new ResizeObserver(es => {
    const e = es[0]
    if (e) LINE_W.value = e.contentRect.width
  })
  ro.observe(el)
  LINE_W.value = el.clientWidth
  onCleanup(() => ro.disconnect())
}, { flush: 'post', immediate: true })

const lineSeries = computed(() => {
  const t = revenueTrend.value
  return {
    revenue: t.map((d: any) => Number(d.revenue) || 0),
    expense: t.map((d: any) => Number(d.expense) || 0),
    labels: t.map((d: any) => d.label),
  }
})
const lineMax = computed(() => {
  const { revenue, expense } = lineSeries.value
  const m = Math.max(...revenue, ...expense, revenueTarget.value || 0, 1)
  return m
})
const lineTicks = computed(() => niceTicks(lineMax.value, 4))
const lineIW = computed(() => Math.max(10, LINE_W.value - linePadL - linePadR))
const lineIH = LINE_H - linePadT - linePadB
function lineX(i: number, total: number): number {
  return total <= 1 ? linePadL + lineIW.value / 2 : linePadL + (i / (total - 1)) * lineIW.value
}
function lineY(v: number): number {
  return linePadT + lineIH - (v / lineTicks.value.top) * lineIH
}
const linePaths = computed(() => {
  const { revenue, expense } = lineSeries.value
  const n = revenue.length
  if (!n || !LINE_W.value) return { revLine: '', revArea: '', expLine: '' }
  const rev = revenue.map((v, i) => [lineX(i, n), lineY(v)])
  const exp = expense.map((v, i) => [lineX(i, n), lineY(v)])
  const revLine = rev.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const revArea = `${revLine} L${lineX(n - 1, n)} ${linePadT + lineIH} L${lineX(0, n)} ${linePadT + lineIH} Z`
  const expLine = exp.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  return { revLine, revArea, expLine }
})
const lineLabelEvery = computed(() => Math.ceil(lineSeries.value.labels.length / 7))

// ============================================================
// Bar chart math (orders by hour)
// ============================================================
const BAR_W = ref(700)
const BAR_H = 240
const barPadL = 44, barPadR = 12, barPadT = 14, barPadB = 28
const barHover = ref<number | null>(null)
const barRef = ref<HTMLElement | null>(null)

watch(barRef, (el, _, onCleanup) => {
  if (!el) return
  const ro = new ResizeObserver(es => {
    const e = es[0]
    if (e) BAR_W.value = e.contentRect.width
  })
  ro.observe(el)
  BAR_W.value = el.clientWidth
  onCleanup(() => ro.disconnect())
}, { flush: 'post', immediate: true })

const barMax = computed(() => Math.max(1, ...ordersByHour.value.map((d: any) => Number(d.orders) || 0)))
const barTicks = computed(() => niceTicks(barMax.value, 4))
const barIW = computed(() => Math.max(10, BAR_W.value - barPadL - barPadR))
const barIH = BAR_H - barPadT - barPadB
const barBand = computed(() => barIW.value / Math.max(1, ordersByHour.value.length))
const barWidth = computed(() => Math.min(barBand.value * 0.62, 40))
function barY(v: number): number {
  return barPadT + barIH - (v / barTicks.value.top) * barIH
}
</script>

<template>
  <div class="dash">
    <!-- Page header -->
    <div class="head">
      <div>
        <h1 class="head__title">
          {{ t('Dashboard') }}
        </h1>
        <div class="head__sub">
          {{ todayDateLine }}
        </div>
      </div>
      <div class="head__actions">
        <button
          class="btn btn--secondary"
          :disabled="loading"
          @click="refresh"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3-6.7" /><polyline points="21 4 21 11 14 11" /></svg>
          {{ t('Refresh') }}
        </button>
        <button class="btn btn--primary">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          {{ t('Export report') }}
        </button>
      </div>
    </div>

    <!-- Row 1: 4 KPI cards with deltas -->
    <div class="grid cols-4 mb-5">
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-success">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>
          </div>
          <div class="kpi__label">
            {{ t(`Today's Revenue`) }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:140px;height:30px;border-radius:4px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(Number(today?.revenue ?? 0)) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__foot">
          <span v-if="deltas?.revenue_delta !== null && deltas?.revenue_delta !== undefined" class="delta" :class="deltas.revenue_delta > 0 ? 'is-up' : deltas.revenue_delta < 0 ? 'is-down' : 'is-flat'">
            <svg v-if="deltas.revenue_delta" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="deltas.revenue_delta > 0"><path d="M7 17 L17 7" /><path d="M9 7 H17 V15" /></template>
              <template v-else><path d="M7 7 L17 17" /><path d="M9 17 H17 V9" /></template>
            </svg>
            {{ fmtDelta(deltas.revenue_delta) }}
          </span>
          <span class="kpi__sub">vs last week</span>
        </div>
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12l-2 20H8L6 2zM8 7h8M8 12h8M8 17h8" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Orders Today') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:30px;border-radius:4px;" />
        <div v-else class="kpi__value">
          {{ today?.orders ?? 0 }}
        </div>
        <div class="kpi__foot">
          <span v-if="deltas?.orders_delta !== null && deltas?.orders_delta !== undefined" class="delta" :class="deltas.orders_delta > 0 ? 'is-up' : deltas.orders_delta < 0 ? 'is-down' : 'is-flat'">
            <svg v-if="deltas.orders_delta" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="deltas.orders_delta > 0"><path d="M7 17 L17 7" /><path d="M9 7 H17 V15" /></template>
              <template v-else><path d="M7 7 L17 17" /><path d="M9 17 H17 V9" /></template>
            </svg>
            {{ fmtDelta(deltas.orders_delta) }}
          </span>
          <span class="kpi__sub">vs last week</span>
        </div>
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-info">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Avg Order Value') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:120px;height:30px;border-radius:4px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(aov ?? 0) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__foot">
          <span v-if="deltas?.aov_delta !== null && deltas?.aov_delta !== undefined" class="delta" :class="deltas.aov_delta > 0 ? 'is-up' : deltas.aov_delta < 0 ? 'is-down' : 'is-flat'">
            <svg v-if="deltas.aov_delta" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="deltas.aov_delta > 0"><path d="M7 17 L17 7" /><path d="M9 7 H17 V15" /></template>
              <template v-else><path d="M7 7 L17 17" /><path d="M9 17 H17 V9" /></template>
            </svg>
            {{ fmtDelta(deltas.aov_delta) }}
          </span>
          <span class="kpi__sub">vs last week</span>
        </div>
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon" :class="lowStockCount && lowStockCount > 0 ? 't-warning' : 't-success'">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zM2 7l10 5 10-5M12 22V12" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Low Stock Items') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:60px;height:30px;border-radius:4px;" />
        <div v-else class="kpi__value">
          {{ lowStockCount ?? 0 }}
        </div>
        <div class="kpi__foot">
          <span class="kpi__sub">{{ lowStockCount && lowStockCount > 0 ? t('needs reorder') : t('all stocked') }}</span>
        </div>
      </div>
    </div>

    <!-- Row 2: secondary mini KPIs -->
    <div class="grid cols-4 mb-5">
      <div class="kpi-mini">
        <div class="kpi-mini__label">
          {{ t('Open Orders') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;border-radius:4px;" />
        <div v-else class="kpi-mini__value" style="color: rgb(var(--v-theme-primary));">
          {{ today?.open ?? 0 }}
        </div>
      </div>
      <div class="kpi-mini">
        <div class="kpi-mini__label">
          {{ t('Cancelled') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;border-radius:4px;" />
        <div v-else class="kpi-mini__value" style="color: rgb(var(--v-theme-error));">
          {{ today?.cancelled ?? 0 }}
        </div>
      </div>
      <div class="kpi-mini">
        <div class="kpi-mini__label">
          {{ t('Paid') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;border-radius:4px;" />
        <div v-else class="kpi-mini__value" style="color: rgb(var(--v-theme-success));">
          {{ paidPct ?? 0 }}%
        </div>
        <div class="kpi-mini__sub">
          {{ today?.paid_orders ?? 0 }}/{{ today?.orders ?? 0 }}
        </div>
      </div>
      <div class="kpi-mini">
        <div class="kpi-mini__label">
          {{ t('Clocked In') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;border-radius:4px;" />
        <div v-else class="kpi-mini__value" style="color: rgb(var(--v-theme-info));">
          {{ clockedIn.length }}
        </div>
      </div>
    </div>

    <!-- Row 3: revenue line chart + payment mix donut -->
    <div class="grid grid--170-100 mb-5">
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="card__eyebrow">
              Revenue vs expenses · last 14 days
            </div>
            <h3 class="card__insight">
              {{ revenueInsight }}
            </h3>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="skel" style="height:260px;border-radius:10px;" />
          <div v-else-if="!revenueTrend.length" class="empty">
            <div>No trend data yet</div>
            <div style="font-size:12px;color:rgb(var(--v-theme-text-tertiary));margin-top:4px;">Run seed_14d_orders.py to backfill</div>
          </div>
          <div v-else ref="lineRef" style="position:relative;">
            <svg :width="LINE_W" :height="LINE_H" style="display:block;">
              <defs>
                <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgb(var(--v-theme-chart-revenue))" stop-opacity="0.18" />
                  <stop offset="100%" stop-color="rgb(var(--v-theme-chart-revenue))" stop-opacity="0" />
                </linearGradient>
              </defs>
              <!-- gridlines -->
              <g v-for="(tv, i) in lineTicks.ticks" :key="`g${i}`">
                <line :x1="linePadL" :x2="LINE_W - linePadR" :y1="lineY(tv)" :y2="lineY(tv)" stroke="rgb(var(--v-theme-chart-grid))" stroke-width="1" />
                <text :x="linePadL - 10" :y="lineY(tv) + 4" text-anchor="end" font-size="11" fill="rgb(var(--v-theme-chart-axis))" font-family="var(--font-mono)">{{ fmtAbbr(tv) }}</text>
              </g>
              <!-- target line -->
              <g v-if="revenueTarget > 0">
                <line :x1="linePadL" :x2="LINE_W - linePadR" :y1="lineY(revenueTarget)" :y2="lineY(revenueTarget)" stroke="rgb(var(--v-theme-chart-target))" stroke-width="1.5" stroke-dasharray="5 4" />
                <text :x="LINE_W - linePadR" :y="lineY(revenueTarget) - 6" text-anchor="end" font-size="11" font-weight="600" fill="rgb(var(--v-theme-chart-target))">Target {{ fmtAbbr(revenueTarget) }}</text>
              </g>
              <!-- area + lines -->
              <path :d="linePaths.revArea" fill="url(#rev-grad)" />
              <path :d="linePaths.revLine" fill="none" stroke="rgb(var(--v-theme-chart-revenue))" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
              <path :d="linePaths.expLine" fill="none" stroke="rgb(var(--v-theme-chart-expense))" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
              <!-- x labels -->
              <text v-for="(c, i) in lineSeries.labels" :key="`xl${i}`" v-show="i % lineLabelEvery === 0 || i === lineSeries.labels.length - 1" :x="lineX(i, lineSeries.labels.length)" :y="LINE_H - 8" text-anchor="middle" font-size="11" fill="rgb(var(--v-theme-chart-axis))">{{ c }}</text>
            </svg>
            <div class="legend-row">
              <span class="legend-item">
                <span class="legend-swatch" style="background:rgb(var(--v-theme-chart-revenue));" />
                Revenue <b class="mono">{{ fmtNum(revenueLatest) }}</b>
              </span>
              <span class="legend-item">
                <span class="legend-swatch" style="background:rgb(var(--v-theme-chart-expense));" />
                Expenses <b class="mono">{{ fmtNum(expenseLatest) }}</b>
              </span>
              <span class="legend-item">
                <span class="legend-swatch" style="background:rgb(var(--v-theme-chart-target));" />
                Daily target <b class="mono">{{ fmtNum(revenueTarget) }}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="card__eyebrow">
              Payment mix · today
            </div>
            <h3 class="card__insight">
              {{ paymentInsight }}
            </h3>
            <div class="card__sub">
              Share of paid revenue by method
            </div>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="skel" :style="`width:${DONUT_SIZE}px;height:${DONUT_SIZE}px;border-radius:50%;margin:0 auto;`" />
          <div v-else-if="!paymentMix.length" class="empty">
            <div>No data for this range</div>
          </div>
          <div v-else class="donut-wrap">
            <svg :width="DONUT_SIZE" :height="DONUT_SIZE">
              <path
                v-for="(a, i) in donutArcs"
                :key="i"
                :d="a.path"
                :fill="a.d.color"
                :opacity="donutHover !== null && donutHover !== i ? 0.4 : 1"
                @mouseenter="donutHover = i"
                @mouseleave="donutHover = null"
              />
              <text :x="DONUT_SIZE / 2" :y="DONUT_SIZE / 2 - 4" text-anchor="middle" font-size="22" font-weight="700" fill="rgb(var(--v-theme-on-surface))" font-family="var(--font-mono)">{{ fmtAbbr(paymentTotal) }}</text>
              <text :x="DONUT_SIZE / 2" :y="DONUT_SIZE / 2 + 16" text-anchor="middle" font-size="11" fill="rgb(var(--v-theme-text-secondary))">Collected</text>
            </svg>
            <div class="donut-legend">
              <div v-for="(a, i) in donutArcs" :key="i" class="donut-legend__row" :style="{ opacity: donutHover !== null && donutHover !== i ? 0.5 : 1 }">
                <span class="legend-item">
                  <span class="legend-swatch" :style="{ background: a.d.color }" />
                  {{ a.d.label }}
                </span>
                <span class="legend-vals">
                  <b class="mono">{{ fmtAbbr(a.d.value) }}</b>
                  <span class="legend-pct">{{ a.pct }}%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 4: orders by hour bar + top products hbar -->
    <div class="grid grid--140-100 mb-5">
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="card__eyebrow">
              Orders by hour · today
            </div>
            <h3 class="card__insight">
              {{ ordersByHourInsight }}
            </h3>
            <div class="card__sub">
              {{ ordersByHourTotal }} orders across the day
            </div>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="skel" :style="`height:${BAR_H}px;border-radius:10px;`" />
          <div v-else-if="!ordersByHour.length" class="empty">
            <div>No orders today yet</div>
          </div>
          <div v-else ref="barRef" style="position:relative;">
            <svg :width="BAR_W" :height="BAR_H" style="display:block;">
              <g v-for="(tv, i) in barTicks.ticks" :key="`bg${i}`">
                <line :x1="barPadL" :x2="BAR_W - barPadR" :y1="barY(tv)" :y2="barY(tv)" stroke="rgb(var(--v-theme-chart-grid))" stroke-width="1" />
                <text :x="barPadL - 9" :y="barY(tv) + 4" text-anchor="end" font-size="11" fill="rgb(var(--v-theme-chart-axis))" font-family="var(--font-mono)">{{ Math.round(tv) }}</text>
              </g>
              <g v-for="(d, i) in ordersByHour" :key="`b${i}`">
                <rect
                  :x="barPadL + barBand * i + (barBand - barWidth) / 2"
                  :y="barY(d.orders)"
                  :width="barWidth"
                  :height="Math.max((d.orders / barTicks.top) * barIH, 1)"
                  rx="4"
                  :fill="d.peak ? 'rgb(var(--v-theme-chart-revenue))' : (barHover === i ? 'rgb(var(--v-theme-primary-hover))' : 'rgb(var(--v-theme-c4))')"
                  :opacity="barHover !== null && barHover !== i && !d.peak ? 0.55 : 1"
                  @mouseenter="barHover = i"
                  @mouseleave="barHover = null"
                />
                <text v-if="d.peak" :x="barPadL + barBand * i + barBand / 2" :y="barY(d.orders) - 7" text-anchor="middle" font-size="11" font-weight="700" fill="rgb(var(--v-theme-chart-revenue))">{{ d.orders }}</text>
                <text :x="barPadL + barBand * i + barBand / 2" :y="BAR_H - 9" text-anchor="middle" font-size="11" fill="rgb(var(--v-theme-chart-axis))">{{ d.label }}</text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="card__eyebrow">
              Top products · today
            </div>
            <h3 class="card__insight">
              {{ topProductInsight }}
            </h3>
            <div class="card__sub">
              By revenue contribution
            </div>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="hbar-list">
            <div v-for="i in 5" :key="i" class="skel" style="height:26px;" />
          </div>
          <div v-else-if="!topProductsForChart.length" class="empty">
            <div>{{ topProductInsight }}</div>
          </div>
          <div v-else class="hbar-list">
            <div v-for="(d, i) in topProductsForChart" :key="i">
              <div class="hbar-head">
                <span class="hbar-name">
                  <svg v-if="i === 0" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="color: rgb(var(--v-theme-warning));"><path d="M12 2L14.6 8.6 21.5 9.1 16.2 13.5 17.8 20.3 12 16.7 6.2 20.3 7.8 13.5 2.5 9.1 9.4 8.6Z" /></svg>
                  {{ d.name }}
                  <span v-if="d.units" class="hbar-units">· {{ d.units }} units</span>
                </span>
                <span class="hbar-val">{{ fmtAbbr(d.value) }}</span>
              </div>
              <div class="hbar-track">
                <div class="hbar-fill" :style="{ width: `${(d.value / topProductMax) * 100}%`, background: i === 0 ? 'rgb(var(--v-theme-chart-revenue))' : 'rgb(var(--v-theme-c4))' }" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 5: recent orders + side column -->
    <div class="grid grid--170-100">
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <h3 class="card__title">
              {{ t('Recent orders') }}
            </h3>
            <div class="card__sub">
              {{ t('Latest activity today') }}
            </div>
          </div>
          <button class="link-btn" @click="router.push('/orders')">
            {{ t('View all') }} →
          </button>
        </div>
        <div class="divider" />
        <div v-if="recentOrdersLoading" style="padding:20px;display:flex;flex-direction:column;gap:14px;">
          <div v-for="i in 5" :key="i" class="skel" style="height:18px;" />
        </div>
        <div v-else-if="!recentOrders.length" class="empty">
          <div>No orders yet today</div>
        </div>
        <table v-else class="dtable">
          <thead>
            <tr>
              <th>{{ t('Order') }}</th>
              <th>{{ t('Type') }}</th>
              <th>{{ t('Status') }}</th>
              <th>{{ t('Payment') }}</th>
              <th class="num">{{ t('Total') }}</th>
              <th class="num">{{ t('Time') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in recentOrders" :key="o.id">
              <td class="cell-strong mono">#{{ o.display_id ?? o.id }}</td>
              <td><span class="badge t-neutral">{{ titleCase(o.order_type ?? 'HALL') }}</span></td>
              <td><span class="badge badge--dot" :class="`t-${statusTone(o.status)}`">{{ titleCase(o.status) }}</span></td>
              <td><span class="badge" :class="`t-${statusTone(o.is_paid ? 'PAID' : 'UNPAID')}`">{{ o.is_paid ? 'Paid' : 'Unpaid' }}</span></td>
              <td class="num mono cell-strong">{{ fmtNum(Number(o.total_amount) || 0) }}</td>
              <td class="num mono cell-muted">{{ fmtTime(o.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="side-col">
        <div class="card">
          <div class="card__head card__head--tight">
            <h3 class="card__title">
              {{ t('Clocked in') }}
            </h3>
            <span class="badge t-primary">{{ clockedIn.length }} active</span>
          </div>
          <div class="card__body card__body--tight">
            <div v-if="loading" style="display:flex;flex-direction:column;gap:10px;">
              <div v-for="i in 2" :key="i" class="skel" style="height:40px;" />
            </div>
            <div v-else-if="!clockedIn.length" class="empty">
              <div>{{ t('No one on shift') }}</div>
            </div>
            <div v-for="c in clockedIn" v-else :key="c.shift_id ?? c.name" class="clockin-row" @click="router.push('/shifts-analytics')">
              <div class="av">{{ ((c.name ?? '?').trim()[0] || '?').toUpperCase() }}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:14px;color:rgb(var(--v-theme-on-surface));">{{ c.name }}</div>
                <div style="font-size:12px;color:rgb(var(--v-theme-text-tertiary));">{{ t('Since') }} {{ fmtDateTime(c.start_time) }}</div>
              </div>
              <span class="badge badge--dot t-success">{{ t('On shift') }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head card__head--tight">
            <h3 class="card__title">
              {{ t('Low stock') }}
            </h3>
            <span class="badge t-warning">{{ lowStockCount ?? 0 }} items</span>
          </div>
          <div class="card__body card__body--tight">
            <div v-if="loading" style="display:flex;flex-direction:column;gap:10px;">
              <div v-for="i in 4" :key="i" class="skel" style="height:28px;" />
            </div>
            <div v-else-if="!lowStockItems.length" class="empty">
              <div>{{ t('No low-stock items') }}</div>
              <button class="link-btn" style="margin-top:8px;" @click="router.push('/stock/items')">
                {{ t('View items') }} →
              </button>
            </div>
            <div v-for="s in lowStockItems" v-else :key="s.id" class="low-row">
              <span style="font-weight:500;font-size:14px;color:rgb(var(--v-theme-on-surface));">{{ s.name }}</span>
              <span style="display:inline-flex;gap:10px;align-items:center;">
                <span class="mono" style="color:rgb(var(--v-theme-warning));font-weight:600;font-size:13px;">{{ fmtNum(s.level) }} {{ s.unit }}</span>
                <span style="font-size:12px;color:rgb(var(--v-theme-text-tertiary));">/ {{ fmtNum(s.reorder) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dash { padding: 32px; max-width: 1440px; margin: 0 auto; }

.head {
  display: flex; align-items: flex-start; gap: 16px;
  margin-bottom: 24px; flex-wrap: wrap;
  &__title {
    font-size: 24px; line-height: 32px; font-weight: 700;
    letter-spacing: -0.02em; margin: 0; color: rgb(var(--v-theme-on-surface));
  }
  &__sub { color: rgb(var(--v-theme-text-secondary)); font-size: 13px; margin-top: 4px; }
  &__actions { margin-left: auto; display: flex; gap: 12px; }
}

.btn {
  display: inline-flex; align-items: center; gap: 8px;
  height: 40px; padding: 0 16px; border-radius: 8px;
  font-weight: 600; font-size: 14px; border: 1px solid transparent;
  cursor: pointer; font-family: inherit; background: transparent;
  &--secondary {
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-on-surface));
    border-color: rgb(var(--v-theme-border-strong));
  }
  &--secondary:hover { background: rgb(var(--v-theme-surface-2)); }
  &--primary {
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
  }
  &--primary:hover { background: rgb(var(--v-theme-primary-hover)); }
}

.link-btn {
  background: transparent; border: 0;
  color: rgb(var(--v-theme-text-secondary));
  font-weight: 500; cursor: pointer; font-family: inherit;
  font-size: 13px; padding: 6px 8px; border-radius: 6px;
  &:hover { background: rgb(var(--v-theme-surface-2)); color: rgb(var(--v-theme-on-surface)); }
}

.grid { display: grid; gap: 20px; }
.cols-4 { grid-template-columns: repeat(4, 1fr); }
.grid--170-100 { grid-template-columns: 1.7fr 1fr; }
.grid--140-100 { grid-template-columns: 1.4fr 1fr; }
@media (max-width: 1100px) {
  .cols-4 { grid-template-columns: repeat(2, 1fr); }
  .grid--170-100, .grid--140-100 { grid-template-columns: 1fr; }
}
@media (max-width: 720px) { .cols-4 { grid-template-columns: 1fr; } }
.mb-5 { margin-bottom: 20px; }

/* KPI cards */
.kpi {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 14px; padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  &__top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  &__icon {
    width: 38px; height: 38px; border-radius: 8px;
    display: grid; place-items: center; flex: 0 0 38px;
    &.t-primary { background: rgb(var(--v-theme-primary-weak)); color: rgb(var(--v-theme-primary)); }
    &.t-success { background: rgb(var(--v-theme-success-weak)); color: rgb(var(--v-theme-success)); }
    &.t-warning { background: rgb(var(--v-theme-warning-weak)); color: rgb(var(--v-theme-warning)); }
    &.t-error { background: rgb(var(--v-theme-error-weak)); color: rgb(var(--v-theme-error)); }
    &.t-info { background: rgb(var(--v-theme-info-weak)); color: rgb(var(--v-theme-info)); }
  }
  &__label { font-size: 13px; color: rgb(var(--v-theme-text-secondary)); font-weight: 500; }
  &__value {
    font-family: var(--font-mono); font-size: 30px; line-height: 36px;
    font-weight: 700; letter-spacing: -0.03em; color: rgb(var(--v-theme-on-surface));
  }
  &__unit {
    font-size: 13px; color: rgb(var(--v-theme-text-tertiary));
    font-weight: 500; font-family: var(--font-sans); margin-left: 4px;
  }
  &__foot { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  &__sub { font-size: 13px; color: rgb(var(--v-theme-text-tertiary)); }
}

.delta {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 13px; font-weight: 600;
  padding: 2px 7px 2px 5px; border-radius: 99px;
  &.is-up { color: rgb(var(--v-theme-success)); background: rgb(var(--v-theme-success-weak)); }
  &.is-down { color: rgb(var(--v-theme-error)); background: rgb(var(--v-theme-error-weak)); }
  &.is-flat { color: rgb(var(--v-theme-text-secondary)); background: rgb(var(--v-theme-neutral-weak)); }
}

.kpi-mini {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 14px; padding: 16px 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  &__label { font-size: 13px; color: rgb(var(--v-theme-text-secondary)); font-weight: 500; margin-bottom: 6px; }
  &__value { font-family: var(--font-mono); font-size: 24px; line-height: 32px; font-weight: 700; letter-spacing: -0.03em; }
  &__sub { font-size: 13px; color: rgb(var(--v-theme-text-tertiary)); margin-top: 4px; }
}

/* Cards */
.card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex; flex-direction: column;
}
.card__head { display: flex; align-items: flex-start; gap: 12px; padding: 20px 20px 16px; }
.card__head--tight { padding-bottom: 12px; }
.card__head-text { min-width: 0; }
.card__eyebrow { font-size: 13px; color: rgb(var(--v-theme-text-secondary)); font-weight: 500; margin-bottom: 3px; }
.card__title { font-size: 15px; font-weight: 600; margin: 0; letter-spacing: -0.01em; color: rgb(var(--v-theme-on-surface)); }
.card__insight { font-size: 19px; line-height: 28px; font-weight: 700; letter-spacing: -0.02em; margin: 0; color: rgb(var(--v-theme-on-surface)); }
.card__sub { font-size: 13px; color: rgb(var(--v-theme-text-secondary)); margin-top: 3px; }
.card__body { padding: 0 20px 20px; &--tight { padding-top: 0; } }
.divider { height: 1px; background: rgb(var(--v-theme-border)); }

.skel {
  background: linear-gradient(90deg,
    rgba(var(--v-theme-on-surface), 0.06) 25%,
    rgba(var(--v-theme-on-surface), 0.12) 37%,
    rgba(var(--v-theme-on-surface), 0.06) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
  border-radius: 6px;
}
@keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

.donut-wrap { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
.donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 200px; }
.donut-legend__row { display: flex; align-items: center; justify-content: space-between; transition: opacity .12s; }
.legend-row { display: flex; gap: 24px; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgb(var(--v-theme-border)); flex-wrap: wrap; }
.legend-item { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: rgb(var(--v-theme-text-secondary)); font-weight: 500; }
.legend-swatch { width: 10px; height: 10px; border-radius: 3px; flex: 0 0 10px; }
.legend-item b { color: rgb(var(--v-theme-on-surface)); font-weight: 600; }
.legend-vals { display: inline-flex; align-items: center; gap: 8px; }
.legend-vals b { font-size: 13px; font-weight: 700; color: rgb(var(--v-theme-on-surface)); }
.legend-pct { font-family: var(--font-mono); font-size: 12px; width: 38px; text-align: right; color: rgb(var(--v-theme-text-tertiary)); }

.hbar-list { display: flex; flex-direction: column; gap: 14px; }
.hbar-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.hbar-name { font-weight: 500; font-size: 13px; display: flex; align-items: center; gap: 7px; color: rgb(var(--v-theme-on-surface)); }
.hbar-units { font-size: 12px; color: rgb(var(--v-theme-text-tertiary)); }
.hbar-val { font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: rgb(var(--v-theme-on-surface)); }
.hbar-track { height: 10px; border-radius: 99px; background: rgb(var(--v-theme-chart-track)); overflow: hidden; }
.hbar-fill { height: 100%; border-radius: 99px; transition: width .5s cubic-bezier(.2, .8, .3, 1); }

.empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; gap: 8px; padding: 40px 20px;
  color: rgb(var(--v-theme-text-secondary)); font-size: 13px;
}

.badge {
  display: inline-flex; align-items: center; gap: 5px;
  height: 22px; padding: 0 9px; border-radius: 6px;
  font-size: 12px; font-weight: 600; border: 1px solid transparent; white-space: nowrap;
  &--dot::before { content: ""; width: 6px; height: 6px; border-radius: 99px; background: currentColor; }
  &.t-success { background: rgb(var(--v-theme-success-weak)); color: rgb(var(--v-theme-success-strong)); border-color: rgb(var(--v-theme-success-border)); }
  &.t-warning { background: rgb(var(--v-theme-warning-weak)); color: rgb(var(--v-theme-warning-strong)); border-color: rgb(var(--v-theme-warning-border)); }
  &.t-error { background: rgb(var(--v-theme-error-weak)); color: rgb(var(--v-theme-error-strong)); border-color: rgb(var(--v-theme-error-border)); }
  &.t-info { background: rgb(var(--v-theme-info-weak)); color: rgb(var(--v-theme-info-strong)); border-color: rgb(var(--v-theme-info-border)); }
  &.t-primary { background: rgb(var(--v-theme-primary-weak)); color: rgb(var(--v-theme-primary)); border-color: rgb(var(--v-theme-primary-border)); }
  &.t-neutral { background: rgb(var(--v-theme-neutral-weak)); color: rgb(var(--v-theme-text-secondary)); border-color: rgb(var(--v-theme-neutral-border)); }
}

.dtable { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
.dtable thead th {
  background: rgb(var(--v-theme-surface-2)); color: rgb(var(--v-theme-text-secondary));
  font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  text-align: left; padding: 12px 16px; white-space: nowrap;
  border-bottom: 1px solid rgb(var(--v-theme-border));
}
.dtable th.num, .dtable td.num { text-align: right; }
.dtable tbody td { padding: 14px 16px; border-bottom: 1px solid rgb(var(--v-theme-border)); color: rgb(var(--v-theme-on-surface)); }
.dtable tbody tr:last-child td { border-bottom: 0; }
.dtable tbody tr:hover { background: rgb(var(--v-theme-surface-2)); }
.dtable .cell-strong { font-weight: 600; }
.dtable .cell-muted { color: rgb(var(--v-theme-text-secondary)); }
.dtable .mono { font-family: var(--font-mono); font-feature-settings: "tnum" 1; }

.side-col { display: flex; flex-direction: column; gap: 20px; }
.clockin-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; cursor: pointer; border-radius: 8px; }
.clockin-row:hover { background: rgb(var(--v-theme-surface-2)); padding-inline: 6px; margin-inline: -6px; }
.av {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgb(var(--v-theme-primary-weak)); color: rgb(var(--v-theme-primary));
  display: grid; place-items: center; font-size: 12px; font-weight: 600; flex: 0 0 28px;
}
.low-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 0; border-bottom: 1px solid rgb(var(--v-theme-border));
  &:last-child { border-bottom: 0; }
}

.mono { font-family: var(--font-mono); font-feature-settings: "tnum" 1; }
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

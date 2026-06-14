<script setup lang="ts">
import axios from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

// ============================================================
// Inline format helpers (ported from .tmp-design-bundle/.../format.js)
// Bundle's NB = ' ' (narrow no-break space) — kept as a literal
// character here per project convention.
// ============================================================
const NB = ' '
function group(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, NB)
}
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'
  const neg = n < 0
  const s = group(Math.round(Math.abs(n)).toString())
  return (neg ? '-' : '') + s
}
function fmtAbbr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'
  const neg = n < 0
  const a = Math.abs(n)
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, '')
  const trim1 = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  let out: string
  if (a >= 1e9) out = `${trim(a / 1e9)}B`
  else if (a >= 1e6) out = `${trim(a / 1e6)}M`
  else if (a >= 1e3) out = `${trim1(a / 1e3)}K`
  else out = String(Math.round(a))
  return (neg ? '-' : '') + out
}
function fmtMoney(n: number | null | undefined, opts?: { unit?: boolean }): string {
  const v = fmtNum(n)
  if (v === '—')
    return v
  return opts?.unit ? v + NB + 'UZS' : v
}
function fmtDelta(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'
  const a = Math.abs(n)
  const s = `${a.toFixed(digits).replace(/\.0$/, '')}%`
  return (n > 0 ? '+' : n < 0 ? '−' : '') + s
}
function fmtDate(d: Date | string | null | undefined): string {
  if (!d)
    return '—'
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime()))
    return '—'
  const p = (v: number) => (v < 10 ? `0${v}` : `${v}`)
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`
}
function fmtTime(d: Date | string | null | undefined): string {
  if (!d)
    return '—'
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime()))
    return '—'
  const p = (v: number) => (v < 10 ? `0${v}` : `${v}`)
  return `${p(x.getHours())}:${p(x.getMinutes())}`
}
function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d)
    return '—'
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime()))
    return '—'
  return `${fmtDate(x)}, ${fmtTime(x)}`
}

// ============================================================
// Data wiring
// ============================================================
const loading = ref(true)
const data = ref<any>(null)
const recentOrders = ref<any[]>([])
const recentOrdersLoading = ref(true)
const nowStamp = ref(new Date())

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/dashboard/today')
    data.value = res.data?.data ?? res.data
    nowStamp.value = new Date()
  }
  catch {
    data.value = null
  }
  finally {
    loading.value = false
  }
}

async function loadRecentOrders() {
  recentOrdersLoading.value = true
  try {
    const res = await axios.get('/orders', { params: { per_page: 5, page: 1 } })
    const d = res.data?.data ?? res.data
    recentOrders.value = d?.orders ?? d?.items ?? (Array.isArray(d) ? d : [])
  }
  catch {
    recentOrders.value = []
  }
  finally {
    recentOrdersLoading.value = false
  }
}

onMounted(() => {
  load()
  loadRecentOrders()
})

function refresh() {
  load()
  loadRecentOrders()
}

// ============================================================
// Computed slices over BE response
// ============================================================
const today = computed(() => data.value?.today ?? null)
const paymentBreakdown = computed<Record<string, string | number>>(() => data.value?.payment_breakdown_today ?? {})
const topProducts = computed<any[]>(() => data.value?.top_products_today ?? [])
const lowStockCount = computed<number>(() => Number(data.value?.low_stock_count ?? 0))
const lowStockItems = computed<any[]>(() => data.value?.low_stock_items ?? [])
const clockedIn = computed<any[]>(() => data.value?.clocked_in ?? [])
const ordersByHour = computed<any[]>(() => data.value?.orders_by_hour ?? [])
const revenueTrend = computed<any[]>(() => data.value?.revenue_trend ?? [])
const revenueTarget = computed<number>(() => Number(data.value?.revenue_target ?? 0))
const deltas = computed<any>(() => data.value?.deltas ?? null)

const aov = computed<number>(() => {
  if (!today.value)
    return 0
  const paid = Number(today.value.paid_orders) || 0
  const rev = Number(today.value.revenue) || 0
  return paid ? Math.round(rev / paid) : 0
})
const paidPct = computed<number>(() => {
  if (!today.value)
    return 0
  const totalOrders = Number(today.value.orders) || 0
  return totalOrders ? Math.round(((Number(today.value.paid_orders) || 0) / totalOrders) * 100) : 0
})

const todayDateLine = computed(() => `${t('Today\'s snapshot')} · ${fmtDateTime(nowStamp.value)}`)

// ============================================================
// Payment mix (donut) — palette per task spec
// ============================================================
const PAYMENT_COLORS: Record<string, string> = {
  CASH: 'var(--chart-cash)',
  UZCARD: 'var(--c1)',
  HUMO: 'var(--c4)',
  PAYME: 'var(--c5)',
  CLICK: 'var(--c3)',
  MIXED: 'var(--c5)',
}
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UZCARD: 'Uzcard',
  HUMO: 'Humo',
  PAYME: 'Payme',
  CLICK: 'Click',
  MIXED: 'Mixed',
}
const paymentMix = computed(() => {
  return Object.entries(paymentBreakdown.value)
    .map(([k, v]) => ({
      key: k,
      label: PAYMENT_LABELS[k] ?? k,
      value: Number(v) || 0,
      color: PAYMENT_COLORS[k] ?? 'var(--c5)',
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)
})
const paymentTotal = computed(() => paymentMix.value.reduce((a, b) => a + b.value, 0))
const paymentInsight = computed(() => {
  if (!paymentMix.value.length)
    return t('No paid orders yet')
  const total = paymentTotal.value || 1
  const top = paymentMix.value[0]
  return t('{name} leads at {pct}%', { name: top.label, pct: Math.round((top.value / total) * 100) })
})

// ============================================================
// Top products (HBar)
// ============================================================
const topProductsForChart = computed(() =>
  topProducts.value.slice(0, 5).map((p: any) => ({
    name: p.product_name,
    value: Number(p.revenue) || 0,
    units: Number(p.quantity) || 0,
  })),
)
const topProductInsight = computed(() =>
  topProductsForChart.value.length
    ? t('{name} leads revenue', { name: topProductsForChart.value[0].name })
    : t('No sales yet today'),
)
const topProductMax = computed(() => Math.max(1, ...topProductsForChart.value.map(p => p.value)))

// ============================================================
// Orders by hour (BarChart)
// ============================================================
const peakHourLabel = computed<string | null>(() => {
  const series = ordersByHour.value
  if (series.length) {
    const p = series.find((b: any) => b.peak)
    if (p) return p.label
  }
  const h = today.value?.peak_hour
  if (h === null || h === undefined)
    return null
  return `${String(h).padStart(2, '0')}:00`
})
const ordersByHourInsight = computed(() =>
  peakHourLabel.value
    ? t('Peak trade at {hour}', { hour: peakHourLabel.value })
    : t('No orders today yet'),
)
const ordersByHourTotal = computed(() => ordersByHour.value.reduce((a, b: any) => a + (Number(b.orders) || 0), 0))

// ============================================================
// Revenue trend (LineArea)
// ============================================================
const revenueInsight = computed(() => {
  if (!revenueTrend.value.length)
    return t('Trend data not yet available')
  const arr = revenueTrend.value
  if (arr.length < 14)
    return t('Revenue trend')
  const lastWeek = arr.slice(0, 7).reduce((a, b: any) => a + (Number(b.revenue) || 0), 0)
  const thisWeek = arr.slice(-7).reduce((a, b: any) => a + (Number(b.revenue) || 0), 0)
  if (!lastWeek)
    return t('Revenue trend')
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
  if (pct === 0)
    return t('Revenue flat vs last week')
  return pct > 0
    ? t('Revenue is up {pct}% vs last week', { pct })
    : t('Revenue is down {pct}% vs last week', { pct: Math.abs(pct) })
})
const revenueLatest = computed(() => {
  const arr = revenueTrend.value
  return arr.length ? Number(arr[arr.length - 1].revenue) || 0 : 0
})
const expenseLatest = computed(() => {
  const arr = revenueTrend.value
  return arr.length ? Number(arr[arr.length - 1].expense) || 0 : 0
})

// ============================================================
// niceTicks utility (ported verbatim from charts.jsx)
// ============================================================
function niceTicks(max: number, count: number): { ticks: number[]; top: number } {
  const raw = (max || 1) / count
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
// LineArea chart (revenue vs expense + target)
// padL 52, padR 16, padT 16, padB 28, height 260
// ============================================================
const LINE_PAD_L = 52
const LINE_PAD_R = 16
const LINE_PAD_T = 16
const LINE_PAD_B = 28
const LINE_H = 260
const LINE_W = ref(800)
const lineEl = ref<HTMLElement | null>(null)
const lineHover = ref<number | null>(null)
const lineGradId = `lg-${Math.random().toString(36).slice(2, 8)}`

watch(lineEl, (el, _old, onCleanup) => {
  if (!el)
    return
  const ro = new ResizeObserver((es) => {
    const e = es[0]
    if (e)
      LINE_W.value = e.contentRect.width
  })
  ro.observe(el)
  LINE_W.value = el.clientWidth
  onCleanup(() => ro.disconnect())
}, { flush: 'post', immediate: true })

const lineSeries = computed(() => {
  const arr = revenueTrend.value
  return {
    labels: arr.map((d: any) => d.label),
    revenue: arr.map((d: any) => Number(d.revenue) || 0),
    expense: arr.map((d: any) => Number(d.expense) || 0),
  }
})
const lineMax = computed(() => {
  const { revenue, expense } = lineSeries.value
  return Math.max(...revenue, ...expense, revenueTarget.value || 0, 1)
})
const lineTicks = computed(() => niceTicks(lineMax.value, 4))
const lineIW = computed(() => Math.max(10, LINE_W.value - LINE_PAD_L - LINE_PAD_R))
const lineIH = LINE_H - LINE_PAD_T - LINE_PAD_B
function lineX(i: number, total: number): number {
  if (total <= 1)
    return LINE_PAD_L + lineIW.value / 2
  return LINE_PAD_L + (i / (total - 1)) * lineIW.value
}
function lineY(v: number): number {
  return LINE_PAD_T + lineIH - (v / (lineTicks.value.top || 1)) * lineIH
}
const linePaths = computed(() => {
  const { revenue, expense } = lineSeries.value
  const n = revenue.length
  if (!n || !LINE_W.value)
    return { revLine: '', revArea: '', expLine: '' }
  const rev = revenue.map((v, i) => [lineX(i, n), lineY(v)])
  const exp = expense.map((v, i) => [lineX(i, n), lineY(v)])
  const revLine = rev.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const revArea = `${revLine} L${lineX(n - 1, n)} ${LINE_PAD_T + lineIH} L${lineX(0, n)} ${LINE_PAD_T + lineIH} Z`
  const expLine = exp.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  return { revLine, revArea, expLine }
})
const lineLabelEvery = computed(() => Math.max(1, Math.ceil(lineSeries.value.labels.length / 7)))

// ============================================================
// BarChart (orders by hour)
// padL 44, padR 12, padT 14, padB 28, height 240
// ============================================================
const BAR_PAD_L = 44
const BAR_PAD_R = 12
const BAR_PAD_T = 14
const BAR_PAD_B = 28
const BAR_H = 240
const BAR_W = ref(700)
const barEl = ref<HTMLElement | null>(null)
const barHover = ref<number | null>(null)

watch(barEl, (el, _old, onCleanup) => {
  if (!el)
    return
  const ro = new ResizeObserver((es) => {
    const e = es[0]
    if (e)
      BAR_W.value = e.contentRect.width
  })
  ro.observe(el)
  BAR_W.value = el.clientWidth
  onCleanup(() => ro.disconnect())
}, { flush: 'post', immediate: true })

const barMax = computed(() => Math.max(1, ...ordersByHour.value.map((d: any) => Number(d.orders) || 0)))
const barTicks = computed(() => niceTicks(barMax.value, 4))
const barIW = computed(() => Math.max(10, BAR_W.value - BAR_PAD_L - BAR_PAD_R))
const barIH = BAR_H - BAR_PAD_T - BAR_PAD_B
const barBand = computed(() => barIW.value / Math.max(1, ordersByHour.value.length))
const barWidth = computed(() => Math.min(barBand.value * 0.62, 40))
function barY(v: number): number {
  return BAR_PAD_T + barIH - (v / (barTicks.value.top || 1)) * barIH
}

// ============================================================
// Donut chart
// R = size/2, r = R*0.62, gap 0.018, start at -0.25
// ============================================================
const DONUT_SIZE = 188
const donutHover = ref<number | null>(null)
const donutArcs = computed(() => {
  const R = DONUT_SIZE / 2
  const r = R * 0.62
  const cx = R
  const cy = R
  const gap = 0.018
  const total = paymentTotal.value || 1
  let acc = -0.25
  return paymentMix.value.map((d) => {
    const frac = d.value / total
    const a0 = acc * 2 * Math.PI + gap * Math.PI
    const a1 = (acc + frac) * 2 * Math.PI - gap * Math.PI
    acc += frac
    const big = (a1 - a0) > Math.PI ? 1 : 0
    const p = (ang: number, rad: number) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]
    const o0 = p(a0, R)
    const o1 = p(a1, R)
    const i1 = p(a1, r)
    const i0 = p(a0, r)
    const path = `M${o0[0]} ${o0[1]} A${R} ${R} 0 ${big} 1 ${o1[0]} ${o1[1]} L${i1[0]} ${i1[1]} A${r} ${r} 0 ${big} 0 ${i0[0]} ${i0[1]} Z`
    return { path, pct: Math.round(frac * 100), d }
  })
})

// ============================================================
// Recent orders helpers
// ============================================================
const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'success',
  COMPLETED: 'success',
  READY: 'success',
  PAID: 'success',
  PREPARING: 'warning',
  PENDING: 'warning',
  INACTIVE: 'neutral',
  CANCELLED: 'error',
  CANCELED: 'error',
  UNPAID: 'error',
  HALL: 'neutral',
  DELIVERY: 'info',
  PICKUP: 'primary',
}
function statusTone(v: string | undefined | null): string {
  if (!v)
    return 'neutral'
  return STATUS_TONE[String(v).toUpperCase()] || 'neutral'
}
function titleCase(v: any): string {
  if (!v)
    return '—'
  const s = String(v)
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
function initial(s: string | undefined | null): string {
  if (!s)
    return '?'
  return (s.trim()[0] || '?').toUpperCase()
}
</script>

<template>
  <div class="page">
    <!-- ===== Page header ===== -->
    <div class="page__head">
      <div style="min-width:0;">
        <h1 class="page__title">
          {{ t('Dashboard') }}
        </h1>
        <div class="page__subtitle">
          {{ todayDateLine }}
        </div>
      </div>
      <div class="page__head-actions">
        <button class="btn btn--secondary" :class="{ 'is-loading': loading }" :disabled="loading" @click="refresh">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3-6.7" /><polyline points="21 4 21 11 14 11" /></svg>
          {{ t('Refresh') }}
        </button>
        <button class="btn btn--primary">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          {{ t('Export report') }}
        </button>
      </div>
    </div>

    <!-- ===== KPI row (primary) ===== -->
    <div class="grid cols-4" style="margin-bottom:var(--sp-5);">
      <!-- Today's Revenue -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-success">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /><circle cx="17" cy="15" r="1.5" /></svg>
          </div>
          <div class="kpi__label">
            {{ t(`Today's Revenue`) }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:140px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(Number(today?.revenue ?? 0)) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__foot">
          <span
            v-if="deltas?.revenue_delta !== null && deltas?.revenue_delta !== undefined && !loading"
            class="delta"
            :class="deltas.revenue_delta > 0 ? 'is-up' : deltas.revenue_delta < 0 ? 'is-down' : 'is-flat'"
          >
            <svg v-if="deltas.revenue_delta > 0" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="9 7 17 7 17 15" /></svg>
            <svg v-else-if="deltas.revenue_delta < 0" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17" /><polyline points="9 17 17 17 17 9" /></svg>
            {{ fmtDelta(deltas.revenue_delta) }}
          </span>
          <span class="kpi__subtext">{{ t('vs last week') }}</span>
        </div>
      </div>

      <!-- Orders Today -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12l-1 20H7L6 2z" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="17" x2="15" y2="17" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Orders Today') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:90px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtNum(Number(today?.orders ?? 0)) }}
        </div>
        <div class="kpi__foot">
          <span
            v-if="deltas?.orders_delta !== null && deltas?.orders_delta !== undefined && !loading"
            class="delta"
            :class="deltas.orders_delta > 0 ? 'is-up' : deltas.orders_delta < 0 ? 'is-down' : 'is-flat'"
          >
            <svg v-if="deltas.orders_delta > 0" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="9 7 17 7 17 15" /></svg>
            <svg v-else-if="deltas.orders_delta < 0" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17" /><polyline points="9 17 17 17 17 9" /></svg>
            {{ fmtDelta(deltas.orders_delta) }}
          </span>
          <span class="kpi__subtext">{{ t('vs last week') }}</span>
        </div>
      </div>

      <!-- Avg Order Value -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-info">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Avg Order Value') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:130px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(aov) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__foot">
          <span
            v-if="deltas?.aov_delta !== null && deltas?.aov_delta !== undefined && !loading"
            class="delta"
            :class="deltas.aov_delta > 0 ? 'is-up' : deltas.aov_delta < 0 ? 'is-down' : 'is-flat'"
          >
            <svg v-if="deltas.aov_delta > 0" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="9 7 17 7 17 15" /></svg>
            <svg v-else-if="deltas.aov_delta < 0" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17" /><polyline points="9 17 17 17 17 9" /></svg>
            {{ fmtDelta(deltas.aov_delta) }}
          </span>
          <span class="kpi__subtext">{{ t('vs last week') }}</span>
        </div>
      </div>

      <!-- Low Stock Items -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon" :class="lowStockCount > 0 ? 't-warning' : 't-success'">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Low Stock Items') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:70px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtNum(lowStockCount) }}
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ lowStockCount > 0 ? t('needs reorder') : t('all stocked') }}</span>
        </div>
      </div>
    </div>

    <!-- ===== Secondary KPI row (mini) ===== -->
    <div class="grid cols-4" style="margin-bottom:var(--sp-5);">
      <div class="kpi" style="padding: var(--sp-4) var(--sp-5);">
        <div class="kpi__label" style="margin-bottom: 6px;">
          {{ t('Open Orders') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;" />
        <div v-else class="kpi__value" style="font-size: var(--fs-h1); line-height: var(--lh-h1); color: var(--info);">
          {{ fmtNum(Number(today?.open ?? 0)) }}
        </div>
      </div>
      <div class="kpi" style="padding: var(--sp-4) var(--sp-5);">
        <div class="kpi__label" style="margin-bottom: 6px;">
          {{ t('Cancelled') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;" />
        <div v-else class="kpi__value" style="font-size: var(--fs-h1); line-height: var(--lh-h1); color: var(--error);">
          {{ fmtNum(Number(today?.cancelled ?? 0)) }}
        </div>
      </div>
      <div class="kpi" style="padding: var(--sp-4) var(--sp-5);">
        <div class="kpi__label" style="margin-bottom: 6px;">
          {{ t('Paid') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;" />
        <div v-else class="kpi__value" style="font-size: var(--fs-h1); line-height: var(--lh-h1); color: var(--success);">
          {{ paidPct }}%
        </div>
        <div v-if="!loading && today" class="kpi__subtext" style="margin-top: 4px;">
          {{ today.paid_orders ?? 0 }} / {{ today.orders ?? 0 }}
        </div>
      </div>
      <div class="kpi" style="padding: var(--sp-4) var(--sp-5);">
        <div class="kpi__label" style="margin-bottom: 6px;">
          {{ t('Clocked In') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;" />
        <div v-else class="kpi__value" style="font-size: var(--fs-h1); line-height: var(--lh-h1); color: var(--primary);">
          {{ fmtNum(clockedIn.length) }}
        </div>
      </div>
    </div>

    <!-- ===== Revenue trend + payment mix ===== -->
    <div class="grid" style="grid-template-columns: 1.7fr 1fr; margin-bottom: var(--sp-5);">
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label" style="margin-bottom: 3px;">
              {{ t('Revenue vs expenses · last 14 days') }}
            </div>
            <h3 class="card__insight">
              {{ revenueInsight }}
            </h3>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="skel" :style="`height:${LINE_H}px;border-radius:10px;`" />
          <div v-else-if="!revenueTrend.length" class="statefill" :style="`height:${LINE_H}px;`">
            <div class="statefill__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /></svg>
            </div>
            <div class="statefill__title">
              {{ t('No data for this range') }}
            </div>
          </div>
          <div v-else ref="lineEl" style="position:relative;">
            <svg :width="LINE_W" :height="LINE_H" style="display:block;">
              <defs>
                <linearGradient :id="lineGradId" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--chart-revenue)" stop-opacity="0.18" />
                  <stop offset="100%" stop-color="var(--chart-revenue)" stop-opacity="0" />
                </linearGradient>
              </defs>

              <!-- gridlines + Y-axis labels -->
              <g v-for="(tv, i) in lineTicks.ticks" :key="`lg${i}`">
                <line :x1="LINE_PAD_L" :x2="LINE_W - LINE_PAD_R" :y1="lineY(tv)" :y2="lineY(tv)" stroke="var(--chart-grid)" stroke-width="1" />
                <text :x="LINE_PAD_L - 10" :y="lineY(tv) + 4" text-anchor="end" font-size="11" fill="var(--chart-axis)" font-family="var(--font-mono)">{{ fmtAbbr(tv) }}</text>
              </g>

              <!-- target reference line (dashed) -->
              <g v-if="revenueTarget > 0">
                <line :x1="LINE_PAD_L" :x2="LINE_W - LINE_PAD_R" :y1="lineY(revenueTarget)" :y2="lineY(revenueTarget)" stroke="var(--chart-target)" stroke-width="1.5" stroke-dasharray="5 4" />
                <text :x="LINE_W - LINE_PAD_R" :y="lineY(revenueTarget) - 6" text-anchor="end" font-size="11" font-weight="600" fill="var(--chart-target)">{{ t('Daily target') }} {{ fmtAbbr(revenueTarget) }}</text>
              </g>

              <!-- area + lines -->
              <path :d="linePaths.revArea" :fill="`url(#${lineGradId})`" />
              <path :d="linePaths.revLine" fill="none" stroke="var(--chart-revenue)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
              <path :d="linePaths.expLine" fill="none" stroke="var(--chart-expense)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

              <!-- crosshair + hover dots -->
              <g v-if="lineHover !== null">
                <line :x1="lineX(lineHover, lineSeries.labels.length)" :x2="lineX(lineHover, lineSeries.labels.length)" :y1="LINE_PAD_T" :y2="LINE_PAD_T + lineIH" stroke="var(--border-strong)" stroke-width="1" />
                <circle :cx="lineX(lineHover, lineSeries.labels.length)" :cy="lineY(lineSeries.revenue[lineHover])" r="4.5" fill="var(--surface)" stroke="var(--chart-revenue)" stroke-width="2.5" />
                <circle :cx="lineX(lineHover, lineSeries.labels.length)" :cy="lineY(lineSeries.expense[lineHover])" r="4.5" fill="var(--surface)" stroke="var(--chart-expense)" stroke-width="2.5" />
              </g>

              <!-- x-axis labels (every Nth + last) -->
              <template v-for="(c, i) in lineSeries.labels" :key="`lx${i}`">
                <text v-if="i % lineLabelEvery === 0 || i === lineSeries.labels.length - 1" :x="lineX(i, lineSeries.labels.length)" :y="LINE_H - 8" text-anchor="middle" font-size="11" fill="var(--chart-axis)">{{ c }}</text>
              </template>

              <!-- hover hit-zones -->
              <rect
                v-for="(_c, i) in lineSeries.labels"
                :key="`lh${i}`"
                :x="lineX(i, lineSeries.labels.length) - lineIW / lineSeries.labels.length / 2"
                :y="LINE_PAD_T"
                :width="lineIW / lineSeries.labels.length"
                :height="lineIH"
                fill="transparent"
                @mouseenter="lineHover = i"
                @mouseleave="lineHover = null"
              />
            </svg>

            <div class="chart-legend" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
              <span class="legend-item">
                <span class="legend-swatch" style="background: var(--chart-revenue);" />
                {{ t('Revenue') }} <b>{{ fmtMoney(revenueLatest) }}</b>
              </span>
              <span class="legend-item">
                <span class="legend-swatch" style="background: var(--chart-expense);" />
                {{ t('Expenses') }} <b>{{ fmtMoney(expenseLatest) }}</b>
              </span>
              <span v-if="revenueTarget > 0" class="legend-item">
                <span class="legend-swatch" style="background: var(--chart-target);" />
                {{ t('Daily target') }} <b>{{ fmtMoney(revenueTarget) }}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Payment mix · donut -->
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label" style="margin-bottom: 3px;">
              {{ t('Payment mix · today') }}
            </div>
            <h3 class="card__insight">
              {{ paymentInsight }}
            </h3>
            <div class="card__sub">
              {{ t('Share of paid revenue by method') }}
            </div>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="skel" :style="`width:${DONUT_SIZE}px;height:${DONUT_SIZE}px;border-radius:50%;margin:0 auto;`" />
          <div v-else-if="!paymentMix.length" class="statefill" :style="`height:${DONUT_SIZE}px;`">
            <div class="statefill__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /></svg>
            </div>
            <div class="statefill__title">
              {{ t('No data for this range') }}
            </div>
          </div>
          <div v-else class="row" style="gap: 24px; align-items: center; flex-wrap: wrap;">
            <div style="position: relative; flex: 0 0 auto;">
              <svg :width="DONUT_SIZE" :height="DONUT_SIZE">
                <path
                  v-for="(a, i) in donutArcs"
                  :key="`da${i}`"
                  :d="a.path"
                  :fill="a.d.color"
                  :opacity="donutHover !== null && donutHover !== i ? 0.4 : 1"
                  :style="`transition: opacity .12s; cursor: default; transform-origin: ${DONUT_SIZE / 2}px ${DONUT_SIZE / 2}px; transform: ${donutHover === i ? 'scale(1.03)' : 'scale(1)'};`"
                  @mouseenter="donutHover = i"
                  @mouseleave="donutHover = null"
                />
                <text :x="DONUT_SIZE / 2" :y="DONUT_SIZE / 2 - 4" class="donut-center donut-center__v" font-size="22">{{ fmtAbbr(paymentTotal) }}</text>
                <text :x="DONUT_SIZE / 2" :y="DONUT_SIZE / 2 + 16" class="donut-center donut-center__l" font-size="11">{{ t('Collected') }}</text>
              </svg>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 160px;">
              <div
                v-for="(a, i) in donutArcs"
                :key="`dl${i}`"
                class="row between"
                :style="{ opacity: donutHover !== null && donutHover !== i ? 0.5 : 1, transition: 'opacity .12s' }"
                @mouseenter="donutHover = i"
                @mouseleave="donutHover = null"
              >
                <span class="legend-item">
                  <span class="legend-swatch" :style="{ background: a.d.color }" />
                  {{ a.d.label }}
                </span>
                <span class="row" style="gap: 8px;">
                  <b class="mono" style="font-size: var(--fs-sm);">{{ fmtAbbr(a.d.value) }}</b>
                  <span class="tertiary mono" style="font-size: var(--fs-label); width: 38px; text-align: right;">{{ a.pct }}%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Orders by hour + top products ===== -->
    <div class="grid" style="grid-template-columns: 1.4fr 1fr; margin-bottom: var(--sp-5);">
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label" style="margin-bottom: 3px;">
              {{ t('Orders by hour · today') }}
            </div>
            <h3 class="card__insight">
              {{ ordersByHourInsight }}
            </h3>
            <div class="card__sub">
              {{ t('{n} orders across the day', { n: ordersByHourTotal }) }}
            </div>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="skel" :style="`height:${BAR_H}px;border-radius:10px;`" />
          <div v-else-if="!ordersByHour.length" class="statefill" :style="`height:${BAR_H}px;`">
            <div class="statefill__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /></svg>
            </div>
            <div class="statefill__title">
              {{ t('No data for this range') }}
            </div>
          </div>
          <div v-else ref="barEl" style="position:relative;">
            <svg :width="BAR_W" :height="BAR_H" style="display:block;">
              <g v-for="(tv, i) in barTicks.ticks" :key="`bg${i}`">
                <line :x1="BAR_PAD_L" :x2="BAR_W - BAR_PAD_R" :y1="barY(tv)" :y2="barY(tv)" stroke="var(--chart-grid)" stroke-width="1" />
                <text :x="BAR_PAD_L - 9" :y="barY(tv) + 4" text-anchor="end" font-size="11" fill="var(--chart-axis)" font-family="var(--font-mono)">{{ Math.round(tv) }}</text>
              </g>
              <g v-for="(d, i) in ordersByHour" :key="`b${i}`">
                <rect
                  :x="BAR_PAD_L + barBand * i + (barBand - barWidth) / 2"
                  :y="barY(Number(d.orders) || 0)"
                  :width="barWidth"
                  :height="Math.max(((Number(d.orders) || 0) / (barTicks.top || 1)) * barIH, 1)"
                  rx="4"
                  :fill="d.peak ? 'var(--chart-revenue)' : (barHover === i ? 'var(--primary-hover)' : 'var(--c4)')"
                  :opacity="barHover !== null && barHover !== i && !d.peak ? 0.55 : 1"
                  style="transition: opacity .12s;"
                />
                <text
                  v-if="d.peak"
                  :x="BAR_PAD_L + barBand * i + barBand / 2"
                  :y="barY(Number(d.orders) || 0) - 7"
                  text-anchor="middle"
                  font-size="11"
                  font-weight="700"
                  fill="var(--chart-revenue)"
                >{{ d.orders }}</text>
                <text
                  :x="BAR_PAD_L + barBand * i + barBand / 2"
                  :y="BAR_H - 9"
                  text-anchor="middle"
                  font-size="11"
                  fill="var(--chart-axis)"
                >{{ d.label }}</text>
                <rect
                  :x="BAR_PAD_L + barBand * i"
                  :y="BAR_PAD_T"
                  :width="barBand"
                  :height="barIH"
                  fill="transparent"
                  @mouseenter="barHover = i"
                  @mouseleave="barHover = null"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>

      <!-- Top products HBar -->
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label" style="margin-bottom: 3px;">
              {{ t('Top products · today') }}
            </div>
            <h3 class="card__insight">
              {{ topProductInsight }}
            </h3>
            <div class="card__sub">
              {{ t('By revenue contribution') }}
            </div>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" style="display: flex; flex-direction: column; gap: 16px;">
            <div v-for="i in 5" :key="`hs${i}`" class="skel" style="height:26px;" />
          </div>
          <div v-else-if="!topProductsForChart.length" class="statefill">
            <div class="statefill__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /></svg>
            </div>
            <div class="statefill__title">
              {{ topProductInsight }}
            </div>
          </div>
          <div v-else style="display: flex; flex-direction: column; gap: 14px;">
            <div v-for="(d, i) in topProductsForChart" :key="`hp${i}`">
              <div class="row between" style="margin-bottom: 6px;">
                <span style="font-weight: 500; font-size: var(--fs-sm); display: flex; align-items: center; gap: 7px;">
                  <svg v-if="i === 0" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="color: var(--warning);"><path d="M12 2L14.6 8.6 21.5 9.1 16.2 13.5 17.8 20.3 12 16.7 6.2 20.3 7.8 13.5 2.5 9.1 9.4 8.6Z" /></svg>
                  {{ d.name }}
                  <span v-if="d.units" class="tertiary" style="font-size: var(--fs-label);">· {{ t('{n} units', { n: d.units }) }}</span>
                </span>
                <span class="mono" style="font-weight: 700; font-size: var(--fs-sm);">{{ fmtAbbr(d.value) }}</span>
              </div>
              <div style="height: 10px; border-radius: 99px; background: var(--chart-track); overflow: hidden;">
                <div :style="{
                  width: `${(d.value / topProductMax) * 100}%`,
                  height: '100%',
                  borderRadius: '99px',
                  background: i === 0 ? 'var(--chart-revenue)' : 'var(--c4)',
                  transition: 'width .5s cubic-bezier(.2,.8,.3,1)',
                }" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Recent orders + side column ===== -->
    <div class="grid" style="grid-template-columns: 1.7fr 1fr;">
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
          <div class="card__actions">
            <button class="btn btn--ghost btn--sm" @click="router.push('/orders')">
              {{ t('View all') }}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        </div>
        <div class="card__divider" />
        <div v-if="recentOrdersLoading" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <div v-for="i in 5" :key="`ros${i}`" class="skel" style="height:18px;" />
        </div>
        <div v-else-if="!recentOrders.length" class="statefill">
          <div class="statefill__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>
          </div>
          <div class="statefill__title">
            {{ t('No orders today yet') }}
          </div>
        </div>
        <table v-else class="dtable">
          <thead>
            <tr>
              <th>{{ t('Order') }}</th>
              <th>{{ t('Type') }}</th>
              <th>{{ t('Status') }}</th>
              <th>{{ t('Payment') }}</th>
              <th class="num">
                {{ t('Total') }}
              </th>
              <th class="num">
                {{ t('Time') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in recentOrders" :key="o.id">
              <td class="cell-strong mono">
                #{{ o.display_id ?? o.id }}
              </td>
              <td>
                <span class="badge t-neutral">{{ titleCase(o.order_type ?? 'HALL') }}</span>
              </td>
              <td>
                <span class="badge badge--dot" :class="`t-${statusTone(o.status)}`">{{ titleCase(o.status) }}</span>
              </td>
              <td>
                <span class="badge" :class="`t-${statusTone(o.is_paid ? 'PAID' : 'UNPAID')}`">{{ o.is_paid ? t('Paid') : t('UNPAID') }}</span>
              </td>
              <td class="num mono cell-strong">
                {{ fmtMoney(Number(o.total_amount) || 0) }}
              </td>
              <td class="num mono cell-muted">
                {{ fmtTime(o.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Side column: Clocked in + Low stock -->
      <div style="display: flex; flex-direction: column; gap: var(--sp-5);">
        <div class="card">
          <div class="card__head" style="padding-bottom: var(--sp-3);">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Clocked in') }}
              </h3>
            </div>
            <span class="badge t-primary">{{ t('{n} active', { n: clockedIn.length }) }}</span>
          </div>
          <div class="card__body" style="padding-top: 0;">
            <div v-if="loading" style="display: flex; flex-direction: column; gap: 10px;">
              <div v-for="i in 2" :key="`cs${i}`" class="skel" style="height:40px;" />
            </div>
            <div v-else-if="!clockedIn.length" class="statefill">
              <div class="statefill__icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
              </div>
              <div class="statefill__title">
                {{ t('No one on shift') }}
              </div>
            </div>
            <div v-for="c in clockedIn" v-else :key="c.shift_id ?? c.name" class="row" style="padding: 8px 0; gap: 12px;">
              <div class="avatar avatar--sm">
                {{ initial(c.name) }}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 14px;">
                  {{ c.name }}
                </div>
                <div class="tertiary" style="font-size: 12px;">
                  {{ t('Since') }} {{ fmtDateTime(c.start_time) }}
                </div>
              </div>
              <span class="badge t-success badge--dot">{{ t('On shift') }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head" style="padding-bottom: var(--sp-3);">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Low stock') }}
              </h3>
            </div>
            <span class="badge t-warning">{{ t('{n} items', { n: lowStockCount }) }}</span>
          </div>
          <div class="card__body" style="padding-top: 0;">
            <div v-if="loading" style="display: flex; flex-direction: column; gap: 10px;">
              <div v-for="i in 3" :key="`ls${i}`" class="skel" style="height:28px;" />
            </div>
            <div v-else-if="!lowStockItems.length" class="statefill">
              <div class="statefill__icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>
              </div>
              <div class="statefill__title">
                {{ t('No low-stock items') }}
              </div>
            </div>
            <div v-for="s in lowStockItems" v-else :key="s.id" class="row between" style="padding: 9px 0; border-bottom: 1px solid var(--border);">
              <span style="font-weight: 500; font-size: 14px;">{{ s.name }}</span>
              <span class="row" style="gap: 10px;">
                <span class="mono" style="color: var(--warning); font-weight: 600; font-size: 13px;">{{ fmtNum(s.level) }} {{ s.unit }}</span>
                <span class="tertiary" style="font-size: 12px;">/ {{ fmtNum(s.reorder) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
  layout: design
</route>

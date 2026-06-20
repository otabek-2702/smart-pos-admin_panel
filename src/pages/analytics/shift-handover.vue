<script setup lang="ts">
/* ============================================================
   ANALYTICS · SHIFT HANDOVER REPORT
   Ported 1:1 from .tmp-alpha-design/alpha-design-source/Analytics.ShiftHandover.jsx
   Plain HTML + design-shell.css. Inline SVG charts (Donut, Bar,
   HBar) — no Vuetify components on this page.
   ============================================================ */
import axios from '@/plugins/axios'
import { STATUS_TONE } from '@/constants/statusTones'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()
const route = useRoute()
const router = useRouter()

// ============================================================
// Existing data wiring (UNCHANGED)
// ============================================================
const shiftIdInput = ref<number | null>(Number(route.query.shift) || null)
const data = ref<any>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)
const exporting = ref(false)

async function load() {
  loadError.value = null
  if (!shiftIdInput.value) {
    data.value = null
    return
  }
  loading.value = true
  try {
    const res = await axios.get(`/analytics/shifts/${shiftIdInput.value}/report`)
    data.value = res.data?.data ?? res.data
    router.replace({ query: { ...route.query, shift: String(shiftIdInput.value) } })
  }
  catch (e: any) {
    const msg = e?.response?.data?.message ?? t('Failed to load')
    notify(msg, 'error')
    loadError.value = msg
    data.value = null
  }
  finally {
    loading.value = false
  }
}

async function doExport() {
  if (!shiftIdInput.value || exporting.value) return
  exporting.value = true
  try {
    const res = await axios.get(
      `/analytics/shifts/${shiftIdInput.value}/report/export`,
      { responseType: 'blob' },
    )
    const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shift-${shiftIdInput.value}-handover.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    notify(t('Export downloaded'), 'success')
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Export failed'), 'error')
  }
  finally {
    exporting.value = false
  }
}

onMounted(load)
watch(shiftIdInput, load)

const shift = computed<any>(() => data.value?.shift)
const receipts = computed<any[]>(() => data.value?.receipts ?? [])
const products = computed<any[]>(() => data.value?.products ?? [])
const distribution = computed<any>(() => data.value?.distribution)
const settlement = computed<any[]>(() => data.value?.settlement ?? [])
const cashExpenses = computed<any[]>(() => data.value?.cash_expenses ?? [])
const cashExpensesTotal = computed(() =>
  cashExpenses.value.reduce((acc, e: any) => acc + Number(e.total || 0), 0),
)
function settlementDiffColor(diff: string | number): string {
  const n = Number(diff)
  if (Math.abs(n) < 0.01) return 'success'
  return n < 0 ? 'error' : 'warning'
}

function fmtSec(s: number | null | undefined): string {
  if (!s && s !== 0) return '—'
  const m = Math.floor((s as number) / 60)
  const sec = (s as number) % 60
  return `${m}m ${sec}s`
}

// ============================================================
// Number formatters (mirror bundle Fmt helpers)
// NB = U+202F narrow no-break space — kept literal per convention
// ============================================================
const NB = ' '
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const neg = Number(n) < 0
  const s = Math.round(Math.abs(Number(n))).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB)
  return (neg ? '−' : '') + s
}
function fmtMoney(n: number | null | undefined): string { return fmtNum(n) }
function fmtAbbr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  const a = Math.abs(v)
  const trim2 = (x: number) => x.toFixed(2).replace(/\.?0+$/, '')
  const trim1 = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  let out: string
  if (a >= 1e9) out = `${trim2(a / 1e9)}B`
  else if (a >= 1e6) out = `${trim2(a / 1e6)}M`
  else if (a >= 1e3) out = `${trim1(a / 1e3)}K`
  else out = String(Math.round(a))
  return (v < 0 ? '−' : '') + out
}
function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toFixed(digits).replace(/\.0$/, '')}%`
}

// ============================================================
// Status / tone maps — shared map at @/constants/statusTones
// ============================================================
function tone(v: string | undefined | null): string {
  if (!v) return 'neutral'
  return STATUS_TONE[String(v).toUpperCase()] || 'neutral'
}
function titleCase(v: any): string {
  if (!v) return '—'
  const s = String(v)
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
function reconTone(rec: any): string {
  if (!rec) return 'neutral'
  if (rec.is_short) return 'error'
  if (rec.is_over) return 'warning'
  return 'success'
}

// ============================================================
// Payment mix → donut data (kept logic identical, palette mirrors bundle)
// ============================================================
const PAYMENT_COLORS: Record<string, string> = {
  CASH: 'var(--c1)',
  UZCARD: 'var(--c2)',
  HUMO: 'var(--c3)',
  PAYME: 'var(--c4)',
  MIXED: 'var(--c5)',
}
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UZCARD: 'Uzcard',
  HUMO: 'Humo',
  PAYME: 'Payme',
  MIXED: 'Mixed',
}
const paymentMix = computed(() => {
  const mix = shift.value?.money?.payment_mix ?? {}
  return Object.keys(PAYMENT_COLORS)
    .map(k => ({
      key: k,
      label: k === 'CASH' ? t('Cash') : PAYMENT_LABELS[k],
      value: Number(mix[k] || 0),
      color: PAYMENT_COLORS[k],
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)
})
const paymentTotal = computed(() => paymentMix.value.reduce((a, b) => a + b.value, 0))
const paymentInsight = computed(() => {
  if (!paymentMix.value.length) return t('No paid orders yet')
  const total = paymentTotal.value || 1
  const top = paymentMix.value[0]
  return t('{name} leads at {pct}%', { name: top.label, pct: Math.round((top.value / total) * 100) })
})

// ============================================================
// Orders-by-hour bar data
// ============================================================
const byHour = computed<any[]>(() => {
  const series = distribution.value?.by_hour ?? []
  const maxV = series.reduce((m: number, b: any) => Math.max(m, Number(b.orders) || 0), 0)
  return series.map((b: any) => ({
    label: `${String(b.hour).padStart(2, '0')}:00`,
    value: Number(b.orders) || 0,
    peak: Number(b.orders) === maxV && maxV > 0,
  }))
})
const peakHourLabel = computed<string | null>(() => {
  const p = byHour.value.find(b => b.peak)
  if (p) return p.label
  if (data.value?.peak_hour !== undefined && data.value?.peak_hour !== null)
    return `${String(data.value.peak_hour).padStart(2, '0')}:00`
  return null
})

// ============================================================
// Top products (HBar)
// ============================================================
const topProductsForChart = computed(() =>
  products.value.slice(0, 8).map((p: any) => ({
    name: p.name,
    value: Number(p.revenue) || 0,
    units: Number(p.units_sold) || 0,
  })),
)
const topProductMax = computed(() => Math.max(1, ...topProductsForChart.value.map(p => p.value)))

// ============================================================
// niceTicks utility (verbatim port from charts.jsx)
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
// BarChart geometry (orders by hour)
// padL 44, padR 12, padT 14, padB 28, height 236 (per source)
// ============================================================
const BAR_PAD_L = 44
const BAR_PAD_R = 12
const BAR_PAD_T = 14
const BAR_PAD_B = 28
const BAR_H = 236
const BAR_W = ref(700)
const barEl = ref<HTMLElement | null>(null)
const barHover = ref<number | null>(null)

watch(barEl, (el, _old, onCleanup) => {
  if (!el) return
  const ro = new ResizeObserver((es) => {
    const e = es[0]
    if (e) BAR_W.value = e.contentRect.width
  })
  ro.observe(el)
  BAR_W.value = el.clientWidth
  onCleanup(() => ro.disconnect())
}, { flush: 'post', immediate: true })

const barMax = computed(() => Math.max(1, ...byHour.value.map(d => d.value)))
const barTicks = computed(() => niceTicks(barMax.value, 4))
const barIW = computed(() => Math.max(10, BAR_W.value - BAR_PAD_L - BAR_PAD_R))
const barIH = BAR_H - BAR_PAD_T - BAR_PAD_B
const barBand = computed(() => barIW.value / Math.max(1, byHour.value.length))
const barWidth = computed(() => Math.min(barBand.value * 0.62, 40))
function barY(v: number): number {
  return BAR_PAD_T + barIH - (v / (barTicks.value.top || 1)) * barIH
}

// ============================================================
// Donut geometry (payment mix) — size 188 per source
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
// Entrance animations (parity with bundle anim.jsx::useShown)
// ============================================================
const barShown = useShown(120)
const donutShown = useShown(120)
const hbarShown = useShown(140)

// ============================================================
// Header KPIs — count-ups
// ============================================================
const revenueT = computed(() => Number(shift.value?.money?.revenue ?? 0))
const cashT = computed(() => Number(shift.value?.money?.cash ?? 0))
const cardT = computed(() => Number(shift.value?.money?.card ?? 0))
const aovT = computed(() => Number(shift.value?.money?.avg_order_value ?? 0))
const revenueCounted = useCountUp(revenueT)
const cashCounted = useCountUp(cashT)
const cardCounted = useCountUp(cardT)
const aovCounted = useCountUp(aovT)

const cashPctOfRevenue = computed(() => {
  const r = revenueT.value
  return r > 0 ? Math.round((cashT.value / r) * 100) : 0
})
const cardPctOfRevenue = computed(() => {
  const r = revenueT.value
  return r > 0 ? Math.round((cardT.value / r) * 100) : 0
})

function initialsOf(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase()
}
function shiftDurationLabel(): string {
  const dm = Number(shift.value?.duration_minutes || 0)
  const h = Math.floor(dm / 60)
  const m = dm % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
</script>

<template>
  <div class="page">
    <!-- ===== Page head ===== -->
    <div class="page__head">
      <div style="min-width:0;">
        <h1 class="page__title">
          {{ t('Shift Handover Report') }}
        </h1>
        <div class="page__subtitle">
          {{ t('Per-shift performance, payments and punctuality') }}
        </div>
      </div>
      <div class="page__head-actions">
        <div class="field" style="width:130px;">
          <div class="field__label">
            {{ t('Shift ID') }}
          </div>
          <div class="control">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              v-model.number="shiftIdInput"
              type="number"
              :placeholder="t('Enter shift id')"
              :disabled="loading"
              @keydown.enter="load"
            >
          </div>
        </div>
        <button class="btn btn--primary" :class="{ 'is-loading': loading }" :disabled="loading" style="align-self:flex-end;" @click="load">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>
          {{ t('Load') }}
        </button>
      </div>
    </div>

    <!-- ===== Empty / loading boot ===== -->
    <div v-if="!shift && !loading && loadError" class="card">
      <div class="statefill" style="padding: 64px 24px;">
        <div class="statefill__icon" style="color: var(--error);">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <div class="statefill__title">
          {{ t('Could not load shift report') }}
        </div>
        <div class="statefill__sub">
          {{ loadError }}
        </div>
        <div class="row" style="gap:10px; margin-top:18px; justify-content:center; flex-wrap:wrap;">
          <button class="btn btn--primary" :class="{ 'is-loading': loading }" :disabled="loading" @click="load">
            {{ t('Retry') }}
          </button>
          <button class="btn btn--secondary" @click="router.push('/shifts-analytics')">
            {{ t('Browse shifts') }}
          </button>
        </div>
      </div>
    </div>
    <div v-else-if="!shift && !loading" class="card">
      <div class="statefill" style="padding: 64px 24px;">
        <div class="statefill__icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        </div>
        <div class="statefill__title">
          {{ t('Pick a shift to load the handover report') }}
        </div>
        <div class="statefill__sub">
          {{ t('Enter a shift ID above and press Load') }}
        </div>
        <div class="row" style="gap:10px; margin-top:18px; justify-content:center; flex-wrap:wrap;">
          <button class="btn btn--secondary" @click="router.push('/shifts-analytics')">
            {{ t('Browse shifts') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="loading && !shift" class="card">
      <div class="card__body" style="padding: var(--sp-5);">
        <div class="skel" style="height:120px;border-radius:10px;margin-bottom:var(--sp-5);" />
        <div class="grid cols-4" style="margin-bottom:var(--sp-5);">
          <div v-for="i in 4" :key="`bs${i}`" class="skel" style="height:118px;border-radius:10px;" />
        </div>
        <div class="skel" style="height:300px;border-radius:10px;" />
      </div>
    </div>

    <template v-else-if="shift">
      <!-- ===== Shift summary banner ===== -->
      <div class="card" style="margin-bottom:var(--sp-5);">
        <div class="row between" style="padding:var(--sp-5); flex-wrap:wrap; gap:16px;">
          <div class="row" style="gap:16px;">
            <div class="avatar" style="width:48px;height:48px;flex-basis:48px;font-size:17px;">
              {{ initialsOf(data?.cashier?.name) }}
            </div>
            <div>
              <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap;">
                <span style="font-size:var(--fs-h2); font-weight:700; letter-spacing:-0.01em;">{{ data?.cashier?.name ?? t('Unknown') }}</span>
                <span class="badge badge--dot" :class="`t-${tone(shift.status)}`">{{ titleCase(shift.status) }}</span>
              </div>
              <div class="muted" style="font-size:13px;margin-top:2px;">
                {{ t('Shift') }} #{{ shiftIdInput }} · {{ formatDate(shift.start_time) }} —
                {{ shift.end_time ? formatDate(shift.end_time) : t('in progress') }} ·
                {{ shiftDurationLabel() }}
              </div>
            </div>
          </div>
          <div class="row" style="gap:28px; flex-wrap:wrap;">
            <div style="text-align:right;">
              <div class="kpi__label">
                {{ t('Receipts') }}
              </div>
              <div class="mono" style="font-size:20px;font-weight:700;margin-top:2px;color:var(--text);max-width:180px;">
                {{ fmtNum(data?.receipt_count) }}
              </div>
            </div>
            <div style="text-align:right;">
              <div class="kpi__label">
                {{ t('Avg / hour') }}
              </div>
              <div class="mono" style="font-size:20px;font-weight:700;margin-top:2px;color:var(--text);max-width:180px;">
                {{ Number(shift.speed?.orders_per_hour ?? 0).toFixed(1) }}
              </div>
            </div>
            <div v-if="data?.best_seller" style="text-align:right;">
              <div class="kpi__label">
                {{ t('Top product') }}
              </div>
              <div style="font-size:15px;font-weight:700;margin-top:2px;color:var(--primary);max-width:180px;">
                {{ data.best_seller.name }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== KPI row ===== -->
      <div class="grid cols-4" style="margin-bottom:var(--sp-5);">
        <div class="kpi">
          <div class="kpi__top">
            <div class="kpi__icon t-primary">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4z" /></svg>
            </div>
            <div class="kpi__label">
              {{ t('Revenue') }}
            </div>
          </div>
          <div class="kpi__value">
            {{ fmtAbbr(revenueCounted) }}<span class="kpi__unit">UZS</span>
          </div>
          <div class="kpi__foot">
            <span class="kpi__subtext">{{ fmtAbbr(shift.money?.revenue_per_hour) }} / {{ t('h') }}</span>
          </div>
        </div>

        <div class="kpi">
          <div class="kpi__top">
            <div class="kpi__icon t-success">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1115.61 21.66" /><line x1="7" y1="6" x2="7" y2="10" /></svg>
            </div>
            <div class="kpi__label">
              {{ t('Cash') }}
            </div>
          </div>
          <div class="kpi__value">
            {{ fmtAbbr(cashCounted) }}<span class="kpi__unit">UZS</span>
          </div>
          <div class="kpi__foot">
            <span class="kpi__subtext">{{ cashPctOfRevenue }}% {{ t('of revenue') }}</span>
          </div>
        </div>

        <div class="kpi">
          <div class="kpi__top">
            <div class="kpi__icon t-info">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            </div>
            <div class="kpi__label">
              {{ t('Card') }}
            </div>
          </div>
          <div class="kpi__value">
            {{ fmtAbbr(cardCounted) }}<span class="kpi__unit">UZS</span>
          </div>
          <div class="kpi__foot">
            <span class="kpi__subtext">{{ cardPctOfRevenue }}% {{ t('of revenue') }}</span>
          </div>
        </div>

        <div class="kpi">
          <div class="kpi__top">
            <div class="kpi__icon t-neutral">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>
            </div>
            <div class="kpi__label">
              {{ t('Avg Order Value') }}
            </div>
          </div>
          <div class="kpi__value">
            {{ fmtAbbr(aovCounted) }}<span class="kpi__unit">UZS</span>
          </div>
          <div class="kpi__foot">
            <span class="kpi__subtext">{{ t('vs shift avg') }}</span>
          </div>
        </div>
      </div>

      <!-- ===== Payment mix donut + Orders by hour bar (cols-2, donut LEFT) ===== -->
      <div class="grid cols-2" style="margin-bottom:var(--sp-5);">
        <div class="card">
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label" style="margin-bottom:3px;">
                {{ t('Payment mix · this shift') }}
              </div>
              <h3 class="card__insight">
                {{ paymentInsight }}
              </h3>
              <div class="card__sub">
                {{ t('Share of collected revenue by method') }}
              </div>
            </div>
          </div>
          <div class="card__body">
            <div v-if="!paymentMix.length" class="statefill" :style="`height:${DONUT_SIZE}px;`">
              <div class="statefill__icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 3 v9 l7 4" /></svg>
              </div>
              <div class="statefill__title">
                {{ t('No paid orders yet') }}
              </div>
            </div>
            <div v-else class="row" style="gap:24px; align-items:center; flex-wrap:wrap;">
              <div style="position:relative; flex:0 0 auto;">
                <svg
                  class="donut-in"
                  :width="DONUT_SIZE"
                  :height="DONUT_SIZE"
                  :style="{ opacity: donutShown ? 1 : 0, transform: donutShown ? 'none' : 'rotate(-10deg) scale(.9)' }"
                >
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
              <div style="display:flex; flex-direction:column; gap:10px; flex:1; min-width:160px;">
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
                  <span class="row" style="gap:8px;">
                    <b class="mono" style="font-size:var(--fs-sm);">{{ fmtAbbr(a.d.value) }}</b>
                    <span class="tertiary mono" style="font-size:var(--fs-label); width:38px; text-align:right;">{{ a.pct }}%</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label" style="margin-bottom:3px;">
                {{ t('Orders by hour') }}
              </div>
              <h3 class="card__insight">
                {{ peakHourLabel ? t('Peak trade at {hour}', { hour: peakHourLabel }) : t('No orders this shift') }}
              </h3>
              <div class="card__sub">
                {{ t('Busiest window of the shift') }}
              </div>
            </div>
          </div>
          <div class="card__body">
            <div v-if="!byHour.length" class="statefill" :style="`height:${BAR_H}px;`">
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
                <g v-for="(d, i) in byHour" :key="`b${i}`">
                  <rect
                    class="bar-rise"
                    :x="BAR_PAD_L + barBand * i + (barBand - barWidth) / 2"
                    :y="barY(d.value)"
                    :width="barWidth"
                    :height="Math.max((d.value / (barTicks.top || 1)) * barIH, 1)"
                    rx="4"
                    :fill="d.peak ? 'var(--chart-revenue)' : (barHover === i ? 'var(--primary-hover)' : 'var(--c4)')"
                    :opacity="barHover !== null && barHover !== i && !d.peak ? 0.55 : 1"
                    :style="{ transition: 'opacity .12s ease, transform .6s cubic-bezier(.2,.8,.2,1)', transform: barShown ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${(0.04 + i * 0.03).toFixed(3)}s` }"
                  />
                  <text
                    v-if="d.peak"
                    :x="BAR_PAD_L + barBand * i + barBand / 2"
                    :y="barY(d.value) - 7"
                    text-anchor="middle"
                    font-size="11"
                    font-weight="700"
                    fill="var(--chart-revenue)"
                  >{{ d.value }}</text>
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
      </div>

      <!-- ===== Orders breakdown + Speed & punctuality ===== -->
      <div class="grid cols-2" style="margin-bottom:var(--sp-5);">
        <div class="card">
          <div class="card__head">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Orders breakdown') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <div class="row" style="gap:0; margin-bottom:18px;">
              <div style="flex:1;">
                <div style="font-size:12px; font-weight:600; color:var(--success); margin-bottom:4px;">
                  {{ t('Completed') }}
                </div>
                <div class="mono" style="font-size:26px; font-weight:700; letter-spacing:-0.02em;">
                  {{ fmtNum(shift.orders?.completed) }}
                </div>
              </div>
              <div style="flex:1;">
                <div style="font-size:12px; font-weight:600; color:var(--error); margin-bottom:4px;">
                  {{ t('Cancelled') }} ({{ fmtPct(shift.orders?.cancel_rate_pct, 1) }})
                </div>
                <div class="mono" style="font-size:26px; font-weight:700; letter-spacing:-0.02em;">
                  {{ fmtNum(shift.orders?.cancelled) }}
                </div>
              </div>
              <div style="flex:1;">
                <div style="font-size:12px; font-weight:600; color:var(--primary); margin-bottom:4px;">
                  {{ t('Paid') }}
                </div>
                <div class="mono" style="font-size:26px; font-weight:700; letter-spacing:-0.02em;">
                  {{ fmtNum(shift.orders?.paid) }}
                </div>
              </div>
            </div>
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Hall') }}</span>
              <span class="mono" style="font-weight:600; font-size:14px;">{{ fmtNum(shift.orders?.by_type?.hall) }}</span>
            </div>
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Delivery') }}</span>
              <span class="mono" style="font-weight:600; font-size:14px;">{{ fmtNum(shift.orders?.by_type?.delivery) }}</span>
            </div>
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Pickup') }}</span>
              <span class="mono" style="font-weight:600; font-size:14px;">{{ fmtNum(shift.orders?.by_type?.pickup) }}</span>
            </div>
            <div class="hr" style="margin:12px 0;" />
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Items') }} · {{ shift.items?.line_items }} {{ t('lines') }}</span>
              <span style="font-weight:600; font-size:14px;">{{ t('{n} units', { n: shift.items?.units_sold ?? 0 }) }}</span>
            </div>
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Discounts') }}</span>
              <span style="font-weight:600; font-size:14px;">{{ fmtMoney(shift.discounts?.total_given) }} ({{ t('{n} orders', { n: shift.discounts?.discounted_orders ?? 0 }) }})</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Speed & punctuality') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Avg prep time') }}</span>
              <span style="font-weight:600; font-size:14px;">{{ fmtSec(shift.speed?.avg_prep_seconds) }}</span>
            </div>
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Orders / hour') }}</span>
              <span class="mono" style="font-weight:600; font-size:14px;">{{ Number(shift.speed?.orders_per_hour ?? 0).toFixed(2) }}</span>
            </div>
            <div class="hr" style="margin:12px 0;" />
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Scheduled start') }}</span>
              <span style="font-weight:600; font-size:14px;">{{ shift.punctuality?.scheduled_start ? formatDate(shift.punctuality.scheduled_start) : '—' }}</span>
            </div>
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Actual start') }}</span>
              <span style="font-weight:600; font-size:14px;">{{ formatDate(shift.punctuality?.actual_start) }}</span>
            </div>
            <div class="row between" style="padding:7px 0;">
              <span class="muted" style="font-size:14px;">{{ t('Late') }}</span>
              <span v-if="shift.punctuality?.late_minutes !== null && shift.punctuality?.late_minutes !== undefined" style="color:var(--warning); font-weight:600; font-size:14px;">
                {{ shift.punctuality?.is_late ? `+${shift.punctuality.late_minutes}m` : t('On time') }}
              </span>
              <span v-else class="tertiary">{{ t('No schedule') }}</span>
            </div>
            <div v-if="shift.punctuality?.attendance" class="hr" style="margin:12px 0;" />
            <div v-if="shift.punctuality?.attendance">
              <div class="kpi__label" style="margin-bottom:8px;">
                {{ t('Attendance') }}
              </div>
              <div class="row between" style="padding:7px 0;">
                <span class="muted" style="font-size:14px;">{{ t('Check in') }} / {{ t('out') }}</span>
                <span style="font-weight:600; font-size:14px;">
                  {{ formatDate(shift.punctuality.attendance.check_in) }} /
                  {{ shift.punctuality.attendance.check_out ? formatDate(shift.punctuality.attendance.check_out) : '—' }}
                </span>
              </div>
              <div class="row between" style="padding:7px 0;">
                <span class="muted" style="font-size:14px;">{{ t('Work / Overtime') }}</span>
                <span class="mono" style="font-weight:600; font-size:14px;">{{ shift.punctuality.attendance.work_hours }}h / {{ shift.punctuality.attendance.overtime_hours }}h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Top products HBar + product detail table ===== -->
      <div class="grid cols-2" style="margin-bottom:var(--sp-5);">
        <div class="card">
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label" style="margin-bottom:3px;">
                {{ t('Top products · this shift') }}
              </div>
              <h3 class="card__insight">
                {{ topProductsForChart.length ? t('{name} leads revenue', { name: topProductsForChart[0].name }) : t('No sales yet') }}
              </h3>
              <div class="card__sub">
                {{ t('By revenue contribution') }}
              </div>
            </div>
            <div v-if="data?.best_seller" class="card__actions">
              <span class="badge t-success">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="margin-right:4px;"><path d="M12 2L14.6 8.6 21.5 9.1 16.2 13.5 17.8 20.3 12 16.7 6.2 20.3 7.8 13.5 2.5 9.1 9.4 8.6Z" /></svg>
                {{ data.best_seller.name }}
              </span>
            </div>
          </div>
          <div class="card__body">
            <div v-if="!topProductsForChart.length" class="statefill">
              <div class="statefill__icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /></svg>
              </div>
              <div class="statefill__title">
                {{ t('No data') }}
              </div>
            </div>
            <div v-else style="display:flex; flex-direction:column; gap:14px;">
              <div v-for="(d, i) in topProductsForChart" :key="`hp${i}`" class="hbar-row">
                <div class="row between" style="margin-bottom:6px;">
                  <span style="font-weight:500; font-size:var(--fs-sm); display:flex; align-items:center; gap:7px;">
                    <svg v-if="i === 0" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="color: var(--warning);"><path d="M12 2L14.6 8.6 21.5 9.1 16.2 13.5 17.8 20.3 12 16.7 6.2 20.3 7.8 13.5 2.5 9.1 9.4 8.6Z" /></svg>
                    {{ d.name }}
                    <span v-if="d.units" class="tertiary" style="font-size:var(--fs-label);">· {{ d.units }} {{ t('units') }}</span>
                  </span>
                  <span class="mono" style="font-weight:700; font-size:var(--fs-sm);">{{ fmtAbbr(d.value) }}</span>
                </div>
                <div style="height:10px; border-radius:99px; background:var(--chart-track); overflow:hidden;">
                  <div
                    class="hbar-fill"
                    :style="{
                      width: `${hbarShown ? (d.value / topProductMax) * 100 : 0}%`,
                      height: '100%',
                      borderRadius: '99px',
                      background: i === 0 ? 'var(--chart-revenue)' : 'var(--c4)',
                      transitionDelay: `${(0.05 + i * 0.06).toFixed(2)}s`,
                    }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Product detail') }}
              </h3>
              <div class="card__sub">
                {{ t('{n} products', { n: products.length }) }}
              </div>
            </div>
          </div>
          <div class="card__divider" />
          <div v-if="!products.length" class="statefill">
            <div class="statefill__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7L12 3 4 7v10l8 4 8-4V7z" /></svg>
            </div>
            <div class="statefill__title">
              {{ t('No products sold') }}
            </div>
          </div>
          <table v-else class="dtable">
            <thead>
              <tr>
                <th>{{ t('Name') }}</th>
                <th class="num">
                  {{ t('Units') }}
                </th>
                <th class="num">
                  {{ t('Orders') }}
                </th>
                <th class="num">
                  {{ t('Revenue') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in products" :key="p.product_id">
                <td class="cell-strong">
                  {{ p.name }}
                </td>
                <td class="num mono">
                  {{ p.units_sold }}
                </td>
                <td class="num mono cell-muted">
                  {{ p.times_sold }}
                </td>
                <td class="num mono cell-strong">
                  {{ fmtMoney(p.revenue) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ===== Reconciliation card (extra: kept from existing data layer) ===== -->
      <div v-if="shift.reconciliation" class="card" style="margin-bottom:var(--sp-5);">
        <div class="card__head">
          <div class="card__head-text">
            <h3 class="card__title">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px;color:var(--primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              {{ t('Cash Reconciliation') }}
            </h3>
            <div class="card__sub">
              {{ t('Expected vs counted cash & manager sign-off') }}
            </div>
          </div>
          <div class="card__actions">
            <span class="badge" :class="`t-${reconTone(shift.reconciliation)}`">
              <span class="mono">{{ fmtMoney(shift.reconciliation.difference) }}</span>
            </span>
          </div>
        </div>
        <div class="card__divider" />
        <div class="card__body" style="padding-top:var(--sp-5);">
          <div class="grid cols-4" style="gap:var(--sp-5);">
            <div>
              <div class="kpi__label">
                {{ t('Expected') }}
              </div>
              <div class="mono" style="font-size:20px;font-weight:700;margin-top:4px;">
                {{ fmtMoney(shift.reconciliation.expected_cash) }}
              </div>
            </div>
            <div>
              <div class="kpi__label">
                {{ t('Cashier reported') }}
              </div>
              <div class="mono" style="font-size:20px;font-weight:700;margin-top:4px;">
                {{ fmtMoney(shift.reconciliation.actual_cash) }}
              </div>
            </div>
            <div>
              <div class="kpi__label">
                {{ t('Difference') }}
              </div>
              <div class="mono" style="font-size:20px;font-weight:700;margin-top:4px;" :style="{ color: reconTone(shift.reconciliation) === 'error' ? 'var(--error)' : reconTone(shift.reconciliation) === 'warning' ? 'var(--warning)' : 'var(--success)' }">
                {{ fmtMoney(shift.reconciliation.difference) }}
              </div>
            </div>
            <div>
              <div class="kpi__label">
                {{ t('Reconciled by') }}
              </div>
              <div style="font-size:14px;font-weight:600;margin-top:4px;">
                {{ shift.reconciliation.reconciled_by }}
              </div>
              <div class="tertiary" style="font-size:12px;margin-top:2px;">
                {{ formatDate(shift.reconciliation.reconciled_at) }}
              </div>
            </div>
          </div>
          <div v-if="shift.reconciliation.notes" class="muted" style="margin-top:var(--sp-4);font-size:13px;padding-top:var(--sp-4);border-top:1px solid var(--border);">
            {{ shift.reconciliation.notes }}
          </div>
        </div>
      </div>

      <!-- ===== Per-tender settlement table (extra) ===== -->
      <div v-if="settlement.length" class="card" style="margin-bottom:var(--sp-5);">
        <div class="card__head">
          <div class="card__head-text">
            <h3 class="card__title">
              {{ t('Per-tender Settlement') }}
            </h3>
            <div class="card__sub">
              {{ t('System vs counted vs confirmed per payment method') }}
            </div>
          </div>
        </div>
        <div class="card__divider" />
        <table class="dtable">
          <thead>
            <tr>
              <th>{{ t('Method') }}</th>
              <th class="num">
                {{ t('Expected (system)') }}
              </th>
              <th class="num">
                {{ t('Cashier counted') }}
              </th>
              <th class="num">
                {{ t('Manager confirmed') }}
              </th>
              <th class="num">
                {{ t('Difference') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in settlement" :key="row.method">
              <td>
                <span class="badge" :class="`t-${tone(row.method)}`">{{ row.method }}</span>
              </td>
              <td class="num mono">
                {{ fmtMoney(row.expected) }}
              </td>
              <td class="num mono">
                {{ fmtMoney(row.counted) }}
              </td>
              <td class="num mono cell-strong">
                {{ fmtMoney(row.confirmed) }}
              </td>
              <td class="num">
                <span class="badge" :class="`t-${settlementDiffColor(row.difference)}`">
                  <span class="mono">{{ fmtMoney(row.difference) }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ===== Cash drawer expenses (extra) ===== -->
      <div v-if="cashExpenses.length" class="card" style="margin-bottom:var(--sp-5);">
        <div class="card__head">
          <div class="card__head-text">
            <h3 class="card__title">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px;color:var(--error);"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
              {{ t('Cash drawer expenses') }}
            </h3>
          </div>
          <div class="card__actions">
            <span class="mono" style="color:var(--error);font-weight:700;">−{{ fmtMoney(cashExpensesTotal) }}</span>
          </div>
        </div>
        <div class="card__divider" />
        <table class="dtable">
          <thead>
            <tr>
              <th>{{ t('Category') }}</th>
              <th class="num">
                {{ t('Count') }}
              </th>
              <th class="num">
                {{ t('Total') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in cashExpenses" :key="e.category">
              <td class="cell-strong">
                {{ e.category }}
              </td>
              <td class="num mono">
                {{ e.count }}
              </td>
              <td class="num mono" style="color:var(--error);font-weight:600;">
                −{{ fmtMoney(e.total) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ===== All receipts (.dtable) ===== -->
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <h3 class="card__title">
              {{ t('All receipts') }}
            </h3>
            <div class="card__sub">
              {{ receipts.length }} {{ t('of') }} {{ data?.receipt_count }} {{ t('shown') }}
            </div>
          </div>
          <div class="card__actions">
            <button class="btn btn--secondary btn--sm" :class="{ 'is-loading': exporting }" :disabled="exporting || !receipts.length" @click="doExport">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              {{ t('Export') }}
            </button>
          </div>
        </div>
        <div class="card__divider" />
        <div v-if="!receipts.length" class="statefill">
          <div class="statefill__icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2l-1 2-3-2-3 2-3-2-3 2-3-2z" /></svg>
          </div>
          <div class="statefill__title">
            {{ t('No receipts') }}
          </div>
        </div>
        <table v-else class="dtable">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ t('Status') }}</th>
              <th>{{ t('Type') }}</th>
              <th>{{ t('Payment') }}</th>
              <th class="num">
                {{ t('Lines') }}
              </th>
              <th class="num">
                {{ t('Units') }}
              </th>
              <th class="num">
                {{ t('Discount') }}
              </th>
              <th class="num">
                {{ t('Total') }}
              </th>
              <th>{{ t('Paid at') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in receipts" :key="r.order_id">
              <td class="cell-strong mono">
                #{{ r.display_id }}
              </td>
              <td>
                <span class="badge badge--dot" :class="`t-${tone(r.status)}`">{{ titleCase(r.status) }}</span>
              </td>
              <td>
                <span class="badge t-neutral">{{ titleCase(r.order_type) }}</span>
              </td>
              <td>
                <span class="badge" :class="`t-${tone(r.payment_method)}`">{{ r.payment_method }}</span>
              </td>
              <td class="num mono">
                {{ r.line_items }}
              </td>
              <td class="num mono">
                {{ r.units }}
              </td>
              <td class="num">
                <span v-if="Number(r.discount_amount) > 0" class="mono" style="color:var(--warning);">−{{ fmtMoney(r.discount_amount) }}</span>
                <span v-else class="cell-muted">—</span>
              </td>
              <td class="num mono cell-strong">
                {{ fmtMoney(r.total_amount) }}
              </td>
              <td class="cell-muted mono">
                {{ r.paid_at ? formatDate(r.paid_at) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Snackbar — kept as Vuetify primitive since it's a portal/overlay, not a layout element -->
    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped>
/* Animated HBar fill width */
.hbar-fill {
  transition: width .55s cubic-bezier(.2, .8, .3, 1);
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

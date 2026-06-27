<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import axiosIns from '@/plugins/axios'
import { useI18n } from 'vue-i18n'
import Card from '@/components/design/Card.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import Delta from '@/components/design/Delta.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import LineAreaChart from '@/components/design/LineAreaChart.vue'
import { fmtAbbr, fmtNum } from '@/components/design/utils/format'
import { useFormatters } from '@/composables/useFormatters'
import type { Tone } from '@/components/design/utils'
// MOCK_DASH dropped — real BE data only. /dashboard/sales endpoint pending (BACKEND_TODO item 11).
export interface ChannelDay { day: string; hall: number; delivery: number; pickup: number }

/* ============================================================
   ALPHA POS — Sales & Revenue Dashboard (v3 port)
   Source: .tmp-handoff-v3/.../pages/dash/Sales.jsx
   Dependent components (phase 2 — not yet implemented):
     - HeroKpi    → inline fallback using existing primitives
     - Bullet     → inline SVG/CSS fallback (target-vs-actual bars)
     - Heatmap    → inline SVG fallback (hour × day grid)
     - StackedBar → inline SVG fallback (channel stacks)
     - DashLoading→ inline skeleton grid
   Replace these inline blocks with proper components once phase 2 lands.
   ============================================================ */

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()

// ---------- Data shape mirroring window.DASH ----------
interface DashData {
  monthRevenue: number
  grossMargin: number
  revenue30: number[]
  expense30: number[]
  lastMonthRev: number[]
  dayLabels: string[]
  HM_DAYS: string[]
  HM_HOURS: string[]
  heatMatrix: number[][]
  channelDays: ChannelDay[]
}

const data = ref<DashData | null>(null)
const loading = ref(true)

// ---------- Hero KPI strip (4 cards) ----------
interface HeroKpiData {
  label: string
  value: number | string
  money?: boolean
  unit?: string
  delta?: number | null
  icon?: string
  tone?: Tone
  spark?: number[]
  sub?: string
}

// BE returns Decimal arrays as strings — coerce defensively.
const toNumArr = (arr: any): number[] => Array.isArray(arr) ? arr.map(v => Number(v) || 0) : []

const heroKpis = computed<HeroKpiData[]>(() => {
  const D = data.value
  if (!D) return []
  const revenue30 = toNumArr(D.revenue30)
  const expense30 = toNumArr(D.expense30)
  const lastMonth = toNumArr(D.lastMonthRev)
  const lastMonthSum = lastMonth.reduce((a, b) => a + b, 0)
  const monthRevenue = Number(D.monthRevenue) || 0
  // Diff is only meaningful if we ACTUALLY have a prior-month baseline. Otherwise
  // "+360.9M vs last month" is a confident lie — it's just the current value with
  // a green plus sign. When lastMonthSum is 0 we hide the comparison (— UZS).
  const hasLastMonth = lastMonthSum > 0
  const vsLastMonthDiff = monthRevenue - lastMonthSum
  return [
    {
      label: t('This month'),
      value: monthRevenue,
      money: true,
      unit: 'UZS',
      icon: 'wallet',
      tone: 'primary',
      spark: revenue30.slice(-14),
    },
    {
      label: t('vs last month'),
      value: hasLastMonth ? `${vsLastMonthDiff >= 0 ? '+' : ''}${fmtAbbr(vsLastMonthDiff)}` : '—',
      unit: hasLastMonth ? 'UZS' : '',
      icon: 'trend',
      tone: hasLastMonth ? (vsLastMonthDiff >= 0 ? 'success' : 'error') : 'neutral',
    },
    {
      label: t('Best day'),
      value: revenue30.length ? Math.max(...revenue30) : 0,
      money: true,
      unit: 'UZS',
      icon: 'star',
      tone: 'warning',
      sub: t('single-day record'),
    },
    {
      label: t('Expenses (30d)'),
      value: expense30.reduce((a, b) => a + b, 0),
      money: true,
      unit: 'UZS',
      icon: 'receipt',
      tone: 'error',
      spark: expense30.slice(-14),
    },
  ]
})

// ---------- Category targets (bullets) ----------
interface BulletItem {
  label: string
  value: number
  target: number
}

// Real data only — bullets stay empty until BE returns category targets
// (BACKEND_TODO item 17: category targets endpoint or extend /dashboard/sales).
const bullets = computed<BulletItem[]>(() => [])

// ---------- Revenue/Expense chart series ----------
// BE returns Decimal as string. Coerce before passing to LineAreaChart — maxV's
// loop does numeric > comparison, but '22720000' > '8085000' is lex (false), so
// the wrong peak is picked and the area path overshoots above viewBox.
const chartSeries = computed(() => {
  const D = data.value
  if (!D) return []
  return [
    { key: 'revenue', label: t('Revenue'), color: 'rgb(var(--v-theme-chart-revenue))', data: toNumArr(D.revenue30) },
    { key: 'expense', label: t('Expenses'), color: 'rgb(var(--v-theme-chart-expense))', data: toNumArr(D.expense30) },
  ]
})

// ---------- Heatmap helpers (inline fallback) ----------
const HEAT_LABEL_W = 42
const HEAT_GAP = 3
const HEAT_PAD_T = 22
const HEAT_CELL_MAX_H = 30

const heatMaxVal = computed(() => {
  const D = data.value
  if (!D) return 1
  let m = 1
  for (const row of D.heatMatrix) {
    for (const v of row) if (v > m) m = v
  }
  return m
})

function heatOpacity(v: number): number {
  if (v === 0) return 0.04
  return 0.12 + (v / heatMaxVal.value) * 0.88
}

// Peak (day, hour) computed from real heatMatrix. Headline reads "{Day} at {Hour}
// peak" instead of the previous hardcoded "Fri & Sat dinner drive volume" line.
const heatPeak = computed<{ day: string; hour: string } | null>(() => {
  const D = data.value
  if (!D?.heatMatrix?.length) return null
  let best = 0
  let row = 0
  let col = 0
  for (let r = 0; r < D.heatMatrix.length; r++) {
    const cells = D.heatMatrix[r]
    if (!cells) continue
    for (let c = 0; c < cells.length; c++) {
      const v = Number(cells[c]) || 0
      if (v > best) { best = v; row = r; col = c }
    }
  }
  if (!best) return null
  return { day: D.HM_DAYS?.[row] || '', hour: D.HM_HOURS?.[col] || '' }
})

// ---------- StackedBar helpers (inline fallback) ----------
interface ChannelSeries {
  key: 'hall' | 'delivery' | 'pickup'
  label: string
  color: string
}

const channelSeries = computed<ChannelSeries[]>(() => [
  { key: 'hall', label: t('Hall'), color: 'rgb(var(--v-theme-c1, var(--v-theme-primary)))' },
  { key: 'delivery', label: t('Delivery'), color: 'rgb(var(--v-theme-c3, var(--v-theme-warning)))' },
  { key: 'pickup', label: t('Pickup'), color: 'rgb(var(--v-theme-c2, var(--v-theme-success)))' },
])

const STACK_PAD_L = 46
const STACK_PAD_R = 12
const STACK_PAD_T = 14
const STACK_PAD_B = 30
const STACK_HEIGHT = 260

const stackTotals = computed(() => {
  const D = data.value
  if (!D) return [] as number[]
  return D.channelDays.map((d: any) => (d.values?.hall ?? 0) + (d.values?.delivery ?? 0) + (d.values?.pickup ?? 0))
})

const stackMax = computed(() => {
  const ts = stackTotals.value
  if (!ts.length) return 1
  return Math.max(1, ...ts)
})

function niceTopVal(max: number, n = 4): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] }
  const raw = max / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  let step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  step *= mag
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v)
  return { top, ticks }
}

const stackNice = computed(() => niceTopVal(stackMax.value, 4))

// ---------- Sparkline (tiny inline SVG, no chart lib) ----------
function sparkPath(values: number[], w = 96, h = 30): string {
  if (!values?.length) return ''
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  const stepX = values.length > 1 ? w / (values.length - 1) : w
  return values
    .map((v, i) => {
      const x = i * stepX
      const y = h - ((v - min) / span) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function sparkTrend(values: number[]): 'up' | 'down' | 'flat' {
  if (!values || values.length < 2) return 'flat'
  const first = values[0]
  const last = values[values.length - 1]
  if (last > first) return 'up'
  if (last < first) return 'down'
  return 'flat'
}

// ---------- Data loader ----------
async function loadDashboard() {
  loading.value = true
  try {
    const res = await axiosIns.get('/dashboard/sales', { params: { range: '30d' } })
    const raw = res.data?.data ?? res.data
    // BE channelDays shape: { day, hall, delivery, pickup }. FE stacked-bar
    // template uses { label, values: { hall, delivery, pickup } }. Adapt here
    // instead of touching N template bindings.
    const channelDays = Array.isArray(raw?.channelDays)
      ? raw.channelDays.map((d: any) => ({
          label: String(d.day || '').slice(5), // 'MM-DD'
          values: {
            hall: Number(d.hall) || 0,
            delivery: Number(d.delivery) || 0,
            pickup: Number(d.pickup) || 0,
          },
        }))
      : []
    data.value = { ...raw, channelDays }
  }
  catch {
    // Real data only — leave null so the page shows the empty state.
    data.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <div class="sales-dash">
    <!-- Loading state (DashLoading fallback) -->
    <div
      v-if="loading"
      class="sales-loading"
      style="display: flex; flex-direction: column; gap: var(--sp-6);"
    >
      <div class="grid sales-hero">
        <div
          v-for="i in 4"
          :key="`sk${i}`"
          class="herokpi"
        >
          <Skeleton :h="14" w="60%" />
          <Skeleton :h="28" w="80%" :style="{ marginTop: '14px' }" />
          <Skeleton :h="16" w="50%" :style="{ marginTop: '12px' }" />
        </div>
      </div>
      <div
        v-for="r in 2"
        :key="`skrow${r}`"
        class="grid"
        :style="{ gridTemplateColumns: r === 1 ? '1.5fr 1fr' : '1.4fr 1fr' }"
      >
        <Card
          v-for="i in 2"
          :key="`skc${r}${i}`"
          :style="{ padding: '20px' }"
        >
          <Skeleton :h="18" w="40%" />
          <Skeleton :h="240" :style="{ marginTop: '16px', borderRadius: '10px' }" />
        </Card>
      </div>
    </div>

    <!-- Loaded state -->
    <div
      v-else
      style="display: flex; flex-direction: column; gap: var(--sp-6);"
    >
      <!-- Hero KPI strip (4 columns) -->
      <div class="grid sales-hero">
        <div
          v-for="k in heroKpis"
          :key="k.label"
          class="herokpi"
        >
          <div class="herokpi__top">
            <span class="herokpi__label">{{ k.label }}</span>
            <span
              v-if="k.icon"
              class="herokpi__icon"
              :class="`t-${k.tone || 'primary'}`"
            >
              <DesignIcon :name="k.icon" :size="17" />
            </span>
          </div>
          <div class="herokpi__value">
            <template v-if="k.money && typeof k.value === 'number'">{{ formatCurrency(k.value) }}</template>
            <template v-else-if="typeof k.value === 'number'">{{ fmtNum(k.value) }}</template>
            <template v-else>{{ k.value }}</template>
            <span
              v-if="k.unit"
              class="herokpi__unit"
            >{{ k.unit }}</span>
          </div>
          <div class="herokpi__foot">
            <Delta
              v-if="k.delta !== undefined && k.delta !== null"
              :value="k.delta"
            />
            <span
              v-if="k.sub"
              class="herokpi__sub"
            >{{ k.sub }}</span>
            <span
              v-if="k.spark && k.spark.length"
              class="herokpi__spark"
            >
              <svg
                :width="96"
                :height="30"
                viewBox="0 0 96 30"
                style="display: block;"
              >
                <path
                  :d="sparkPath(k.spark)"
                  fill="none"
                  :stroke="sparkTrend(k.spark) === 'down' ? 'rgb(var(--v-theme-error))' : 'rgb(var(--v-theme-success))'"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <!-- Row 2: Revenue vs Expenses chart + Category targets bullets -->
      <div
        class="grid"
        :style="{ gridTemplateColumns: bullets.length ? '1.5fr 1fr' : '1fr' }"
      >
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Revenue vs expenses · 30 days') }}
              </div>
              <h3 class="card__insight">
                {{ t('Margin holding at {pct}%', { pct: Math.round((Number(data?.grossMargin) || 0) * 100) }) }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <LineAreaChart
              v-if="data"
              :categories="data.dayLabels"
              :series="chartSeries as any"
              :height="290"
              :y-format="fmtAbbr"
            />
            <div
              class="chart-legend"
              :style="{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgb(var(--v-theme-border))' }"
            >
              <span class="legend-item">
                <span
                  class="legend-swatch"
                  :style="{ background: 'rgb(var(--v-theme-chart-revenue))' }"
                />{{ t('Revenue') }}
              </span>
              <span class="legend-item">
                <span
                  class="legend-swatch"
                  :style="{ background: 'rgb(var(--v-theme-chart-expense))' }"
                />{{ t('Expenses') }}
              </span>
            </div>
          </div>
        </Card>

        <Card v-if="bullets.length">
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Category targets') }}
              </div>
              <h3 class="card__title">
                {{ t('Actual vs target') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <!-- Inline Bullet fallback (replace w/ <Bullet> in phase 2) -->
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div
                v-for="(it, i) in bullets"
                :key="i"
              >
                <div
                  class="row between"
                  style="margin-bottom: 6px;"
                >
                  <span style="font-size: 13px; font-weight: 600;">{{ it.label }}</span>
                  <span
                    class="row"
                    style="gap: 8px; font-size: 12px;"
                  >
                    <span
                      class="mono"
                      style="font-weight: 700;"
                    >{{ fmtAbbr(it.value) }}</span>
                    <span class="tertiary mono">/ {{ fmtAbbr(it.target) }}</span>
                    <span
                      class="badge"
                      :class="it.value >= it.target ? 't-success' : 't-warning'"
                    >{{ Math.round(it.value / it.target * 100) }}%</span>
                  </span>
                </div>
                <div
                  style="position: relative; height: 14px; background: rgb(var(--v-theme-chart-track)); border-radius: 99px;"
                >
                  <div
                    :style="{
                      position: 'absolute',
                      inset: 0,
                      width: `${Math.min(100, it.value / (Math.max(it.value, it.target) * 1.25) * 100)}%`,
                      background: it.value >= it.target ? 'rgb(var(--v-theme-success))' : 'rgb(var(--v-theme-primary))',
                      borderRadius: '99px',
                      transition: 'width .7s cubic-bezier(.2,.8,.2,1)',
                    }"
                  />
                  <div
                    :style="{
                      position: 'absolute',
                      top: '-3px',
                      bottom: '-3px',
                      left: `${Math.min(100, it.target / (Math.max(it.value, it.target) * 1.25) * 100)}%`,
                      width: '3px',
                      borderRadius: '2px',
                      background: 'rgb(var(--v-theme-on-surface))',
                      opacity: 0.55,
                    }"
                    :title="t('Actual vs target')"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Row 3: Heatmap (when sales happen) + StackedBar (by channel) -->
      <div
        class="grid"
        :style="{ gridTemplateColumns: '1.4fr 1fr' }"
      >
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('When sales happen') }}
              </div>
              <h3 v-if="heatPeak" class="card__insight">
                {{ t('Peak {day} at {hour}', { day: heatPeak.day, hour: heatPeak.hour }) }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <!-- Inline Heatmap fallback (replace w/ <Heatmap> in phase 2) -->
            <div
              v-if="data"
              class="sales-heatmap"
            >
              <div
                class="sales-heatmap__hours"
                :style="{ paddingLeft: `${HEAT_LABEL_W}px`, gap: `${HEAT_GAP}px` }"
              >
                <span
                  v-for="(h, hi) in data.HM_HOURS"
                  :key="`hh${hi}`"
                  class="sales-heatmap__hour"
                >{{ h }}</span>
              </div>
              <div
                v-for="(rLab, ri) in data.HM_DAYS"
                :key="`hr${ri}`"
                class="sales-heatmap__row"
                :style="{ gap: `${HEAT_GAP}px`, marginTop: ri === 0 ? `${HEAT_PAD_T - 16}px` : `${HEAT_GAP}px` }"
              >
                <span
                  class="sales-heatmap__day"
                  :style="{ width: `${HEAT_LABEL_W - 8}px` }"
                >{{ rLab }}</span>
                <div
                  v-for="(_cLab, ci) in data.HM_HOURS"
                  :key="`hc${ri}-${ci}`"
                  class="sales-heatmap__cell"
                  :style="{
                    background: `rgba(var(--v-theme-primary-rgb, 58, 91, 219), ${heatOpacity(data.heatMatrix[ri]?.[ci] || 0)})`,
                    maxHeight: `${HEAT_CELL_MAX_H}px`,
                  }"
                  :title="`${rLab} · ${data.HM_HOURS[ci]} — ${fmtNum(data.heatMatrix[ri]?.[ci] || 0)} ${t('orders')}`"
                />
              </div>
              <div
                class="row"
                style="gap: 8px; justify-content: flex-end; margin-top: 10px; font-size: 11px; color: rgb(var(--v-theme-text-tertiary));"
              >
                <span>{{ t('Less') }}</span>
                <span
                  v-for="(o, i) in [0.08, 0.3, 0.55, 0.8, 1]"
                  :key="`leg${i}`"
                  :style="{
                    width: '16px',
                    height: '12px',
                    borderRadius: '3px',
                    background: `rgba(var(--v-theme-primary-rgb, 58, 91, 219), ${o})`,
                  }"
                />
                <span>{{ t('More') }}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('By channel · last 7 days') }}
              </div>
              <h3 class="card__title">
                {{ t('Hall vs delivery vs pickup') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <!-- Inline StackedBar fallback (replace w/ <StackedBar> in phase 2) -->
            <div
              v-if="data"
              class="sales-stack"
            >
              <svg
                :width="'100%'"
                :height="STACK_HEIGHT"
                :viewBox="`0 0 ${Math.max(360, data.channelDays.length * 64 + STACK_PAD_L + STACK_PAD_R)} ${STACK_HEIGHT}`"
                preserveAspectRatio="none"
                style="display: block;"
              >
                <!-- gridlines + y labels -->
                <g
                  v-for="(tk, i) in stackNice.ticks"
                  :key="`gl${i}`"
                >
                  <line
                    :x1="STACK_PAD_L"
                    :x2="Math.max(360, data.channelDays.length * 64 + STACK_PAD_L + STACK_PAD_R) - STACK_PAD_R"
                    :y1="STACK_PAD_T + (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B) - (tk / stackNice.top) * (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B)"
                    :y2="STACK_PAD_T + (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B) - (tk / stackNice.top) * (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B)"
                    stroke="rgb(var(--v-theme-chart-grid))"
                    stroke-width="1"
                  />
                  <text
                    :x="STACK_PAD_L - 8"
                    :y="STACK_PAD_T + (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B) - (tk / stackNice.top) * (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B) + 4"
                    text-anchor="end"
                    font-size="11"
                    fill="rgb(var(--v-theme-chart-axis))"
                    font-family="var(--font-mono)"
                  >{{ fmtAbbr(tk) }}</text>
                </g>
                <!-- stacked bars -->
                <g
                  v-for="(d, i) in data.channelDays"
                  :key="`sb${i}`"
                >
                  <template v-for="(s, si) in channelSeries" :key="`sbs${i}${si}`">
                    <rect
                      :x="STACK_PAD_L + (Math.max(360, data.channelDays.length * 64 + STACK_PAD_L + STACK_PAD_R) - STACK_PAD_L - STACK_PAD_R) / data.channelDays.length * i + ((Math.max(360, data.channelDays.length * 64 + STACK_PAD_L + STACK_PAD_R) - STACK_PAD_L - STACK_PAD_R) / data.channelDays.length - Math.min((Math.max(360, data.channelDays.length * 64 + STACK_PAD_L + STACK_PAD_R) - STACK_PAD_L - STACK_PAD_R) / data.channelDays.length * 0.6, 46)) / 2"
                      :y="STACK_PAD_T + (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B) - (channelSeries.slice(0, si + 1).reduce((a, ss) => a + (d.values[ss.key] || 0), 0) / stackNice.top) * (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B)"
                      :width="Math.min((Math.max(360, data.channelDays.length * 64 + STACK_PAD_L + STACK_PAD_R) - STACK_PAD_L - STACK_PAD_R) / data.channelDays.length * 0.6, 46)"
                      :height="Math.max(0, ((d.values[s.key] || 0) / stackNice.top) * (STACK_HEIGHT - STACK_PAD_T - STACK_PAD_B))"
                      :fill="s.color"
                    >
                      <title>{{ d.label }} · {{ s.label }} — {{ fmtNum(d.values[s.key] || 0) }}</title>
                    </rect>
                  </template>
                  <text
                    :x="STACK_PAD_L + (Math.max(360, data.channelDays.length * 64 + STACK_PAD_L + STACK_PAD_R) - STACK_PAD_L - STACK_PAD_R) / data.channelDays.length * i + (Math.max(360, data.channelDays.length * 64 + STACK_PAD_L + STACK_PAD_R) - STACK_PAD_L - STACK_PAD_R) / data.channelDays.length / 2"
                    :y="STACK_HEIGHT - 10"
                    text-anchor="middle"
                    font-size="11"
                    fill="rgb(var(--v-theme-chart-axis))"
                  >{{ d.label }}</text>
                </g>
              </svg>
              <div
                class="chart-legend"
                style="margin-top: 12px; justify-content: center;"
              >
                <span
                  v-for="s in channelSeries"
                  :key="s.key"
                  class="legend-item"
                >
                  <span
                    class="legend-swatch"
                    :style="{ background: s.color }"
                  />{{ s.label }}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sales-dash {
  display: block;
}

.grid {
  display: grid;
  gap: var(--sp-6);
}

.sales-hero {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 1100px) {
  .sales-hero {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .sales-hero {
    grid-template-columns: 1fr;
  }
}

/* Hero KPI tile — mirrors executive.vue. */
.herokpi {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-md);
  padding: 18px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.herokpi__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.herokpi__label {
  font-size: var(--fs-label);
  color: rgb(var(--v-theme-text-secondary));
  font-weight: var(--fw-medium);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.herokpi__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-xs);
}
.herokpi__icon.t-primary {
  background: rgb(var(--v-theme-primary-weak));
  color: rgb(var(--v-theme-primary));
}
.herokpi__icon.t-info {
  background: rgb(var(--v-theme-info-weak));
  color: rgb(var(--v-theme-info-strong));
}
.herokpi__icon.t-success {
  background: rgb(var(--v-theme-success-weak));
  color: rgb(var(--v-theme-success-strong));
}
.herokpi__icon.t-warning {
  background: rgb(var(--v-theme-warning-weak));
  color: rgb(var(--v-theme-warning-strong));
}
.herokpi__icon.t-error {
  background: rgb(var(--v-theme-error-weak));
  color: rgb(var(--v-theme-error-strong));
}
.herokpi__value {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.15;
}
.herokpi__unit {
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--v-theme-text-tertiary));
  margin-left: 4px;
}
.herokpi__foot {
  display: flex;
  align-items: center;
  gap: 8px;
}
.herokpi__sub {
  font-size: 11px;
  color: rgb(var(--v-theme-text-tertiary));
}
.herokpi__spark {
  margin-left: auto;
  line-height: 0;
}

/* Card insight heading. */
.card__insight {
  margin: 0;
  font-size: var(--fs-h3);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: rgb(var(--v-theme-on-surface));
}

/* Chart legend (re-declared scoped — matches design-shell.css). */
.chart-legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-secondary));
}
.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: 0 0 10px;
}

/* Bullet — badge pills. */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 600;
}
.badge.t-success {
  color: rgb(var(--v-theme-success));
  background: rgb(var(--v-theme-success-weak));
}
.badge.t-warning {
  color: rgb(var(--v-theme-warning-strong));
  background: rgb(var(--v-theme-warning-weak));
}

/* Heatmap — inline fallback. */
.sales-heatmap {
  display: block;
}
.sales-heatmap__hours {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.sales-heatmap__hour {
  flex: 1;
  text-align: center;
  font-size: 10px;
  color: rgb(var(--v-theme-chart-axis));
  font-family: var(--font-mono);
}
.sales-heatmap__row {
  display: flex;
  align-items: center;
}
.sales-heatmap__day {
  text-align: right;
  padding-right: 8px;
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--v-theme-text-secondary));
  flex: 0 0 auto;
}
.sales-heatmap__cell {
  flex: 1;
  height: 26px;
  border-radius: 4px;
  cursor: default;
}

/* StackedBar wrapper. */
.sales-stack {
  display: block;
}

.row {
  display: flex;
  align-items: center;
}
.row.between {
  justify-content: space-between;
}
.row.wrap {
  flex-wrap: wrap;
}
.mono {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
}
.tertiary {
  color: rgb(var(--v-theme-text-tertiary));
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

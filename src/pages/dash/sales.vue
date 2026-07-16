<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import axiosIns from '@/plugins/axios'
import { useI18n } from 'vue-i18n'
import Card from '@/components/design/Card.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import Delta from '@/components/design/Delta.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import DonutChart from '@/components/design/DonutChart.vue'
import LineAreaChart from '@/components/design/LineAreaChart.vue'
import BarChart from '@/components/design/BarChart.vue'
import { fmtAbbr, fmtNum } from '@/components/design/utils/format'
import { useFormatters } from '@/composables/useFormatters'
import { useDashboardData } from '@/composables/useDashboardData'
import { buildDateParams } from '@/composables/useBusinessDay'
import { formatWindow } from '@/composables/useWindowLabel'
import type { Tone } from '@/components/design/utils'
// MOCK_DASH dropped — real BE data only. /dashboard/sales endpoint pending (BACKEND_TODO item 11).
export interface ChannelDay {
  label: string
  values: { hall: number; delivery: number; pickup: number }
}

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

const { t, locale } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()

// ---------- Data shape mirroring window.DASH ----------
interface DashData {
  monthRevenue: number
  grossMargin: number
  revenue30: number[]
  expense30: number[]
  previousRevenue: number[]
  dayLabels: string[]
  channelDays: ChannelDay[]
}

const data = ref<DashData | null>(null)
const loading = ref(true)
const isHourly = computed(() => /^\d{1,2}:\d{2}$/.test(String(data.value?.dayLabels?.[0] ?? '')))

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
  const previousRevenue = toNumArr(D.previousRevenue)
  const previousSum = previousRevenue.reduce((a, b) => a + b, 0)
  const monthRevenue = Number(D.monthRevenue) || 0
  // Diff is only meaningful if we ACTUALLY have a prior-month baseline. Otherwise
  // "+360.9M vs last month" is a confident lie — it's just the current value with
  // a green plus sign. When lastMonthSum is 0 we hide the comparison (— UZS).
  const hasPrevious = previousSum > 0
  const vsPreviousDiff = monthRevenue - previousSum
  return [
    {
      label: t('Revenue · {window}', { window: windowLabel.value }),
      value: monthRevenue,
      money: true,
      unit: 'UZS',
      icon: 'wallet',
      tone: 'primary',
      spark: revenue30.slice(-14),
    },
    {
      label: t('Change vs previous period'),
      value: hasPrevious ? `${vsPreviousDiff >= 0 ? '+' : ''}${fmtAbbr(vsPreviousDiff)}` : '—',
      unit: hasPrevious ? 'UZS' : '',
      icon: 'trend',
      tone: hasPrevious ? (vsPreviousDiff >= 0 ? 'success' : 'error') : 'neutral',
    },
    {
      label: isHourly.value ? t('Peak revenue hour') : t('Peak revenue day'),
      value: revenue30.length ? Math.max(...revenue30) : 0,
      money: true,
      unit: 'UZS',
      icon: 'star',
      tone: 'warning',
    },
    {
      label: t('Expenses · {window}', { window: windowLabel.value }),
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

// ---------- Daily orders + revenue bars (sepettakip-style per-day breakdown) ----------
// Day count comes from channelDays' hall+delivery+pickup sum, revenue from
// revenue30. Each bar carries the formatted value as a top-label.
function bucketLabel(label: string): string {
  const s = label || ''
  if (/^\d{1,2}:\d{2}$/.test(s))
    return s.padStart(5, '0')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [year, month, day] = s.split('-').map(Number)
    return new Intl.DateTimeFormat(String(locale.value), {
      day: 'numeric', month: 'short',
    }).format(new Date(year, month - 1, day))
  }
  return s
}
const ordersByDay = computed(() => {
  const D = data.value
  if (!D || !D.channelDays?.length) return [] as { label: string; value: number }[]
  return D.channelDays.map((d: any) => ({
    label: bucketLabel(d.label || ''),
    value: (d.values?.hall ?? 0) + (d.values?.delivery ?? 0) + (d.values?.pickup ?? 0),
  }))
})
const revenueByDay = computed(() => {
  const D = data.value
  if (!D) return [] as { label: string; value: number }[]
  const rev = toNumArr(D.revenue30)
  const labels = Array.isArray(D.dayLabels) ? D.dayLabels : []
  return rev.map((v, i) => ({ label: bucketLabel(labels[i] || ''), value: v }))
})

const expenseBreakdown = computed(() => {
  const D = data.value
  if (!D) return [] as { label: string; value: number }[]
  const labels = Array.isArray(D.dayLabels) ? D.dayLabels : []
  return toNumArr(D.expense30)
    .map((value, index) => ({ label: bucketLabel(labels[index] || ''), value }))
    .filter(row => row.value > 0)
    .reverse()
    .slice(0, 8)
})

const expenseListTitle = computed(() => isHourly.value
  ? t('Expense totals by hour')
  : t('Expense totals by day'))

const ordersChartTitle = computed(() => isHourly.value
  ? t('Orders by hour')
  : t('Daily orders'))

const xLabelEvery = computed(() => isHourly.value
  ? 2
  : Math.max(1, Math.ceil(ordersByDay.value.length / 12)))

const orderTypeMix = computed(() => {
  const D = data.value
  if (!D) return [] as Array<{ label: string; value: number; color: string }>
  const totals = D.channelDays.reduce((acc, row) => {
    acc.hall += Number(row.values?.hall) || 0
    acc.delivery += Number(row.values?.delivery) || 0
    acc.pickup += Number(row.values?.pickup) || 0
    return acc
  }, { hall: 0, delivery: 0, pickup: 0 })
  return [
    { label: t('Hall'), value: totals.hall, color: 'rgb(var(--v-theme-c1))' },
    { label: t('Delivery'), value: totals.delivery, color: 'rgb(var(--v-theme-c3))' },
    { label: t('Pickup'), value: totals.pickup, color: 'rgb(var(--v-theme-c2))' },
  ].filter(row => row.value > 0)
})

const orderTypeTotal = computed(() => orderTypeMix.value.reduce((sum, row) => sum + row.value, 0))

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
    const r = sharedRange.value
    const params: Record<string, string> = (r?.from && r?.to)
      ? buildDateParams({ from: r.from, to: r.to, fromTime: r.fromTime, toTime: r.toTime })
      : { range: r?.preset || '30d' }
    const from = r?.from || ''
    const to = r?.to || ''
    // An unbounded "all time" result has no fair previous period. Do not
    // accidentally compare it with the day before the browser clock.
    const canCompare = Boolean(from && to)
    const start = from ? new Date(`${from}T00:00:00`) : null
    const end = to ? new Date(`${to}T00:00:00`) : null
    const span = start && end
      ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
      : 0
    const prevTo = start ? new Date(start) : null
    prevTo?.setDate(prevTo.getDate() - 1)
    const prevFrom = prevTo ? new Date(prevTo) : null
    prevFrom?.setDate(prevFrom.getDate() - span)
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const prevParams = prevFrom && prevTo
      ? buildDateParams({ from: iso(prevFrom), to: iso(prevTo), fromTime: r?.fromTime, toTime: r?.toTime })
      : {}
    const [res, prevRes] = await Promise.all([
      axiosIns.get('/dashboard/sales', { params }),
      canCompare ? axiosIns.get('/dashboard/sales', { params: prevParams }).catch(() => null) : Promise.resolve(null),
    ])
    const raw = res.data?.data ?? res.data
    const previous = prevRes?.data?.data ?? prevRes?.data ?? {}
    // BE channelDays shape: { day, hall, delivery, pickup }. FE stacked-bar
    // template uses { label, values: { hall, delivery, pickup } }. Adapt here
    // instead of touching N template bindings.
    const channelDays = Array.isArray(raw?.channelDays)
      ? raw.channelDays.map((d: any) => ({
          label: String(d.day || ''),
          values: {
            hall: Number(d.hall) || 0,
            delivery: Number(d.delivery) || 0,
            pickup: Number(d.pickup) || 0,
          },
        }))
      : []
    data.value = { ...raw, channelDays, previousRevenue: toNumArr(previous?.revenue30) }
  }
  catch {
    // Real data only — leave null so the page shows the empty state.
    data.value = null
  }
  finally {
    loading.value = false
  }
}

// Re-fetch on hub range change.
const { range: sharedRange } = useDashboardData()
watch(sharedRange, () => { void loadDashboard() })

// Localized label for the active date-picker window, interpolated into the
// range-scoped card titles below so they stop hardcoding "· 30 days".
const windowLabel = computed(() => formatWindow(sharedRange.value, t))
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

      <!-- Row 2: Revenue vs expenses + category targets -->
      <div class="grid sales-revenue-grid">
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Revenue vs expenses · {window}', { window: windowLabel }) }}
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

      <!-- Row 3: expense summary + order-type chart. -->
      <div class="grid sales-expense-grid">
        <!-- The weekly distribution chart was removed: it did not give a reliable, range-aware insight. -->
        <Card v-if="orderTypeMix.length" class="sales-order-type">
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Order type mix · {window}', { window: windowLabel }) }}
              </div>
              <h3 class="card__title">
                {{ t('Where orders come from') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <DonutChart
              :data="orderTypeMix"
              :center-label="t('Orders')"
              :center-value="fmtNum(orderTypeTotal)"
              :size="208"
            />
          </div>
        </Card>

        <Card class="sales-expense-list">
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ expenseListTitle }}
              </div>
              <h3 class="card__title">
                {{ t('Expenses') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <div
              v-if="expenseBreakdown.length"
              class="sales-expense-list__rows"
            >
              <div
                v-for="row in expenseBreakdown"
                :key="row.label"
                class="sales-expense-list__row"
              >
                <span>{{ row.label }}</span>
                <strong class="mono">{{ formatCurrency(row.value) }}</strong>
              </div>
            </div>
            <p
              v-else
              class="muted"
              style="margin: 4px 0 0; font-size: 13px;"
            >
              {{ t('No expenses recorded') }}
            </p>
          </div>
        </Card>
      </div>

      <!-- Rows 4–5: order count and revenue each have their own row. -->
      <div
        v-if="ordersByDay.length || revenueByDay.length"
        class="grid sales-bottom-grid"
      >
        <Card v-if="ordersByDay.length">
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('{window} · order count', { window: windowLabel }) }}
              </div>
              <h3 class="card__title">
                {{ ordersChartTitle }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <BarChart
              :data="ordersByDay"
              :height="240"
              :show-labels="true"
              :value-label="t('Orders')"
              :y-format="(v: number) => String(Math.round(v))"
              :label-format="(v: number) => String(Math.round(v))"
              :x-label-every="xLabelEvery"
            />
          </div>
        </Card>
        <Card v-if="revenueByDay.length">
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('{window} · revenue', { window: windowLabel }) }}
              </div>
              <h3 class="card__title">
                {{ t('Daily revenue') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <BarChart
              :data="revenueByDay"
              :height="240"
              :show-labels="true"
              :value-label="t('Revenue')"
              :y-format="fmtAbbr"
              :label-format="fmtAbbr"
              :x-label-every="xLabelEvery"
            />
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

/* Range-aware dashboard sections. */
.sales-revenue-grid {
  grid-template-columns: minmax(0, 1.45fr) minmax(280px, .85fr);
}
.sales-expense-grid {
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr);
}
.sales-expense-list__rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sales-expense-list__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
  padding: 8px 0;
  border-bottom: 1px solid rgb(var(--v-theme-border));
  color: rgb(var(--v-theme-text-secondary));
  font-size: var(--fs-sm);
}
.sales-expense-list__row:last-child {
  border-bottom: 0;
}
.sales-expense-list__row strong {
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
}
.sales-order-type :deep(.donut-row) {
  justify-content: center;
}
.sales-bottom-grid {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 900px) {
  .sales-revenue-grid,
  .sales-expense-grid,
  .sales-bottom-grid {
    grid-template-columns: 1fr;
  }
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

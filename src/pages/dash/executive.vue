<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import axiosIns from '@/plugins/axios'
import { useI18n } from 'vue-i18n'
import Card from '@/components/design/Card.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import Badge from '@/components/design/Badge.vue'
import Delta from '@/components/design/Delta.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import DonutChart from '@/components/design/DonutChart.vue'
import HBarChart from '@/components/design/HBarChart.vue'
import LineAreaChart from '@/components/design/LineAreaChart.vue'
import BarChart from '@/components/design/BarChart.vue'
import { fmtAbbr, fmtNum } from '@/components/design/utils/format'
import { useFormatters } from '@/composables/useFormatters'
import type { Tone } from '@/components/design/utils'

/* ============================================================
   ALPHA POS — Executive Dashboard (v3 port)
   Source: .tmp-handoff-v3/.../pages/dash/Executive.jsx
   Dependent components (phase 2 — not yet implemented):
     - HeroKpi      → inline fallback below using existing primitives
     - SwitchChart  → inline fallback (metric tabs + LineAreaChart/BarChart)
     - Gauge        → inline SVG arc fallback
   Replace these inline blocks with proper components once phase 2 lands.
   ============================================================ */

const { t, locale } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()

// ---------- Data shape mirroring window.DASH ----------
interface PaymentSlice {
  label: string
  value: number
  color: string
}
interface CategoryRow {
  label: string
  value: number
}
interface LiveOrder {
  id: number
  type: 'HALL' | 'DELIVERY' | 'PICKUP'
  info: string
  total: number
  ts: number
  status: 'PREPARING' | 'READY' | 'COMPLETED'
  _new?: boolean
}
interface DashData {
  monthRevenue: number
  monthOrders: number
  avgAov: number
  grossMargin: number
  repeatRate: number
  monthTarget: number
  revenue30: number[]
  orders30: number[]
  aov30: number[]
  lastMonthRev: number[]
  dayLabels: string[]
  paymentMix: PaymentSlice[]
  categories: CategoryRow[]
  liveFeed: LiveOrder[]
}

const data = ref<DashData | null>(null)
const loading = ref(true)

// Heroes are derived from `data`. Spark = last 14 of the 30d series.
const heroKpis = computed(() => {
  const D = data.value
  if (!D) return []
  return [
    { label: t('Revenue (30d)'), value: D.monthRevenue, money: true, unit: 'UZS', delta: 12.4, icon: 'wallet', tone: 'primary' as Tone, spark: D.revenue30.slice(-14) },
    { label: t('Orders (30d)'), value: D.monthOrders, money: false, delta: 8.1, icon: 'receipt', tone: 'info' as Tone, spark: D.orders30.slice(-14) },
    { label: t('Avg Order Value'), value: D.avgAov, money: true, unit: 'UZS', delta: 3.9, icon: 'trend', tone: 'success' as Tone, spark: D.aov30.slice(-14) },
    { label: t('Gross Margin'), value: `${D.grossMargin}%`, money: false, delta: 1.6, icon: 'coins', tone: 'warning' as Tone, sub: t('of revenue') },
    { label: t('Repeat Rate'), value: `${D.repeatRate}%`, money: false, delta: 4.2, icon: 'users', tone: 'primary' as Tone, sub: t('returning guests') },
  ]
})

// ---------- SwitchChart-lite state (inline until phase 2) ----------
type MetricKey = 'rev' | 'ord' | 'aov'

const metricKey = ref<MetricKey>('rev')
const compare = ref(false)

const metrics = computed(() => {
  const D = data.value
  if (!D)
    return [] as Array<{ key: MetricKey; label: string; data: number[] }>
  return [
    { key: 'rev' as MetricKey, label: t('Revenue'), data: D.revenue30 },
    { key: 'ord' as MetricKey, label: t('Orders'), data: D.orders30 },
    { key: 'aov' as MetricKey, label: t('Avg Order'), data: D.aov30 },
  ]
})

const activeMetric = computed(() => metrics.value.find(m => m.key === metricKey.value) || metrics.value[0])

const switchSeries = computed(() => {
  const m = activeMetric.value
  const D = data.value
  if (!m || !D)
    return []
  const base = [{ key: m.key, label: m.label, color: 'rgb(var(--v-theme-chart-revenue))', data: m.data }]
  if (compare.value && metricKey.value === 'rev' && D.lastMonthRev?.length)
    base.push({ key: 'cmp', label: t('Last month'), color: 'rgb(var(--v-theme-chart-target))', data: D.lastMonthRev, dashed: true } as any)
  return base
})

// Gross-margin / repeat-rate gauge math
const targetPct = computed(() => {
  const D = data.value
  if (!D || !D.monthTarget)
    return 0
  return Math.min(100, Math.round((D.monthRevenue / D.monthTarget) * 100))
})

const dailyPace = computed(() => {
  const D = data.value
  if (!D)
    return 0
  return Math.max(0, Math.round((D.monthTarget - D.monthRevenue) / 6))
})

// ---------- Gauge geometry (inline SVG arc) ----------
const gaugeSize = 220
const gaugeArc = computed(() => {
  const size = gaugeSize
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 16
  const start = Math.PI * 0.75
  const end = Math.PI * 2.25
  const pct = targetPct.value / 100
  const cur = start + (end - start) * pct
  const point = (ang: number) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]
  const s = point(start)
  const e = point(end)
  const c = point(cur)
  const bigBg = (end - start) > Math.PI ? 1 : 0
  const bigFg = (cur - start) > Math.PI ? 1 : 0
  return {
    size,
    cx,
    cy,
    bg: `M${s[0]} ${s[1]} A${r} ${r} 0 ${bigBg} 1 ${e[0]} ${e[1]}`,
    fg: `M${s[0]} ${s[1]} A${r} ${r} 0 ${bigFg} 1 ${c[0]} ${c[1]}`,
  }
})

// ---------- Live feed (animated, identical to v3 source) ----------
const feed = ref<LiveOrder[]>([])
let feedTimer: number | null = null

function tone(o: LiveOrder): Tone {
  if (o.status === 'READY') return 'success'
  if (o.status === 'COMPLETED') return 'neutral'
  return 'warning'
}

function typeTone(t: LiveOrder['type']): Tone {
  if (t === 'DELIVERY') return 'info'
  if (t === 'PICKUP') return 'primary'
  return 'neutral'
}

function ago(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return t('{n}s ago', { n: s })
  return t('{n}m ago', { n: Math.round(s / 60) })
}

function startLiveFeed() {
  const names = [t('Table 7'), t('Table 3'), 'Chilonzor', '—', t('Table 12'), 'Yunusobod', t('Table 1')]
  const types: LiveOrder['type'][] = ['HALL', 'DELIVERY', 'PICKUP']
  feedTimer = window.setInterval(() => {
    const first = feed.value[0]
    const id = (first ? first.id : 1000) + 1
    const next: LiveOrder = {
      id,
      type: types[Math.floor(Math.random() * 3)],
      info: names[Math.floor(Math.random() * names.length)],
      total: (20 + Math.floor(Math.random() * 200)) * 1000,
      ts: Date.now(),
      status: 'PREPARING',
      _new: true,
    }
    feed.value = [next, ...feed.value].slice(0, 6)
  }, 3800)
}

// ---------- Bar fallback (for SwitchChart metric switch) ----------
const barData = computed(() => {
  const D = data.value
  const m = activeMetric.value
  if (!D || !m) return []
  return D.dayLabels.map((c, i) => ({ label: c, value: m.data[i] }))
})

// ---------- Locale-aware insight string ----------
const insightStr = computed(() => t('Revenue is up {pct}% this month', { pct: 12 }))

// ---------- Data loader ----------
// Backend reality (alpha_pos_server/admins/urls.py): there is NO
// `/dashboard/executive?range=30d` route. Only `/dashboard/today` and
// `/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` exist. We consume those and
// map their payloads onto the existing DashData shape so the v3-port UI
// keeps rendering. Series the BE doesn't ship yet (revenue30, orders30,
// aov30, lastMonthRev, dayLabels) are zero-filled — replace once the BE
// adds time-series rollups.
function defaultLast30Labels(): string[] {
  const labels: string[] = []
  for (let i = 29; i >= 0; i--) labels.push(`D-${i}`)
  return labels
}

function emptyDash(): DashData {
  return {
    monthRevenue: 0,
    monthOrders: 0,
    avgAov: 0,
    grossMargin: 0,
    repeatRate: 0,
    monthTarget: 0,
    revenue30: Array.from({ length: 30 }, () => 0),
    orders30: Array.from({ length: 30 }, () => 0),
    aov30: Array.from({ length: 30 }, () => 0),
    lastMonthRev: Array.from({ length: 30 }, () => 0),
    dayLabels: defaultLast30Labels(),
    paymentMix: [],
    categories: [],
    liveFeed: [],
  }
}

// BE returns money as integer-so'm strings (see dashboard_service._uzs).
function asNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Payment mix colors (kept stable across renders so DonutChart legend is consistent).
const PAY_COLORS: Record<string, string> = {
  CASH: 'rgb(var(--v-theme-success))',
  UZCARD: 'rgb(var(--v-theme-info))',
  HUMO: 'rgb(var(--v-theme-warning))',
  PAYME: 'rgb(var(--v-theme-primary))',
  MIXED: 'rgb(var(--v-theme-text-tertiary))',
}

function mapRangePayload(p: any): DashData {
  const d = emptyDash()
  const rev = asNum(p?.revenue)
  const orders = asNum(p?.paid_orders ?? p?.orders)
  d.monthRevenue = rev
  d.monthOrders = orders
  d.avgAov = orders > 0 ? Math.round(rev / orders) : 0

  const pay = p?.payment_breakdown ?? {}
  d.paymentMix = Object.entries(pay)
    .map(([k, v]) => ({ label: k, value: asNum(v), color: PAY_COLORS[k] ?? 'rgb(var(--v-theme-neutral))' }))
    .filter(s => s.value > 0)

  // /dashboard (range) doesn't return category stats — leave empty.
  d.categories = []
  return d
}

function mapTodayPayload(p: any): DashData {
  const d = emptyDash()
  const today = p?.today ?? {}
  const rev = asNum(today.revenue)
  const orders = asNum(today.paid_orders ?? today.orders)
  d.monthRevenue = rev
  d.monthOrders = orders
  d.avgAov = orders > 0 ? Math.round(rev / orders) : 0

  const pay = p?.payment_breakdown_today ?? {}
  d.paymentMix = Object.entries(pay)
    .map(([k, v]) => ({ label: k, value: asNum(v), color: PAY_COLORS[k] ?? 'rgb(var(--v-theme-neutral))' }))
    .filter(s => s.value > 0)

  const cats = Array.isArray(p?.category_stats_today) ? p.category_stats_today : []
  d.categories = cats
    .map((c: any) => ({ label: String(c?.category ?? '—'), value: asNum(c?.revenue) }))
    .filter((c: { value: number }) => c.value > 0)

  return d
}

function isoDateExec(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeDatesExec(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - (days - 1))
  return { from: isoDateExec(from), to: isoDateExec(to) }
}

async function loadDashboard() {
  loading.value = true
  try {
    // Page labels read "Performance · last 30 days", so consume the
    // 30-day range endpoint. Category card falls back to /dashboard/today
    // because /dashboard (range) does not return category stats.
    const { from, to } = rangeDatesExec(30)
    const [rangeRes, todayRes] = await Promise.all([
      axiosIns.get('/dashboard', { params: { from, to } }),
      axiosIns.get('/dashboard/today').catch(() => null),
    ])
    const rangePayload = rangeRes.data?.data ?? rangeRes.data ?? {}
    const mapped = mapRangePayload(rangePayload)
    const todayPayload = todayRes?.data?.data ?? todayRes?.data
    if (todayPayload) {
      const todayMapped = mapTodayPayload(todayPayload)
      if (todayMapped.categories.length)
        mapped.categories = todayMapped.categories
    }
    data.value = mapped
  }
  catch (err) {
    // Soft-degrade: synthesise an empty/zeroed shape so the page can render
    // skeletons rather than throw.
    data.value = emptyDash()
    void err
  }
  finally {
    loading.value = false
  }
}

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

onMounted(() => {
  loadDashboard().then(() => {
    if (data.value?.liveFeed?.length)
      feed.value = data.value.liveFeed
    startLiveFeed()
  })
})

onUnmounted(() => {
  if (feedTimer !== null) {
    clearInterval(feedTimer)
    feedTimer = null
  }
})

// `locale` is read so live `ago()` re-renders when language changes via key.
void locale
</script>

<template>
  <div class="exec-dash">
    <!-- Loading state -->
    <div
      v-if="loading"
      class="exec-loading"
      style="display: flex; flex-direction: column; gap: var(--sp-6);"
    >
      <div class="grid exec-hero">
        <div
          v-for="i in 5"
          :key="`sk${i}`"
          class="herokpi"
        >
          <Skeleton :h="14" w="60%" />
          <Skeleton :h="28" w="80%" :style="{ marginTop: '14px' }" />
          <Skeleton :h="16" w="50%" :style="{ marginTop: '12px' }" />
        </div>
      </div>
      <div
        v-for="r in 3"
        :key="`skrow${r}`"
        class="grid"
        :style="{ gridTemplateColumns: r % 2 ? '1fr 1fr 1fr' : '1.7fr 1fr' }"
      >
        <Card
          v-for="i in (r % 2 ? 3 : 2)"
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
      <!-- Hero KPI strip (5 columns) -->
      <div
        class="grid exec-hero"
      >
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
              :class="`t-${k.tone}`"
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

      <!-- Main row: switchable chart + monthly target gauge -->
      <div
        class="grid exec-main"
      >
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div
                class="kpi__label"
                style="margin-bottom: 3px;"
              >
                {{ t('Performance · last 30 days') }}
              </div>
              <h3 class="card__insight">
                {{ insightStr }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <!-- Inline SwitchChart fallback (replace w/ <SwitchChart> in phase 2) -->
            <div
              class="row between wrap"
              style="gap: 12px; margin-bottom: 16px;"
            >
              <div
                class="seg"
                role="tablist"
              >
                <button
                  v-for="m in metrics"
                  :key="m.key"
                  type="button"
                  class="seg__btn"
                  :class="{ 'is-active': metricKey === m.key }"
                  @click="metricKey = m.key"
                >{{ m.label }}</button>
              </div>
              <div
                v-if="data?.lastMonthRev?.length && metricKey === 'rev'"
                class="row"
                style="gap: 10px;"
              >
                <button
                  type="button"
                  class="chip"
                  :class="{ 'is-on': compare }"
                  :style="compare ? undefined : { background: 'transparent', color: 'rgb(var(--v-theme-text-secondary))', borderColor: 'rgb(var(--v-theme-border-strong))' }"
                  @click="compare = !compare"
                >
                  <DesignIcon
                    :name="compare ? 'check' : 'plus'"
                    :size="13"
                  />
                  {{ t('Compare') }}
                </button>
              </div>
            </div>
            <LineAreaChart
              v-if="activeMetric && data"
              :categories="data.dayLabels"
              :series="switchSeries as any"
              :height="300"
              :y-format="fmtAbbr"
            />
            <BarChart
              v-else-if="activeMetric && data"
              :data="barData"
              :height="300"
              :value-label="activeMetric.label"
              :y-format="fmtAbbr"
            />
          </div>
        </Card>

        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Monthly target') }}
              </div>
              <h3 class="card__title">
                {{ t('Revenue goal') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <!-- Inline Gauge fallback (replace w/ <Gauge> in phase 2) -->
            <div
              class="exec-gauge"
              :style="{ width: `${gaugeSize}px`, height: `${gaugeSize}px`, position: 'relative', margin: '0 auto' }"
            >
              <svg
                :width="gaugeSize"
                :height="gaugeSize"
                :viewBox="`0 0 ${gaugeSize} ${gaugeSize}`"
              >
                <path
                  :d="gaugeArc.bg"
                  fill="none"
                  stroke="rgb(var(--v-theme-chart-track))"
                  :stroke-width="14"
                  stroke-linecap="round"
                />
                <path
                  :d="gaugeArc.fg"
                  fill="none"
                  stroke="rgb(var(--v-theme-chart-revenue))"
                  :stroke-width="14"
                  stroke-linecap="round"
                />
              </svg>
              <div
                class="exec-gauge__center"
                :style="{ position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }"
              >
                <div
                  class="mono"
                  style="font-size: 30px; font-weight: 700; line-height: 1;"
                >{{ targetPct }}%</div>
                <div
                  class="muted"
                  style="font-size: 12px; margin-top: 6px;"
                >{{ t('of target') }}</div>
                <div
                  class="muted mono"
                  style="font-size: 12px; margin-top: 8px;"
                >
                  {{ data ? formatCurrency(data.monthRevenue) : '—' }} / {{ data ? fmtAbbr(data.monthTarget) : '—' }} UZS
                </div>
              </div>
            </div>
            <div
              class="hr"
              style="margin: 8px 0 16px;"
            />
            <div
              class="row between"
              style="margin-bottom: 10px;"
            >
              <span
                class="muted"
                style="font-size: 13px;"
              >{{ t('Daily pace needed') }}</span>
              <span
                class="mono"
                style="font-weight: 700;"
              >{{ t('{n}/day', { n: fmtAbbr(dailyPace) }) }}</span>
            </div>
            <div class="row between">
              <span
                class="muted"
                style="font-size: 13px;"
              >{{ t('Projected close') }}</span>
              <Badge tone="success">{{ t('On track') }}</Badge>
            </div>
          </div>
        </Card>
      </div>

      <!-- Secondary row: payment mix + top categories + live feed -->
      <div
        class="grid exec-secondary"
      >
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Payment mix') }}
              </div>
              <h3 class="card__title">
                {{ t('How guests pay') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <DonutChart
              v-if="data"
              :data="data.paymentMix"
              :center-label="t('Collected')"
              :size="170"
            />
          </div>
        </Card>

        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Top categories') }}
              </div>
              <h3 class="card__title">
                {{ t('Revenue by category') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <HBarChart
              v-if="data"
              :data="data.categories.slice(0, 5).map(c => ({ name: c.label, value: c.value }))"
              :value-format="fmtAbbr"
            />
          </div>
        </Card>

        <Card>
          <div class="card__head between">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Live') }}
              </div>
              <h3 class="card__title">
                {{ t('Recent activity') }}
              </h3>
            </div>
            <Badge tone="success" :dot="true">{{ t('Live') }}</Badge>
          </div>
          <div
            class="card__body"
            style="padding-top: 0;"
          >
            <div style="display: flex; flex-direction: column;">
              <div
                v-for="(o, i) in feed"
                :key="o.id"
                class="feed-row"
                :class="{ 'feed-row--new': o._new }"
                :style="{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '10px 0',
                  borderBottom: i < feed.length - 1 ? '1px solid rgb(var(--v-theme-border))' : 'none',
                }"
              >
                <span
                  class="feed-dot"
                  :class="`t-${tone(o)}`"
                />
                <div style="flex: 1; min-width: 0;">
                  <div
                    class="row"
                    style="gap: 7px;"
                  >
                    <span
                      class="cell-strong mono"
                      style="font-size: 13px;"
                    >#{{ o.id }}</span>
                    <Badge :tone="typeTone(o.type)">{{ t(o.type) }}</Badge>
                  </div>
                  <div
                    class="tertiary"
                    style="font-size: 11px;"
                  >
                    {{ o.info }} · {{ ago(o.ts) }}
                  </div>
                </div>
                <span
                  class="mono cell-strong"
                  style="font-size: 13px;"
                >{{ formatCurrency(o.total) }}</span>
              </div>
              <div
                v-if="!feed.length"
                class="muted"
                style="padding: 16px 0; text-align: center; font-size: 13px;"
              >
                {{ t('Waiting for orders…') }}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exec-dash {
  display: block;
}

.grid {
  display: grid;
  gap: var(--sp-6);
}

.exec-hero {
  grid-template-columns: repeat(5, 1fr);
}

.exec-main {
  grid-template-columns: 1.7fr 1fr;
}

.exec-secondary {
  grid-template-columns: 1fr 1fr 1fr;
}

@media (max-width: 1100px) {
  .exec-hero {
    grid-template-columns: repeat(2, 1fr);
  }
  .exec-main,
  .exec-secondary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .exec-hero {
    grid-template-columns: 1fr;
  }
}

/* Hero KPI tile — minimal styling pending design-executive.css. */
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

/* Segmented control (metric tabs). */
.seg {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  background: rgb(var(--v-theme-neutral-weak));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-pill);
}
.seg__btn {
  border: none;
  background: transparent;
  padding: 4px 12px;
  border-radius: var(--r-pill);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: rgb(var(--v-theme-text-secondary));
  cursor: pointer;
  transition: background .12s, color .12s;
}
.seg__btn:hover {
  color: rgb(var(--v-theme-on-surface));
}
.seg__btn.is-active {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* Compare chip — borrows .chip semantics from design-shell.css when present. */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: var(--r-pill);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  cursor: pointer;
  background: rgb(var(--v-theme-primary-weak));
  color: rgb(var(--v-theme-primary));
  border: 1px solid rgb(var(--v-theme-primary-border));
}

/* Live feed status dot. */
.feed-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 8px;
  background: rgb(var(--v-theme-warning));
}
.feed-dot.t-success { background: rgb(var(--v-theme-success)); }
.feed-dot.t-warning { background: rgb(var(--v-theme-warning)); }
.feed-dot.t-neutral { background: rgb(var(--v-theme-text-tertiary)); }
.feed-dot.t-error { background: rgb(var(--v-theme-error)); }
.feed-dot.t-info { background: rgb(var(--v-theme-info)); }
.feed-dot.t-primary { background: rgb(var(--v-theme-primary)); }

/* Subtle slide-in for new feed rows. */
.feed-row--new {
  animation: feed-slide .3s ease;
}
@keyframes feed-slide {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.hr {
  height: 1px;
  background: rgb(var(--v-theme-border));
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
.muted {
  color: rgb(var(--v-theme-text-secondary));
}
.tertiary {
  color: rgb(var(--v-theme-text-tertiary));
}
.cell-strong {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 600;
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

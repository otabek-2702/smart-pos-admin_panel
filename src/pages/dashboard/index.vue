<script setup lang="ts">
/* ============================================================
   ALPHA POS — Dashboard (1:1 port of
   .tmp-alpha-design/alpha-design-source/Dashboard.jsx)

   Structure mirrors the React source exactly:
     PageHeader -> KPI row (4) -> KpiMini row (4)
       -> ChartCard[LineArea] + ChartCard[Donut]   (1.7fr / 1fr)
       -> ChartCard[Bar]      + ChartCard[HBar]    (1.4fr / 1fr)
       -> Card[recent orders] + side column        (1.7fr / 1fr)

   Wires the existing GET /dashboard/today endpoint, mapping the
   same BE field shape the old page used (today.*, payment_breakdown_today,
   top_products_today, low_stock_items, clocked_in, orders_by_hour,
   revenue_trend, deltas).
   ============================================================ */
import axios from '@/plugins/axios'
import Card from '@/components/design/Card.vue'
import ChartCard from '@/components/design/ChartCard.vue'
import Kpi from '@/components/design/Kpi.vue'
import KpiMini from '@/components/design/KpiMini.vue'
import Badge from '@/components/design/Badge.vue'
import StatusBadge from '@/components/design/StatusBadge.vue'
import LineAreaChart from '@/components/design/LineAreaChart.vue'
import DonutChart from '@/components/design/DonutChart.vue'
import BarChart from '@/components/design/BarChart.vue'
import HBarChart from '@/components/design/HBarChart.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import Segmented from '@/components/design/Segmented.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Button from '@/components/design/Button.vue'
import { fmtAbbr, fmtDateTime, fmtMoney, fmtTime } from '@/components/design/utils/format'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

// ============================================================
// Data wiring — mirror existing /dashboard/today contract
// ============================================================
const loading = ref(true)
const data = ref<any>(null)
const recentOrders = ref<any[]>([])
const recentOrdersLoading = ref(true)
const nowStamp = ref(new Date())
const exporting = ref(false)
const revOrOrd = ref<'rev' | 'ord'>('rev')

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/dashboard/today')
    data.value = res.data?.data ?? res.data
    nowStamp.value = new Date()
  }
  catch (e: any) {
    data.value = null
    notify(e?.response?.data?.message ?? t('Failed to load dashboard'), 'error')
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
  catch (e: any) {
    recentOrders.value = []
    notify(e?.response?.data?.message ?? t('Failed to load recent orders'), 'error')
  }
  finally {
    recentOrdersLoading.value = false
  }
}

async function exportReport() {
  if (exporting.value)
    return
  exporting.value = true
  try {
    const res = await axios.get('/dashboard/export', { responseType: 'blob' })
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    a.download = `dashboard-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    notify(t('Export downloaded'))
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Export failed'), 'error')
  }
  finally {
    exporting.value = false
  }
}

function refresh() {
  load()
  loadRecentOrders()
}

onMounted(() => {
  load()
  loadRecentOrders()
})

// ============================================================
// Computed slices over BE response
// ============================================================
const today = computed(() => data.value?.today ?? null)
const paymentBreakdown = computed<Record<string, string | number>>(() => data.value?.payment_breakdown_today ?? {})
const topProducts = computed<any[]>(() => data.value?.top_products_today ?? [])
const lowStockCount = computed<number>(() => Number(data.value?.low_stock_count ?? data.value?.low_stock_items?.length ?? 0))
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

const subtitle = computed(() => `${t('Today\'s snapshot')} · ${fmtDateTime(nowStamp.value)}`)

// ============================================================
// KPI rows — Kpi (4) + KpiMini (4) — same data sources as the
// React source's DB.dashboardKpis / DB.dashboardSubKpis.
// ============================================================
const kpis = computed(() => [
  {
    key: 'revenue',
    label: t(`Today's Revenue`),
    value: Number(today.value?.revenue ?? 0),
    money: true,
    icon: 'wallet',
    tone: 'success' as const,
    delta: deltas.value?.revenue_delta ?? null,
    deltaLabel: t('vs last week'),
  },
  {
    key: 'orders',
    label: t('Orders Today'),
    value: Number(today.value?.orders ?? 0),
    icon: 'receipt',
    tone: 'primary' as const,
    delta: deltas.value?.orders_delta ?? null,
    deltaLabel: t('vs last week'),
  },
  {
    key: 'aov',
    label: t('Avg Order Value'),
    value: aov.value,
    money: true,
    icon: 'trend',
    tone: 'info' as const,
    delta: deltas.value?.aov_delta ?? null,
    deltaLabel: t('vs last week'),
  },
  {
    key: 'lowstock',
    label: t('Low Stock Items'),
    value: lowStockCount.value,
    icon: 'box',
    tone: (lowStockCount.value > 0 ? 'warning' : 'success') as 'warning' | 'success',
    delta: null,
    deltaLabel: lowStockCount.value > 0 ? t('needs reorder') : t('all stocked'),
  },
])

const subKpis = computed(() => [
  { key: 'open', label: t('Open Orders'), value: Number(today.value?.open ?? 0), tone: 'info' as const },
  { key: 'cancelled', label: t('Cancelled'), value: Number(today.value?.cancelled ?? 0), tone: 'error' as const },
  {
    key: 'paid',
    label: t('Paid'),
    value: `${paidPct.value}%`,
    sub: today.value ? `${today.value.paid_orders ?? 0} / ${today.value.orders ?? 0}` : undefined,
    tone: 'success' as const,
  },
  { key: 'clocked', label: t('Clocked In'), value: clockedIn.value.length, tone: 'primary' as const },
])

// ============================================================
// Extra headline figures from BE (units_sold, avg_prep_seconds,
// money_entered, peak_hour) + category_stats_today
// ============================================================
function fmtPrepTime(seconds: number): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

const extraKpis = computed(() => [
  {
    key: 'units_sold',
    label: t('Units Sold'),
    value: Number(today.value?.units_sold ?? 0),
    tone: 'primary' as const,
    sub: peakHourLabel.value ? t('Peak hour {hour}', { hour: peakHourLabel.value }) : undefined,
  },
  {
    key: 'avg_prep',
    label: t('Avg Prep'),
    value: today.value?.avg_prep_seconds != null
      ? fmtPrepTime(Number(today.value.avg_prep_seconds))
      : '—',
    tone: 'info' as const,
    sub: t('mm:ss per order'),
  },
  {
    key: 'money_entered',
    label: t('Counted into Safe'),
    value: fmtMoney(Number(today.value?.money_entered ?? 0)),
    tone: 'success' as const,
  },
])

const categoryStatsToday = computed<any[]>(() => data.value?.category_stats_today ?? [])
const categoryMixData = computed(() =>
  categoryStatsToday.value.slice(0, 6).map((c: any) => ({
    name: String(c.category ?? c.category_name ?? c.name ?? '—'),
    value: Number(c.revenue) || 0,
    units: Number(c.quantity) || Number(c.units) || 0,
  })),
)
const categoryMixInsight = computed(() =>
  categoryMixData.value.length
    ? t('{name} leads category revenue', { name: categoryMixData.value[0].name })
    : t('No category sales yet'),
)

// ============================================================
// Revenue trend — last 14 days (revenue vs expense, with target)
// Mapped to LineAreaChart series format.
// ============================================================
const trendCategories = computed(() => revenueTrend.value.map((d: any) => String(d.label ?? '')))
const trendSeries = computed(() => [
  {
    key: 'revenue',
    label: t('Revenue'),
    color: 'var(--chart-revenue)',
    data: revenueTrend.value.map((d: any) => Number(d.revenue) || 0),
  },
  {
    key: 'expense',
    label: t('Expenses'),
    color: 'var(--chart-expense)',
    data: revenueTrend.value.map((d: any) => Number(d.expense) || 0),
  },
])
const trendLast = computed(() => {
  const arr = revenueTrend.value
  return arr.length ? arr[arr.length - 1] : null
})
const revenueLatest = computed(() => Number(trendLast.value?.revenue) || 0)
const expenseLatest = computed(() => Number(trendLast.value?.expense) || 0)
const revenueInsight = computed(() => {
  const arr = revenueTrend.value
  if (!arr.length)
    return t('Revenue trend')
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

// ============================================================
// Payment mix (donut)
// ============================================================
const PAYMENT_COLORS: Record<string, string> = {
  CASH: 'var(--chart-cash)',
  UZCARD: 'var(--c1)',
  HUMO: 'var(--c4)',
  PAYME: 'var(--c5)',
  MIXED: 'var(--c5)',
}
const paymentMix = computed(() =>
  Object.entries(paymentBreakdown.value)
    .map(([k, v]) => ({
      label: t(`payment_method_${k}`),
      value: Number(v) || 0,
      color: PAYMENT_COLORS[k] ?? 'var(--c5)',
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value),
)
const paymentTotal = computed(() => paymentMix.value.reduce((a, b) => a + b.value, 0))
const paymentInsight = computed(() => {
  if (!paymentMix.value.length)
    return t('No paid orders yet')
  const top = paymentMix.value[0]
  const pct = Math.round((top.value / (paymentTotal.value || 1)) * 100)
  return t('{name} leads at {pct}%', { name: top.label, pct })
})

// ============================================================
// Orders by hour (BarChart) + Top products (HBarChart)
// ============================================================
const ordersByHourData = computed(() =>
  ordersByHour.value.map((h: any) => ({
    label: String(h.label ?? ''),
    value: Number(h.orders) || 0,
    peak: !!h.peak,
  })),
)
const ordersByHourTotal = computed(() =>
  ordersByHour.value.reduce((a, b: any) => a + (Number(b.orders) || 0), 0),
)
const peakHourLabel = computed<string | null>(() => {
  const series = ordersByHour.value
  if (series.length) {
    const p = series.find((b: any) => b.peak)
    if (p)
      return String(p.label)
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

const topProductsData = computed(() =>
  topProducts.value
    .map((p: any) => ({
      name: String(p.product_name ?? ''),
      value: Number(p.revenue) || 0,
      units: Number(p.quantity) || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5),
)
const topProductInsight = computed(() =>
  topProductsData.value.length
    ? t('{name} leads revenue', { name: topProductsData.value[0].name })
    : t('No sales yet today'),
)

// ============================================================
// Recent orders helpers
// ============================================================
function initial(s: string | undefined | null): string {
  if (!s)
    return '?'
  return (s.trim()[0] || '?').toUpperCase()
}
</script>

<template>
  <div class="page">
    <!-- ===== Page header ===== -->
    <PageHeader :title="t('Dashboard')" :subtitle="subtitle">
      <template #actions>
        <Button
          variant="secondary"
          icon="refresh"
          :loading="loading"
          @click="refresh"
        >
          {{ t('Refresh') }}
        </Button>
        <Button
          variant="primary"
          icon="download"
          :loading="exporting"
          @click="exportReport"
        >
          {{ t('Export report') }}
        </Button>
      </template>
    </PageHeader>

    <!-- ===== KPI row ===== -->
    <div class="grid cols-4 dash-kpi-row" style="margin-bottom: var(--sp-5);">
      <template v-for="k in kpis" :key="k.key">
        <div v-if="loading" class="kpi">
          <div class="kpi__top">
            <Skeleton :w="38" :h="38" :r="8" />
            <Skeleton :w="90" :h="13" />
          </div>
          <Skeleton :w="140" :h="30" />
          <Skeleton :w="80" :h="18" :style="{ marginTop: '12px', borderRadius: '99px' }" />
        </div>
        <Kpi v-else :data="k" />
      </template>
    </div>

    <!-- ===== Secondary KPIs ===== -->
    <div class="grid cols-4 dash-kpi-row" style="margin-bottom: var(--sp-5);">
      <template v-for="k in subKpis" :key="k.key">
        <div v-if="loading" class="kpi" style="padding: var(--sp-4) var(--sp-5);">
          <Skeleton :w="70" :h="13" :style="{ marginBottom: '10px' }" />
          <Skeleton :w="90" :h="24" />
        </div>
        <KpiMini v-else :data="k" />
      </template>
    </div>

    <!-- ===== Extra headline figures (units sold / avg prep / counted into safe) ===== -->
    <div class="grid cols-3 dash-kpi-row" style="margin-bottom: var(--sp-5);">
      <template v-for="k in extraKpis" :key="k.key">
        <div v-if="loading" class="kpi" style="padding: var(--sp-4) var(--sp-5);">
          <Skeleton :w="90" :h="13" :style="{ marginBottom: '10px' }" />
          <Skeleton :w="120" :h="24" />
        </div>
        <KpiMini v-else :data="k" />
      </template>
    </div>

    <!-- ===== Revenue trend + payment mix ===== -->
    <div class="grid split-1-7" style="margin-bottom: var(--sp-5);">
      <ChartCard
        :eyebrow="t('Revenue vs expenses · last 14 days')"
        :insight="revenueInsight"
      >
        <template #actions>
          <Segmented
            v-model="revOrOrd"
            :options="[
              { value: 'rev', label: t('Revenue') },
              { value: 'ord', label: t('Orders') },
            ]"
          />
        </template>
        <LineAreaChart
          :loading="loading"
          :categories="trendCategories"
          :series="trendSeries"
          :target="revenueTarget"
          :height="260"
        />
        <div
          v-if="!loading && revenueTrend.length"
          class="chart-legend"
          style="margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);"
        >
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
      </ChartCard>

      <ChartCard
        :eyebrow="t('Payment mix · today')"
        :insight="paymentInsight"
        :sub="t('Share of paid revenue by method')"
      >
        <DonutChart
          :loading="loading"
          :data="paymentMix"
          :center-label="t('Collected')"
          :size="188"
        />
      </ChartCard>
    </div>

    <!-- ===== Orders by hour + top products ===== -->
    <div class="grid split-1-4" style="margin-bottom: var(--sp-5);">
      <ChartCard
        :eyebrow="t('Orders by hour · today')"
        :insight="ordersByHourInsight"
        :sub="t('{n} orders across the day', { n: ordersByHourTotal })"
      >
        <BarChart
          :loading="loading"
          :data="ordersByHourData"
          :height="240"
          :value-label="t('Orders')"
          :y-format="(v: number) => String(Math.round(v))"
        />
      </ChartCard>
      <ChartCard
        :eyebrow="t('Top products · today')"
        :insight="topProductInsight"
        :sub="t('By revenue contribution')"
      >
        <HBarChart
          :loading="loading"
          :data="topProductsData"
          :value-format="fmtAbbr"
        />
      </ChartCard>
    </div>

    <!-- ===== Category mix today ===== -->
    <div class="grid" style="margin-bottom: var(--sp-5);">
      <ChartCard
        :eyebrow="t('Category mix today')"
        :insight="categoryMixInsight"
        :sub="t('Revenue and units by category')"
      >
        <HBarChart
          v-if="categoryMixData.length || loading"
          :loading="loading"
          :data="categoryMixData"
          :value-format="fmtAbbr"
        />
        <div v-else class="statefill">
          <div class="statefill__title">
            {{ t('No category sales yet') }}
          </div>
        </div>
      </ChartCard>
    </div>

    <!-- ===== Recent orders + side column ===== -->
    <div class="grid split-1-7">
      <Card>
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
            <Button
              variant="ghost"
              size="sm"
              icon-right="chevright"
              @click="router.push('/orders')"
            >
              {{ t('View all') }}
            </Button>
          </div>
        </div>
        <div class="card__divider" />
        <div
          v-if="recentOrdersLoading"
          style="padding: 20px; display: flex; flex-direction: column; gap: 14px;"
        >
          <Skeleton v-for="i in 5" :key="`ros${i}`" :h="18" />
        </div>
        <div v-else-if="recentOrders.length" class="tablewrap">
          <table class="dtable">
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
                #{{ o.id }}<span v-if="o.display_id != null"> · K{{ o.display_id }}</span>
              </td>
              <td>
                <Badge tone="neutral">
                  {{ t(`order_type_${String(o.order_type ?? 'HALL').toUpperCase()}`) }}
                </Badge>
              </td>
              <td>
                <StatusBadge :value="o.status ? t(`order_status_${String(o.status).toUpperCase()}`) : ''" dot />
              </td>
              <td>
                <StatusBadge :value="o.is_paid ? t('payment_status_PAID') : t('payment_status_UNPAID')" />
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
        <div v-else class="statefill">
          <div class="statefill__title">
            {{ t('No orders today yet') }}
          </div>
        </div>
      </Card>

      <div style="display: flex; flex-direction: column; gap: var(--sp-5);">
        <Card>
          <div class="card__head" style="padding-bottom: var(--sp-3);">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Clocked in') }}
              </h3>
            </div>
            <Badge tone="primary">
              {{ t('{n} active', { n: clockedIn.length }) }}
            </Badge>
          </div>
          <div class="card__body" style="padding-top: 0;">
            <template v-if="loading">
              <Skeleton
                v-for="i in 2"
                :key="`cs${i}`"
                :h="40"
                :style="{ marginBottom: '10px' }"
              />
            </template>
            <template v-else-if="clockedIn.length">
              <div
                v-for="c in clockedIn"
                :key="c.shift_id ?? c.name"
                class="row"
                style="padding: 8px 0; gap: 12px;"
              >
                <div class="avatar avatar--sm">
                  {{ initial(c.name) }}
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; font-size: 14px; overflow-wrap: anywhere; word-break: break-word;">
                    {{ c.name }}
                  </div>
                  <div class="tertiary" style="font-size: 12px; overflow-wrap: anywhere;">
                    {{ t('Since') }} {{ fmtDateTime(c.start_time) }}
                  </div>
                </div>
                <span class="badge t-success badge--dot" style="flex-shrink: 0;">{{ t('On shift') }}</span>
              </div>
            </template>
            <div v-else class="statefill">
              <div class="statefill__title">
                {{ t('No one on shift') }}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div class="card__head" style="padding-bottom: var(--sp-3);">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Low stock') }}
              </h3>
            </div>
            <Badge tone="warning">
              {{ t('{n} items', { n: lowStockCount }) }}
            </Badge>
          </div>
          <div class="card__body" style="padding-top: 0;">
            <template v-if="loading">
              <Skeleton
                v-for="i in 3"
                :key="`ls${i}`"
                :h="28"
                :style="{ marginBottom: '10px' }"
              />
            </template>
            <template v-else-if="lowStockItems.length">
              <div
                v-for="s in lowStockItems"
                :key="s.id"
                class="row between low-stock-row"
                style="padding: 9px 0; border-bottom: 1px solid var(--border); gap: 12px;"
              >
                <span class="low-stock-name" style="font-weight: 500; font-size: 14px; min-width: 0; flex: 1 1 auto; overflow-wrap: anywhere; word-break: break-word;">{{ s.name }}</span>
                <span class="row" style="gap: 10px; flex-shrink: 0;">
                  <span class="mono" style="color: var(--warning); font-weight: 600; font-size: 13px;">{{ s.level }} {{ s.unit }}</span>
                  <span class="tertiary" style="font-size: 12px;">/ {{ s.reorder }}</span>
                </span>
              </div>
            </template>
            <div v-else class="statefill">
              <div class="statefill__title">
                {{ t('No low-stock items') }}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>

    <!-- Toast / snackbar -->
    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      location="top end"
      timeout="3500"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.split-1-7 { grid-template-columns: 1.7fr 1fr; }
.split-1-4 { grid-template-columns: 1.4fr 1fr; }
/* Prevent wide table contents from blowing out grid tracks */
.split-1-7 > *, .split-1-4 > * { min-width: 0; }

/* Allow PageHeader action buttons (Refresh + Export) to wrap on narrow screens */
.page :deep(.page__head-actions) {
  flex-wrap: wrap;
}

@media (max-width: 1100px) {
  .split-1-7, .split-1-4 { grid-template-columns: 1fr; }
}

/* KPI rows: keep 2-up on tablet/phone (>=520px), collapse to single column only on small phones. */
@media (max-width: 1100px) {
  .dash-kpi-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .page :deep(.page__head-actions) {
    width: 100%;
    margin-left: 0;
  }
}
@media (max-width: 520px) {
  .dash-kpi-row { grid-template-columns: 1fr; }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

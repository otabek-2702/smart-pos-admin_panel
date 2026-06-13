<script setup lang="ts">
import axios from '@/plugins/axios'

import AppPageHeader from '@/components/design/AppPageHeader.vue'
import KpiCard from '@/components/design/KpiCard.vue'
import KpiMiniCard from '@/components/design/KpiMiniCard.vue'
import ChartCard from '@/components/design/ChartCard.vue'
import LineAreaChart from '@/components/design/LineAreaChart.vue'
import BarChart from '@/components/design/BarChart.vue'
import HBarChart from '@/components/design/HBarChart.vue'
import DonutChart from '@/components/design/DonutChart.vue'
import StatusBadge from '@/components/design/StatusBadge.vue'
import Badge from '@/components/design/Badge.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import StateFill from '@/components/design/StateFill.vue'
import { fmtAbbr, fmtDate, fmtDateTime, fmtMoney, fmtTime } from '@/components/design/utils/format'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

const loading = ref(true)
const data = ref<any>(null)

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/dashboard/today')

    data.value = res.data?.data ?? res.data
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const today = computed(() => data.value?.today ?? null)
const paymentBreakdown = computed(() => data.value?.payment_breakdown_today ?? {})
const topProducts = computed<any[]>(() => data.value?.top_products_today ?? [])
const lowStockCount = computed(() => data.value?.low_stock_count ?? null)
const clockedIn = computed<any[]>(() => data.value?.clocked_in ?? [])

const aov = computed(() => {
  if (!today.value)
    return null
  const paid = Number(today.value.paid_orders) || 0
  const rev = Number(today.value.revenue) || 0
  if (!paid)
    return 0

  return Math.round(rev / paid)
})

const paidPct = computed(() => {
  if (!today.value)
    return null
  const total = Number(today.value.orders) || 0
  if (!total)
    return 0

  return Math.round(((Number(today.value.paid_orders) || 0) / total) * 100)
})

const paymentMix = computed(() => {
  const palette = [
    'rgb(var(--v-theme-c1))',
    'rgb(var(--v-theme-c2))',
    'rgb(var(--v-theme-c3))',
    'rgb(var(--v-theme-c4))',
    'rgb(var(--v-theme-c5))',
    'rgb(var(--v-theme-chart-target))',
  ]
  const labelMap: Record<string, string> = {
    CASH: 'Cash',
    UZCARD: 'UzCard',
    HUMO: 'Humo',
    PAYME: 'Payme',
    CLICK: 'Click',
    MIXED: 'Mixed',
  }

  return Object.entries(paymentBreakdown.value)
    .map(([k, v], i) => ({
      label: labelMap[k] ?? k,
      value: Number(v) || 0,
      color: palette[i % palette.length],
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)
})

const paymentInsight = computed(() => {
  if (!paymentMix.value.length)
    return ''
  const total = paymentMix.value.reduce((a, b) => a + b.value, 0) || 1
  const top = paymentMix.value[0]

  return `${top.label} leads at ${Math.round(top.value / total * 100)}%`
})

const topProductsForChart = computed(() =>
  topProducts.value.slice(0, 5).map((p: any) => ({
    name: p.product_name,
    value: Number(p.revenue) || 0,
    units: Number(p.quantity) || 0,
  })),
)

const topProductInsight = computed(() => {
  if (!topProductsForChart.value.length)
    return 'No sales yet today'

  return `${topProductsForChart.value[0].name} leads revenue`
})

const peakHourLabel = computed(() => {
  const p = today.value?.peak_hour
  if (!p || p.hour === undefined || p.hour === null)
    return null
  const h = String(p.hour).padStart(2, '0')

  return `${h}:00`
})

const ordersByHourInsight = computed(() => {
  const peak = peakHourLabel.value
  if (!peak)
    return 'No orders today yet'

  return `Peak trade at ${peak}`
})

const recentOrders = ref<any[]>([])
const recentOrdersLoading = ref(true)

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

onMounted(loadRecentOrders)

const refresh = () => {
  load()
  loadRecentOrders()
}

// ---- Empty placeholders for series the BE doesn't yet return.
// Front-end shows a "No data" state — see docs/design-system.md for the
// BE-TODO covering /dashboard/trend (revenue line) and /dashboard/orders-by-hour.
const revenueSeries = computed(() => [])
const revenueCategories = computed<string[]>(() => [])
const revenueTarget = computed(() => 0)
const ordersByHourData = computed<any[]>(() => {
  const peak = today.value?.peak_hour
  if (!peak)
    return []

  // BE only returns the peak hour, not the full 24h breakdown. Display a single
  // "peak" bar inline until the BE exposes a per-hour series.
  return [{ label: String(peak.hour).padStart(2, '0'), value: peak.orders || 0, peak: true }]
})

const todayDateLine = computed(() => {
  const now = new Date()

  return `Today's snapshot · ${fmtDateTime(now)}`
})
</script>

<template>
  <div class="page">
    <AppPageHeader
      :title="t('Dashboard')"
      :subtitle="todayDateLine"
    >
      <template #actions>
        <VBtn
          variant="outlined"
          color="default"
          prepend-icon="bx-refresh"
          :loading="loading"
          @click="refresh"
        >
          {{ t('Refresh') }}
        </VBtn>
      </template>
    </AppPageHeader>

    <!-- ============ Row 1: 4 KPIs ============ -->
    <div class="grid cols-4 mb-5">
      <KpiCard
        :label="t(`Today's Revenue`)"
        icon="bx-money"
        tone="success"
        money
        :value="today ? Number(today.revenue) : null"
        :loading="loading"
        :sub="`${today?.paid_orders ?? 0} paid`"
      />
      <KpiCard
        :label="t('Orders Today')"
        icon="bx-receipt"
        tone="primary"
        :value="today ? Number(today.orders) : null"
        :loading="loading"
        :sub="`${today?.open ?? 0} open`"
      />
      <KpiCard
        :label="t('Avg Order Value')"
        icon="bx-trending-up"
        tone="info"
        money
        :value="aov"
        :loading="loading"
        :sub="t('per paid order')"
      />
      <KpiCard
        :label="t('Low Stock Items')"
        :icon="lowStockCount && lowStockCount > 0 ? 'bx-error-circle' : 'bx-check-circle'"
        :tone="lowStockCount && lowStockCount > 0 ? 'warning' : 'success'"
        :value="lowStockCount"
        :loading="loading"
        :sub="lowStockCount && lowStockCount > 0 ? t('needs reorder') : t('all stocked')"
      />
    </div>

    <!-- ============ Row 2: secondary mini KPIs ============ -->
    <div class="grid cols-4 mb-5">
      <KpiMiniCard
        :label="t('Open orders')"
        tone="primary"
        :value="today ? Number(today.open) : null"
        :loading="loading"
      />
      <KpiMiniCard
        :label="t('Cancelled')"
        tone="error"
        :value="today ? Number(today.cancelled) : null"
        :loading="loading"
      />
      <KpiMiniCard
        :label="t('Paid')"
        tone="success"
        :value="paidPct !== null ? `${paidPct}%` : null"
        :sub="`${today?.paid_orders ?? 0}/${today?.orders ?? 0}`"
        :loading="loading"
      />
      <KpiMiniCard
        :label="t('Clocked in')"
        tone="info"
        :value="clockedIn.length"
        :loading="loading"
      />
    </div>

    <!-- ============ Row 3: revenue trend (1.7fr) + payment mix (1fr) ============ -->
    <div class="grid grid--170-100 mb-5">
      <ChartCard
        eyebrow="Revenue vs expenses · last 14 days"
        :insight="revenueSeries.length ? 'Revenue trend' : 'Trend data not yet available'"
      >
        <LineAreaChart
          :loading="loading"
          :categories="revenueCategories"
          :series="revenueSeries"
          :target="revenueTarget"
          :height="260"
        />
        <template
          v-if="!loading && revenueSeries.length"
          #legend
        >
          <span class="legend-item">
            <span class="legend-swatch" style="background: rgb(var(--v-theme-chart-revenue));" />
            Revenue <b class="mono num">{{ fmtMoney(0) }}</b>
          </span>
          <span class="legend-item">
            <span class="legend-swatch" style="background: rgb(var(--v-theme-chart-expense));" />
            Expenses <b class="mono num">{{ fmtMoney(0) }}</b>
          </span>
        </template>
      </ChartCard>

      <ChartCard
        eyebrow="Payment mix · today"
        :insight="paymentInsight || 'No paid orders yet'"
        sub="Share of paid revenue by method"
      >
        <DonutChart
          :loading="loading"
          :data="paymentMix"
          :size="188"
          center-label="Collected"
        />
      </ChartCard>
    </div>

    <!-- ============ Row 4: orders/hour (1.4fr) + top products (1fr) ============ -->
    <div class="grid grid--140-100 mb-5">
      <ChartCard
        eyebrow="Orders by hour · today"
        :insight="ordersByHourInsight"
        :sub="today?.units_sold ? `${today.units_sold} items sold` : undefined"
      >
        <BarChart
          :loading="loading"
          :data="ordersByHourData"
          :height="240"
          value-label="Orders"
          :y-format="(v) => String(Math.round(v))"
        />
      </ChartCard>

      <ChartCard
        eyebrow="Top products · today"
        :insight="topProductInsight"
        sub="By revenue contribution"
      >
        <HBarChart
          :loading="loading"
          :data="topProductsForChart"
          :value-format="fmtAbbr"
        />
      </ChartCard>
    </div>

    <!-- ============ Row 5: recent orders (1.7fr) + side column (1fr) ============ -->
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
          <div class="card__actions">
            <VBtn
              variant="text"
              size="small"
              append-icon="bx-chevron-right"
              @click="router.push('/orders')"
            >
              {{ t('View all') }}
            </VBtn>
          </div>
        </div>
        <div class="card__divider" />
        <div v-if="recentOrdersLoading" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <Skeleton v-for="i in 5" :key="i" :h="18" />
        </div>
        <StateFill
          v-else-if="!recentOrders.length"
          icon="bx-receipt"
          title="No orders yet today"
        />
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
            <tr
              v-for="o in recentOrders"
              :key="o.id"
            >
              <td class="cell-strong mono">
                #{{ o.display_id ?? o.id }}
              </td>
              <td>
                <Badge tone="neutral">
                  {{ o.order_type ?? 'HALL' }}
                </Badge>
              </td>
              <td>
                <StatusBadge :value="o.status" dot />
              </td>
              <td>
                <StatusBadge :value="o.is_paid ? 'PAID' : 'UNPAID'" />
              </td>
              <td class="num mono cell-strong">
                {{ fmtMoney(Number(o.total_amount) || 0) }}
              </td>
              <td class="num mono cell-muted">
                {{ o.created_at ? fmtTime(o.created_at) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display: flex; flex-direction: column; gap: var(--sp-5);">
        <div class="card">
          <div class="card__head card__head--tight">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Clocked In') }}
              </h3>
            </div>
            <Badge tone="primary">
              {{ clockedIn.length }} active
            </Badge>
          </div>
          <div class="card__body card__body--tight">
            <div v-if="loading" style="display: flex; flex-direction: column; gap: 10px;">
              <Skeleton v-for="i in 2" :key="i" :h="40" />
            </div>
            <StateFill
              v-else-if="!clockedIn.length"
              icon="bx-user"
              title="No one on shift"
            />
            <div
              v-for="c in clockedIn"
              v-else
              :key="c.shift_id ?? c.name"
              class="clockin-row"
              @click="router.push('/shifts-analytics')"
            >
              <div class="avatar--sm">
                {{ ((c.name ?? '?').trim()[0] || '?').toUpperCase() }}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 14px;">
                  {{ c.name }}
                </div>
                <div style="font-size: 12px; color: rgb(var(--v-theme-text-tertiary));">
                  {{ t('Since') }} {{ c.start_time ? fmtDateTime(c.start_time) : '—' }}
                </div>
              </div>
              <Badge tone="success" dot>
                {{ t('On shift') }}
              </Badge>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head card__head--tight">
            <div class="card__head-text">
              <h3 class="card__title">
                {{ t('Low stock') }}
              </h3>
            </div>
            <Badge tone="warning">
              {{ lowStockCount ?? 0 }} items
            </Badge>
          </div>
          <div class="card__body card__body--tight">
            <StateFill
              icon="bx-package"
              title="Detailed list pending"
              :sub="t('Count only — full list not yet wired')"
            >
              <VBtn
                size="small"
                variant="text"
                append-icon="bx-chevron-right"
                style="margin-top: 8px;"
                @click="router.push('/stock/items')"
              >
                {{ t('View items') }}
              </VBtn>
            </StateFill>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page {
  padding: var(--sp-7);
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
}

.grid {
  display: grid;
  gap: var(--sp-5);
}

.cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

.grid--170-100 {
  grid-template-columns: 1.7fr 1fr;
}

.grid--140-100 {
  grid-template-columns: 1.4fr 1fr;
}

@media (max-width: 1100px) {
  .cols-4 { grid-template-columns: repeat(2, 1fr); }
  .grid--170-100,
  .grid--140-100 { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .cols-4 { grid-template-columns: 1fr; }
}

.mb-5 {
  margin-block-end: var(--sp-5);
}

/* ---- Card ---- */
.card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
}
.card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
}
.card__head--tight {
  padding-block-end: var(--sp-3);
}
.card__head-text {
  min-width: 0;
}
.card__title {
  font-size: var(--fs-h3);
  font-weight: var(--fw-semibold);
  margin: 0;
  letter-spacing: -0.01em;
  color: rgb(var(--v-theme-on-surface));
}
.card__sub {
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-secondary));
  margin-top: 3px;
}
.card__actions {
  margin-left: auto;
}
.card__divider {
  height: 1px;
  background: rgb(var(--v-theme-border));
}
.card__body {
  padding: 0 var(--sp-5) var(--sp-5);
}
.card__body--tight {
  padding-top: 0;
}

/* ---- DTable ---- */
.dtable {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--fs-body);
}
.dtable thead th {
  background: rgb(var(--v-theme-surface-2));
  color: rgb(var(--v-theme-text-secondary));
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  text-align: left;
  padding: 12px var(--sp-4);
  white-space: nowrap;
  border-bottom: 1px solid rgb(var(--v-theme-border));
}
.dtable th.num,
.dtable td.num {
  text-align: right;
}
.dtable tbody td {
  padding: 14px var(--sp-4);
  border-bottom: 1px solid rgb(var(--v-theme-border));
  color: rgb(var(--v-theme-on-surface));
  vertical-align: middle;
}
.dtable tbody tr:last-child td {
  border-bottom: none;
}
.dtable tbody tr {
  transition: background .12s;
}
.dtable tbody tr:hover {
  background: rgb(var(--v-theme-surface-2));
}
.dtable .cell-strong {
  font-weight: var(--fw-semibold);
}
.dtable .cell-muted {
  color: rgb(var(--v-theme-text-secondary));
}
.dtable .mono {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
  letter-spacing: -0.01em;
}

/* ---- Clocked-in row ---- */
.clockin-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  cursor: pointer;
  border-radius: var(--r-sm);
  transition: background .12s;
}
.clockin-row:hover {
  background: rgb(var(--v-theme-surface-2));
  padding-inline: 4px;
  margin-inline: -4px;
}
.avatar--sm {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary-weak));
  color: rgb(var(--v-theme-primary));
  display: grid;
  place-items: center;
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  flex: 0 0 28px;
}

/* ---- Legend (for revenue chart) ---- */
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-secondary));
  font-weight: var(--fw-medium);
}
.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: 0 0 10px;
}
.legend-item b {
  color: rgb(var(--v-theme-on-surface));
  font-weight: var(--fw-semibold);
}
.mono {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
}
.num {
  font-variant-numeric: tabular-nums;
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

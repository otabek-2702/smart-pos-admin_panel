<script setup lang="ts">
import axios from '@/plugins/axios'
import VueApexCharts from 'vue3-apexcharts'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Select from '@/components/design/Select.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

// -------- filters --------
const dateFrom = ref(new Date().toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))
const userIdFilter = ref<string>('')
const cashiers = ref<any[]>([])
const statusFilter = ref<string>('')

function setRangePreset(preset: 'today' | 'last7' | 'last30' | 'thisMonth') {
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (preset === 'today') {
    dateFrom.value = iso(today)
    dateTo.value = iso(today)
  }
  else if (preset === 'last7') {
    const from = new Date(today)
    from.setDate(today.getDate() - 6)
    dateFrom.value = iso(from)
    dateTo.value = iso(today)
  }
  else if (preset === 'last30') {
    const from = new Date(today)
    from.setDate(today.getDate() - 29)
    dateFrom.value = iso(from)
    dateTo.value = iso(today)
  }
  else if (preset === 'thisMonth') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    dateFrom.value = iso(from)
    dateTo.value = iso(today)
  }
}

// -------- response --------
const data = ref<any>(null)
const loading = ref(false)

async function loadCashiers() {
  try {
    const res = await axios.get('/users', { params: { role: 'CASHIER', per_page: 200 } })
    const d = res.data?.data ?? res.data

    cashiers.value = d?.users ?? d?.items ?? []
  }
  catch {
    cashiers.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const params: any = { from: dateFrom.value, to: dateTo.value }
    if (userIdFilter.value)
      params.user_id = userIdFilter.value
    const res = await axios.get('/analytics/shifts/cashiers', { params })

    data.value = res.data?.data ?? res.data
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
    data.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(() => { loadCashiers(); load() })
watch([dateFrom, dateTo, userIdFilter], load)

// -------- derived --------
const summary = computed<any>(() => data.value?.summary)
const leaderboard = computed<any[]>(() => data.value?.leaderboard ?? [])
const distribution = computed<any>(() => data.value?.distribution)
const lateArrivals = computed<any[]>(() => summary.value?.punctuality?.late_arrivals ?? [])
const perShift = computed<any[]>(() => data.value?.shifts ?? [])
const filteredPerShift = computed<any[]>(() => {
  if (!statusFilter.value) return perShift.value
  return perShift.value.filter((s: any) => s.status === statusFilter.value)
})
const router = useRouter()

function openHandover(shiftId: number) {
  router.push({ path: '/analytics/shift-handover', query: { shift: String(shiftId) } })
}

// -------- filter options --------
const cashierOptions = computed(() =>
  cashiers.value.map(c => ({ value: String(c.id), label: `${c.first_name} ${c.last_name}` })),
)

const statusOptions = computed(() => [
  { value: 'ACTIVE', label: t('shift_status_ACTIVE') },
  { value: 'ENDED', label: t('shift_status_ENDED') },
  { value: 'COMPLETED', label: t('shift_status_COMPLETED') },
  { value: 'ABANDONED', label: t('shift_status_ABANDONED') },
])

// -------- charts --------
const paymentMixSeries = computed(() => {
  const mix = summary.value?.money?.payment_mix_pct ?? {}

  return [mix.CASH ?? 0, mix.UZCARD ?? 0, mix.HUMO ?? 0, mix.PAYME ?? 0, mix.MIXED ?? 0]
})

const paymentMixOptions = computed(() => ({
  chart: { type: 'donut', toolbar: { show: false } },
  labels: [t('payment_method_CASH'), t('payment_method_UZCARD'), t('payment_method_HUMO'), t('payment_method_PAYME'), t('payment_method_MIXED')],
  colors: ['#22c55e', '#3b82f6', '#f59e0b', '#06b6d4', '#a855f7'],
  legend: { position: 'bottom' },
  dataLabels: { enabled: true, formatter: (v: number) => `${v.toFixed(1)}%` },
}))

const byHourOptions = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '70%' } },
  xaxis: { categories: (distribution.value?.by_hour ?? []).map((b: any) => `${b.hour}:00`) },
  colors: ['#6366f1'],
  dataLabels: { enabled: false },
}))

const byHourSeries = computed(() => [{
  name: t('Orders'),
  data: (distribution.value?.by_hour ?? []).map((b: any) => b.orders),
}])

const byDateOptions = computed(() => ({
  chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false } },
  xaxis: { categories: (distribution.value?.by_date ?? []).map((b: any) => b.date), labels: { rotate: -45 } },
  stroke: { curve: 'smooth', width: 2 },
  colors: ['#22c55e'],
  dataLabels: { enabled: false },
}))

const byDateSeries = computed(() => [{
  name: t('Revenue'),
  data: (distribution.value?.by_date ?? []).map((b: any) => Number(b.revenue)),
}])

// -------- variance helpers --------
function varianceColor(v: string | number): 'success' | 'error' | 'warning' {
  const n = Number(v)
  if (Math.abs(n) < 0.01) return 'success'

  return n < 0 ? 'error' : 'warning'
}

function varianceTone(v: string | number): 'success' | 'error' | 'warning' {
  return varianceColor(v)
}

function shiftStatusTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'COMPLETED') return 'success'
  if (status === 'ENDED') return 'warning'
  return 'neutral'
}

// -------- duration / time formatters --------
function fmtMinutes(min: number | null | undefined) {
  const n = Number(min ?? 0)
  return t('{n} min', { n: Math.round(n) })
}

function fmtSecondsAsMin(sec: number | null | undefined) {
  const n = Number(sec ?? 0)
  return t('{n} min', { n: Math.round(n / 60) })
}

function fmtSecondsAsMinSec(sec: number | null | undefined) {
  const n = Number(sec ?? 0)
  return t('{m} min {s} sec', { m: Math.floor(n / 60), s: n % 60 })
}

function fmtMinutesAsHours(min: number | null | undefined) {
  const n = Number(min ?? 0)
  return t('{n} h', { n: Math.round(n / 60) })
}

function fmtLateMinutes(min: number | null | undefined) {
  const n = Number(min ?? 0)
  return `+${t('{n} min', { n })}`
}

// -------- leaderboard columns --------
const leaderboardColumns = computed<DataTableColumn<any>[]>(() => [
  { key: 'revenue_rank', label: '#', align: 'left', width: 60 },
  { key: 'user_name', label: t('Cashier'), sortable: true },
  { key: 'shifts', label: t('Shifts'), align: 'right', sortable: true },
  { key: 'orders', label: t('Orders'), align: 'right', sortable: true },
  { key: 'revenue', label: t('Revenue'), align: 'right', sortable: true },
  { key: 'cash', label: t('Cash'), align: 'right', sortable: true },
  { key: 'avg_order_value', label: t('AOV'), align: 'right', sortable: true },
  { key: 'cancel_rate_pct', label: t('Cancel %'), align: 'right', sortable: true },
  { key: 'late_shifts', label: t('Late'), align: 'right' },
  { key: 'cash_variance', label: t('Variance'), align: 'right', sortable: true },
  { key: 'avg_prep_seconds', label: t('Avg prep'), align: 'right', sortable: true },
])

// -------- per-shift columns --------
const shiftColumns = computed<DataTableColumn<any>[]>(() => [
  { key: 'user_name', label: t('Cashier'), sortable: true },
  { key: 'status', label: t('Status') },
  { key: 'start_time', label: t('Date'), sortable: true },
  { key: 'duration_minutes', label: t('Duration'), align: 'right', sortable: true },
  { key: 'orders_total', label: t('Orders'), align: 'right', sortValue: r => r.orders?.total ?? 0 },
  { key: 'by_type', label: t('By type') },
  { key: 'units_sold', label: t('Units'), align: 'right', sortValue: r => r.items?.units_sold ?? 0 },
  { key: 'line_items', label: t('Lines'), align: 'right', sortValue: r => r.items?.line_items ?? 0 },
  { key: 'revenue', label: t('Revenue'), align: 'right', sortValue: r => r.money?.revenue ?? 0 },
  { key: 'cash', label: t('Cash'), align: 'right', sortValue: r => r.money?.cash ?? 0 },
  { key: 'card', label: t('Card'), align: 'right', sortValue: r => r.money?.card ?? 0 },
  { key: 'aov', label: t('AOV'), align: 'right', sortValue: r => r.money?.avg_order_value ?? 0 },
  { key: 'discount_rate_pct', label: `${t('Discount')} %`, align: 'right', sortValue: r => r.discounts?.discount_rate_pct ?? 0 },
  { key: 'avg_discount_pct', label: `${t('Avg discount')} %`, align: 'right', sortValue: r => r.discounts?.avg_discount_pct ?? 0 },
  { key: 'avg_prep_seconds', label: t('Prep'), align: 'right', sortValue: r => r.speed?.avg_prep_seconds ?? 0 },
  { key: 'is_late', label: t('Late'), align: 'right' },
  { key: 'variance', label: t('Variance'), align: 'right' },
])
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">{{ t('Cashier Shift Analytics') }}</h1>
        <div class="page-head__subtitle">{{ dateFrom }} — {{ dateTo }}</div>
      </div>
    </div>

    <!-- Filters -->
    <Card className="mb-4">
      <div class="toolbar cs-toolbar">
        <Field :label="t('From')">
          <input
            v-model="dateFrom"
            type="date"
            class="cs-date-input"
          >
        </Field>
        <Field :label="t('To')">
          <input
            v-model="dateTo"
            type="date"
            class="cs-date-input"
          >
        </Field>
        <Field :label="t('Cashier')" class="cs-select-field">
          <Select
            v-model="userIdFilter"
            :options="cashierOptions"
            :placeholder="t('All cashiers')"
          />
        </Field>
        <Field :label="t('Filter by status')" class="cs-select-field">
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            :placeholder="t('All statuses')"
          />
        </Field>
        <div class="cs-chip-row">
          <Button size="sm" variant="ghost" @click="setRangePreset('today')">{{ t('Today') }}</Button>
          <Button size="sm" variant="ghost" @click="setRangePreset('last7')">{{ t('Last 7 days') }}</Button>
          <Button size="sm" variant="ghost" @click="setRangePreset('last30')">{{ t('Last 30 days') }}</Button>
          <Button size="sm" variant="ghost" @click="setRangePreset('thisMonth')">{{ t('This month') }}</Button>
        </div>
      </div>
    </Card>

    <div
      v-if="!summary && loading"
      class="text-center py-8"
    >
      <VProgressCircular indeterminate />
    </div>

    <template v-else-if="summary">
      <!-- Top-line KPIs -->
      <div class="grid cols-4 mb-4">
        <div class="kpi">
          <div class="kpi__top">
            <div class="kpi__icon t-primary"><VIcon icon="bx-time" size="20" /></div>
            <div class="kpi__label">{{ t('Shifts') }}</div>
          </div>
          <div class="kpi__value num-tabular">{{ summary.shift_count }}</div>
          <div class="kpi__foot">
            <span class="kpi__subtext">{{ summary.distinct_cashiers }} {{ t('cashiers') }}</span>
          </div>
        </div>
        <div class="kpi">
          <div class="kpi__top">
            <div class="kpi__icon t-info"><VIcon icon="bx-stopwatch" size="20" /></div>
            <div class="kpi__label">{{ t('Total Hours') }}</div>
          </div>
          <div class="kpi__value num-tabular">{{ summary.total_hours }}<span class="kpi__unit">{{ t('hours_unit') }}</span></div>
          <div class="kpi__foot">
            <span class="kpi__subtext">{{ t('avg') }} {{ fmtMinutes(summary.avg_shift_minutes) }}</span>
          </div>
        </div>
        <div class="kpi">
          <div class="kpi__top">
            <div class="kpi__icon t-warning"><VIcon icon="bx-receipt" size="20" /></div>
            <div class="kpi__label">{{ t('Orders') }}</div>
          </div>
          <div class="kpi__value num-tabular">{{ summary.orders.total }}</div>
          <div class="kpi__foot">
            <span class="kpi__subtext text-error">{{ summary.orders.cancelled }} {{ t('cancelled') }} ({{ summary.orders.cancel_rate_pct }}%)</span>
          </div>
        </div>
        <div class="kpi">
          <div class="kpi__top">
            <div class="kpi__icon t-success"><VIcon icon="bx-dollar" size="20" /></div>
            <div class="kpi__label">{{ t('Revenue') }}</div>
          </div>
          <div class="kpi__value num-tabular">{{ formatCurrency(summary.money.revenue) }}<span class="kpi__unit">UZS</span></div>
          <div class="kpi__foot">
            <span class="kpi__subtext">{{ formatCurrency(summary.money.revenue_per_hour) }} / {{ t('hours_unit') }}</span>
          </div>
        </div>
      </div>

      <!-- Money split + payment mix + speed -->
      <div class="grid cols-3 mb-4">
        <Card>
          <div class="card-pad">
            <div class="card-title">{{ t('Money Split') }}</div>
            <div class="cs-row">
              <span class="cs-row__label">{{ t('Cash') }}</span>
              <span class="cs-row__val">{{ formatCurrency(summary.money.cash) }}</span>
            </div>
            <div class="cs-row">
              <span class="cs-row__label">{{ t('Card') }}</span>
              <span class="cs-row__val">{{ formatCurrency(summary.money.card) }}</span>
            </div>
            <hr class="cs-divider">
            <div class="cs-row">
              <span class="cs-row__label">{{ t('Avg Order Value') }}</span>
              <span>{{ formatCurrency(summary.money.avg_order_value) }}</span>
            </div>
            <div class="cs-row">
              <span class="cs-row__label">{{ t('Avg per Shift') }}</span>
              <span>{{ formatCurrency(summary.money.avg_per_shift) }}</span>
            </div>
          </div>
        </Card>
        <Card>
          <div class="card-pad">
            <div class="card-title">{{ t('Payment Mix') }}</div>
            <VueApexCharts
              :options="paymentMixOptions"
              :series="paymentMixSeries"
              height="240"
            />
          </div>
        </Card>
        <Card>
          <div class="card-pad">
            <div class="card-title">{{ t('Speed') }}</div>
            <div class="cs-row">
              <span class="cs-row__label">{{ t('Avg Prep') }}</span>
              <span class="cs-row__val">{{ fmtSecondsAsMinSec(summary.speed.avg_prep_seconds) }}</span>
            </div>
            <div class="cs-row">
              <span class="text-success">{{ t('Fastest shift') }}</span>
              <span>{{ fmtSecondsAsMin(summary.speed.fastest_shift_avg_seconds) }}</span>
            </div>
            <div class="cs-row">
              <span class="text-error">{{ t('Slowest shift') }}</span>
              <span>{{ fmtSecondsAsMin(summary.speed.slowest_shift_avg_seconds) }}</span>
            </div>
            <hr class="cs-divider">
            <div class="card-subtitle">{{ t('Discounts') }}</div>
            <div class="cs-row">
              <span class="cs-row__label">{{ t('Total Given') }}</span>
              <span>{{ formatCurrency(summary.discounts.total_given) }}</span>
            </div>
            <div class="cs-row">
              <span class="cs-row__label">{{ summary.discounts.discounted_orders }} {{ t('orders') }}</span>
              <span>{{ summary.discounts.discount_rate_pct }}%</span>
            </div>
          </div>
        </Card>
      </div>

      <!-- Punctuality + Cash accuracy -->
      <div class="grid cols-2 mb-4">
        <Card>
          <div class="card-pad">
            <div class="card-title">{{ t('Punctuality') }}</div>
            <div class="cs-stats-row">
              <div class="cs-stat">
                <div class="cs-stat__label text-success">{{ t('On time') }}</div>
                <div class="cs-stat__value">{{ summary.punctuality.on_time_shifts }}</div>
              </div>
              <div class="cs-stat">
                <div class="cs-stat__label text-warning">{{ t('Late') }}</div>
                <div class="cs-stat__value">{{ summary.punctuality.late_shifts }}</div>
              </div>
              <div class="cs-stat">
                <div class="cs-stat__label text-disabled">{{ t('Rate') }}</div>
                <div class="cs-stat__value">{{ summary.punctuality.punctuality_rate_pct }}%</div>
              </div>
            </div>
            <hr class="cs-divider">
            <div class="card-subtitle">{{ t('Worst late arrivals') }}</div>
            <div
              v-for="la in lateArrivals.slice(0, 5)"
              :key="la.shift_id"
              class="cs-row cs-row--sm"
            >
              <span>{{ la.user_name }}</span>
              <span class="text-warning font-weight-medium">{{ fmtLateMinutes(la.late_minutes) }}</span>
            </div>
          </div>
        </Card>
        <Card>
          <div class="card-pad">
            <div class="card-title">{{ t('Cash Accuracy') }}</div>
            <div class="cs-stats-row cs-stats-row--4">
              <div class="cs-stat">
                <div class="cs-stat__label text-success">{{ t('Exact') }}</div>
                <div class="cs-stat__value">{{ summary.cash_accuracy.exact_count }}</div>
              </div>
              <div class="cs-stat">
                <div class="cs-stat__label text-error">{{ t('Short') }}</div>
                <div class="cs-stat__value">{{ summary.cash_accuracy.short_count }}</div>
              </div>
              <div class="cs-stat">
                <div class="cs-stat__label text-warning">{{ t('Over') }}</div>
                <div class="cs-stat__value">{{ summary.cash_accuracy.over_count }}</div>
              </div>
              <div class="cs-stat">
                <div class="cs-stat__label text-disabled">{{ t('Not reconciled') }}</div>
                <div class="cs-stat__value">{{ summary.cash_accuracy.shifts_unreconciled }}</div>
              </div>
            </div>
            <hr class="cs-divider">
            <div class="cs-row cs-row--sm">
              <span class="cs-row__label">{{ t('Net variance') }}</span>
              <Badge :tone="varianceTone(summary.cash_accuracy.net_variance)">
                {{ formatCurrency(summary.cash_accuracy.net_variance) }}
              </Badge>
            </div>
            <div class="cs-row cs-row--sm">
              <span class="cs-row__label">{{ t('Worst shortage') }}</span>
              <span class="text-error">{{ summary.cash_accuracy.worst_shortage.user_name }} {{ formatCurrency(summary.cash_accuracy.worst_shortage.difference) }}</span>
            </div>
            <div class="cs-row cs-row--sm">
              <span class="cs-row__label">{{ t('Biggest overage') }}</span>
              <span class="text-warning">{{ summary.cash_accuracy.biggest_overage.user_name }} +{{ formatCurrency(summary.cash_accuracy.biggest_overage.difference) }}</span>
            </div>
          </div>
        </Card>
      </div>

      <!-- Leaderboard -->
      <Card className="mb-4">
        <div class="card-pad">
          <div class="card-title">{{ t('Leaderboard (by revenue)') }}</div>
        </div>
        <DataTable
          :columns="leaderboardColumns"
          :rows="leaderboard"
          row-key="user_id"
          :per-page="20"
          :empty-title="t('No data')"
          :empty-sub="t('No cashier results for this period.')"
        >
          <template #cell.revenue_rank="{ row }">
            <Badge tone="primary">{{ row.revenue_rank }}</Badge>
          </template>
          <template #cell.user_name="{ row }">
            <span class="cell-strong">{{ row.user_name }}</span>
          </template>
          <template #cell.revenue="{ row }">
            <span class="cell-strong">{{ formatCurrency(row.revenue) }}</span>
          </template>
          <template #cell.cash="{ row }">
            {{ formatCurrency(row.cash) }}
          </template>
          <template #cell.avg_order_value="{ row }">
            {{ formatCurrency(row.avg_order_value) }}
          </template>
          <template #cell.cancel_rate_pct="{ row }">
            {{ row.cancel_rate_pct }}%
          </template>
          <template #cell.late_shifts="{ row }">
            {{ row.late_shifts }} ({{ fmtMinutes(row.late_minutes_total) }})
          </template>
          <template #cell.cash_variance="{ row }">
            <Badge :tone="varianceTone(row.cash_variance)">
              {{ formatCurrency(row.cash_variance) }}
            </Badge>
          </template>
          <template #cell.avg_prep_seconds="{ row }">
            {{ fmtSecondsAsMin(row.avg_prep_seconds) }}
          </template>
        </DataTable>
      </Card>

      <!-- Per-shift breakdown -->
      <Card v-if="perShift.length" className="mb-4">
        <div class="card-pad">
          <div class="card-title">{{ t('Per-shift breakdown') }} ({{ filteredPerShift.length }})</div>
        </div>
        <DataTable
          :columns="shiftColumns"
          :rows="filteredPerShift"
          row-key="shift_id"
          :per-page="20"
          expandable
          :empty-title="t('No shifts')"
          :empty-sub="t('No shifts match your filters.')"
        >
          <template #cell.user_name="{ row }">
            <span class="cell-strong">{{ row.user_name }}</span>
          </template>
          <template #cell.status="{ row }">
            <Badge :tone="shiftStatusTone(row.status)">
              {{ t(`shift_status_${row.status}`) }}
            </Badge>
          </template>
          <template #cell.start_time="{ row }">
            {{ formatDate(row.start_time) }}
          </template>
          <template #cell.duration_minutes="{ row }">
            {{ fmtMinutesAsHours(row.duration_minutes) }}
          </template>
          <template #cell.orders_total="{ row }">
            {{ row.orders?.total ?? 0 }}
          </template>
          <template #cell.by_type="{ row }">
            <div class="cs-type-chips">
              <Badge tone="primary" :title="t('order_type_HALL')">{{ t('order_type_short_HALL') }} {{ row.orders?.by_type?.hall ?? 0 }}</Badge>
              <Badge tone="info" :title="t('order_type_DELIVERY')">{{ t('order_type_short_DELIVERY') }} {{ row.orders?.by_type?.delivery ?? 0 }}</Badge>
              <Badge tone="warning" :title="t('order_type_PICKUP')">{{ t('order_type_short_PICKUP') }} {{ row.orders?.by_type?.pickup ?? 0 }}</Badge>
            </div>
          </template>
          <template #cell.units_sold="{ row }">
            {{ row.items?.units_sold ?? 0 }}
          </template>
          <template #cell.line_items="{ row }">
            {{ row.items?.line_items ?? 0 }}
          </template>
          <template #cell.revenue="{ row }">
            <span class="cell-strong">{{ formatCurrency(row.money?.revenue ?? 0) }}</span>
          </template>
          <template #cell.cash="{ row }">
            {{ formatCurrency(row.money?.cash ?? 0) }}
          </template>
          <template #cell.card="{ row }">
            {{ formatCurrency(row.money?.card ?? 0) }}
          </template>
          <template #cell.aov="{ row }">
            {{ formatCurrency(row.money?.avg_order_value ?? 0) }}
          </template>
          <template #cell.discount_rate_pct="{ row }">
            {{ row.discounts?.discount_rate_pct ?? 0 }}%
          </template>
          <template #cell.avg_discount_pct="{ row }">
            {{ row.discounts?.avg_discount_pct ?? 0 }}%
          </template>
          <template #cell.avg_prep_seconds="{ row }">
            {{ fmtSecondsAsMin(row.speed?.avg_prep_seconds ?? 0) }}
          </template>
          <template #cell.is_late="{ row }">
            <span v-if="row.punctuality?.is_late" class="text-warning">{{ fmtLateMinutes(row.punctuality.late_minutes) }}</span>
            <span v-else class="text-success">{{ t('on_time_mark') }}</span>
          </template>
          <template #cell.variance="{ row }">
            <Badge
              v-if="row.reconciliation"
              :tone="varianceTone(row.reconciliation.difference)"
            >
              {{ formatCurrency(row.reconciliation.difference) }}
            </Badge>
            <span v-else class="text-disabled">—</span>
          </template>
          <template #row-actions="{ row }">
            <IconAction
              icon="send"
              :title="t('Open handover')"
              @click="openHandover(row.shift_id)"
            />
          </template>
          <template #expanded="{ row }">
            <div class="cs-expand">
              <div class="cs-expand__col">
                <div class="card-subtitle">{{ t('Payment mix') }}</div>
                <div v-for="(v, k) in (row.money?.payment_mix ?? {})" :key="k" class="cs-row cs-row--sm">
                  <span class="cs-row__label">{{ t(`payment_method_${k}`) }}</span>
                  <span>{{ formatCurrency(v) }}</span>
                </div>
              </div>
              <div class="cs-expand__col">
                <div class="card-subtitle">{{ t('Attendance') }}</div>
                <div class="cs-row cs-row--sm">
                  <span class="cs-row__label">{{ t('Scheduled start') }}</span>
                  <span>{{ row.punctuality?.scheduled_start ? formatDate(row.punctuality.scheduled_start) : '—' }}</span>
                </div>
                <div class="cs-row cs-row--sm">
                  <span class="cs-row__label">{{ t('Check-in') }}</span>
                  <span>{{ row.punctuality?.attendance?.check_in ? formatDate(row.punctuality.attendance.check_in) : '—' }}</span>
                </div>
                <div class="cs-row cs-row--sm">
                  <span class="cs-row__label">{{ t('Check-out') }}</span>
                  <span>{{ row.punctuality?.attendance?.check_out ? formatDate(row.punctuality.attendance.check_out) : '—' }}</span>
                </div>
              </div>
            </div>
          </template>
        </DataTable>
      </Card>

      <!-- Distribution charts -->
      <div class="grid cols-2">
        <Card>
          <div class="card-pad">
            <div class="card-title">
              {{ t('Orders by Hour') }} ({{ t('Peak') }}: {{ distribution.peak_hour }}:00)
            </div>
            <VueApexCharts
              :options="byHourOptions"
              :series="byHourSeries"
              height="280"
            />
          </div>
        </Card>
        <Card>
          <div class="card-pad">
            <div class="card-title">{{ t('Revenue by Date') }}</div>
            <VueApexCharts
              :options="byDateOptions"
              :series="byDateSeries"
              height="280"
            />
          </div>
        </Card>
      </div>
    </template>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.cs-toolbar {
  align-items: flex-end;
}

.cs-date-input {
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--text);
  font-size: var(--fs-body);
  min-width: 160px;
}

.cs-select-field {
  min-width: 200px;
  flex: 1 1 200px;
}

.cs-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.card-pad {
  padding: var(--sp-4);
}

.card-title {
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--text);
  margin-bottom: var(--sp-3);
}

.card-subtitle {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--text);
  margin-block: var(--sp-2);
}

.cs-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--sp-2);
  font-size: var(--fs-body);
}

.cs-row--sm {
  font-size: var(--fs-sm);
  margin-bottom: 4px;
}

.cs-row__label {
  color: var(--text-secondary);
}

.cs-row__val {
  font-weight: var(--fw-semibold);
}

.cs-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin-block: var(--sp-3);
}

.cs-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-3);
}

.cs-stats-row--4 {
  grid-template-columns: repeat(4, 1fr);
}

.cs-stat__label {
  font-size: var(--fs-sm);
  margin-bottom: 4px;
}

.cs-stat__value {
  font-size: var(--fs-h3);
  font-weight: var(--fw-bold);
  font-family: var(--font-mono);
}

.cs-type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.cs-expand {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: var(--sp-3) var(--sp-2);
}

.cs-expand__col {
  min-width: 220px;
  flex: 1 1 220px;
}

@media (max-width: 768px) {
  .cs-select-field,
  .cs-date-input {
    min-width: 100%;
    flex: 1 1 100%;
  }
  .cs-stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .cs-stats-row--4 {
    grid-template-columns: repeat(2, 1fr);
  }
  .cs-expand__col {
    min-width: 100%;
    flex: 1 1 100%;
  }
}

@media (max-width: 420px) {
  .cs-stats-row,
  .cs-stats-row--4 {
    grid-template-columns: 1fr;
  }
  .cs-expand {
    gap: 16px;
    padding: var(--sp-2);
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

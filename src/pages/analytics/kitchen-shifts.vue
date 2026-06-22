<script setup lang="ts">
import axios from '@/plugins/axios'
import VueApexCharts from 'vue3-apexcharts'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable from '@/components/design/DataTable.vue'
import Field from '@/components/design/Field.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

// -------- filters --------
const dateFrom = ref(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))
const userIdFilter = ref<string>('')
const roleFilter = ref<string>('WAITER')
const targetPrepMinutes = ref<number>(15)
const staff = ref<any[]>([])

// -------- response --------
const data = ref<any>(null)
const loading = ref(false)

async function loadStaff() {
  try {
    const res = await axios.get('/users', { params: { role: roleFilter.value, per_page: 200 } })
    const d = res.data?.data ?? res.data

    staff.value = d?.users ?? d?.items ?? []
  }
  catch {
    staff.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const params: any = {
      from: dateFrom.value, to: dateTo.value, role: roleFilter.value,
      target_prep_minutes: targetPrepMinutes.value,
    }
    if (userIdFilter.value)
      params.user_id = userIdFilter.value
    const res = await axios.get('/analytics/shifts/kitchen', { params })

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

onMounted(() => { loadStaff(); load() })
watch([dateFrom, dateTo, userIdFilter, targetPrepMinutes], load)
watch(roleFilter, () => { loadStaff(); load() })

const summary = computed<any>(() => data.value?.summary)
const distribution = computed<any>(() => data.value?.distribution)
const shifts = computed<any[]>(() => data.value?.shifts ?? [])
const lateArrivals = computed<any[]>(() => summary.value?.punctuality?.late_arrivals ?? [])

function fmtSec(s: number | null | undefined) {
  if (!s && s !== 0) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60

  return `${m}${t('time_min_suffix')} ${sec}${t('time_sec_suffix')}`
}

const roleOptions = computed(() => [
  { value: 'WAITER', label: t('role_WAITER') },
  { value: 'CASHIER', label: t('role_CASHIER') },
  { value: 'ADMIN', label: t('role_ADMIN') },
  { value: 'MANAGER', label: t('role_MANAGER') },
])

const staffOptions = computed(() =>
  staff.value.map((s: any) => ({ value: String(s.id), label: `${s.first_name} ${s.last_name}` })),
)

const byHourSeries = computed(() => [{
  name: t('Orders'),
  data: (distribution.value?.by_hour ?? []).map((b: any) => b.orders),
}])

const byHourOptions = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '70%' } },
  xaxis: { categories: (distribution.value?.by_hour ?? []).map((b: any) => `${b.hour}:00`) },
  colors: ['#f59e0b'],
  dataLabels: { enabled: false },
}))

// -------- shift table columns --------
const shiftColumns = computed(() => [
  { key: 'user_name', label: t('Staff'), sortable: true },
  { key: 'start_time', label: t('Date'), sortable: true },
  { key: 'duration_minutes', label: t('Duration'), sortable: true, align: 'right' as const },
  { key: 'orders_in_window', label: t('Orders'), sortable: true, align: 'right' as const },
  { key: 'orders_readied', label: t('Readied'), align: 'right' as const },
  { key: 'items_prepared', label: t('Items'), align: 'right' as const },
  { key: 'avg_prep', label: t('Avg Prep'), align: 'right' as const },
  { key: 'median_prep', label: t('Median prep'), align: 'right' as const },
  { key: 'slow', label: t('Slow'), align: 'right' as const },
  { key: 'throughput', label: t('Orders/h'), align: 'right' as const },
  { key: 'late', label: t('Late'), align: 'right' as const },
])
</script>

<template>
  <div>
    <PageHeader
      :title="t('Kitchen Shift Analytics')"
      :subtitle="`${dateFrom} — ${dateTo}`"
    />

    <Card class="mb-4">
      <div class="toolbar">
        <Field :label="t('From')" class="toolbar__field toolbar__field--date">
          <Input v-model="dateFrom" type="date" />
        </Field>
        <Field :label="t('To')" class="toolbar__field toolbar__field--date">
          <Input v-model="dateTo" type="date" />
        </Field>
        <Field :label="t('Role')" class="toolbar__field toolbar__field--select">
          <Select v-model="roleFilter" :options="roleOptions" />
        </Field>
        <Field :label="t('Staff')" class="toolbar__field toolbar__field--select">
          <Select v-model="userIdFilter" :options="staffOptions" :placeholder="t('All staff')" />
        </Field>
        <Field :label="t('Target prep (min)')" class="toolbar__field toolbar__field--num">
          <Input v-model.number="targetPrepMinutes" type="number" min="1" />
        </Field>
      </div>
    </Card>

    <div v-if="!summary && loading" class="loading-pad">
      <VProgressCircular indeterminate />
    </div>

    <template v-else-if="summary">
      <!-- KPIs -->
      <div class="grid cols-4 mb-4">
        <Kpi :data="{ label: t('Shifts'), value: summary.shift_count, icon: 'clock', tone: 'primary', sub: `${summary.distinct_staff} ${t('staff')}` }" />
        <Kpi :data="{ label: t('Orders in Window'), value: summary.orders_in_window, icon: 'receipt', tone: 'info', sub: `${summary.completion_rate_pct}% ${t('completed')}` }" />
        <Kpi :data="{ label: t('Items Prepared'), value: summary.items_prepared, icon: 'package', tone: 'success', sub: `${summary.items_per_hour} / ${t('h')}` }" />
        <Kpi :data="{ label: t('Avg Prep Time'), value: fmtSec(summary.prep_time.avg_seconds), icon: 'clock', tone: 'warning', sub: `${summary.prep_time.slow_orders} ${t('slow')} (${summary.prep_time.slow_rate_pct}%)` }" />
      </div>

      <!-- Prep + Punctuality -->
      <div class="grid cols-2 mb-4">
        <Card>
          <div class="section-title">{{ t('Prep Time') }}</div>
          <div class="row-line">
            <span class="muted">{{ t('Average') }}</span>
            <span class="strong">{{ fmtSec(summary.prep_time.avg_seconds) }}</span>
          </div>
          <div class="row-line">
            <span class="t-success">{{ t('Best shift') }}</span>
            <span>{{ fmtSec(summary.prep_time.best_shift_avg_seconds) }}</span>
          </div>
          <div class="row-line">
            <span class="t-danger">{{ t('Worst shift') }}</span>
            <span>{{ fmtSec(summary.prep_time.worst_shift_avg_seconds) }}</span>
          </div>
          <div class="divider" />
          <div class="row-line">
            <span class="muted">{{ t('Target') }}</span>
            <span>{{ fmtSec(summary.prep_time.target_seconds) }}</span>
          </div>
          <div class="row-line">
            <span class="t-warning">{{ t('Slow orders') }}</span>
            <span>{{ summary.prep_time.slow_orders }} ({{ summary.prep_time.slow_rate_pct }}%)</span>
          </div>
        </Card>

        <Card>
          <div class="section-title">{{ t('Punctuality') }}</div>
          <div class="grid cols-3 punct-grid">
            <div>
              <div class="caption t-success">{{ t('On time') }}</div>
              <div class="big-num">{{ summary.punctuality.on_time_shifts }}</div>
            </div>
            <div>
              <div class="caption t-warning">{{ t('Late') }}</div>
              <div class="big-num">{{ summary.punctuality.late_shifts }}</div>
            </div>
            <div>
              <div class="caption muted">{{ t('Rate') }}</div>
              <div class="big-num">{{ summary.punctuality.punctuality_rate_pct }}%</div>
            </div>
          </div>
          <div class="divider" />
          <div class="section-sub">{{ t('Worst late arrivals') }}</div>
          <div
            v-for="la in lateArrivals.slice(0, 5)"
            :key="la.shift_id"
            class="row-line small"
          >
            <span>{{ la.user_name }}</span>
            <span class="t-warning strong">+{{ la.late_minutes }}{{ t('time_min_suffix') }}</span>
          </div>
        </Card>
      </div>

      <!-- Per-shift -->
      <Card class="mb-4">
        <div class="section-title">{{ t('Per-shift breakdown') }}</div>
        <DataTable
          :columns="shiftColumns"
          :rows="shifts"
          row-key="shift_id"
          :loading="loading"
        >
          <template #cell.user_name="{ row }">
            <span class="strong">{{ row.user_name }}</span>
          </template>
          <template #cell.start_time="{ row }">
            {{ formatDate(row.start_time) }}
          </template>
          <template #cell.duration_minutes="{ row }">
            {{ Math.round(row.duration_minutes / 60) }}{{ t('hour_suffix') }}
          </template>
          <template #cell.orders_readied="{ row }">
            {{ row.orders_readied }} ({{ row.completion_rate_pct }}%)
          </template>
          <template #cell.items_prepared="{ row }">
            {{ row.items_prepared.units }}
          </template>
          <template #cell.avg_prep="{ row }">
            {{ fmtSec(row.prep_time.avg_seconds) }}
          </template>
          <template #cell.median_prep="{ row }">
            {{ fmtSec(row.prep_time.median_seconds) }}
          </template>
          <template #cell.slow="{ row }">
            {{ row.prep_time.slow_orders }} ({{ row.prep_time.slow_rate_pct }}%)
          </template>
          <template #cell.throughput="{ row }">
            {{ row.throughput.orders_per_hour }}
          </template>
          <template #cell.late="{ row }">
            <span v-if="row.punctuality.is_late" class="t-warning">+{{ row.punctuality.late_minutes }}{{ t('time_min_suffix') }}</span>
            <span v-else class="t-success">{{ t('punctuality_on_time_check') }}</span>
          </template>
        </DataTable>
      </Card>

      <!-- Chart -->
      <Card>
        <div class="section-title">
          {{ t('Orders by Hour') }} ({{ t('Peak') }}: {{ distribution.peak_hour }}:00)
        </div>
        <VueApexCharts
          :options="byHourOptions"
          :series="byHourSeries"
          height="280"
        />
      </Card>
    </template>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.mb-4 { margin-bottom: 16px; }
.loading-pad { text-align: center; padding: 32px 0; }

/* Toolbar: flex-wrap so inputs collapse on narrow screens */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}
.toolbar__field { flex: 0 1 auto; }
.toolbar__field--date { min-width: 160px; }
.toolbar__field--select { min-width: 180px; }
.toolbar__field--num { min-width: 140px; }

@media (max-width: 768px) {
  .toolbar__field,
  .toolbar__field--date,
  .toolbar__field--select,
  .toolbar__field--num { width: 100%; min-width: 0; }
}

/* Simple grid utility (collapses on mobile) */
.grid { display: grid; gap: 16px; }
.grid.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid.cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

@media (max-width: 1024px) {
  .grid.cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.cols-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 768px) {
  .grid.cols-2,
  .grid.cols-3 { grid-template-columns: 1fr; }
  .grid.cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.section-title {
  font-size: var(--fs-h6, 16px);
  font-weight: 600;
  margin-bottom: 12px;
}
.section-sub {
  font-size: var(--fs-body, 14px);
  font-weight: 600;
  margin-bottom: 8px;
}
.row-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.row-line.small { font-size: 13px; }
.row-line .strong, .strong { font-weight: 600; }
.muted { color: var(--text-tertiary, #94a3b8); }
.t-success { color: var(--success, #22c55e); }
.t-warning { color: var(--warning, #f59e0b); }
.t-danger { color: var(--danger, #ef4444); }

.divider {
  height: 1px;
  background: var(--border, rgba(148,163,184,0.2));
  margin: 8px 0;
}

.punct-grid { margin-bottom: 8px; }
.caption { font-size: 12px; }
.big-num {
  font-size: 20px;
  font-weight: 700;
  margin-top: 2px;
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

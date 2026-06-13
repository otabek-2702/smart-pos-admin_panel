<script setup lang="ts">
import axios from '@/plugins/axios'
import VueApexCharts from 'vue3-apexcharts'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()
const route = useRoute()
const router = useRouter()

// Shift id either via ?shift=N query, or numeric input on the page.
const shiftIdInput = ref<number | null>(Number(route.query.shift) || null)
const data = ref<any>(null)
const loading = ref(false)

async function load() {
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
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
    data.value = null
  }
  finally {
    loading.value = false
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
function settlementDiffColor(diff: string | number) {
  const n = Number(diff)
  if (Math.abs(n) < 0.01) return 'success'

  return n < 0 ? 'error' : 'warning'
}

// -------- charts --------
const paymentMixSeries = computed(() => {
  const mix = shift.value?.money?.payment_mix ?? {}

  return [Number(mix.CASH || 0), Number(mix.UZCARD || 0), Number(mix.HUMO || 0), Number(mix.PAYME || 0), Number(mix.MIXED || 0)]
})

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  return v || fallback
}

const paymentMixOptions = computed(() => ({
  chart: { type: 'donut', toolbar: { show: false } },
  labels: [t('Cash'), 'Uzcard', 'Humo', 'Payme', t('Mixed')],
  colors: [
    cssVar('--c1', '#22c55e'),
    cssVar('--c2', '#3b82f6'),
    cssVar('--c3', '#f59e0b'),
    cssVar('--c4', '#06b6d4'),
    cssVar('--c5', '#a855f7'),
  ],
  legend: { position: 'bottom' },
  dataLabels: { enabled: true, formatter: (v: number) => `${v.toFixed(1)}%` },
}))

const byHourSeries = computed(() => [{
  name: t('Orders'),
  data: (distribution.value?.by_hour ?? []).map((b: any) => b.orders),
}])

const byHourOptions = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '70%', distributed: false } },
  xaxis: { categories: (distribution.value?.by_hour ?? []).map((b: any) => `${b.hour}:00`) },
  colors: [cssVar('--chart-revenue', '#6366f1')],
  dataLabels: { enabled: false },
}))

const topProductsSeries = computed(() => [{
  name: t('Units sold'),
  data: products.value.slice(0, 8).map((p: any) => p.units_sold),
}])

const topProductsOptions = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
  xaxis: { categories: products.value.slice(0, 8).map((p: any) => p.name) },
  legend: { show: false },
  dataLabels: { enabled: false },
  colors: [
    cssVar('--c1', '#6366f1'),
    cssVar('--c2', '#8b5cf6'),
    cssVar('--c3', '#22c55e'),
    cssVar('--c4', '#f59e0b'),
    cssVar('--c5', '#ef4444'),
    cssVar('--chart-cash', '#06b6d4'),
    cssVar('--chart-card', '#ec4899'),
    cssVar('--chart-expense', '#84cc16'),
  ],
}))

// -------- helpers --------
const orderStatusColor: Record<string, string> = {
  COMPLETED: 'success', CANCELED: 'error', PREPARING: 'warning', READY: 'info', OPEN: 'default',
}

const paymentMethodColor: Record<string, string> = {
  CASH: 'success', UZCARD: 'primary', HUMO: 'warning', PAYME: 'info',
}

function reconColor(rec: any) {
  if (!rec) return 'default'
  if (rec.is_short) return 'error'
  if (rec.is_over) return 'warning'

  return 'success'
}

function fmtSec(s: number | null | undefined) {
  if (!s && s !== 0) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60

  return `${m}m ${sec}s`
}
</script>

<template>
  <div>
    <!-- Page head -->
    <div class="page-head">
      <div>
        <h1 class="page-head__title">
          {{ t('Shift Handover Report') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Per-shift performance, payments and punctuality') }}
        </div>
      </div>
      <div class="page-head__actions">
        <VTextField
          v-model.number="shiftIdInput"
          type="number"
          :label="t('Shift ID')"
          density="compact"
          variant="outlined"
          hide-details
          style="max-inline-size:160px;"
          :placeholder="t('Enter shift id')"
        />
        <VBtn
          color="primary"
          prepend-icon="bx-search"
          :loading="loading"
          @click="load"
        >
          {{ t('Load') }}
        </VBtn>
      </div>
    </div>

    <div v-if="!shift && !loading" class="text-center text-tertiary py-8">
      <VIcon icon="bx-receipt" size="56" class="mb-2" />
      <div class="text-h6">
        {{ t('Pick a shift to load the handover report') }}
      </div>
    </div>

    <div v-else-if="loading && !shift" class="text-center py-8">
      <VProgressCircular indeterminate />
    </div>

    <template v-else-if="shift">
      <!-- Shift summary banner -->
      <VCard class="mb-5">
        <VCardText class="d-flex align-center justify-space-between flex-wrap gap-3">
          <div>
            <div class="d-flex align-center gap-3 flex-wrap">
              <span class="text-h5 font-weight-bold">{{ data.cashier.name }}</span>
              <VChip
                class="status-pill"
                :color="shift.status === 'COMPLETED' ? 'success' : 'warning'"
                variant="tonal"
                size="small"
              >
                {{ shift.status }}
              </VChip>
            </div>
            <div class="text-caption text-tertiary mt-1">
              {{ formatDate(shift.start_time) }} — {{ shift.end_time ? formatDate(shift.end_time) : t('in progress') }}
              · {{ Math.round(shift.duration_minutes / 60) }}h {{ shift.duration_minutes % 60 }}m
            </div>
          </div>
          <div class="text-end">
            <div class="text-caption text-tertiary">
              {{ t('Receipts') }}
            </div>
            <div class="text-h4 font-weight-bold num-tabular">
              {{ data.receipt_count }}
            </div>
          </div>
        </VCardText>
      </VCard>

      <!-- Money KPIs -->
      <VRow class="mb-5">
        <VCol cols="6" sm="3">
          <div class="kpi-card">
            <div class="kpi-card__top">
              <div class="kpi-card__icon t-primary">
                <VIcon icon="bx-wallet" size="20" />
              </div>
              <div class="kpi-card__label">
                {{ t('Revenue') }}
              </div>
            </div>
            <div class="kpi-card__value">
              {{ formatCurrency(shift.money.revenue) }}
            </div>
            <div class="kpi-card__foot">
              <span class="kpi-card__sub">{{ formatCurrency(shift.money.revenue_per_hour) }} / {{ t('h') }}</span>
            </div>
          </div>
        </VCol>
        <VCol cols="6" sm="3">
          <div class="kpi-card">
            <div class="kpi-card__top">
              <div class="kpi-card__icon t-success">
                <VIcon icon="bx-money" size="20" />
              </div>
              <div class="kpi-card__label">
                {{ t('Cash') }}
              </div>
            </div>
            <div class="kpi-card__value">
              {{ formatCurrency(shift.money.cash) }}
            </div>
          </div>
        </VCol>
        <VCol cols="6" sm="3">
          <div class="kpi-card">
            <div class="kpi-card__top">
              <div class="kpi-card__icon t-info">
                <VIcon icon="bx-credit-card" size="20" />
              </div>
              <div class="kpi-card__label">
                {{ t('Card') }}
              </div>
            </div>
            <div class="kpi-card__value">
              {{ formatCurrency(shift.money.card) }}
            </div>
          </div>
        </VCol>
        <VCol cols="6" sm="3">
          <div class="kpi-card">
            <div class="kpi-card__top">
              <div class="kpi-card__icon t-neutral">
                <VIcon icon="bx-trending-up" size="20" />
              </div>
              <div class="kpi-card__label">
                {{ t('Avg Order Value') }}
              </div>
            </div>
            <div class="kpi-card__value">
              {{ formatCurrency(shift.money.avg_order_value) }}
            </div>
          </div>
        </VCol>
      </VRow>

      <!-- Reconciliation -->
      <VCard v-if="shift.reconciliation" class="mb-5">
        <VCardText>
          <div class="text-subtitle-1 font-weight-bold mb-4 d-flex align-center gap-2">
            <VIcon icon="bx-shield-quarter" size="20" color="primary" />
            {{ t('Cash Reconciliation') }}
          </div>
          <VRow>
            <VCol cols="12" sm="3">
              <div class="text-caption text-tertiary">
                {{ t('Expected') }}
              </div>
              <div class="text-h6 font-weight-bold num-tabular">
                {{ formatCurrency(shift.reconciliation.expected_cash) }}
              </div>
            </VCol>
            <VCol cols="12" sm="3">
              <div class="text-caption text-tertiary">
                {{ t('Cashier reported') }}
              </div>
              <div class="text-h6 font-weight-bold num-tabular">
                {{ formatCurrency(shift.reconciliation.actual_cash) }}
              </div>
            </VCol>
            <VCol cols="12" sm="3">
              <div class="text-caption text-tertiary mb-1">
                {{ t('Difference') }}
              </div>
              <VChip class="status-pill" :color="reconColor(shift.reconciliation)" variant="tonal" size="large">
                <strong class="num-tabular">{{ formatCurrency(shift.reconciliation.difference) }}</strong>
              </VChip>
            </VCol>
            <VCol cols="12" sm="3">
              <div class="text-caption text-tertiary">
                {{ t('Reconciled by') }}
              </div>
              <div class="text-body-1 font-weight-medium">
                {{ shift.reconciliation.reconciled_by }}
              </div>
              <div class="text-caption text-tertiary">
                {{ formatDate(shift.reconciliation.reconciled_at) }}
              </div>
            </VCol>
          </VRow>
          <div v-if="shift.reconciliation.notes" class="mt-2 text-body-2 text-tertiary">
            {{ shift.reconciliation.notes }}
          </div>
        </VCardText>
      </VCard>

      <!-- Per-tender settlement (P2) -->
      <VCard v-if="settlement.length" class="mb-5">
        <VCardText>
          <div class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center gap-2">
            <VIcon icon="bx-list-check" size="20" color="primary" />
            {{ t('Per-tender Settlement') }}
          </div>
          <VTable density="compact">
            <thead>
              <tr>
                <th>{{ t('Method') }}</th>
                <th class="text-end">{{ t('Expected (system)') }}</th>
                <th class="text-end">{{ t('Cashier counted') }}</th>
                <th class="text-end">{{ t('Manager confirmed') }}</th>
                <th class="text-end">{{ t('Difference') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in settlement" :key="row.method">
                <td>
                  <VChip
                    class="status-pill"
                    size="small"
                    :color="paymentMethodColor[row.method] ?? 'default'"
                    variant="tonal"
                  >
                    {{ row.method }}
                  </VChip>
                </td>
                <td class="text-end num-tabular">{{ formatCurrency(row.expected) }}</td>
                <td class="text-end num-tabular">{{ formatCurrency(row.counted) }}</td>
                <td class="text-end font-weight-medium num-tabular">{{ formatCurrency(row.confirmed) }}</td>
                <td class="text-end">
                  <VChip
                    class="status-pill"
                    size="small"
                    :color="settlementDiffColor(row.difference)"
                    variant="tonal"
                  >
                    <span class="num-tabular">{{ formatCurrency(row.difference) }}</span>
                  </VChip>
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>

      <!-- Cash expenses out of the drawer (P4) -->
      <VCard v-if="cashExpenses.length" class="mb-5">
        <VCardText>
          <div class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center justify-space-between">
            <span class="d-flex align-center gap-2">
              <VIcon icon="bx-minus-circle" size="20" color="error" />
              {{ t('Cash drawer expenses') }}
            </span>
            <span class="text-error font-weight-bold num-tabular">
              −{{ formatCurrency(cashExpensesTotal) }}
            </span>
          </div>
          <VTable density="compact">
            <thead>
              <tr>
                <th>{{ t('Category') }}</th>
                <th class="text-end">{{ t('Count') }}</th>
                <th class="text-end">{{ t('Total') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in cashExpenses" :key="e.category">
                <td>{{ e.category }}</td>
                <td class="text-end num-tabular">{{ e.count }}</td>
                <td class="text-end font-weight-medium text-error num-tabular">−{{ formatCurrency(e.total) }}</td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>

      <!-- Charts row: payment mix + by hour -->
      <VRow class="mb-5">
        <VCol cols="12" md="5">
          <VCard>
            <VCardText>
              <div class="text-caption text-tertiary mb-1" style="text-transform:uppercase; letter-spacing:.08em; font-weight:600;">
                {{ t('Payment mix · this shift') }}
              </div>
              <div class="text-subtitle-1 font-weight-bold mb-3">
                {{ t('Payment Mix') }}
              </div>
              <VueApexCharts
                :options="paymentMixOptions"
                :series="paymentMixSeries"
                height="280"
              />
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="7">
          <VCard>
            <VCardText>
              <div class="text-caption text-tertiary mb-1" style="text-transform:uppercase; letter-spacing:.08em; font-weight:600;">
                {{ t('Orders by Hour') }}
              </div>
              <div class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center justify-space-between">
                <span>{{ t('Orders by Hour') }}</span>
                <VChip class="status-pill" color="info" variant="tonal" size="small">
                  {{ t('Peak') }}: {{ data.peak_hour }}:00
                </VChip>
              </div>
              <VueApexCharts
                :options="byHourOptions"
                :series="byHourSeries"
                height="280"
              />
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Orders breakdown + Speed/Punctuality -->
      <VRow class="mb-5">
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-bold mb-4">
                {{ t('Orders Breakdown') }}
              </div>
              <VRow>
                <VCol cols="4">
                  <div class="text-caption text-success font-weight-semibold">
                    {{ t('Completed') }}
                  </div>
                  <div class="text-h5 font-weight-bold num-tabular">
                    {{ shift.orders.completed }}
                  </div>
                </VCol>
                <VCol cols="4">
                  <div class="text-caption text-error font-weight-semibold">
                    {{ t('Cancelled') }} ({{ shift.orders.cancel_rate_pct }}%)
                  </div>
                  <div class="text-h5 font-weight-bold num-tabular">
                    {{ shift.orders.cancelled }}
                  </div>
                </VCol>
                <VCol cols="4">
                  <div class="text-caption text-primary font-weight-semibold">
                    {{ t('Paid') }}
                  </div>
                  <div class="text-h5 font-weight-bold num-tabular">
                    {{ shift.orders.paid }}
                  </div>
                </VCol>
              </VRow>
              <VDivider class="my-3" />
              <div class="d-flex justify-space-between mb-2">
                <span class="text-muted">{{ t('Hall') }}</span>
                <span class="num-tabular font-weight-medium">{{ shift.orders.by_type.hall }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-muted">{{ t('Delivery') }}</span>
                <span class="num-tabular font-weight-medium">{{ shift.orders.by_type.delivery }}</span>
              </div>
              <div class="d-flex justify-space-between mb-3">
                <span class="text-muted">{{ t('Pickup') }}</span>
                <span class="num-tabular font-weight-medium">{{ shift.orders.by_type.pickup }}</span>
              </div>
              <VDivider class="mb-3" />
              <div class="d-flex justify-space-between mb-2">
                <span class="text-muted">{{ t('Items') }}: {{ shift.items.line_items }} {{ t('lines') }}</span>
                <span class="font-weight-medium num-tabular">{{ shift.items.units_sold }} {{ t('units') }}</span>
              </div>
              <div class="d-flex justify-space-between">
                <span class="text-muted">{{ t('Discounts') }}</span>
                <span class="num-tabular">{{ formatCurrency(shift.discounts.total_given) }} ({{ shift.discounts.discounted_orders }} {{ t('orders') }})</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-bold mb-4">
                {{ t('Speed & Punctuality') }}
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-muted">{{ t('Avg Prep') }}</span>
                <span class="font-weight-bold num-tabular">{{ fmtSec(shift.speed.avg_prep_seconds) }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-muted">{{ t('Orders / hour') }}</span>
                <span class="num-tabular font-weight-medium">{{ shift.speed.orders_per_hour }}</span>
              </div>
              <VDivider class="my-2" />
              <div class="d-flex justify-space-between mb-2">
                <span class="text-muted">{{ t('Scheduled start') }}</span>
                <span class="num-tabular">{{ shift.punctuality.scheduled_start ? formatDate(shift.punctuality.scheduled_start) : '—' }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-muted">{{ t('Actual start') }}</span>
                <span class="num-tabular">{{ formatDate(shift.punctuality.actual_start) }}</span>
              </div>
              <div class="d-flex justify-space-between mb-3 align-center">
                <span class="text-muted">{{ t('Late') }}</span>
                <VChip
                  v-if="shift.punctuality.late_minutes !== null"
                  class="status-pill"
                  size="small"
                  :color="shift.punctuality.is_late ? 'warning' : 'success'"
                  variant="tonal"
                >
                  {{ shift.punctuality.is_late ? `+${shift.punctuality.late_minutes}m` : t('On time') }}
                </VChip>
                <span v-else class="text-tertiary">{{ t('No schedule') }}</span>
              </div>
              <VDivider class="mb-3" />
              <div v-if="shift.punctuality.attendance">
                <div class="text-subtitle-2 font-weight-bold mb-2">
                  {{ t('Attendance') }}
                </div>
                <div class="d-flex justify-space-between mb-2">
                  <span class="text-muted">{{ t('Check in') }} / {{ t('out') }}</span>
                  <span class="num-tabular">{{ formatDate(shift.punctuality.attendance.check_in) }} / {{ shift.punctuality.attendance.check_out ? formatDate(shift.punctuality.attendance.check_out) : '—' }}</span>
                </div>
                <div class="d-flex justify-space-between">
                  <span class="text-muted">{{ t('Work / Overtime') }}</span>
                  <span class="num-tabular font-weight-medium">{{ shift.punctuality.attendance.work_hours }}h / {{ shift.punctuality.attendance.overtime_hours }}h</span>
                </div>
              </div>
              <div v-else class="text-tertiary">
                {{ t('No attendance record') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Top products -->
      <VRow class="mb-5">
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-caption text-tertiary mb-1" style="text-transform:uppercase; letter-spacing:.08em; font-weight:600;">
                {{ t('Top products · this shift') }}
              </div>
              <div class="text-subtitle-1 font-weight-bold mb-3 d-flex align-center justify-space-between">
                <span>{{ t('Top Products') }}</span>
                <VChip v-if="data.best_seller" class="status-pill" size="small" color="success" variant="tonal" prepend-icon="bx-trophy">
                  {{ data.best_seller.name }}
                </VChip>
              </div>
              <VueApexCharts
                :options="topProductsOptions"
                :series="topProductsSeries"
                height="320"
              />
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-bold mb-3">
                {{ t('Product detail') }}
              </div>
              <VTable density="compact">
                <thead>
                  <tr>
                    <th>{{ t('Name') }}</th>
                    <th class="text-end">{{ t('Units') }}</th>
                    <th class="text-end">{{ t('Orders') }}</th>
                    <th class="text-end">{{ t('Revenue') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in products" :key="p.product_id">
                    <td class="font-weight-medium">{{ p.name }}</td>
                    <td class="text-end num-tabular">{{ p.units_sold }}</td>
                    <td class="text-end num-tabular text-muted">{{ p.times_sold }}</td>
                    <td class="text-end num-tabular font-weight-semibold">{{ formatCurrency(p.revenue) }}</td>
                  </tr>
                </tbody>
              </VTable>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Receipts -->
      <VCard>
        <VCardText>
          <div class="text-subtitle-1 font-weight-bold mb-1">
            {{ t('All receipts') }}
          </div>
          <div class="text-caption text-tertiary mb-3">
            {{ data.receipt_count }} {{ t('total') }}
          </div>
          <VTable density="compact">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ t('Status') }}</th>
                <th>{{ t('Type') }}</th>
                <th>{{ t('Payment') }}</th>
                <th class="text-end">{{ t('Lines') }}</th>
                <th class="text-end">{{ t('Units') }}</th>
                <th class="text-end">{{ t('Discount') }}</th>
                <th class="text-end">{{ t('Total') }}</th>
                <th>{{ t('Paid at') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in receipts" :key="r.order_id">
                <td class="font-weight-medium num-tabular">#{{ r.display_id }}</td>
                <td>
                  <VChip class="status-pill" size="x-small" :color="orderStatusColor[r.status] ?? 'default'" variant="tonal">
                    {{ r.status }}
                  </VChip>
                </td>
                <td>{{ r.order_type }}</td>
                <td>
                  <VChip class="status-pill" size="x-small" :color="paymentMethodColor[r.payment_method] ?? 'default'" variant="tonal">
                    {{ r.payment_method }}
                  </VChip>
                </td>
                <td class="text-end num-tabular">{{ r.line_items }}</td>
                <td class="text-end num-tabular">{{ r.units }}</td>
                <td class="text-end">
                  <span v-if="Number(r.discount_amount) > 0" class="text-warning num-tabular">
                    −{{ formatCurrency(r.discount_amount) }}
                  </span>
                  <span v-else class="text-tertiary">—</span>
                </td>
                <td class="text-end font-weight-semibold num-tabular">{{ formatCurrency(r.total_amount) }}</td>
                <td class="num-tabular">{{ r.paid_at ? formatDate(r.paid_at) : '—' }}</td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>
    </template>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

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

const paymentMixOptions = computed(() => ({
  chart: { type: 'donut', toolbar: { show: false } },
  labels: [t('Cash'), 'Uzcard', 'Humo', 'Payme', t('Mixed')],
  colors: ['#22c55e', '#3b82f6', '#f59e0b', '#06b6d4', '#a855f7'],
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
  colors: ['#6366f1'],
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
  colors: ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'],
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
    <!-- Picker -->
    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center gap-3">
        <span class="text-h6">{{ t('Shift Handover Report') }}</span>
        <VSpacer />
        <VTextField
          v-model.number="shiftIdInput"
          type="number"
          :label="t('Shift ID')"
          density="compact"
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
      </VCardText>
    </VCard>

    <div v-if="!shift && !loading" class="text-center text-disabled py-8">
      <VIcon icon="bx-receipt" size="56" class="mb-2" />
      <div class="text-h6">
        {{ t('Pick a shift to load the handover report') }}
      </div>
    </div>

    <div v-else-if="loading && !shift" class="text-center py-8">
      <VProgressCircular indeterminate />
    </div>

    <template v-else-if="shift">
      <!-- Header -->
      <VCard class="mb-4">
        <VCardText class="d-flex align-center justify-space-between flex-wrap gap-3">
          <div>
            <div class="text-h6">
              {{ data.cashier.name }}
            </div>
            <div class="text-caption text-disabled">
              {{ formatDate(shift.start_time) }} — {{ shift.end_time ? formatDate(shift.end_time) : t('in progress') }}
              · {{ Math.round(shift.duration_minutes / 60) }}h {{ shift.duration_minutes % 60 }}m
            </div>
          </div>
          <VChip :color="shift.status === 'COMPLETED' ? 'success' : 'warning'" variant="tonal">
            {{ shift.status }}
          </VChip>
          <div class="text-end">
            <div class="text-caption text-disabled">
              {{ t('Receipts') }}
            </div>
            <div class="text-h5 font-weight-bold">
              {{ data.receipt_count }}
            </div>
          </div>
        </VCardText>
      </VCard>

      <!-- Money KPIs -->
      <VRow class="mb-4">
        <VCol cols="6" sm="3">
          <VCard color="success" variant="tonal">
            <VCardText>
              <div class="text-caption">
                {{ t('Revenue') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ formatCurrency(shift.money.revenue) }}
              </div>
              <div class="text-caption">
                {{ formatCurrency(shift.money.revenue_per_hour) }} / {{ t('h') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="6" sm="3">
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Cash') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ formatCurrency(shift.money.cash) }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="6" sm="3">
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Card') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ formatCurrency(shift.money.card) }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="6" sm="3">
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Avg Order Value') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ formatCurrency(shift.money.avg_order_value) }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Reconciliation -->
      <VCard v-if="shift.reconciliation" class="mb-4">
        <VCardText>
          <div class="text-subtitle-1 font-weight-medium mb-3 d-flex align-center gap-2">
            <VIcon icon="bx-shield-quarter" size="20" />
            {{ t('Cash Reconciliation') }}
          </div>
          <VRow>
            <VCol cols="12" sm="3">
              <div class="text-caption text-disabled">
                {{ t('Expected') }}
              </div>
              <div class="text-h6 font-weight-bold">
                {{ formatCurrency(shift.reconciliation.expected_cash) }}
              </div>
            </VCol>
            <VCol cols="12" sm="3">
              <div class="text-caption text-disabled">
                {{ t('Cashier reported') }}
              </div>
              <div class="text-h6 font-weight-bold">
                {{ formatCurrency(shift.reconciliation.actual_cash) }}
              </div>
            </VCol>
            <VCol cols="12" sm="3">
              <div class="text-caption text-disabled">
                {{ t('Difference') }}
              </div>
              <VChip :color="reconColor(shift.reconciliation)" variant="tonal" size="large">
                <strong>{{ formatCurrency(shift.reconciliation.difference) }}</strong>
              </VChip>
            </VCol>
            <VCol cols="12" sm="3">
              <div class="text-caption text-disabled">
                {{ t('Reconciled by') }}
              </div>
              <div class="text-body-1">
                {{ shift.reconciliation.reconciled_by }}
              </div>
              <div class="text-caption text-disabled">
                {{ formatDate(shift.reconciliation.reconciled_at) }}
              </div>
            </VCol>
          </VRow>
          <div v-if="shift.reconciliation.notes" class="mt-2 text-body-2 text-disabled">
            {{ shift.reconciliation.notes }}
          </div>
        </VCardText>
      </VCard>

      <!-- Per-tender settlement (P2) -->
      <VCard v-if="settlement.length" class="mb-4">
        <VCardText>
          <div class="text-subtitle-1 font-weight-medium mb-3 d-flex align-center gap-2">
            <VIcon icon="bx-list-check" size="20" />
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
                    size="small"
                    :color="paymentMethodColor[row.method] ?? 'default'"
                    variant="tonal"
                  >
                    {{ row.method }}
                  </VChip>
                </td>
                <td class="text-end">{{ formatCurrency(row.expected) }}</td>
                <td class="text-end">{{ formatCurrency(row.counted) }}</td>
                <td class="text-end font-weight-medium">{{ formatCurrency(row.confirmed) }}</td>
                <td class="text-end">
                  <VChip
                    size="small"
                    :color="settlementDiffColor(row.difference)"
                    variant="tonal"
                  >
                    {{ formatCurrency(row.difference) }}
                  </VChip>
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>

      <!-- Cash expenses out of the drawer (P4) -->
      <VCard v-if="cashExpenses.length" class="mb-4">
        <VCardText>
          <div class="text-subtitle-1 font-weight-medium mb-3 d-flex align-center justify-space-between">
            <span class="d-flex align-center gap-2">
              <VIcon icon="bx-minus-circle" size="20" />
              {{ t('Cash drawer expenses') }}
            </span>
            <span class="text-error font-weight-bold">
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
                <td class="text-end">{{ e.count }}</td>
                <td class="text-end font-weight-medium text-error">−{{ formatCurrency(e.total) }}</td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>

      <!-- Charts row: payment mix + by hour -->
      <VRow class="mb-4">
        <VCol cols="12" md="5">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-2">
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
              <div class="text-subtitle-1 font-weight-medium mb-2">
                {{ t('Orders by Hour') }} ({{ t('Peak') }}: {{ data.peak_hour }}:00)
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
      <VRow class="mb-4">
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-3">
                {{ t('Orders Breakdown') }}
              </div>
              <VRow>
                <VCol cols="4">
                  <div class="text-caption text-success">
                    {{ t('Completed') }}
                  </div>
                  <div class="text-h6">
                    {{ shift.orders.completed }}
                  </div>
                </VCol>
                <VCol cols="4">
                  <div class="text-caption text-error">
                    {{ t('Cancelled') }} ({{ shift.orders.cancel_rate_pct }}%)
                  </div>
                  <div class="text-h6">
                    {{ shift.orders.cancelled }}
                  </div>
                </VCol>
                <VCol cols="4">
                  <div class="text-caption text-info">
                    {{ t('Paid') }}
                  </div>
                  <div class="text-h6">
                    {{ shift.orders.paid }}
                  </div>
                </VCol>
              </VRow>
              <VDivider class="my-3" />
              <div class="d-flex justify-space-between mb-1">
                <span class="text-disabled">{{ t('Hall') }}</span>
                <span>{{ shift.orders.by_type.hall }}</span>
              </div>
              <div class="d-flex justify-space-between mb-1">
                <span class="text-disabled">{{ t('Delivery') }}</span>
                <span>{{ shift.orders.by_type.delivery }}</span>
              </div>
              <div class="d-flex justify-space-between mb-3">
                <span class="text-disabled">{{ t('Pickup') }}</span>
                <span>{{ shift.orders.by_type.pickup }}</span>
              </div>
              <VDivider class="mb-3" />
              <div class="d-flex justify-space-between mb-1">
                <span class="text-disabled">{{ t('Items') }}: {{ shift.items.line_items }} {{ t('lines') }}</span>
                <span class="font-weight-medium">{{ shift.items.units_sold }} {{ t('units') }}</span>
              </div>
              <div class="d-flex justify-space-between">
                <span class="text-disabled">{{ t('Discounts') }}</span>
                <span>{{ formatCurrency(shift.discounts.total_given) }} ({{ shift.discounts.discounted_orders }} {{ t('orders') }})</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-3">
                {{ t('Speed & Punctuality') }}
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Avg Prep') }}</span>
                <span class="font-weight-bold">{{ fmtSec(shift.speed.avg_prep_seconds) }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Orders / hour') }}</span>
                <span>{{ shift.speed.orders_per_hour }}</span>
              </div>
              <VDivider class="my-2" />
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Scheduled start') }}</span>
                <span>{{ shift.punctuality.scheduled_start ? formatDate(shift.punctuality.scheduled_start) : '—' }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Actual start') }}</span>
                <span>{{ formatDate(shift.punctuality.actual_start) }}</span>
              </div>
              <div class="d-flex justify-space-between mb-3">
                <span class="text-disabled">{{ t('Late') }}</span>
                <VChip
                  v-if="shift.punctuality.late_minutes !== null"
                  size="small"
                  :color="shift.punctuality.is_late ? 'warning' : 'success'"
                  variant="tonal"
                >
                  {{ shift.punctuality.is_late ? `+${shift.punctuality.late_minutes}m` : t('On time') }}
                </VChip>
                <span v-else class="text-disabled">{{ t('No schedule') }}</span>
              </div>
              <VDivider class="mb-3" />
              <div v-if="shift.punctuality.attendance">
                <div class="text-subtitle-2 mb-2">
                  {{ t('Attendance') }}
                </div>
                <div class="d-flex justify-space-between mb-1">
                  <span class="text-disabled">{{ t('Check in') }} / {{ t('out') }}</span>
                  <span>{{ formatDate(shift.punctuality.attendance.check_in) }} / {{ shift.punctuality.attendance.check_out ? formatDate(shift.punctuality.attendance.check_out) : '—' }}</span>
                </div>
                <div class="d-flex justify-space-between">
                  <span class="text-disabled">{{ t('Work / Overtime') }}</span>
                  <span>{{ shift.punctuality.attendance.work_hours }}h / {{ shift.punctuality.attendance.overtime_hours }}h</span>
                </div>
              </div>
              <div v-else class="text-disabled">
                {{ t('No attendance record') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Top products -->
      <VRow class="mb-4">
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-2 d-flex align-center justify-space-between">
                <span>{{ t('Top Products') }}</span>
                <VChip v-if="data.best_seller" size="small" color="success" variant="tonal" prepend-icon="bx-trophy">
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
              <div class="text-subtitle-1 font-weight-medium mb-2">
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
                    <td class="text-end">{{ p.units_sold }}</td>
                    <td class="text-end">{{ p.times_sold }}</td>
                    <td class="text-end">{{ formatCurrency(p.revenue) }}</td>
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
          <div class="text-subtitle-1 font-weight-medium mb-2">
            {{ t('All receipts') }} ({{ data.receipt_count }})
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
                <td class="font-weight-medium">#{{ r.display_id }}</td>
                <td>
                  <VChip size="x-small" :color="orderStatusColor[r.status] ?? 'default'" variant="tonal">
                    {{ r.status }}
                  </VChip>
                </td>
                <td>{{ r.order_type }}</td>
                <td>
                  <VChip size="x-small" :color="paymentMethodColor[r.payment_method] ?? 'default'" variant="tonal">
                    {{ r.payment_method }}
                  </VChip>
                </td>
                <td class="text-end">{{ r.line_items }}</td>
                <td class="text-end">{{ r.units }}</td>
                <td class="text-end">
                  <span v-if="Number(r.discount_amount) > 0" class="text-warning">
                    −{{ formatCurrency(r.discount_amount) }}
                  </span>
                  <span v-else class="text-disabled">—</span>
                </td>
                <td class="text-end font-weight-medium">{{ formatCurrency(r.total_amount) }}</td>
                <td>{{ r.paid_at ? formatDate(r.paid_at) : '—' }}</td>
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

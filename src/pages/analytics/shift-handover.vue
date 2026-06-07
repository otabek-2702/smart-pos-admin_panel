<script setup lang="ts">
// import axios from '@/plugins/axios'
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
    // TODO BE: wire when ready
    // const res = await axios.get(`/analytics/shifts/${shiftIdInput.value}/report`)
    // data.value = res.data?.data ?? res.data

    data.value = mockResponse(shiftIdInput.value)

    // Reflect in URL for shareable deep link.
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

function mockResponse(shiftId: number) {
  return {
    cashier: { id: 12, name: 'Ali Karimov' },
    shift: {
      shift_id: shiftId, user_id: 12, user_name: 'Ali Karimov', status: 'COMPLETED',
      start_time: '2026-06-06T09:00:00', end_time: '2026-06-06T17:30:00', duration_minutes: 510,
      orders: { total: 84, completed: 80, cancelled: 2, open: 0, preparing: 0, ready: 2, paid: 80, cancel_rate_pct: 2.38, by_type: { hall: 60, delivery: 18, pickup: 6 } },
      items: { units_sold: 198, line_items: 240 },
      money: {
        revenue: '12400000.00', cash: '8200000.00', card: '4200000.00', avg_order_value: '155000.00',
        payment_mix: { CASH: '8200000.00', UZCARD: '2800000.00', HUMO: '900000.00', PAYME: '450000.00', MIXED: '50000.00' },
      },
      discounts: { total_given: '320000.00', discounted_orders: 8, discount_rate_pct: 9.5, avg_discount_pct: 12.0 },
      speed: { avg_prep_seconds: 540, orders_per_hour: 9.9, revenue_per_hour: '1458823.00' },
      punctuality: {
        actual_start: '2026-06-06T09:00:00', scheduled_start: '2026-06-06T09:00:00',
        late_minutes: 0, is_late: false,
        attendance: { status: 'PRESENT', check_in: '2026-06-06T09:00:00', check_out: '2026-06-06T17:30:00', work_hours: 8.5, overtime_hours: 0.5 },
      },
      reconciliation: {
        expected_cash: '8200000.00', actual_cash: '8195000.00', difference: '-5000.00',
        is_short: true, is_over: false, notes: 'Small change shortage',
        reconciled_by: 'Manager Aziz', reconciled_at: '2026-06-06T17:35:00',
      },
    },
    receipt_count: 84,
    receipts: Array.from({ length: 12 }, (_, i) => ({
      order_id: 501 + i, display_id: 14 + i,
      status: ['COMPLETED', 'COMPLETED', 'CANCELED'][i % 3] ?? 'COMPLETED',
      order_type: ['HALL', 'DELIVERY', 'PICKUP'][i % 3],
      is_paid: true, payment_method: ['CASH', 'UZCARD', 'HUMO', 'PAYME'][i % 4],
      total_amount: String(120000 + i * 5000), discount_amount: i === 2 ? '15000.00' : '0.00',
      discount_percent: i === 2 ? '10' : '0', line_items: 2 + (i % 3), units: 3 + (i % 4),
      created_at: `2026-06-06T${String(9 + i).padStart(2, '0')}:30:00`,
      paid_at: `2026-06-06T${String(9 + i).padStart(2, '0')}:42:00`,
    })),
    products: [
      { product_id: 7, name: 'Lavash', units_sold: 40, times_sold: 31, revenue: '1600000.00' },
      { product_id: 12, name: 'Plov', units_sold: 28, times_sold: 26, revenue: '2240000.00' },
      { product_id: 3, name: 'Manti', units_sold: 22, times_sold: 18, revenue: '1320000.00' },
      { product_id: 18, name: 'Shashlik', units_sold: 18, times_sold: 17, revenue: '1620000.00' },
      { product_id: 9, name: 'Salat', units_sold: 16, times_sold: 14, revenue: '480000.00' },
    ],
    best_seller: { product_id: 7, name: 'Lavash', units_sold: 40, times_sold: 31, revenue: '1600000.00' },
    distribution: {
      by_hour: Array.from({ length: 24 }, (_, h) => {
        if (h < 9 || h > 17) return { hour: h, orders: 0, revenue: '0' }
        const peak = [12, 13]
        const orders = peak.includes(h) ? 18 + Math.round(Math.random() * 8) : 6 + Math.round(Math.random() * 6)

        return { hour: h, orders, revenue: String(orders * 155000) }
      }),
      by_date: [{ date: '2026-06-06', orders: 84, revenue: '12400000.00' }],
      peak_hour: 13,
    },
    peak_hour: 13,
  }
}

const shift = computed<any>(() => data.value?.shift)
const receipts = computed<any[]>(() => data.value?.receipts ?? [])
const products = computed<any[]>(() => data.value?.products ?? [])
const distribution = computed<any>(() => data.value?.distribution)

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

<script setup lang="ts">
import axios from '@/plugins/axios'
import VueApexCharts from 'vue3-apexcharts'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

// -------- filters --------
const dateFrom = ref(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))
const userIdFilter = ref<number | null>(null)
const cashiers = ref<any[]>([])

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
const router = useRouter()

function openHandover(shiftId: number) {
  router.push({ path: '/analytics/shift-handover', query: { shift: String(shiftId) } })
}

// -------- charts --------
const paymentMixSeries = computed(() => {
  const mix = summary.value?.money?.payment_mix_pct ?? {}

  return [mix.CASH ?? 0, mix.UZCARD ?? 0, mix.HUMO ?? 0, mix.PAYME ?? 0, mix.MIXED ?? 0]
})

const paymentMixOptions = computed(() => ({
  chart: { type: 'donut', toolbar: { show: false } },
  labels: ['Cash', 'Uzcard', 'Humo', 'Payme', 'Mixed'],
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

// -------- variance color --------
function varianceColor(v: string | number) {
  const n = Number(v)
  if (Math.abs(n) < 0.01) return 'success'

  return n < 0 ? 'error' : 'warning'
}
</script>

<template>
  <div>
    <!-- Filters -->
    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center gap-3">
        <span class="text-h6">{{ t('Cashier Shift Analytics') }}</span>
        <VSpacer />
        <VTextField
          v-model="dateFrom"
          type="date"
          :label="t('From')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
        />
        <VTextField
          v-model="dateTo"
          type="date"
          :label="t('To')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
        />
        <VSelect
          v-model="userIdFilter"
          :items="cashiers.map(c => ({ title: `${c.first_name} ${c.last_name}`, value: c.id }))"
          :label="t('Cashier')"
          density="compact"
          hide-details
          style="min-inline-size:180px;"
          clearable
        />
      </VCardText>
    </VCard>

    <div
      v-if="!summary && loading"
      class="text-center py-8"
    >
      <VProgressCircular indeterminate />
    </div>

    <template v-else-if="summary">
      <!-- Top-line KPIs -->
      <VRow class="mb-4">
        <VCol
          cols="6"
          sm="3"
        >
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Shifts') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ summary.shift_count }}
              </div>
              <div class="text-caption text-disabled">
                {{ summary.distinct_cashiers }} {{ t('cashiers') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol
          cols="6"
          sm="3"
        >
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Total Hours') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ summary.total_hours }}h
              </div>
              <div class="text-caption text-disabled">
                {{ t('avg') }} {{ Math.round(summary.avg_shift_minutes) }}m
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol
          cols="6"
          sm="3"
        >
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Orders') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ summary.orders.total }}
              </div>
              <div class="text-caption text-error">
                {{ summary.orders.cancelled }} {{ t('cancelled') }} ({{ summary.orders.cancel_rate_pct }}%)
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol
          cols="6"
          sm="3"
        >
          <VCard color="success" variant="tonal">
            <VCardText>
              <div class="text-caption">
                {{ t('Revenue') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ formatCurrency(summary.money.revenue) }}
              </div>
              <div class="text-caption">
                {{ formatCurrency(summary.money.revenue_per_hour) }} / {{ t('h') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Money split + payment mix -->
      <VRow class="mb-4">
        <VCol cols="12" md="4">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-3">
                {{ t('Money Split') }}
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Cash') }}</span>
                <span class="font-weight-bold">{{ formatCurrency(summary.money.cash) }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Card') }}</span>
                <span class="font-weight-bold">{{ formatCurrency(summary.money.card) }}</span>
              </div>
              <VDivider class="my-2" />
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Avg Order Value') }}</span>
                <span>{{ formatCurrency(summary.money.avg_order_value) }}</span>
              </div>
              <div class="d-flex justify-space-between">
                <span class="text-disabled">{{ t('Avg per Shift') }}</span>
                <span>{{ formatCurrency(summary.money.avg_per_shift) }}</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="4">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-2">
                {{ t('Payment Mix') }}
              </div>
              <VueApexCharts
                :options="paymentMixOptions"
                :series="paymentMixSeries"
                height="240"
              />
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="4">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-3">
                {{ t('Speed') }}
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Avg Prep') }}</span>
                <span class="font-weight-bold">{{ Math.round(summary.speed.avg_prep_seconds / 60) }}m {{ summary.speed.avg_prep_seconds % 60 }}s</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-success">{{ t('Fastest shift') }}</span>
                <span>{{ Math.round(summary.speed.fastest_shift_avg_seconds / 60) }}m</span>
              </div>
              <div class="d-flex justify-space-between mb-3">
                <span class="text-error">{{ t('Slowest shift') }}</span>
                <span>{{ Math.round(summary.speed.slowest_shift_avg_seconds / 60) }}m</span>
              </div>
              <VDivider class="mb-3" />
              <div class="text-subtitle-2 mb-2">
                {{ t('Discounts') }}
              </div>
              <div class="d-flex justify-space-between mb-1">
                <span class="text-disabled">{{ t('Total Given') }}</span>
                <span>{{ formatCurrency(summary.discounts.total_given) }}</span>
              </div>
              <div class="d-flex justify-space-between">
                <span class="text-disabled">{{ summary.discounts.discounted_orders }} {{ t('orders') }}</span>
                <span>{{ summary.discounts.discount_rate_pct }}%</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Punctuality + Cash accuracy -->
      <VRow class="mb-4">
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-3">
                {{ t('Punctuality') }}
              </div>
              <VRow>
                <VCol cols="4">
                  <div class="text-caption text-success">
                    {{ t('On time') }}
                  </div>
                  <div class="text-h6">
                    {{ summary.punctuality.on_time_shifts }}
                  </div>
                </VCol>
                <VCol cols="4">
                  <div class="text-caption text-warning">
                    {{ t('Late') }}
                  </div>
                  <div class="text-h6">
                    {{ summary.punctuality.late_shifts }}
                  </div>
                </VCol>
                <VCol cols="4">
                  <div class="text-caption text-disabled">
                    {{ t('Rate') }}
                  </div>
                  <div class="text-h6">
                    {{ summary.punctuality.punctuality_rate_pct }}%
                  </div>
                </VCol>
              </VRow>
              <VDivider class="my-3" />
              <div class="text-subtitle-2 mb-2">
                {{ t('Worst late arrivals') }}
              </div>
              <div
                v-for="la in lateArrivals.slice(0, 5)"
                :key="la.shift_id"
                class="d-flex justify-space-between text-body-2 mb-1"
              >
                <span>{{ la.user_name }}</span>
                <span class="text-warning font-weight-medium">+{{ la.late_minutes }}m</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-3">
                {{ t('Cash Accuracy') }}
              </div>
              <VRow>
                <VCol cols="3">
                  <div class="text-caption text-success">
                    {{ t('Exact') }}
                  </div>
                  <div class="text-h6">
                    {{ summary.cash_accuracy.exact_count }}
                  </div>
                </VCol>
                <VCol cols="3">
                  <div class="text-caption text-error">
                    {{ t('Short') }}
                  </div>
                  <div class="text-h6">
                    {{ summary.cash_accuracy.short_count }}
                  </div>
                </VCol>
                <VCol cols="3">
                  <div class="text-caption text-warning">
                    {{ t('Over') }}
                  </div>
                  <div class="text-h6">
                    {{ summary.cash_accuracy.over_count }}
                  </div>
                </VCol>
                <VCol cols="3">
                  <div class="text-caption text-disabled">
                    {{ t('Not rec.') }}
                  </div>
                  <div class="text-h6">
                    {{ summary.cash_accuracy.shifts_unreconciled }}
                  </div>
                </VCol>
              </VRow>
              <VDivider class="my-3" />
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span class="text-disabled">{{ t('Net variance') }}</span>
                <VChip size="small" :color="varianceColor(summary.cash_accuracy.net_variance)" variant="tonal">
                  {{ formatCurrency(summary.cash_accuracy.net_variance) }}
                </VChip>
              </div>
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span class="text-disabled">{{ t('Worst shortage') }}</span>
                <span class="text-error">{{ summary.cash_accuracy.worst_shortage.user_name }} {{ formatCurrency(summary.cash_accuracy.worst_shortage.difference) }}</span>
              </div>
              <div class="d-flex justify-space-between text-body-2">
                <span class="text-disabled">{{ t('Biggest overage') }}</span>
                <span class="text-warning">{{ summary.cash_accuracy.biggest_overage.user_name }} +{{ formatCurrency(summary.cash_accuracy.biggest_overage.difference) }}</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Leaderboard -->
      <VCard class="mb-4">
        <VCardText>
          <div class="text-subtitle-1 font-weight-medium mb-2">
            {{ t('Leaderboard (by revenue)') }}
          </div>
          <VTable density="compact">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ t('Cashier') }}</th>
                <th class="text-end">{{ t('Shifts') }}</th>
                <th class="text-end">{{ t('Orders') }}</th>
                <th class="text-end">{{ t('Revenue') }}</th>
                <th class="text-end">{{ t('Cash') }}</th>
                <th class="text-end">{{ t('AOV') }}</th>
                <th class="text-end">{{ t('Cancel %') }}</th>
                <th class="text-end">{{ t('Late') }}</th>
                <th class="text-end">{{ t('Variance') }}</th>
                <th class="text-end">{{ t('Avg prep') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in leaderboard" :key="row.user_id">
                <td>
                  <VChip size="x-small" color="primary" variant="tonal">
                    {{ row.revenue_rank }}
                  </VChip>
                </td>
                <td class="font-weight-medium">{{ row.user_name }}</td>
                <td class="text-end">{{ row.shifts }}</td>
                <td class="text-end">{{ row.orders }}</td>
                <td class="text-end font-weight-medium">{{ formatCurrency(row.revenue) }}</td>
                <td class="text-end">{{ formatCurrency(row.cash) }}</td>
                <td class="text-end">{{ formatCurrency(row.avg_order_value) }}</td>
                <td class="text-end">{{ row.cancel_rate_pct }}%</td>
                <td class="text-end">{{ row.late_shifts }} ({{ row.late_minutes_total }}m)</td>
                <td class="text-end">
                  <VChip size="x-small" :color="varianceColor(row.cash_variance)" variant="tonal">
                    {{ formatCurrency(row.cash_variance) }}
                  </VChip>
                </td>
                <td class="text-end">{{ Math.round(row.avg_prep_seconds / 60) }}m</td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>

      <!-- Per-shift breakdown -->
      <VCard v-if="perShift.length" class="mb-4">
        <VCardText>
          <div class="text-subtitle-1 font-weight-medium mb-2">
            {{ t('Per-shift breakdown') }} ({{ perShift.length }})
          </div>
          <VTable density="compact">
            <thead>
              <tr>
                <th>{{ t('Cashier') }}</th>
                <th>{{ t('Status') }}</th>
                <th>{{ t('Date') }}</th>
                <th class="text-end">{{ t('Duration') }}</th>
                <th class="text-end">{{ t('Orders') }}</th>
                <th class="text-end">{{ t('Revenue') }}</th>
                <th class="text-end">{{ t('Cash') }}</th>
                <th class="text-end">{{ t('Card') }}</th>
                <th class="text-end">{{ t('AOV') }}</th>
                <th class="text-end">{{ t('Prep') }}</th>
                <th class="text-end">{{ t('Late') }}</th>
                <th class="text-end">{{ t('Variance') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in perShift" :key="s.shift_id">
                <td class="font-weight-medium">{{ s.user_name }}</td>
                <td>
                  <VChip size="x-small" :color="s.status === 'COMPLETED' ? 'success' : (s.status === 'ENDED' ? 'warning' : 'default')" variant="tonal">
                    {{ t(`shift_status_${s.status}`) }}
                  </VChip>
                </td>
                <td>{{ formatDate(s.start_time) }}</td>
                <td class="text-end">{{ Math.round((s.duration_minutes ?? 0) / 60) }}h</td>
                <td class="text-end">{{ s.orders?.total ?? 0 }}</td>
                <td class="text-end font-weight-medium">{{ formatCurrency(s.money?.revenue ?? 0) }}</td>
                <td class="text-end">{{ formatCurrency(s.money?.cash ?? 0) }}</td>
                <td class="text-end">{{ formatCurrency(s.money?.card ?? 0) }}</td>
                <td class="text-end">{{ formatCurrency(s.money?.avg_order_value ?? 0) }}</td>
                <td class="text-end">{{ Math.round((s.speed?.avg_prep_seconds ?? 0) / 60) }}m</td>
                <td class="text-end">
                  <span v-if="s.punctuality?.is_late" class="text-warning">+{{ s.punctuality.late_minutes }}m</span>
                  <span v-else class="text-success">✓</span>
                </td>
                <td class="text-end">
                  <VChip
                    v-if="s.reconciliation"
                    size="x-small"
                    :color="varianceColor(s.reconciliation.difference)"
                    variant="tonal"
                  >
                    {{ formatCurrency(s.reconciliation.difference) }}
                  </VChip>
                  <span v-else class="text-disabled">—</span>
                </td>
                <td class="text-end">
                  <VBtn
                    icon
                    variant="text"
                    size="x-small"
                    @click="openHandover(s.shift_id)"
                  >
                    <VIcon icon="bx-link-external" size="16" />
                    <VTooltip activator="parent" location="top">
                      {{ t('Open handover') }}
                    </VTooltip>
                  </VBtn>
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>

      <!-- Distribution charts -->
      <VRow>
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-2">
                {{ t('Orders by Hour') }} ({{ t('Peak') }}: {{ distribution.peak_hour }}:00)
              </div>
              <VueApexCharts
                :options="byHourOptions"
                :series="byHourSeries"
                height="280"
              />
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-2">
                {{ t('Revenue by Date') }}
              </div>
              <VueApexCharts
                :options="byDateOptions"
                :series="byDateSeries"
                height="280"
              />
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
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

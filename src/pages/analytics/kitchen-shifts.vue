<script setup lang="ts">
// import axios from '@/plugins/axios'
import VueApexCharts from 'vue3-apexcharts'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

// -------- filters --------
const dateFrom = ref(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))
const userIdFilter = ref<number | null>(null)
const roleFilter = ref<string>('WAITER')
const targetPrepMinutes = ref<number>(15)
const staff = ref<any[]>([])

// -------- response --------
const data = ref<any>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    // TODO BE: wire when ready
    // const params: any = {
    //   from: dateFrom.value, to: dateTo.value, role: roleFilter.value,
    //   target_prep_minutes: targetPrepMinutes.value,
    // }
    // if (userIdFilter.value) params.user_id = userIdFilter.value
    // const res = await axios.get('/analytics/shifts/kitchen', { params })
    // data.value = res.data?.data ?? res.data

    data.value = mockResponse()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)
watch([dateFrom, dateTo, userIdFilter, roleFilter, targetPrepMinutes], load)

function mockResponse() {
  return {
    scope: 'kitchen',
    date_from: dateFrom.value, date_to: dateTo.value, filtered_user_id: null,
    summary: {
      shift_count: 20, distinct_staff: 3, role: roleFilter.value,
      by_status: { ACTIVE: 0, COMPLETED: 19, ABANDONED: 1 },
      total_hours: 150.0, avg_shift_minutes: 450.0,
      orders_in_window: 880, orders_readied: 860, orders_pending: 20,
      completion_rate_pct: 97.7,
      items_prepared: 2600, items_per_hour: 17.3,
      prep_time: {
        avg_seconds: 520, best_shift_avg_seconds: 300,
        worst_shift_avg_seconds: 1100, slow_orders: 64,
        slow_rate_pct: 7.4, target_seconds: targetPrepMinutes.value * 60,
      },
      punctuality: {
        on_time_shifts: 17, late_shifts: 3, punctuality_rate_pct: 85.0,
        avg_late_minutes: 8.6, max_late_minutes: 22,
        late_arrivals: [
          { shift_id: 91, user_id: 22, user_name: 'Jasur K.', late_minutes: 22, start_time: '2026-06-05T09:22:00' },
          { shift_id: 73, user_id: 14, user_name: 'Diyor R.', late_minutes: 12, start_time: '2026-06-02T09:12:00' },
        ],
      },
    },
    distribution: {
      by_hour: Array.from({ length: 24 }, (_, h) => {
        const peak = [12, 13, 19, 20]
        const orders = peak.includes(h) ? Math.round(60 + Math.random() * 30) : Math.round(Math.random() * 15)

        return { hour: h, orders, revenue: '0' }
      }),
      by_date: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400_000).toISOString().slice(0, 10),
        orders: Math.round(20 + Math.random() * 20),
        revenue: '0',
      })),
      peak_hour: 13,
    },
    shifts: [
      {
        shift_id: 91, user_id: 22, user_name: 'Jasur K.', status: 'COMPLETED',
        start_time: '2026-06-05T09:22:00', end_time: '2026-06-05T17:30:00', duration_minutes: 488,
        orders_in_window: 92, orders_readied: 88, orders_pending: 4, completion_rate_pct: 95.6,
        items_prepared: { units: 220, line_items: 92 },
        prep_time: { avg_seconds: 480, median_seconds: 460, fastest_seconds: 180, slowest_seconds: 1320, slow_orders: 5, slow_rate_pct: 5.4, target_seconds: targetPrepMinutes.value * 60 },
        throughput: { orders_per_hour: 11.3, items_per_hour: 27.0 },
        punctuality: { actual_start: '2026-06-05T09:22:00', scheduled_start: '2026-06-05T09:00:00', late_minutes: 22, is_late: true },
      },
      {
        shift_id: 73, user_id: 14, user_name: 'Diyor R.', status: 'COMPLETED',
        start_time: '2026-06-02T09:12:00', end_time: '2026-06-02T17:00:00', duration_minutes: 468,
        orders_in_window: 84, orders_readied: 84, orders_pending: 0, completion_rate_pct: 100,
        items_prepared: { units: 196, line_items: 84 },
        prep_time: { avg_seconds: 410, median_seconds: 390, fastest_seconds: 160, slowest_seconds: 1020, slow_orders: 2, slow_rate_pct: 2.4, target_seconds: targetPrepMinutes.value * 60 },
        throughput: { orders_per_hour: 10.8, items_per_hour: 25.1 },
        punctuality: { actual_start: '2026-06-02T09:12:00', scheduled_start: '2026-06-02T09:00:00', late_minutes: 12, is_late: true },
      },
    ],
  }
}

const summary = computed<any>(() => data.value?.summary)
const distribution = computed<any>(() => data.value?.distribution)
const shifts = computed<any[]>(() => data.value?.shifts ?? [])
const lateArrivals = computed<any[]>(() => summary.value?.punctuality?.late_arrivals ?? [])

function fmtSec(s: number | null | undefined) {
  if (!s && s !== 0) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60

  return `${m}m ${sec}s`
}

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
</script>

<template>
  <div>
    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center gap-3">
        <span class="text-h6">{{ t('Kitchen Shift Analytics') }}</span>
        <VSpacer />
        <VTextField v-model="dateFrom" type="date" :label="t('From')" density="compact" hide-details style="max-inline-size:170px;" />
        <VTextField v-model="dateTo" type="date" :label="t('To')" density="compact" hide-details style="max-inline-size:170px;" />
        <VSelect
          v-model="roleFilter"
          :items="['WAITER', 'CASHIER', 'ADMIN']"
          :label="t('Role')"
          density="compact"
          hide-details
          style="min-inline-size:140px;"
        />
        <VTextField
          v-model.number="targetPrepMinutes"
          type="number"
          :label="t('Target prep (min)')"
          density="compact"
          hide-details
          style="max-inline-size:140px;"
          min="1"
        />
      </VCardText>
    </VCard>

    <div v-if="!summary && loading" class="text-center py-8">
      <VProgressCircular indeterminate />
    </div>

    <template v-else-if="summary">
      <!-- KPIs -->
      <VRow class="mb-4">
        <VCol cols="6" sm="3">
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Shifts') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ summary.shift_count }}
              </div>
              <div class="text-caption text-disabled">
                {{ summary.distinct_staff }} {{ t('staff') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="6" sm="3">
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Orders in Window') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ summary.orders_in_window }}
              </div>
              <div class="text-caption text-success">
                {{ summary.completion_rate_pct }}% {{ t('completed') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="6" sm="3">
          <VCard>
            <VCardText>
              <div class="text-caption text-disabled">
                {{ t('Items Prepared') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ summary.items_prepared }}
              </div>
              <div class="text-caption text-disabled">
                {{ summary.items_per_hour }} / {{ t('h') }}
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="6" sm="3">
          <VCard color="warning" variant="tonal">
            <VCardText>
              <div class="text-caption">
                {{ t('Avg Prep Time') }}
              </div>
              <div class="text-h5 font-weight-bold">
                {{ fmtSec(summary.prep_time.avg_seconds) }}
              </div>
              <div class="text-caption">
                {{ summary.prep_time.slow_orders }} {{ t('slow') }} ({{ summary.prep_time.slow_rate_pct }}%)
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <!-- Prep + Punctuality -->
      <VRow class="mb-4">
        <VCol cols="12" md="6">
          <VCard>
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-3">
                {{ t('Prep Time') }}
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-disabled">{{ t('Average') }}</span>
                <span class="font-weight-bold">{{ fmtSec(summary.prep_time.avg_seconds) }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-success">{{ t('Best shift') }}</span>
                <span>{{ fmtSec(summary.prep_time.best_shift_avg_seconds) }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2">
                <span class="text-error">{{ t('Worst shift') }}</span>
                <span>{{ fmtSec(summary.prep_time.worst_shift_avg_seconds) }}</span>
              </div>
              <VDivider class="my-2" />
              <div class="d-flex justify-space-between mb-1">
                <span class="text-disabled">{{ t('Target') }}</span>
                <span>{{ fmtSec(summary.prep_time.target_seconds) }}</span>
              </div>
              <div class="d-flex justify-space-between">
                <span class="text-warning">{{ t('Slow orders') }}</span>
                <span>{{ summary.prep_time.slow_orders }} ({{ summary.prep_time.slow_rate_pct }}%)</span>
              </div>
            </VCardText>
          </VCard>
        </VCol>
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
      </VRow>

      <!-- Per-shift -->
      <VCard class="mb-4">
        <VCardText>
          <div class="text-subtitle-1 font-weight-medium mb-2">
            {{ t('Per-shift breakdown') }}
          </div>
          <VTable density="compact">
            <thead>
              <tr>
                <th>{{ t('Staff') }}</th>
                <th>{{ t('Date') }}</th>
                <th class="text-end">{{ t('Duration') }}</th>
                <th class="text-end">{{ t('Orders') }}</th>
                <th class="text-end">{{ t('Readied') }}</th>
                <th class="text-end">{{ t('Items') }}</th>
                <th class="text-end">{{ t('Avg Prep') }}</th>
                <th class="text-end">{{ t('Slow') }}</th>
                <th class="text-end">{{ t('Orders/h') }}</th>
                <th class="text-end">{{ t('Late') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in shifts" :key="s.shift_id">
                <td class="font-weight-medium">{{ s.user_name }}</td>
                <td>{{ formatDate(s.start_time) }}</td>
                <td class="text-end">{{ Math.round(s.duration_minutes / 60) }}h</td>
                <td class="text-end">{{ s.orders_in_window }}</td>
                <td class="text-end">{{ s.orders_readied }} ({{ s.completion_rate_pct }}%)</td>
                <td class="text-end">{{ s.items_prepared.units }}</td>
                <td class="text-end">{{ fmtSec(s.prep_time.avg_seconds) }}</td>
                <td class="text-end">{{ s.prep_time.slow_orders }} ({{ s.prep_time.slow_rate_pct }}%)</td>
                <td class="text-end">{{ s.throughput.orders_per_hour }}</td>
                <td class="text-end">
                  <span v-if="s.punctuality.is_late" class="text-warning">+{{ s.punctuality.late_minutes }}m</span>
                  <span v-else class="text-success">✓</span>
                </td>
              </tr>
            </tbody>
          </VTable>
        </VCardText>
      </VCard>

      <!-- Chart -->
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

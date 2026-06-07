<script setup lang="ts">
import axios from '@/plugins/axios'
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
        <VSelect
          v-model="userIdFilter"
          :items="staff.map((s: any) => ({ title: `${s.first_name} ${s.last_name}`, value: s.id }))"
          :label="t('Staff')"
          density="compact"
          hide-details
          style="min-inline-size:180px;"
          clearable
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

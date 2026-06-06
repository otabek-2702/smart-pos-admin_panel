<script setup lang="ts">
import axios from '@/plugins/axios'
import VueApexCharts from 'vue3-apexcharts'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

// -------------------- shift list (left) --------------------
const shifts = ref<any[]>([])
const shiftsLoading = ref(false)
const dateFrom = ref('')
const dateTo = ref('')
const statusFilter = ref<string | undefined>(undefined)
const page = ref(1)
const itemsPerPage = ref(15)
const total = ref(0)

const selectedShiftId = ref<number | null>(null)

async function loadShifts() {
  shiftsLoading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (dateFrom.value)
      params.date_from = dateFrom.value
    if (dateTo.value)
      params.date_to = dateTo.value
    if (statusFilter.value)
      params.status = statusFilter.value
    const res = await axios.get('/shifts', { params })
    const d = res.data?.data ?? res.data

    shifts.value = d?.shifts ?? d?.items ?? []
    total.value = d?.pagination?.total ?? shifts.value.length

    // Auto-pick latest on first load if nothing selected.
    if (!selectedShiftId.value && shifts.value.length)
      selectShift(shifts.value[0])
  }
  catch {
    notify(t('Failed to load shifts'), 'error')
  }
  finally {
    shiftsLoading.value = false
  }
}

onMounted(loadShifts)
watch([page, dateFrom, dateTo, statusFilter], () => {
  page.value = 1
  loadShifts()
})

// -------------------- selected shift state --------------------
const selectedShift = ref<any>(null)
const perf = ref<any>(null)
const perfLoading = ref(false)
const topProducts = ref<any[]>([])
const topLoading = ref(false)

async function selectShift(s: any) {
  selectedShiftId.value = s.id
  selectedShift.value = s
  await Promise.all([loadPerformance(s.id), loadTopProducts(s)])
}

async function loadPerformance(shiftId: number) {
  perfLoading.value = true
  try {
    const res = await axios.get(`/analytics/shifts/${shiftId}`)

    perf.value = res.data?.data ?? res.data
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load performance'), 'error')
    perf.value = null
  }
  finally {
    perfLoading.value = false
  }
}

async function loadTopProducts(shift: any) {
  if (!shift?.start_time)
    return
  topLoading.value = true
  try {
    const start = String(shift.start_time).slice(0, 10)
    const end = shift.end_time ? String(shift.end_time).slice(0, 10) : start
    const res = await axios.get('/orders/stats/top-products', {
      params: { date_from: start, date_to: end, limit: 10 },
    })
    const d = res.data?.data ?? res.data

    topProducts.value = d?.products ?? d?.items ?? d ?? []
  }
  catch {
    topProducts.value = []
  }
  finally {
    topLoading.value = false
  }
}

// -------------------- formatters --------------------
function fmtDuration(seconds: number | null | undefined) {
  if (!seconds && seconds !== 0)
    return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  return `${m}m ${s}s`
}

function fmtShiftLength(minutes: number | null | undefined) {
  if (!minutes)
    return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60

  return h ? `${h}h ${m}m` : `${m}m`
}

// -------------------- cash variance --------------------
const cashVariance = computed(() => {
  if (!selectedShift.value)
    return null
  const rec = selectedShift.value.reconciliation
  const systemCash = Number(selectedShift.value.cash_collected ?? 0)
  const expected = rec ? Number(rec.expected_cash ?? 0) : systemCash
  const actual = rec ? Number(rec.actual_cash ?? 0) : null
  const diff = actual !== null ? actual - expected : null

  return { systemCash, expected, actual, diff }
})

const cashDiffColor = computed(() => {
  const d = cashVariance.value?.diff
  if (d === null || d === undefined)
    return 'default'
  if (Math.abs(d) < 0.01)
    return 'success'

  return d < 0 ? 'error' : 'warning'
})

// -------------------- charts --------------------
const statusChartSeries = computed(() => {
  if (!perf.value)
    return []
  return [
    perf.value.orders_completed ?? 0,
    perf.value.orders_cancelled ?? 0,
    Math.max(0, (perf.value.orders_total ?? 0) - (perf.value.orders_completed ?? 0) - (perf.value.orders_cancelled ?? 0)),
  ]
})

const statusChartOptions = computed(() => ({
  chart: { type: 'donut', toolbar: { show: false } },
  labels: [t('Completed'), t('Cancelled'), t('In Progress')],
  colors: ['#22c55e', '#ef4444', '#f59e0b'],
  legend: { position: 'bottom' },
  dataLabels: { enabled: true },
}))

const productsChartSeries = computed(() => [{
  name: t('Quantity'),
  data: topProducts.value.slice(0, 8).map((p: any) => Number(p.total_quantity ?? p.quantity ?? p.qty_sold ?? 0)),
}])

const productsChartOptions = computed(() => ({
  chart: { type: 'bar', toolbar: { show: false } },
  plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
  xaxis: {
    categories: topProducts.value.slice(0, 8).map((p: any) => p.product_name ?? p.name ?? '—'),
  },
  legend: { show: false },
  dataLabels: { enabled: false },
  colors: ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'],
}))

// -------------------- status chip color --------------------
const statusColor: Record<string, string> = {
  ACTIVE: 'success',
  COMPLETED: 'secondary',
  ABANDONED: 'error',
  RECONCILED: 'info',
}
</script>

<template>
  <div>
    <VRow>
      <!-- Left: shift list -->
      <VCol
        cols="12"
        md="4"
        lg="3"
      >
        <VCard>
          <VCardText class="py-3">
            <div class="text-h6 mb-3">
              {{ t('Select Shift') }}
            </div>
            <VTextField
              v-model="dateFrom"
              type="date"
              :label="t('From')"
              density="compact"
              hide-details
              clearable
              class="mb-2"
            />
            <VTextField
              v-model="dateTo"
              type="date"
              :label="t('To')"
              density="compact"
              hide-details
              clearable
              class="mb-2"
            />
            <VSelect
              v-model="statusFilter"
              :items="['ACTIVE', 'COMPLETED', 'ABANDONED']"
              :placeholder="t('Status')"
              density="compact"
              hide-details
              clearable
            />
          </VCardText>
          <VDivider />
          <VList
            density="compact"
            class="pa-0"
            style="max-height:60vh;overflow-y:auto;"
          >
            <template v-if="shiftsLoading && shifts.length === 0">
              <VListItem
                v-for="n in 5"
                :key="n"
              >
                <div
                  class="sk-box"
                  style="width:100%;height:34px;border-radius:4px;"
                />
              </VListItem>
            </template>
            <VListItem
              v-for="s in shifts"
              :key="s.id"
              :active="selectedShiftId === s.id"
              @click="selectShift(s)"
            >
              <VListItemTitle>
                {{ s.user?.name ?? '—' }}
              </VListItemTitle>
              <VListItemSubtitle>
                {{ formatDate(s.start_time) }}
              </VListItemSubtitle>
              <template #append>
                <VChip
                  size="x-small"
                  :color="statusColor[s.status] ?? 'default'"
                  variant="tonal"
                >
                  {{ t(`shift_status_${s.status}`) }}
                </VChip>
              </template>
            </VListItem>
            <VListItem v-if="!shiftsLoading && !shifts.length">
              <VListItemTitle class="text-disabled text-center py-4">
                {{ t('No shifts found') }}
              </VListItemTitle>
            </VListItem>
          </VList>
        </VCard>
      </VCol>

      <!-- Right: analytics -->
      <VCol
        cols="12"
        md="8"
        lg="9"
      >
        <div
          v-if="!selectedShift"
          class="text-center text-disabled py-8"
        >
          <VIcon
            icon="bx-bar-chart-alt-2"
            size="56"
            class="mb-2"
          />
          <div class="text-h6">
            {{ t('Pick a shift to see analytics') }}
          </div>
        </div>

        <template v-else>
          <!-- Header strip -->
          <VCard class="mb-4">
            <VCardText class="d-flex align-center justify-space-between flex-wrap gap-3">
              <div>
                <div class="text-h6">
                  {{ selectedShift.user?.name ?? '—' }}
                </div>
                <div class="text-caption text-disabled">
                  {{ formatDate(selectedShift.start_time) }}
                  {{ selectedShift.end_time ? `— ${formatDate(selectedShift.end_time)}` : '' }}
                </div>
              </div>
              <VChip
                :color="statusColor[selectedShift.status] ?? 'default'"
                variant="tonal"
              >
                {{ t(`shift_status_${selectedShift.status}`) }}
              </VChip>
              <div class="text-end">
                <div class="text-caption text-disabled">
                  {{ t('Duration') }}
                </div>
                <div class="text-h6">
                  {{ fmtShiftLength(perf?.duration_minutes) }}
                </div>
              </div>
            </VCardText>
          </VCard>

          <!-- KPI cards -->
          <VRow class="mb-4">
            <VCol
              cols="6"
              sm="4"
              lg="2"
            >
              <VCard>
                <VCardText>
                  <div class="text-caption text-disabled">
                    {{ t('Total Orders') }}
                  </div>
                  <div class="text-h5 font-weight-bold">
                    <template v-if="perfLoading && !perf">
                      <span
                        class="sk-box d-inline-block"
                        style="width:40px;height:1em;border-radius:4px;"
                      />
                    </template>
                    <template v-else>
                      {{ perf?.orders_total ?? 0 }}
                    </template>
                  </div>
                </VCardText>
              </VCard>
            </VCol>
            <VCol
              cols="6"
              sm="4"
              lg="2"
            >
              <VCard>
                <VCardText>
                  <div class="text-caption text-success">
                    {{ t('Completed') }}
                  </div>
                  <div class="text-h5 font-weight-bold">
                    {{ perf?.orders_completed ?? 0 }}
                  </div>
                </VCardText>
              </VCard>
            </VCol>
            <VCol
              cols="6"
              sm="4"
              lg="2"
            >
              <VCard>
                <VCardText>
                  <div class="text-caption text-error">
                    {{ t('Cancelled') }} ({{ perf?.cancel_rate_pct ?? 0 }}%)
                  </div>
                  <div class="text-h5 font-weight-bold">
                    {{ perf?.orders_cancelled ?? 0 }}
                  </div>
                </VCardText>
              </VCard>
            </VCol>
            <VCol
              cols="6"
              sm="4"
              lg="2"
            >
              <VCard>
                <VCardText>
                  <div class="text-caption text-disabled">
                    {{ t('Revenue') }}
                  </div>
                  <div class="text-h6 font-weight-bold">
                    {{ formatCurrency(perf?.revenue ?? 0) }}
                  </div>
                </VCardText>
              </VCard>
            </VCol>
            <VCol
              cols="6"
              sm="4"
              lg="2"
            >
              <VCard>
                <VCardText>
                  <div class="text-caption text-disabled">
                    {{ t('Orders / Hour') }}
                  </div>
                  <div class="text-h5 font-weight-bold">
                    {{ perf?.orders_per_hour ?? 0 }}
                  </div>
                </VCardText>
              </VCard>
            </VCol>
            <VCol
              cols="6"
              sm="4"
              lg="2"
            >
              <VCard>
                <VCardText>
                  <div class="text-caption text-disabled">
                    {{ t('Avg Prep Time') }}
                  </div>
                  <div class="text-h6 font-weight-bold">
                    {{ fmtDuration(perf?.avg_prep_seconds) }}
                  </div>
                </VCardText>
              </VCard>
            </VCol>
          </VRow>

          <!-- Cash variance -->
          <VCard
            v-if="cashVariance"
            class="mb-4"
          >
            <VCardText>
              <div class="text-subtitle-1 font-weight-medium mb-3 d-flex align-center gap-2">
                <VIcon
                  icon="bx-wallet"
                  size="20"
                />
                {{ t('Cash Variance') }}
              </div>
              <VRow>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-disabled">
                    {{ t('System (recorded)') }}
                  </div>
                  <div class="text-h6 font-weight-bold">
                    {{ formatCurrency(cashVariance.systemCash) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-disabled">
                    {{ t('Expected (drawer)') }}
                  </div>
                  <div class="text-h6 font-weight-bold">
                    {{ formatCurrency(cashVariance.expected) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-disabled">
                    {{ t('Cashier reported') }}
                  </div>
                  <div class="text-h6 font-weight-bold">
                    <template v-if="cashVariance.actual !== null">
                      {{ formatCurrency(cashVariance.actual) }}
                    </template>
                    <span
                      v-else
                      class="text-disabled"
                    >{{ t('Not reconciled') }}</span>
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="3"
                >
                  <div class="text-caption text-disabled">
                    {{ t('Difference') }}
                  </div>
                  <div class="d-flex align-center gap-2">
                    <VChip
                      v-if="cashVariance.diff !== null"
                      :color="cashDiffColor"
                      variant="tonal"
                      size="large"
                    >
                      <strong>{{ formatCurrency(cashVariance.diff) }}</strong>
                    </VChip>
                    <span
                      v-else
                      class="text-disabled"
                    >—</span>
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <!-- Charts -->
          <VRow>
            <VCol
              cols="12"
              md="5"
            >
              <VCard>
                <VCardText>
                  <div class="text-subtitle-1 font-weight-medium mb-2">
                    {{ t('Orders Breakdown') }}
                  </div>
                  <VueApexCharts
                    v-if="perf"
                    :options="statusChartOptions"
                    :series="statusChartSeries"
                    height="280"
                  />
                  <div
                    v-else
                    class="sk-box"
                    style="width:100%;height:280px;border-radius:6px;"
                  />
                </VCardText>
              </VCard>
            </VCol>
            <VCol
              cols="12"
              md="7"
            >
              <VCard>
                <VCardText>
                  <div class="text-subtitle-1 font-weight-medium mb-2">
                    {{ t('Top Products (during shift)') }}
                  </div>
                  <VueApexCharts
                    v-if="topProducts.length"
                    :options="productsChartOptions"
                    :series="productsChartSeries"
                    height="320"
                  />
                  <div
                    v-else-if="topLoading"
                    class="sk-box"
                    style="width:100%;height:320px;border-radius:6px;"
                  />
                  <div
                    v-else
                    class="text-center text-disabled py-8"
                  >
                    {{ t('No product data for this window') }}
                  </div>
                </VCardText>
              </VCard>
            </VCol>
          </VRow>
        </template>
      </VCol>
    </VRow>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

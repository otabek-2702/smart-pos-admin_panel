<script setup lang="ts">
import axios from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()
const router = useRouter()

// -------- filters --------
const dateFrom = ref('')
const dateTo = ref('')
const userIdFilter = ref<number | undefined>(undefined)
const statusFilter = ref<string | undefined>(undefined)
const liveOnly = ref(false)

const cashiers = ref<any[]>([])
const cashierOptions = computed(() =>
  cashiers.value.map((c: any) => ({
    title: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email || `#${c.id}`,
    value: c.id,
  })),
)

const STATUS_VALUES = ['ACTIVE', 'ENDED', 'COMPLETED', 'ABANDONED']

const statusOptions = computed(() =>
  STATUS_VALUES.map(s => ({ title: t(`shift_status_${s}`), value: s })),
)

const hasFilters = computed(() =>
  !!(dateFrom.value || dateTo.value || userIdFilter.value || statusFilter.value || liveOnly.value),
)

function clearFilters() {
  dateFrom.value = ''
  dateTo.value = ''
  userIdFilter.value = undefined
  statusFilter.value = undefined
  liveOnly.value = false
}

// -------- list --------
const shifts = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(12)

async function loadCashiers() {
  try {
    const res = await axios.get('/users', { params: { role: 'CASHIER', per_page: 200 } })
    const d = res.data?.data ?? res.data

    cashiers.value = d?.users ?? []
  }
  catch {
    cashiers.value = []
  }
}

async function loadShifts() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (dateFrom.value)
      params.date_from = dateFrom.value
    if (dateTo.value)
      params.date_to = dateTo.value
    if (userIdFilter.value)
      params.user_id = userIdFilter.value
    if (statusFilter.value)
      params.status = statusFilter.value
    else if (liveOnly.value)
      params.status = 'ACTIVE'

    const res = await axios.get('/shifts', { params })
    const d = res.data?.data ?? res.data

    shifts.value = Array.isArray(d) ? d : (d?.shifts ?? d?.items ?? [])
    total.value = d?.pagination?.total_items
      ?? d?.pagination?.total
      ?? d?.pagination?.total_shifts
      ?? shifts.value.length
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load shifts'), 'error')
    shifts.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

onMounted(() => { loadCashiers(); loadShifts() })
watch([page, itemsPerPage], loadShifts)
watch([dateFrom, dateTo, userIdFilter, statusFilter, liveOnly], () => {
  page.value = 1
  loadShifts()
})

function open(shift: any) {
  router.push({ path: '/analytics/shift-handover', query: { shift: String(shift.id) } })
}

// -------- presentation helpers --------
const statusColor: Record<string, string> = {
  ACTIVE: 'success',
  ENDED: 'warning',
  COMPLETED: 'secondary',
  ABANDONED: 'error',
  RECONCILED: 'info',
}

function fmtDuration(min: number | null | undefined) {
  if (!min && min !== 0)
    return '—'
  const h = Math.floor(min / 60)
  const m = min % 60

  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

function fmtClock(iso: string | null | undefined) {
  if (!iso)
    return '—'
  try {
    const d = new Date(iso)

    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  catch {
    return '—'
  }
}

function fmtDay(iso: string | null | undefined) {
  if (!iso)
    return '—'

  return formatDate(iso)
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso)
    return '—'
  try {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')

    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`
  }
  catch {
    return '—'
  }
}

function num(v: any): number {
  const n = Number(v)

  return Number.isFinite(n) ? n : 0
}

function netRevenue(s: any): number {
  if (s.net_revenue !== undefined && s.net_revenue !== null)
    return num(s.net_revenue)

  return num(s.total_revenue) - num(s.expenses_total) - num(s.cancelled_orders_value)
}

function avgTicket(s: any): number {
  const orders = num(s.total_orders)
  if (!orders)
    return 0

  return num(s.total_revenue) / orders
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UZCARD: 'UzCard',
  HUMO: 'Humo',
  PAYME: 'Payme',
  CLICK: 'Click',
  MIXED: 'Mixed',
}

function tokenColor(name: string, fallback: string): string {
  if (typeof window === 'undefined')
    return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  return v || fallback
}

const PAYMENT_COLORS: Record<string, string> = {
  CASH: tokenColor('--chart-cash', '#15935A'),
  UZCARD: tokenColor('--chart-card', '#3A5BDB'),
  HUMO: tokenColor('--c4', '#6E8BFF'),
  PAYME: tokenColor('--c5', '#9AA3B2'),
  CLICK: tokenColor('--chart-expense', '#E0823C'),
  MIXED: tokenColor('--c5', '#9AA3B2'),
}

interface PaymentRow {
  key: string
  label: string
  amount: number
  count: number
  percent: number
  color: string
}

function paymentRows(s: any): PaymentRow[] {
  const mix = s.payment_mix
  if (!mix || typeof mix !== 'object')
    return []
  const total = Object.values(mix).reduce((acc: number, v: any) => acc + num(v?.amount), 0) || 1

  return Object.entries(mix)
    .map(([k, v]: [string, any]) => {
      const amount = num(v?.amount)

      return {
        key: k,
        label: PAYMENT_LABELS[k] ?? k,
        amount,
        count: num(v?.count),
        percent: Math.round((amount / total) * 100),
        color: PAYMENT_COLORS[k] ?? '#607d8b',
      }
    })
    .filter(r => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

function fmtPrepSeconds(sec: number | null | undefined) {
  if (sec === null || sec === undefined)
    return '—'
  const n = Number(sec)
  if (!Number.isFinite(n) || n <= 0)
    return '—'
  if (n < 60)
    return `${Math.round(n)}s`

  return `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, '0')}s`
}

function fmtPeakHour(p: any) {
  if (!p || p.hour === undefined || p.hour === null)
    return '—'
  const h = String(p.hour).padStart(2, '0')

  return p.orders !== undefined ? `${h}:00 (${p.orders})` : `${h}:00`
}

function varianceColor(v: any) {
  if (v === null || v === undefined || v === '')
    return 'default'
  const n = Number(v)
  if (Math.abs(n) < 0.01)
    return 'success'

  return n < 0 ? 'error' : 'warning'
}

function varianceLabel(v: any) {
  const n = Number(v)
  if (n > 0)
    return `+${formatCurrency(v)}`

  return formatCurrency(v)
}

const skeletonCards = computed(() => Array.from({ length: 6 }))
</script>

<template>
  <div>
    <!-- Filter bar -->
    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center gap-3">
        <span class="text-h6 me-2">{{ t('Shifts') }}</span>
        <VTextField
          v-model="dateFrom"
          type="date"
          :label="t('From')"
          density="compact"
          hide-details
          clearable
          style="max-inline-size:170px;"
        />
        <VTextField
          v-model="dateTo"
          type="date"
          :label="t('To')"
          density="compact"
          hide-details
          clearable
          style="max-inline-size:170px;"
        />
        <VSelect
          v-model="userIdFilter"
          :items="cashierOptions"
          :label="t('Cashier')"
          density="compact"
          hide-details
          clearable
          style="min-inline-size:200px;"
        />
        <VSelect
          v-model="statusFilter"
          :items="statusOptions"
          :label="t('Status')"
          density="compact"
          hide-details
          clearable
          style="min-inline-size:180px;"
        />
        <VChip
          :color="liveOnly ? 'success' : 'default'"
          :variant="liveOnly ? 'flat' : 'tonal'"
          size="small"
          prepend-icon="bx-pulse"
          class="cursor-pointer"
          @click="liveOnly = !liveOnly"
        >
          {{ t('Live only') }}
        </VChip>
        <VSpacer />
        <VBtn
          v-if="hasFilters"
          variant="tonal"
          size="small"
          prepend-icon="bx-x"
          @click="clearFilters"
        >
          {{ t('Clear') }}
        </VBtn>
      </VCardText>
    </VCard>

    <!-- Skeleton grid -->
    <VRow v-if="loading && shifts.length === 0">
      <VCol
        v-for="(_, i) in skeletonCards"
        :key="i"
        cols="12"
        sm="6"
        md="4"
      >
        <VCard>
          <VCardText>
            <div
              class="sk-box mb-2"
              style="width:60%;height:18px;border-radius:4px;"
            />
            <div
              class="sk-box mb-2"
              style="width:40%;height:12px;border-radius:4px;"
            />
            <div
              class="sk-box mb-3"
              style="width:80%;height:12px;border-radius:4px;"
            />
            <VDivider class="mb-3" />
            <div class="d-flex justify-space-between mb-2">
              <div
                class="sk-box"
                style="width:60px;height:24px;border-radius:4px;"
              />
              <div
                class="sk-box"
                style="width:90px;height:24px;border-radius:4px;"
              />
              <div
                class="sk-box"
                style="width:80px;height:24px;border-radius:4px;"
              />
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Empty -->
    <VCard
      v-else-if="!loading && shifts.length === 0"
      variant="tonal"
    >
      <VCardText class="text-center py-12">
        <VIcon
          icon="bx-time-five"
          size="56"
          class="mb-2"
        />
        <div class="text-h6 mb-2">
          {{ t('No shifts found') }}
        </div>
        <VBtn
          v-if="hasFilters"
          variant="tonal"
          prepend-icon="bx-x"
          @click="clearFilters"
        >
          {{ t('Clear filters') }}
        </VBtn>
      </VCardText>
    </VCard>

    <!-- Cards -->
    <VRow v-else>
      <VCol
        v-for="s in shifts"
        :key="s.id"
        cols="12"
        sm="6"
        md="4"
      >
        <VCard
          class="shift-card"
          :class="{ 'shift-card--active': s.status === 'ACTIVE', 'shift-card--abandoned': s.status === 'ABANDONED' }"
          hover
          @click="open(s)"
        >
          <VCardText>
            <!-- Header row: avatar + name + template + status chip -->
            <div class="d-flex align-center gap-2 mb-3">
              <VAvatar
                size="36"
                :color="statusColor[s.status] ?? 'primary'"
                variant="tonal"
              >
                <span class="text-body-2 font-weight-medium">
                  {{ ((s.user?.name ?? '?').trim()[0] || '?').toUpperCase() }}
                </span>
              </VAvatar>
              <div class="flex-grow-1 min-width-0">
                <div class="text-body-1 font-weight-medium text-truncate">
                  {{ s.user?.name ?? '—' }}
                </div>
                <div class="text-caption text-disabled text-truncate">
                  {{ s.shift_template?.name ?? t('No template') }}
                </div>
              </div>
              <VChip
                class="status-pill"
                :color="statusColor[s.status] ?? 'default'"
                size="small"
                variant="flat"
                :prepend-icon="s.is_live_stats ? 'bx-pulse' : undefined"
              >
                {{ t(`shift_status_${s.status}`) }}
              </VChip>
            </div>

            <!-- BIG datetime row: start → end + duration pill -->
            <div class="datetime-row pa-3 mb-3">
              <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                <div class="d-flex align-center gap-2">
                  <span class="text-body-1 font-weight-medium">{{ fmtDateTime(s.start_time) }}</span>
                  <VIcon
                    icon="bx-right-arrow-alt"
                    size="18"
                    class="text-primary"
                  />
                  <span
                    v-if="s.end_time"
                    class="text-body-1 font-weight-medium"
                  >{{ fmtDateTime(s.end_time) }}</span>
                  <span
                    v-else
                    class="text-body-1 font-weight-medium text-success"
                  >…{{ t('running') }}</span>
                </div>
                <VChip
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="bx-time-five"
                >
                  {{ fmtDuration(s.duration_minutes) }}
                </VChip>
              </div>
            </div>

            <!-- KPI row: Orders / Gross / Net -->
            <div class="kpi-row d-flex justify-space-between text-center mb-3">
              <div class="kpi-col">
                <div class="text-caption text-disabled">
                  {{ t('Orders') }}
                </div>
                <div class="text-h6 font-weight-bold font-mono num-tabular">
                  {{ s.total_orders ?? 0 }}
                </div>
              </div>
              <VDivider vertical />
              <div class="kpi-col">
                <div class="text-caption text-disabled">
                  {{ t('Gross') }}
                </div>
                <div class="text-h6 font-weight-bold font-mono num-tabular">
                  {{ formatCurrency(s.total_revenue ?? 0) }}
                </div>
              </div>
              <VDivider vertical />
              <div class="kpi-col">
                <div class="text-caption text-disabled">
                  {{ t('Net') }}
                </div>
                <div class="text-h6 font-weight-bold text-success font-mono num-tabular">
                  {{ formatCurrency(netRevenue(s)) }}
                </div>
              </div>
            </div>

            <!-- Payment mix -->
            <VDivider class="mb-3" />
            <div class="mb-3">
              <div class="text-caption text-disabled mb-2 d-flex align-center justify-space-between">
                <span>{{ t('Payments') }}</span>
                <span
                  v-if="!paymentRows(s).length"
                  class="text-disabled"
                >—</span>
              </div>
              <template v-if="paymentRows(s).length">
                <!-- Stacked single bar -->
                <div class="pay-bar mb-2">
                  <div
                    v-for="r in paymentRows(s)"
                    :key="r.key"
                    class="pay-bar__seg"
                    :style="{ width: `${r.percent}%`, background: r.color }"
                    :title="`${r.label}: ${formatCurrency(r.amount)} (${r.percent}%)`"
                  />
                </div>
                <!-- Per-method rows -->
                <div
                  v-for="r in paymentRows(s)"
                  :key="r.key"
                  class="d-flex align-center justify-space-between text-caption mb-1"
                >
                  <div class="d-flex align-center gap-2">
                    <span
                      class="pay-dot"
                      :style="{ background: r.color }"
                    />
                    <span>{{ r.label }}</span>
                  </div>
                  <div>
                    <span class="font-weight-medium">{{ formatCurrency(r.amount) }}</span>
                    <span class="text-disabled ms-2">{{ r.percent }}%</span>
                  </div>
                </div>
              </template>
            </div>

            <!-- Problems row: Cancelled + Expenses -->
            <VDivider class="mb-3" />
            <div class="d-flex justify-space-between gap-2 mb-3">
              <div class="problem-tile">
                <VIcon
                  icon="bx-x-circle"
                  size="16"
                  color="error"
                />
                <div class="d-flex flex-column">
                  <span class="text-caption text-disabled">{{ t('Cancelled') }}</span>
                  <span class="text-body-2 font-weight-medium">
                    {{ s.cancelled_orders_count ?? 0 }}
                    <span
                      v-if="num(s.cancelled_orders_value) > 0"
                      class="text-disabled ms-1"
                    >· {{ formatCurrency(s.cancelled_orders_value) }}</span>
                  </span>
                </div>
              </div>
              <div class="problem-tile">
                <VIcon
                  icon="bx-money-withdraw"
                  size="16"
                  color="warning"
                />
                <div class="d-flex flex-column">
                  <span class="text-caption text-disabled">{{ t('Expenses') }}</span>
                  <span class="text-body-2 font-weight-medium">{{ formatCurrency(s.expenses_total ?? 0) }}</span>
                </div>
              </div>
            </div>

            <!-- Extras micro-row -->
            <VDivider class="mb-3" />
            <div class="extras-row d-flex flex-wrap gap-3 mb-3">
              <div class="extra-stat">
                <VIcon
                  icon="bx-receipt"
                  size="14"
                  class="text-disabled"
                />
                <span class="text-caption text-disabled">{{ t('Avg ticket') }}:</span>
                <span class="text-caption font-weight-medium">{{ formatCurrency(avgTicket(s)) }}</span>
              </div>
              <div class="extra-stat">
                <VIcon
                  icon="bx-package"
                  size="14"
                  class="text-disabled"
                />
                <span class="text-caption text-disabled">{{ t('Items') }}:</span>
                <span class="text-caption font-weight-medium">{{ s.items_sold ?? '—' }}</span>
              </div>
              <div class="extra-stat">
                <VIcon
                  icon="bx-stopwatch"
                  size="14"
                  class="text-disabled"
                />
                <span class="text-caption text-disabled">{{ t('Avg prep') }}:</span>
                <span class="text-caption font-weight-medium">{{ fmtPrepSeconds(s.avg_prep_seconds) }}</span>
              </div>
              <div class="extra-stat">
                <VIcon
                  icon="bx-trending-up"
                  size="14"
                  class="text-disabled"
                />
                <span class="text-caption text-disabled">{{ t('Peak') }}:</span>
                <span class="text-caption font-weight-medium">{{ fmtPeakHour(s.peak_hour) }}</span>
              </div>
            </div>

            <!-- Variance footer -->
            <template v-if="s.reconciliation">
              <VDivider class="mb-3" />
              <div class="d-flex align-center justify-space-between">
                <div class="d-flex flex-column">
                  <span class="text-caption text-disabled">
                    {{ t('Δ vs reported') }}
                  </span>
                  <span
                    v-if="s.reconciliation.reconciled_by?.name"
                    class="text-caption text-disabled"
                  >
                    {{ t('by') }} {{ s.reconciliation.reconciled_by.name }}
                  </span>
                </div>
                <VChip
                  size="small"
                  :color="varianceColor(s.reconciliation.difference)"
                  variant="flat"
                >
                  {{ varianceLabel(s.reconciliation.difference) }}
                </VChip>
              </div>
            </template>
            <template v-else-if="s.status === 'ENDED'">
              <VDivider class="mb-3" />
              <div class="text-caption text-warning text-center">
                <VIcon
                  icon="bx-error-circle"
                  size="14"
                  class="me-1"
                />
                {{ t('Awaiting reconciliation') }}
              </div>
            </template>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Pagination -->
    <VCard
      v-if="shifts.length"
      class="mt-3"
    >
      <DataTableFooter
        v-model:page="page"
        v-model:items-per-page="itemsPerPage"
        :total-items="total"
        :per-page-options="[6, 12, 24, 48]"
      />
    </VCard>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped lang="scss">
.shift-card {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  block-size: 100%;

  &:hover {
    transform: translateY(-2px);
  }

  &--active {
    border-inline-start: 3px solid rgb(var(--v-theme-success));
  }

  &--abandoned {
    opacity: 0.75;
  }
}

.min-width-0 {
  min-inline-size: 0;
}

.datetime-row {
  background: rgba(var(--v-theme-primary), 0.06);
  border-radius: 8px;
}

.kpi-row {
  .kpi-col {
    flex: 1;
    padding: 0 8px;
  }
}

.pay-bar {
  display: flex;
  block-size: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.06);

  &__seg {
    transition: width 0.3s ease;
    block-size: 100%;
  }
}

.pay-dot {
  display: inline-block;
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
}

.problem-tile {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 6px 10px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 6px;
}

.extras-row {
  .extra-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

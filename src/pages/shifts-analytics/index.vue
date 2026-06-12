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
            <!-- Header row: avatar + name + status chip -->
            <div class="d-flex align-center gap-2 mb-1">
              <VAvatar
                size="32"
                :color="statusColor[s.status] ?? 'primary'"
                variant="tonal"
              >
                <span class="text-caption">
                  {{ ((s.user?.name ?? '?').trim()[0] || '?').toUpperCase() }}
                </span>
              </VAvatar>
              <div class="text-body-1 font-weight-medium text-truncate flex-grow-1">
                {{ s.user?.name ?? '—' }}
              </div>
              <VChip
                :color="statusColor[s.status] ?? 'default'"
                size="x-small"
                variant="tonal"
                :prepend-icon="s.is_live_stats ? 'bx-pulse' : undefined"
              >
                {{ t(`shift_status_${s.status}`) }}
              </VChip>
            </div>

            <!-- Template + date -->
            <div class="text-caption text-disabled mb-1 ms-10">
              <span v-if="s.shift_template?.name">{{ s.shift_template.name }} · </span>
              {{ fmtDay(s.start_time) }}
            </div>

            <!-- Time window + duration -->
            <div class="text-body-2 ms-10 mb-3">
              {{ fmtClock(s.start_time) }}
              <VIcon
                icon="bx-right-arrow-alt"
                size="14"
                class="mx-1 text-disabled"
              />
              <span v-if="s.end_time">{{ fmtClock(s.end_time) }}</span>
              <span
                v-else
                class="text-success"
              >…</span>
              <span class="text-disabled"> · {{ fmtDuration(s.duration_minutes) }}</span>
            </div>

            <VDivider class="mb-3" />

            <!-- KPI strip -->
            <div class="d-flex justify-space-between text-center">
              <div>
                <div class="text-caption text-disabled">
                  {{ t('Orders') }}
                </div>
                <div class="text-body-1 font-weight-bold">
                  {{ s.total_orders ?? 0 }}
                </div>
              </div>
              <div>
                <div class="text-caption text-disabled">
                  {{ t('Revenue') }}
                </div>
                <div class="text-body-1 font-weight-bold">
                  {{ formatCurrency(s.total_revenue ?? 0) }}
                </div>
              </div>
              <div>
                <div class="text-caption text-disabled">
                  {{ t('Cash') }}
                </div>
                <div class="text-body-1 font-weight-bold">
                  {{ formatCurrency(s.cash_collected ?? 0) }}
                </div>
              </div>
            </div>

            <!-- Variance footer -->
            <template v-if="s.reconciliation">
              <VDivider class="my-3" />
              <div class="d-flex align-center justify-space-between">
                <span class="text-caption text-disabled">
                  {{ t('Δ vs reported') }}
                </span>
                <VChip
                  size="small"
                  :color="varianceColor(s.reconciliation.difference)"
                  variant="tonal"
                >
                  {{ varianceLabel(s.reconciliation.difference) }}
                </VChip>
              </div>
            </template>
            <template v-else-if="s.status === 'ENDED'">
              <VDivider class="my-3" />
              <div class="text-caption text-warning text-center">
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
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

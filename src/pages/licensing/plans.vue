<script setup lang="ts">
/* ============================================================
   LICENSING — PLANS
   Subscription plans browser w/ change-request flow. Extends the
   existing licensing/status.vue by rendering the current license
   state as a top status card, then a plans tab below where the
   user can pick a plan + submit a vendor-approval request.
   Plain HTML + design primitives, no Vuetify.
   ============================================================ */
import type { DataTableColumn } from '@/components/design/DataTable.vue'
import { licensingApi } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Segmented from '@/components/design/Segmented.vue'
import Select from '@/components/design/Select.vue'
import StatusBadge from '@/components/design/StatusBadge.vue'
import Switch from '@/components/design/Switch.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

// ============================================================
// State
// ============================================================
const plans = ref<any[]>([])
const totalPlans = ref(0)
const loadingPlans = ref(false)
const plansUnreachable = ref(false)

const licenseState = ref<any>(null)
const loadingStatus = ref(false)

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const currencyFilter = ref<string>('')
const periodFilter = ref<string>('')
const activeOnly = ref<boolean>(false)

const tab = ref<'plans' | 'status'>('plans')

// Plan-change modal state
const changeOpen = ref(false)
const changeBusy = ref(false)
const changeTarget = ref<any>(null)
const changeNote = ref('')
const changeErrors = ref<Record<string, string>>({})

const PERIOD_VALUES = ['monthly', 'yearly', 'quarterly', 'lifetime']
const CURRENCY_VALUES = ['USD', 'UZS', 'RUB', 'EUR']

// ============================================================
// Enum -> tone maps (mirror STATUS_TONE convention)
// ============================================================
const STATUS_TONE: Record<string, 'primary' | 'info' | 'neutral' | 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  DEPRECATED: 'warning',
  DRAFT: 'info',
}

const CURRENT_TONE: Record<string, 'primary' | 'info' | 'neutral' | 'success' | 'warning' | 'error'> = {
  CURRENT: 'success',
  PENDING: 'warning',
  AVAILABLE: 'neutral',
}

const CURRENCY_TONE: Record<string, 'primary' | 'info' | 'neutral' | 'success' | 'warning' | 'error'> = {
  USD: 'success',
  UZS: 'info',
  RUB: 'primary',
  EUR: 'warning',
}

const PERIOD_TONE: Record<string, 'primary' | 'info' | 'neutral' | 'success' | 'warning' | 'error'> = {
  monthly: 'primary',
  yearly: 'success',
  quarterly: 'info',
  lifetime: 'warning',
}

const LICENSE_TONE: Record<string, 'primary' | 'info' | 'neutral' | 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  UNREGISTERED: 'warning',
  SUSPENDED: 'error',
  EXPIRED: 'error',
}

// ============================================================
// Formatters
// ============================================================
const NB = ' '
function fmtMoney(n: number | string | null | undefined, currency?: string): string {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n)))
    return '—'
  const v = Number(n)
  const neg = v < 0
  const fixed = Math.abs(v).toFixed(2).replace(/\.00$/, '')
  const s = fixed.replace(/\B(?=(\d{3})+(?!\d))/g, NB)

  return `${neg ? '−' : ''}${s}${currency ? ` ${currency}` : ''}`
}

function fmtFeatures(f: any): string {
  if (!f) return '—'
  if (Array.isArray(f)) return f.length === 0 ? '—' : f.join(', ')
  if (typeof f === 'object') return Object.keys(f).join(', ') || '—'

  return String(f)
}

// ============================================================
// API
// ============================================================
async function loadStatus() {
  loadingStatus.value = true
  try {
    const res = await licensingApi.get('/status')
    licenseState.value = res.data?.data ?? res.data
  }
  catch {
    licenseState.value = null
  }
  finally {
    loadingStatus.value = false
  }
}

async function loadPlans() {
  loadingPlans.value = true
  plansUnreachable.value = false
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (currencyFilter.value)
      params.currency = currencyFilter.value
    if (periodFilter.value)
      params.period = periodFilter.value
    if (activeOnly.value)
      params.is_active = true

    const res = await licensingApi.get('/plans', { params })
    const d = res.data?.data ?? res.data
    const rows = d?.plans ?? d?.results ?? d?.items ?? (Array.isArray(d) ? d : [])

    plans.value = rows
    totalPlans.value = d?.pagination?.total_items ?? d?.count ?? d?.total ?? rows.length
  }
  catch {
    plans.value = []
    totalPlans.value = 0
    plansUnreachable.value = true
    notify(t('license_plans_unreachable'), 'error')
  }
  finally {
    loadingPlans.value = false
  }
}

onMounted(() => {
  loadStatus()
  loadPlans()
})

watch([page, itemsPerPage], loadPlans)
const debouncedSearch = useDebounceFn(() => { page.value = 1; loadPlans() }, 400)

watch(search, debouncedSearch)
watch([currencyFilter, periodFilter, activeOnly], () => { page.value = 1; loadPlans() })

// ============================================================
// Plan-change request
// ============================================================
function openChange(row: any) {
  // Guards: can't switch to current, can't open while a pending change exists
  if (isCurrentPlan(row))
    return
  if (licenseState.value?.pending_plan_change) {
    notify(t('plan_change_already_pending'), 'error')

    return
  }
  if (licenseState.value?.status === 'UNREGISTERED') {
    notify(t('plan_change_unregistered'), 'error')

    return
  }
  changeTarget.value = row
  changeNote.value = ''
  changeErrors.value = {}
  changeOpen.value = true
}

function closeChange() {
  if (changeBusy.value) return
  changeOpen.value = false
  changeTarget.value = null
  changeNote.value = ''
  changeErrors.value = {}
}

async function submitChange() {
  if (!changeTarget.value) return
  const errs: Record<string, string> = {}

  if (!changeTarget.value.id)
    errs.plan_id = t('plan_name')
  changeErrors.value = errs
  if (Object.keys(errs).length > 0)
    return

  changeBusy.value = true
  try {
    await licensingApi.post('/plan-change', {
      plan_id: changeTarget.value.id,
      note: changeNote.value || '',
    })
    notify(t('plan_change_success'))
    changeOpen.value = false
    changeTarget.value = null
    changeNote.value = ''
    await loadStatus()
    await loadPlans()
  }
  catch (e: any) {
    const code = e?.response?.data?.code
    if (code === 'PLAN_CHANGE_ALREADY_PENDING')
      notify(t('plan_change_already_pending'), 'error')
    else if (code === 'UNREGISTERED')
      notify(t('plan_change_unregistered'), 'error')
    else
      notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    changeBusy.value = false
  }
}

// ============================================================
// Derived
// ============================================================
function planRowFlag(row: any): 'CURRENT' | 'PENDING' | 'AVAILABLE' {
  if (!licenseState.value)
    return 'AVAILABLE'
  if (licenseState.value.current_plan_id && licenseState.value.current_plan_id === row.id)
    return 'CURRENT'
  if (licenseState.value.pending_plan_change?.plan_id === row.id)
    return 'PENDING'

  return 'AVAILABLE'
}

function isCurrentPlan(row: any): boolean {
  return planRowFlag(row) === 'CURRENT'
}

function isPendingPlan(row: any): boolean {
  return planRowFlag(row) === 'PENDING'
}

const currentPlan = computed(() =>
  plans.value.find(p => planRowFlag(p) === 'CURRENT') ?? null,
)

const pendingPlan = computed(() =>
  plans.value.find(p => planRowFlag(p) === 'PENDING') ?? null,
)

// ============================================================
// Filter chips
// ============================================================
const activeFilters = computed(() => {
  const out: { k: string; label: string; val: string; clear: () => void }[] = []
  if (search.value)
    out.push({ k: 'q', label: t('Search'), val: search.value, clear: () => { search.value = '' } })
  if (currencyFilter.value)
    out.push({ k: 'c', label: t('license_filter_currency'), val: t(`plan_currency_${currencyFilter.value}`), clear: () => { currencyFilter.value = '' } })
  if (periodFilter.value)
    out.push({ k: 'p', label: t('license_filter_period'), val: t(`plan_period_${periodFilter.value}`), clear: () => { periodFilter.value = '' } })
  if (activeOnly.value)
    out.push({ k: 'a', label: t('license_filter_active_only'), val: t('Yes'), clear: () => { activeOnly.value = false } })

  return out
})

function clearAllFilters() {
  search.value = ''
  currencyFilter.value = ''
  periodFilter.value = ''
  activeOnly.value = false
}

// ============================================================
// Filter options
// ============================================================
const currencyOptions = computed(() =>
  CURRENCY_VALUES.map(v => ({ value: v, label: t(`plan_currency_${v}`) })),
)
const periodOptions = computed(() =>
  ['monthly', 'yearly'].map(v => ({ value: v, label: t(`plan_period_${v}`) })),
)

// ============================================================
// KPI strip — license summary
// ============================================================
const kpiStatus = computed(() => ({
  label: t('license_status_label'),
  value: licenseState.value?.status ? t(`license_status_${licenseState.value.status}`) : null,
  icon: 'lock',
  tone: (LICENSE_TONE[licenseState.value?.status] ?? 'neutral') as any,
  sub: licenseState.value?.tenant?.org_name ?? '',
}))

const kpiCurrent = computed(() => ({
  label: t('license_current_plan'),
  value: currentPlan.value?.name ?? (licenseState.value?.current_plan?.name ?? null),
  icon: 'star',
  tone: 'primary' as const,
  sub: currentPlan.value?.period ? t(`plan_period_${currentPlan.value.period}`) : '',
}))

const kpiBalance = computed(() => ({
  label: t('license_balance'),
  value: licenseState.value ? (licenseState.value.balance ?? 0) : null,
  icon: 'wallet',
  tone: 'success' as const,
  money: true,
  sub: licenseState.value?.balance_currency ?? '',
}))

const kpiExpires = computed(() => ({
  label: t('license_days_remaining'),
  value: licenseState.value?.days_remaining ?? null,
  icon: 'calendar',
  tone: 'info' as const,
  sub: licenseState.value?.expires_at ? formatDate(licenseState.value.expires_at) : '',
}))

const showLowBalance = computed(
  () => !!licenseState.value
    && typeof licenseState.value.balance === 'number'
    && licenseState.value.balance > 0
    && licenseState.value.balance < (licenseState.value.low_balance_threshold ?? 5),
)

// ============================================================
// DataTable columns
// ============================================================
const columns: DataTableColumn<any>[] = [
  { key: 'name', label: t('plan_name'), sortable: true },
  { key: 'description', label: t('plan_description'), sortable: false },
  { key: 'price', label: t('plan_price'), sortable: true, align: 'end' },
  { key: 'currency', label: t('plan_currency_label'), sortable: true },
  { key: 'period', label: t('plan_period_label'), sortable: true },
  { key: 'features', label: t('plan_features'), sortable: false },
  { key: 'status', label: t('Status'), sortable: true },
  { key: 'is_current', label: t('license_current_PENDING'), sortable: false },
]

const tablePagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: totalPlans.value,
  onPage: (n: number) => { page.value = n },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

// ============================================================
// Tabs
// ============================================================
const tabOptions = computed(() => [
  { value: 'plans', label: t('license_plans_title'), icon: 'package' },
  { value: 'status', label: t('license_status_label'), icon: 'lock' },
])

// ESC handler — close modal first
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (changeOpen.value) {
    closeChange()
    e.preventDefault()
  }
}
onMounted(() => { window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <div class="page">
    <!-- Header -->
    <PageHeader
      :title="t('license_plans_title')"
      :subtitle="t('license_plans_subtitle')"
    >
      <template #actions>
        <Button
          variant="ghost"
          icon="refresh"
          :loading="loadingPlans || loadingStatus"
          @click="() => { loadStatus(); loadPlans() }"
        >
          {{ t('license_action_refresh') }}
        </Button>
        <Button
          variant="secondary"
          icon="lock"
          @click="tab = 'status'"
        >
          {{ t('license_action_view_status') }}
        </Button>
      </template>
    </PageHeader>

    <!-- License summary strip -->
    <div
      class="grid cols-4"
      style="margin-bottom: var(--sp-5);"
    >
      <Kpi :data="kpiStatus" />
      <Kpi :data="kpiCurrent" />
      <Kpi :data="kpiBalance" />
      <Kpi :data="kpiExpires" />
    </div>

    <!-- Low-balance warning -->
    <div
      v-if="showLowBalance"
      class="callout callout--warning"
      style="margin-bottom: var(--sp-4); display:flex; gap:10px; align-items:center; padding:12px 14px; border-radius:10px; background: rgba(var(--v-theme-warning, 245 158 11) / 0.08); border:1px solid rgba(var(--v-theme-warning, 245 158 11) / 0.28);"
    >
      <DesignIcon
        name="alert"
        :size="18"
      />
      <span>{{ t('license_top_up_warn') }}</span>
    </div>

    <!-- Pending-change notice -->
    <div
      v-if="pendingPlan || licenseState?.pending_plan_change"
      class="callout callout--info"
      style="margin-bottom: var(--sp-4); display:flex; gap:10px; align-items:center; padding:12px 14px; border-radius:10px; background: rgba(var(--v-theme-info, 14 165 233) / 0.08); border:1px solid rgba(var(--v-theme-info, 14 165 233) / 0.28);"
    >
      <DesignIcon
        name="clock"
        :size="18"
      />
      <span>
        {{ t('license_pending_change') }}
        <strong v-if="pendingPlan">
          — {{ pendingPlan.name }}
        </strong>
      </span>
    </div>

    <!-- Tabs -->
    <div style="margin-bottom: var(--sp-3);">
      <Segmented
        v-model="tab"
        :options="tabOptions as any"
      />
    </div>

    <!-- ============================================================
         PLANS TAB
         ============================================================ -->
    <Card v-if="tab === 'plans'">
      <!-- Toolbar -->
      <div class="toolbar">
        <div
          class="control"
          style="flex:1; max-width:320px;"
        >
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search')"
          />
        </div>
        <div
          class="control"
          style="width:180px;"
        >
          <Select
            v-model="currencyFilter"
            icon="filter"
            :placeholder="t('license_filter_currency')"
            :options="currencyOptions"
          />
        </div>
        <div
          class="control"
          style="width:200px;"
        >
          <Select
            v-model="periodFilter"
            :placeholder="t('license_filter_period')"
            :options="periodOptions"
          />
        </div>
        <div
          class="control"
          style="display:flex; gap:10px; align-items:center;"
        >
          <Switch v-model="activeOnly" />
          <span style="font-size:14px; color: var(--text-secondary);">
            {{ t('license_filter_active_only') }}
          </span>
        </div>
      </div>

      <!-- Filter chips -->
      <div
        v-if="activeFilters.length > 0"
        class="toolbar"
        style="padding-top:0;"
      >
        <div class="chips">
          <span
            class="tertiary"
            style="font-size:13px;margin-right:2px;"
          >{{ t('Filters') }}:</span>
          <span
            v-for="f in activeFilters"
            :key="f.k"
            class="chip"
          >
            <span>{{ f.label }}: <b>{{ f.val }}</b></span>
            <span
              class="chip__x"
              @click="f.clear()"
            >
              <DesignIcon
                name="close"
                :size="13"
              />
            </span>
          </span>
          <button
            class="chip--clear"
            @click="clearAllFilters"
          >
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- Table -->
      <DataTable
        :columns="columns"
        :rows="plans"
        row-key="id"
        :loading="loadingPlans"
        :pagination="tablePagination"
        :initial-sort="{ key: 'price', dir: 'asc' }"
      >
        <template #cell.name="{ row }">
          <div
            class="row"
            style="gap:8px; align-items:center;"
          >
            <span class="cell-strong nowrap">{{ row.name }}</span>
            <Badge
              v-if="isCurrentPlan(row)"
              tone="success"
              dot
            >
              {{ t('license_current_plan') }}
            </Badge>
          </div>
        </template>

        <template #cell.description="{ row }">
          <span class="cell-muted">{{ row.description || '—' }}</span>
        </template>

        <template #cell.price="{ row }">
          <span class="mono cell-strong">{{ fmtMoney(row.price) }}</span>
        </template>

        <template #cell.currency="{ row }">
          <Badge :tone="CURRENCY_TONE[row.currency] || 'neutral'">
            {{ row.currency ? t(`plan_currency_${row.currency}`) : '—' }}
          </Badge>
        </template>

        <template #cell.period="{ row }">
          <Badge :tone="PERIOD_TONE[row.period] || 'neutral'">
            {{ row.period ? t(`plan_period_${row.period}`) : '—' }}
          </Badge>
        </template>

        <template #cell.features="{ row }">
          <span class="cell-muted">{{ fmtFeatures(row.features) }}</span>
        </template>

        <template #cell.status="{ row }">
          <StatusBadge
            :tone="STATUS_TONE[row.status] || 'neutral'"
            :label="row.status ? t(`plan_status_${row.status}`) : '—'"
          />
        </template>

        <template #cell.is_current="{ row }">
          <Badge
            :tone="CURRENT_TONE[planRowFlag(row)] || 'neutral'"
            dot
          >
            {{ t(`plan_current_${planRowFlag(row)}`) }}
          </Badge>
        </template>

        <!-- Row actions -->
        <template #row-actions="{ row }">
          <IconAction
            v-if="!isCurrentPlan(row) && !isPendingPlan(row)"
            icon="send"
            tone="primary"
            :title="t('plan_choose_action')"
            @click="openChange(row)"
          />
          <IconAction
            v-else-if="isPendingPlan(row)"
            icon="clock"
            tone="warning"
            :title="t('license_pending_change')"
            :disabled="true"
          />
          <IconAction
            v-else
            icon="check"
            tone="success"
            :title="t('license_current_plan')"
            :disabled="true"
          />
        </template>

        <template #empty>
          <div class="statefill">
            <div class="statefill__icon">
              <DesignIcon
                :name="plansUnreachable ? 'alert' : 'package'"
                :size="24"
              />
            </div>
            <div class="statefill__title">
              {{ plansUnreachable ? t('license_plans_unreachable') : t('license_plans_empty') }}
            </div>
            <div style="margin-top:12px;">
              <Button
                variant="secondary"
                icon="refresh"
                @click="loadPlans"
              >
                {{ t('license_action_refresh') }}
              </Button>
            </div>
          </div>
        </template>
      </DataTable>
    </Card>

    <!-- ============================================================
         STATUS TAB — mirrors licensing/status.vue using design system
         ============================================================ -->
    <Card v-else>
      <div style="padding: var(--sp-4);">
        <div
          v-if="loadingStatus && !licenseState"
          class="row"
          style="gap:12px; align-items:center;"
        >
          <div
            class="sk-box"
            style="width:120px;height:24px;border-radius:12px;"
          />
          <div
            class="sk-box"
            style="width:200px;height:14px;border-radius:4px;"
          />
        </div>

        <div v-else-if="licenseState">
          <div
            class="row"
            style="gap:14px; align-items:center; margin-bottom: var(--sp-3);"
          >
            <StatusBadge
              :tone="LICENSE_TONE[licenseState.status] || 'neutral'"
              :label="t(`license_status_${licenseState.status}`)"
            />
            <Badge
              v-if="licenseState.is_blocked"
              tone="error"
              dot
            >
              {{ t('Kill switch active') }}
            </Badge>
          </div>

          <div
            class="form-grid"
            style="gap: var(--sp-3);"
          >
            <Field :label="t('Organization')">
              <div class="cell-strong">
                {{ licenseState.tenant?.org_name ?? '—' }}
              </div>
            </Field>
            <Field :label="t('Contact email')">
              <div class="cell-strong">
                {{ licenseState.tenant?.email ?? '—' }}
              </div>
            </Field>
            <Field :label="t('license_expires_at')">
              <div class="cell-strong">
                {{ licenseState.expires_at ? formatDate(licenseState.expires_at) : '—' }}
              </div>
            </Field>
            <Field :label="t('license_balance')">
              <div class="mono cell-strong">
                {{ fmtMoney(licenseState.balance, licenseState.balance_currency) }}
              </div>
            </Field>
            <Field :label="t('license_current_plan')">
              <div class="cell-strong">
                {{ licenseState.current_plan?.name ?? currentPlan?.name ?? '—' }}
              </div>
            </Field>
            <Field :label="t('license_days_remaining')">
              <div class="mono cell-strong">
                {{ licenseState.days_remaining ?? '—' }}
              </div>
            </Field>
          </div>

          <div
            v-if="licenseState.message"
            style="margin-top: var(--sp-4); padding: 12px 14px; border-radius: 10px; background: rgba(var(--v-theme-info, 14 165 233) / 0.08); border:1px solid rgba(var(--v-theme-info, 14 165 233) / 0.28);"
          >
            {{ licenseState.message }}
          </div>

          <div
            v-if="licenseState.status === 'UNREGISTERED'"
            style="margin-top: var(--sp-4); display:flex; gap:8px;"
          >
            <Button
              variant="primary"
              icon="lock"
              @click="$router.push('/licensing/setup')"
            >
              {{ t('Run setup') }}
            </Button>
          </div>
        </div>

        <div
          v-else
          class="statefill"
        >
          <div class="statefill__icon">
            <DesignIcon
              name="alert"
              :size="24"
            />
          </div>
          <div class="statefill__title">
            {{ t('license_plans_unreachable') }}
          </div>
          <div style="margin-top:12px;">
            <Button
              variant="secondary"
              icon="refresh"
              @click="loadStatus"
            >
              {{ t('license_action_refresh') }}
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- ============================================================
         CHANGE-REQUEST MODAL
         ============================================================ -->
    <Modal
      :open="changeOpen"
      :title="t('plan_change_request_title')"
      :subtitle="changeTarget ? changeTarget.name : ''"
      :width="520"
      @close="closeChange"
    >
      <form @submit.prevent="submitChange">
        <div class="form-grid">
          <Field
            :label="t('plan_name')"
            class="span-2"
          >
            <div
              class="control is-disabled"
              style="display:flex; align-items:center; gap:8px;"
            >
              <DesignIcon
                name="package"
                :size="16"
              />
              <input
                :value="changeTarget?.name ?? ''"
                disabled
              >
            </div>
          </Field>

          <Field :label="t('plan_price')">
            <div class="mono cell-strong">
              {{ fmtMoney(changeTarget?.price, changeTarget?.currency) }}
            </div>
          </Field>

          <Field :label="t('plan_period_label')">
            <Badge :tone="PERIOD_TONE[changeTarget?.period] || 'neutral'">
              {{ changeTarget?.period ? t(`plan_period_${changeTarget.period}`) : '—' }}
            </Badge>
          </Field>

          <Field
            :label="t('plan_change_note_label')"
            class="span-2"
            :error="changeErrors.note"
          >
            <textarea
              v-model="changeNote"
              class="control control--textarea"
              rows="3"
              :placeholder="t('plan_change_note_label')"
              style="width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--border, rgba(255,255,255,0.12)); background: var(--surface-2, transparent); color: var(--text-primary); font: inherit; resize: vertical;"
            />
          </Field>

          <div
            class="span-2"
            style="display:flex; gap:10px; padding:10px 12px; border-radius:8px; background: rgba(var(--v-theme-info, 14 165 233) / 0.06); border:1px solid rgba(var(--v-theme-info, 14 165 233) / 0.2);"
          >
            <DesignIcon
              name="info"
              :size="16"
            />
            <span style="font-size:13px;">
              {{ t('license_plans_subtitle') }}
            </span>
          </div>
        </div>
      </form>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="changeBusy"
          @click="closeChange"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="send"
          :loading="changeBusy"
          :disabled="changeBusy"
          @click="submitChange"
        >
          {{ t('plan_change_submit') }}
        </Button>
      </template>
    </Modal>

    <!-- Notify snackbar (Vuetify, project-wide pattern preserved) -->
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

<script setup lang="ts">
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable, {
  type DataTableColumn,
  type DataTablePagination,
} from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import Input from '@/components/design/Input.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import StateFill from '@/components/design/StateFill.vue'
import {
  classifyMoneyControlApiError,
  fetchMoneyControlLocations,
  fetchMoneyControlOverview,
  fetchRawInventory,
} from '@/services/moneyControlApi'
import type {
  DecimalValue,
  ExpenseCategorySummaryRow,
  MoneyControlApiErrorKind,
  MoneyControlIssue,
  MoneyControlLocation,
  MoneyControlOverview,
  RawInventoryResult,
  RawInventoryRow,
  SupplierBalanceSummaryRow,
} from '@/types/moneyControl'

type ViewState = 'idle' | 'ready' | MoneyControlApiErrorKind
type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'

interface InventoryTableRow extends RawInventoryRow {
  rowKey: string
}

interface SupplierTableRow extends SupplierBalanceSummaryRow {
  rowKey: string
}

interface ExpenseTableRow extends ExpenseCategorySummaryRow {
  rowKey: string
  sharePercent: number | null
}

const { t, locale } = useI18n({ useScope: 'global' })
const { formatCurrency, formatDate } = useFormatters()

function toLocalDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const today = new Date()
const dateFrom = ref(toLocalDateValue(new Date(today.getFullYear(), today.getMonth(), 1)))
const dateTo = ref(toLocalDateValue(today))
const locationId = ref('')
const search = ref('')
const inventoryPage = ref(1)
const inventoryPerPage = ref(20)

const overview = ref<MoneyControlOverview | null>(null)
const inventory = ref<RawInventoryResult | null>(null)
const locations = ref<MoneyControlLocation[]>([])
const overviewState = ref<ViewState>('idle')
const inventoryState = ref<ViewState>('idle')
const overviewLoading = ref(false)
const inventoryLoading = ref(false)
const locationsLoading = ref(false)
const locationsError = ref(false)

const rangeInvalid = computed(() => Boolean(dateFrom.value && dateTo.value && dateFrom.value > dateTo.value))
const isRefreshing = computed(() => overviewLoading.value || inventoryLoading.value)

const integrationUnavailable = computed(() =>
  overviewState.value === 'integration-unavailable'
  && inventoryState.value === 'integration-unavailable',
)

const partiallyUnavailable = computed(() =>
  !integrationUnavailable.value
  && [overviewState.value, inventoryState.value].includes('integration-unavailable'),
)

const localeTag = computed(() => {
  if (locale.value === 'ru')
    return 'ru-RU'
  if (locale.value === 'uz')
    return 'uz-UZ'

  return 'en-GB'
})

const quantityFormatter = computed(() => new Intl.NumberFormat(localeTag.value, {
  maximumFractionDigits: 3,
}))

const percentFormatter = computed(() => new Intl.NumberFormat(localeTag.value, {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
}))

const locationOptions = computed(() => locations.value.map(location => ({
  value: String(location.id),
  label: location.name,
})))

const inventoryRows = computed<InventoryTableRow[]>(() =>
  (inventory.value?.items ?? []).map((row, index) => ({
    ...row,
    rowKey: String(row.stockItem.id ?? `${row.stockItem.code ?? 'material'}-${index}`),
  })),
)

const supplierRows = computed<SupplierTableRow[]>(() =>
  (overview.value?.suppliers.topBalances ?? []).map((row, index) => ({
    ...row,
    rowKey: String(row.supplierId ?? `supplier-${index}`),
  })),
)

const expenseRows = computed<ExpenseTableRow[]>(() => {
  const rows = overview.value?.expenses.byCategory ?? []
  const paidTotal = numeric(overview.value?.expenses.paidUzs)

  return rows.map((row, index) => ({
    ...row,
    rowKey: String(row.categoryId ?? `category-${index}`),
    sharePercent: (paidTotal > 0 && row.paidUzs !== null)
      ? numeric(row.paidUzs) / paidTotal * 100
      : null,
  }))
})

const allIssues = computed<MoneyControlIssue[]>(() => {
  if (!overview.value)
    return []

  const unique = new Map<string, MoneyControlIssue>()

  const issues = [
    ...overview.value.completeness.issues,
    ...overview.value.reconciliation.issues,
  ]

  issues.forEach((issue, index) => {
    const key = `${issue.code}-${issue.entityType ?? ''}-${issue.entityId ?? ''}-${issue.message ?? index}`

    unique.set(key, issue)
  })

  return [...unique.values()]
})

const inventoryPagination = computed<DataTablePagination>(() => ({
  page: inventoryPage.value,
  perPage: inventoryPerPage.value,
  total: inventory.value?.pagination.total ?? inventoryRows.value.length,
  onPage: (nextPage: number) => {
    inventoryPage.value = nextPage
    loadInventory()
  },
  onPerPage: (nextPerPage: number) => {
    inventoryPerPage.value = nextPerPage
    inventoryPage.value = 1
    loadInventory()
  },
}))

const rawMaterialColumns = computed<DataTableColumn<InventoryTableRow>[]>(() => [
  { key: 'material', label: t('moneyControl.colMaterial'), sortable: true, sortValue: row => row.stockItem.name },
  { key: 'category', label: t('moneyControl.colCategory'), sortable: true, sortValue: row => row.category?.name ?? '' },
  { key: 'quantity', label: t('moneyControl.colOnHand'), align: 'right', sortable: true, sortValue: row => numeric(row.quantity) },
  { key: 'reservedQuantity', label: t('moneyControl.colReserved'), align: 'right', sortable: true, sortValue: row => numeric(row.reservedQuantity) },
  { key: 'availableQuantity', label: t('moneyControl.colAvailable'), align: 'right', sortable: true, sortValue: row => numeric(row.availableQuantity) },
  { key: 'averageCostUzs', label: t('moneyControl.colAverageCost'), align: 'right', sortable: true, sortValue: row => numeric(row.averageCostUzs) },
  { key: 'inventoryValueUzs', label: t('moneyControl.colInventoryValue'), align: 'right', sortable: true, sortValue: row => numeric(row.inventoryValueUzs) },
  { key: 'stockStatus', label: t('moneyControl.colStockStatus') },
  { key: 'preferredSupplier', label: t('moneyControl.colPreferredSupplier') },
])

const supplierColumns = computed<DataTableColumn<SupplierTableRow>[]>(() => [
  { key: 'supplierName', label: t('moneyControl.colSupplier'), sortable: true },
  { key: 'payableUzs', label: t('moneyControl.colSupplierBalance'), align: 'right', sortable: true, sortValue: row => numeric(supplierPayable(row)) },
])

const expenseColumns = computed<DataTableColumn<ExpenseTableRow>[]>(() => [
  { key: 'categoryName', label: t('moneyControl.colCategory'), sortable: true },
  { key: 'paidUzs', label: t('moneyControl.colAmount'), align: 'right', sortable: true, sortValue: row => numeric(row.paidUzs) },
  { key: 'sharePercent', label: t('moneyControl.colShare'), align: 'right', sortable: true },
])

const summaryCards = computed(() => {
  const data = overview.value
  if (!data)
    return []

  return [
    {
      id: 'drawer',
      label: t('moneyControl.drawerAwaiting'),
      sub: t('moneyControl.drawerAwaitingSub'),
      value: data.treasury.drawerUnreconciledUzs,
      icon: 'register',
      tone: 'warning',
    },
    {
      id: 'safe',
      label: t('moneyControl.safeBalance'),
      sub: t('moneyControl.safeBalanceSub'),
      value: data.treasury.safeUzs,
      icon: 'lock',
      tone: 'success',
    },
    {
      id: 'bank',
      label: t('moneyControl.bankBalance'),
      sub: t('moneyControl.bankBalanceSub'),
      value: data.treasury.bankUzs,
      icon: 'wallet',
      tone: 'primary',
    },
    {
      id: 'suppliers',
      label: t('moneyControl.supplierPayable'),
      sub: t('moneyControl.supplierPayableSub'),
      value: data.suppliers.payableUzs,
      icon: 'building',
      tone: numeric(data.suppliers.overduePayableUzs) > 0 ? 'error' : 'warning',
    },
    {
      id: 'inventory',
      label: t('moneyControl.rawInventoryValue'),
      sub: data.inventory.rawItemCount === null
        ? t('moneyControl.rawInventoryValueSub')
        : `${t('moneyControl.rawInventoryValueSub')} · ${t('moneyControl.itemsCount', { count: data.inventory.rawItemCount })}`,
      value: data.inventory.rawMaterialValueUzs,
      icon: 'package',
      tone: data.inventory.outOfStockCount ? 'warning' : 'info',
    },
    {
      id: 'expenses',
      label: t('moneyControl.periodExpenses'),
      sub: t('moneyControl.periodExpensesSub'),
      value: data.expenses.paidUzs,
      icon: 'receipt',
      tone: 'error',
    },
    {
      id: 'working-capital',
      label: t('moneyControl.workingCapital'),
      sub: t('moneyControl.workingCapitalSub'),
      value: data.workingCapital.amountUzs,
      icon: 'trend',
      tone: numeric(data.workingCapital.amountUzs) < 0 ? 'error' : 'success',
    },
  ] as Array<{
    id: string
    label: string
    sub: string
    value: DecimalValue | null
    icon: string
    tone: BadgeTone
  }>
})

const quickActions = computed(() => [
  { to: '/stock/items?type=RAW', label: t('moneyControl.openRawMaterials'), icon: 'box' },
  { to: '/stock/suppliers', label: t('moneyControl.openSuppliers'), icon: 'building' },
  { to: '/stock/receiving', label: t('moneyControl.receiveGoods'), icon: 'inbox' },
  { to: '/stock/levels?item_type=RAW', label: t('moneyControl.openStockLevels'), icon: 'bars' },
  { to: '/treasury', label: t('moneyControl.openTreasury'), icon: 'wallet' },
  { to: '/hr-expenses', label: t('moneyControl.openExpenses'), icon: 'receipt' },
])

function numeric(value: DecimalValue | null | undefined): number {
  const number = Number(value)

  return Number.isFinite(number) ? number : 0
}

function displayMoney(value: DecimalValue | null | undefined): string {
  if (value === null || value === undefined || value === '')
    return '—'

  return formatCurrency(value)
}

function displayQuantity(value: DecimalValue | null | undefined): string {
  if (value === null || value === undefined || value === '')
    return '—'

  return quantityFormatter.value.format(numeric(value))
}

function displayPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value))
    return '—'

  return `${percentFormatter.value.format(value)}%`
}

function supplierPayable(row: SupplierBalanceSummaryRow): DecimalValue | null {
  return row.payableUzs ?? row.balanceUzs
}

function materialStatus(row: RawInventoryRow): { text: string; tone: BadgeTone } {
  if (row.isOutOfStock === true || numeric(row.availableQuantity) <= 0)
    return { text: t('moneyControl.statusOut'), tone: 'error' }
  if (row.isLowStock === true)
    return { text: t('moneyControl.statusLow'), tone: 'warning' }

  return { text: t('moneyControl.statusHealthy'), tone: 'success' }
}

function statusLabel(status: string | null | undefined): string {
  switch (String(status ?? '').toUpperCase()) {
    case 'COMPLETE': return t('moneyControl.statusComplete')
    case 'BALANCED': return t('moneyControl.statusBalanced')
    case 'WARNING': return t('moneyControl.statusWarning')
    case 'INCOMPLETE': return t('moneyControl.statusIncomplete')
    default: return t('moneyControl.statusUnknown')
  }
}

function statusTone(status: string | null | undefined): BadgeTone {
  switch (String(status ?? '').toUpperCase()) {
    case 'COMPLETE':
    case 'BALANCED': return 'success'
    case 'WARNING': return 'warning'
    case 'INCOMPLETE': return 'error'
    default: return 'neutral'
  }
}

function issueTone(issue: MoneyControlIssue): BadgeTone {
  const severity = issue.severity.toUpperCase()
  if (['ERROR', 'CRITICAL'].includes(severity))
    return 'error'
  if (severity === 'INFO')
    return 'info'

  return 'warning'
}

function issueText(issue: MoneyControlIssue): string {
  return issue.message || issue.title || issue.code
}

function stateTitle(state: ViewState): string {
  if (state === 'integration-unavailable')
    return t('moneyControl.integrationTitle')
  if (state === 'forbidden')
    return t('moneyControl.forbiddenTitle')

  return t('moneyControl.loadErrorTitle')
}

function stateBody(state: ViewState): string {
  if (state === 'integration-unavailable')
    return t('moneyControl.integrationBody')
  if (state === 'forbidden')
    return t('moneyControl.forbiddenBody')

  return t('moneyControl.loadErrorBody')
}

async function loadOverview() {
  if (rangeInvalid.value)
    return

  overviewLoading.value = true
  overview.value = null
  try {
    overview.value = await fetchMoneyControlOverview({
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      location_id: locationId.value || undefined,
    })
    overviewState.value = 'ready'
  }
  catch (error: unknown) {
    overviewState.value = classifyMoneyControlApiError(error).kind
  }
  finally {
    overviewLoading.value = false
  }
}

async function loadInventory() {
  inventoryLoading.value = true
  inventory.value = null
  try {
    inventory.value = await fetchRawInventory({
      location_id: locationId.value || undefined,
      search: search.value.trim() || undefined,
      page: inventoryPage.value,
      per_page: inventoryPerPage.value,
    })
    inventoryState.value = 'ready'
  }
  catch (error: unknown) {
    inventoryState.value = classifyMoneyControlApiError(error).kind
  }
  finally {
    inventoryLoading.value = false
  }
}

async function loadLocations() {
  locationsLoading.value = true
  locationsError.value = false
  try {
    locations.value = await fetchMoneyControlLocations()
  }
  catch {
    locations.value = []
    locationsError.value = true
  }
  finally {
    locationsLoading.value = false
  }
}

async function refreshAll() {
  if (rangeInvalid.value)
    return

  inventoryPage.value = 1
  await Promise.all([loadOverview(), loadInventory()])
}

const searchInventory = useDebounceFn(() => {
  inventoryPage.value = 1
  loadInventory()
}, 350)

watch(search, searchInventory)

onMounted(() => {
  loadLocations()
  refreshAll()
})
</script>

<template>
  <div class="page money-control-page">
    <PageHeader
      :title="t('Money Control')"
      :subtitle="t('moneyControl.subtitle')"
    >
      <template #actions>
        <Button
          variant="secondary"
          icon="refresh"
          :loading="isRefreshing"
          :disabled="rangeInvalid"
          @click="refreshAll"
        >
          {{ t('moneyControl.refresh') }}
        </Button>
      </template>
    </PageHeader>

    <Card class-name="control-card">
      <div class="toolbar money-control-filters">
        <Field :label="t('moneyControl.dateFrom')">
          <Input
            v-model="dateFrom"
            type="date"
            :max="dateTo || undefined"
            @change="refreshAll"
          />
        </Field>
        <Field
          :label="t('moneyControl.dateTo')"
          :error="rangeInvalid ? t('moneyControl.invalidRange') : ''"
        >
          <Input
            v-model="dateTo"
            type="date"
            :min="dateFrom || undefined"
            :error="rangeInvalid"
            @change="refreshAll"
          />
        </Field>
        <Field :label="t('Location')">
          <Select
            v-model="locationId"
            :options="locationOptions"
            :placeholder="t('moneyControl.allLocations')"
            :disabled="locationsLoading"
            @change="refreshAll"
          />
        </Field>
        <div class="money-control-filter-meta">
          <span v-if="overview?.asOf || inventory?.summary.asOf">
            {{ t('moneyControl.lastUpdated') }}:
            <strong>{{ formatDate(overview?.asOf || inventory?.summary.asOf || '') }}</strong>
          </span>
          <span v-else>{{ t('moneyControl.liveSource') }}</span>
          <span
            v-if="locationsError"
            class="filter-warning"
            role="status"
          >{{ t('moneyControl.locationLoadFailed') }}</span>
        </div>
      </div>
    </Card>

    <Card
      v-if="integrationUnavailable"
      class-name="endpoint-state-card"
    >
      <StateFill
        icon="gear"
        :title="t('moneyControl.integrationTitle')"
        :sub="t('moneyControl.integrationBody')"
      >
        <template #action>
          <Button
            variant="secondary"
            icon="retry"
            :loading="isRefreshing"
            @click="refreshAll"
          >
            {{ t('moneyControl.retry') }}
          </Button>
        </template>
      </StateFill>
    </Card>

    <div
      v-else-if="partiallyUnavailable"
      class="partial-data-notice"
      role="status"
    >
      <DesignIcon
        name="alert"
        :size="18"
      />
      <div>
        <strong>{{ t('moneyControl.partialDataTitle') }}</strong>
        <span>{{ t('moneyControl.partialDataBody') }}</span>
      </div>
    </div>

    <section
      v-if="overviewLoading || overviewState === 'ready'"
      class="money-control-summary"
      :aria-busy="overviewLoading"
    >
      <div
        v-if="overviewLoading"
        class="money-kpi-grid"
      >
        <div
          v-for="index in 7"
          :key="index"
          class="kpi-card"
        >
          <div class="kpi-card__top">
            <Skeleton
              :w="38"
              :h="38"
              :r="8"
            />
            <Skeleton
              w="55%"
              :h="14"
            />
          </div>
          <Skeleton
            w="72%"
            :h="30"
          />
          <Skeleton
            w="62%"
            :h="12"
            style="margin-top: var(--sp-3);"
          />
        </div>
      </div>

      <div
        v-else
        class="money-kpi-grid"
      >
        <div
          v-for="card in summaryCards"
          :key="card.id"
          class="kpi-card"
        >
          <div class="kpi-card__top">
            <div
              class="kpi-card__icon"
              :class="`t-${card.tone}`"
            >
              <DesignIcon
                :name="card.icon"
                :size="20"
              />
            </div>
            <div class="kpi-card__label">
              {{ card.label }}
            </div>
          </div>
          <div class="kpi-card__value num-tabular">
            {{ displayMoney(card.value) }}<span
              v-if="card.value !== null"
              class="kpi-card__unit"
            >{{ t('moneyControl.currencyUzs') }}</span>
          </div>
          <div class="kpi-card__sub">
            {{ card.sub }}
          </div>
        </div>
      </div>
    </section>

    <Card
      v-else-if="overviewState !== 'idle' && !integrationUnavailable"
      class-name="endpoint-state-card"
    >
      <StateFill
        :icon="overviewState === 'integration-unavailable' ? 'gear' : 'alert'"
        :title="stateTitle(overviewState)"
        :sub="stateBody(overviewState)"
        :error="overviewState !== 'integration-unavailable'"
      >
        <template #action>
          <Button
            variant="secondary"
            icon="retry"
            @click="loadOverview"
          >
            {{ t('moneyControl.retry') }}
          </Button>
        </template>
      </StateFill>
    </Card>

    <div
      v-if="overview"
      class="money-control-detail-grid"
    >
      <Card class-name="detail-card reconciliation-card">
        <div class="card__head between">
          <div class="card__head-text">
            <h2 class="card__title">
              {{ t('moneyControl.reconciliationTitle') }}
            </h2>
            <div class="card__sub">
              {{ t('moneyControl.reconciliationSubtitle') }}
            </div>
          </div>
        </div>
        <div class="card__body reconciliation-body">
          <div class="reconciliation-statuses">
            <div>
              <span>{{ t('moneyControl.dataCompleteness') }}</span>
              <Badge
                :tone="statusTone(overview.completeness.status)"
                dot
              >
                {{ statusLabel(overview.completeness.status) }}
              </Badge>
            </div>
            <div>
              <span>{{ t('moneyControl.reconciliationTitle') }}</span>
              <Badge
                :tone="statusTone(overview.reconciliation.status)"
                dot
              >
                {{ statusLabel(overview.reconciliation.status) }}
              </Badge>
            </div>
          </div>

          <div class="issue-list">
            <h3>{{ t('moneyControl.issueTitle') }}</h3>
            <div
              v-if="allIssues.length === 0"
              class="no-issues"
            >
              <DesignIcon
                name="checkcircle"
                :size="18"
              />
              {{ t('moneyControl.noIssues') }}
            </div>
            <div
              v-for="issue in allIssues"
              v-else
              :key="`${issue.code}-${issue.entityId ?? ''}`"
              class="issue-row"
            >
              <Badge :tone="issueTone(issue)">
                {{ issue.code }}
              </Badge>
              <span>{{ issueText(issue) }}</span>
              <strong
                v-if="issue.amountUzs !== null"
                class="num-tabular"
              >{{ displayMoney(issue.amountUzs) }} {{ t('moneyControl.currencyUzs') }}</strong>
            </div>
          </div>
        </div>
      </Card>

      <Card class-name="detail-card quick-actions-card">
        <div class="card__head">
          <div class="card__head-text">
            <h2 class="card__title">
              {{ t('moneyControl.quickActions') }}
            </h2>
          </div>
        </div>
        <div class="card__body quick-actions-grid">
          <RouterLink
            v-for="action in quickActions"
            :key="action.to"
            :to="action.to"
            class="quick-action"
          >
            <DesignIcon
              :name="action.icon"
              :size="18"
            />
            <span>{{ action.label }}</span>
            <DesignIcon
              name="chevright"
              :size="16"
            />
          </RouterLink>
        </div>
      </Card>
    </div>

    <Card
      v-if="!integrationUnavailable"
      class-name="raw-materials-card"
    >
      <div class="card__head between raw-materials-head">
        <div class="card__head-text">
          <h2 class="card__title">
            {{ t('moneyControl.rawMaterialsTitle') }}
          </h2>
          <div class="card__sub">
            {{ t('moneyControl.rawMaterialsSubtitle') }}
          </div>
        </div>
        <div
          v-if="inventory?.summary"
          class="valuation-meta"
        >
          {{ t('moneyControl.valuationNote', {
            method: inventory.summary.valuationMethod || t('moneyControl.notAvailable'),
            asOf: inventory.summary.asOf ? formatDate(inventory.summary.asOf) : t('moneyControl.notAvailable'),
          }) }}
        </div>
      </div>

      <div class="toolbar raw-materials-toolbar">
        <Input
          v-model="search"
          icon="search"
          :placeholder="t('moneyControl.searchMaterials')"
          :aria-label="t('moneyControl.searchMaterials')"
        />
      </div>
      <div class="card__divider" />

      <DataTable
        v-if="inventoryLoading || inventoryState === 'ready'"
        :columns="rawMaterialColumns"
        :rows="inventoryRows"
        row-key="rowKey"
        :loading="inventoryLoading"
        :pagination="inventoryPagination"
        :per-page-options="[10, 20, 50, 100]"
        :empty-title="t('moneyControl.noMaterialsTitle')"
        :empty-sub="t('moneyControl.noMaterialsBody')"
        empty-icon="package"
      >
        <template #cell.material="{ row }">
          <div class="primary-cell">
            <RouterLink
              v-if="row.stockItem.id !== null"
              :to="`/stock/items/${row.stockItem.id}`"
              class="table-link"
            >
              {{ row.stockItem.name || t('moneyControl.notAvailable') }}
            </RouterLink>
            <strong v-else>{{ row.stockItem.name || t('moneyControl.notAvailable') }}</strong>
            <span>{{ row.stockItem.code || '—' }}</span>
          </div>
        </template>
        <template #cell.category="{ row }">
          <span :class="{ 'cell-muted': !row.category?.name }">
            {{ row.category?.name || '—' }}
          </span>
        </template>
        <template #cell.quantity="{ row }">
          <span class="num-tabular">{{ displayQuantity(row.quantity) }} {{ row.baseUnit?.code || row.baseUnit?.name || '' }}</span>
        </template>
        <template #cell.reservedQuantity="{ row }">
          <span class="num-tabular">{{ displayQuantity(row.reservedQuantity) }}</span>
        </template>
        <template #cell.availableQuantity="{ row }">
          <strong class="num-tabular">{{ displayQuantity(row.availableQuantity) }}</strong>
        </template>
        <template #cell.averageCostUzs="{ row }">
          <span class="num-tabular">{{ displayMoney(row.averageCostUzs) }}</span>
        </template>
        <template #cell.inventoryValueUzs="{ row }">
          <strong class="num-tabular">{{ displayMoney(row.inventoryValueUzs) }}</strong>
        </template>
        <template #cell.stockStatus="{ row }">
          <Badge
            :tone="materialStatus(row).tone"
            dot
          >
            {{ materialStatus(row).text }}
          </Badge>
        </template>
        <template #cell.preferredSupplier="{ row }">
          <div
            v-if="row.preferredSupplier"
            class="primary-cell"
          >
            <RouterLink
              v-if="row.preferredSupplier.supplierId !== null"
              :to="`/stock/suppliers/${row.preferredSupplier.supplierId}`"
              class="table-link"
            >
              {{ row.preferredSupplier.supplierName }}
            </RouterLink>
            <strong v-else>{{ row.preferredSupplier.supplierName }}</strong>
            <span class="num-tabular">
              {{ t('moneyControl.colSupplierBalance') }}: {{ displayMoney(row.preferredSupplier.currentBalanceUzs) }}
            </span>
          </div>
          <span
            v-else
            class="cell-muted"
          >{{ t('moneyControl.unassignedSupplier') }}</span>
        </template>
      </DataTable>

      <StateFill
        v-else
        :icon="inventoryState === 'integration-unavailable' ? 'gear' : 'alert'"
        :title="stateTitle(inventoryState)"
        :sub="stateBody(inventoryState)"
        :error="inventoryState !== 'integration-unavailable'"
      >
        <template #action>
          <Button
            variant="secondary"
            icon="retry"
            @click="loadInventory"
          >
            {{ t('moneyControl.retry') }}
          </Button>
        </template>
      </StateFill>
    </Card>

    <div
      v-if="overview"
      class="money-control-table-grid"
    >
      <Card class-name="summary-table-card">
        <div class="card__head">
          <div class="card__head-text">
            <h2 class="card__title">
              {{ t('moneyControl.suppliersTitle') }}
            </h2>
            <div class="card__sub">
              {{ t('moneyControl.suppliersSubtitle') }}
            </div>
          </div>
        </div>
        <div class="card__divider" />
        <DataTable
          :columns="supplierColumns"
          :rows="supplierRows"
          row-key="rowKey"
          :per-page="5"
          :empty-title="t('moneyControl.noSuppliersTitle')"
          :empty-sub="t('moneyControl.noSuppliersBody')"
          empty-icon="building"
        >
          <template #cell.supplierName="{ row }">
            <RouterLink
              v-if="row.supplierId !== null"
              :to="`/stock/suppliers/${row.supplierId}`"
              class="table-link"
            >
              {{ row.supplierName }}
            </RouterLink>
            <strong v-else>{{ row.supplierName }}</strong>
          </template>
          <template #cell.payableUzs="{ row }">
            <strong class="num-tabular">{{ displayMoney(supplierPayable(row)) }}</strong>
          </template>
        </DataTable>
      </Card>

      <Card class-name="summary-table-card">
        <div class="card__head">
          <div class="card__head-text">
            <h2 class="card__title">
              {{ t('moneyControl.expenseCategoriesTitle') }}
            </h2>
            <div class="card__sub">
              {{ t('moneyControl.expenseCategoriesSubtitle') }}
            </div>
          </div>
        </div>
        <div class="card__divider" />
        <DataTable
          :columns="expenseColumns"
          :rows="expenseRows"
          row-key="rowKey"
          :per-page="5"
          :empty-title="t('moneyControl.noExpensesTitle')"
          :empty-sub="t('moneyControl.noExpensesBody')"
          empty-icon="receipt"
        >
          <template #cell.categoryName="{ row }">
            <strong>{{ row.categoryName }}</strong>
            <div class="cell-muted">
              {{ t('moneyControl.transactionsCount', { count: row.transactionCount ?? 0 }) }}
            </div>
          </template>
          <template #cell.paidUzs="{ row }">
            <strong class="num-tabular">{{ displayMoney(row.paidUzs) }}</strong>
          </template>
          <template #cell.sharePercent="{ row }">
            <span class="num-tabular">{{ displayPercent(row.sharePercent) }}</span>
          </template>
        </DataTable>
      </Card>
    </div>

    <Card
      v-if="integrationUnavailable"
      class-name="quick-actions-card standalone-quick-actions"
    >
      <div class="card__head">
        <div class="card__head-text">
          <h2 class="card__title">
            {{ t('moneyControl.quickActions') }}
          </h2>
        </div>
      </div>
      <div class="card__body quick-actions-grid">
        <RouterLink
          v-for="action in quickActions"
          :key="action.to"
          :to="action.to"
          class="quick-action"
        >
          <DesignIcon
            :name="action.icon"
            :size="18"
          />
          <span>{{ action.label }}</span>
          <DesignIcon
            name="chevright"
            :size="16"
          />
        </RouterLink>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.money-control-page {
  max-width: none;
}

.control-card,
.endpoint-state-card,
.partial-data-notice,
.money-control-summary,
.money-control-detail-grid,
.raw-materials-card,
.money-control-table-grid {
  margin-bottom: var(--sp-5);
}

.money-control-filters {
  align-items: flex-start;
}

.money-control-filters :deep(.field) {
  flex: 0 1 190px;
  min-width: 165px;
}

.money-control-filter-meta {
  display: flex;
  min-width: 220px;
  flex: 1 1 260px;
  flex-direction: column;
  align-items: flex-end;
  align-self: center;
  gap: 4px;
  color: rgb(var(--v-theme-text-secondary));
  font-size: var(--fs-sm);
  text-align: right;
}

.money-control-filter-meta strong {
  color: rgb(var(--v-theme-on-surface));
  font-weight: var(--fw-semibold);
}

.filter-warning {
  color: rgb(var(--v-theme-warning-strong));
}

.partial-data-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid rgb(var(--v-theme-warning-border));
  border-radius: var(--r-md);
  color: rgb(var(--v-theme-warning-strong));
  background: rgb(var(--v-theme-warning-weak));
}

.partial-data-notice div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.partial-data-notice span {
  font-size: var(--fs-sm);
}

.money-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-4);
}

.money-kpi-grid .kpi-card {
  min-width: 0;
  padding: var(--sp-4);
}

.money-kpi-grid .kpi-card__label,
.money-kpi-grid .kpi-card__sub {
  overflow-wrap: anywhere;
}

.money-kpi-grid .kpi-card__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.money-kpi-grid .kpi-card__sub {
  min-height: 38px;
  margin-top: var(--sp-2);
  line-height: 1.4;
}

@media (min-width: 1281px) {
  .money-kpi-grid .kpi-card:last-child {
    grid-column: span 2;
  }
}

.money-control-detail-grid,
.money-control-table-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr);
  gap: var(--sp-4);
}

.money-control-table-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-card,
.summary-table-card {
  min-width: 0;
}

.reconciliation-body {
  display: grid;
  grid-template-columns: minmax(220px, .55fr) minmax(0, 1.45fr);
  gap: var(--sp-5);
}

.reconciliation-statuses {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.reconciliation-statuses > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3);
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-sm);
  background: rgb(var(--v-theme-surface-inset));
  color: rgb(var(--v-theme-text-secondary));
  font-size: var(--fs-sm);
}

.issue-list h3 {
  margin: 0 0 var(--sp-3);
  color: rgb(var(--v-theme-on-surface));
  font-size: var(--fs-body);
}

.issue-row,
.no-issues {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid rgb(var(--v-theme-border));
  color: rgb(var(--v-theme-text-secondary));
  font-size: var(--fs-sm);
}

.issue-row:last-child,
.no-issues:last-child {
  border-bottom: 0;
}

.issue-row > span:nth-child(2) {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.issue-row strong {
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
}

.no-issues {
  color: rgb(var(--v-theme-success-strong));
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2);
}

.quick-action {
  display: flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-sm);
  color: rgb(var(--v-theme-on-surface));
  background: rgb(var(--v-theme-surface));
  text-decoration: none;
  transition: border-color .14s, background .14s, box-shadow .14s;
}

.quick-action:hover {
  border-color: rgb(var(--v-theme-primary-border));
  background: rgb(var(--v-theme-primary-weak));
}

.quick-action:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.quick-action > span {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.raw-materials-head {
  align-items: center;
}

.valuation-meta {
  max-width: 420px;
  margin-left: auto;
  color: rgb(var(--v-theme-text-tertiary));
  font-size: var(--fs-label);
  text-align: right;
}

.raw-materials-toolbar {
  padding-top: 0;
}

.raw-materials-toolbar :deep(.control) {
  width: min(100%, 360px);
}

.primary-cell {
  display: flex;
  min-width: 150px;
  flex-direction: column;
  gap: 3px;
}

.primary-cell > span {
  color: rgb(var(--v-theme-text-tertiary));
  font-size: var(--fs-label);
}

.table-link {
  color: rgb(var(--v-theme-primary));
  font-weight: var(--fw-semibold);
  text-decoration: none;
}

.table-link:hover {
  text-decoration: underline;
}

.table-link:focus-visible {
  border-radius: 3px;
  outline: none;
  box-shadow: var(--shadow-focus);
}

.standalone-quick-actions .quick-actions-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 1280px) {
  .money-kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .money-control-detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .money-kpi-grid,
  .money-control-table-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reconciliation-body {
    grid-template-columns: 1fr;
  }

  .standalone-quick-actions .quick-actions-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .money-kpi-grid .kpi-card:last-child {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .money-control-filters :deep(.field),
  .money-control-filter-meta {
    width: 100%;
    min-width: 0;
    flex-basis: 100%;
  }

  .money-control-filter-meta {
    align-items: flex-start;
    text-align: left;
  }

  .raw-materials-head {
    align-items: flex-start;
  }

  .valuation-meta {
    max-width: none;
    margin-left: 0;
    text-align: left;
  }
}

@media (max-width: 540px) {
  .money-kpi-grid,
  .money-control-table-grid,
  .quick-actions-grid,
  .standalone-quick-actions .quick-actions-grid {
    grid-template-columns: 1fr;
  }

  .money-kpi-grid .kpi-card__value {
    font-size: 22px;
  }

  .money-kpi-grid .kpi-card:last-child {
    grid-column: span 1;
  }

  .issue-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
  anyPermission:
    - money.control.view
</route>

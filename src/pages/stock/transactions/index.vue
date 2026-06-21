<script setup lang="ts">
/* ============================================================
   ALPHA POS — Stock Transactions (Movement Log)
   Refactored to design primitives + design-shell.css.
   - Vuetify table replaced with <DataTable>
   - Vuetify inputs replaced with <Input> / <Select>
   - Action buttons via <IconAction>
   - All UI strings via t()
   - Responsive toolbar: flex-wrap, collapses to single column < 900px
   - Horizontal scroll provided by .tablewrap inside <DataTable>
   ============================================================ */
import { stockApi as axios } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'

const { t } = useI18n({ useScope: 'global' })

const transactions = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const typeFilter = ref<string | undefined>(undefined)
const locationFilter = ref<number | undefined>(undefined)
const itemFilter = ref<string>('')
const stockItemFilter = ref<number | undefined>(undefined)
const dateFromFilter = ref<string>('')
const dateToFilter = ref<string>('')

const locationsList = ref<any[]>([])
const stockItemsList = ref<any[]>([])

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate, formatCurrency } = useFormatters()

// Real movement types from the API
const movementTypes = [
  'PURCHASE_IN',
  'SALE_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'PRODUCTION_IN',
  'PRODUCTION_OUT',
  'ADJUSTMENT_PLUS',
  'ADJUSTMENT_MINUS',
  'WASTE',
  'SPOILAGE',
  'RETURN_FROM_CUSTOMER',
  'RETURN_TO_SUPPLIER',
  'COUNT_ADJUSTMENT',
  'OPENING_BALANCE',
]

// Map movement type → design Badge tone
const MOVEMENT_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'> = {
  PURCHASE_IN: 'success',
  SALE_OUT: 'error',
  TRANSFER_IN: 'info',
  TRANSFER_OUT: 'neutral',
  PRODUCTION_IN: 'primary',
  PRODUCTION_OUT: 'warning',
  ADJUSTMENT_PLUS: 'success',
  ADJUSTMENT_MINUS: 'error',
  WASTE: 'error',
  SPOILAGE: 'error',
  RETURN_FROM_CUSTOMER: 'warning',
  RETURN_TO_SUPPLIER: 'warning',
  COUNT_ADJUSTMENT: 'neutral',
  OPENING_BALANCE: 'info',
}

function formatQty(val: any) {
  if (val === null || val === undefined)
    return '0'
  const n = Number(val)

  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

async function loadTransactions() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (typeFilter.value)
      params.movement_type = typeFilter.value
    if (locationFilter.value)
      params.location_id = locationFilter.value
    if (stockItemFilter.value)
      params.stock_item_id = stockItemFilter.value
    if (dateFromFilter.value)
      params.date_from = dateFromFilter.value
    if (dateToFilter.value)
      params.date_to = dateToFilter.value

    const res = await axios.get('/transactions/', { params })
    const d = res.data?.data ?? res.data

    transactions.value = d?.transactions ?? []
    total.value = d.pagination?.total_items ?? d.pagination?.total ?? transactions.value.length
  }
  catch {
    notify(t('Failed to load transactions'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadLocations() {
  try {
    const res = await axios.get('/locations/', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data

    locationsList.value = d?.locations ?? []
  }
  catch { /* ignore */ }
}

async function loadStockItems() {
  try {
    const res = await axios.get('/items/', { params: { per_page: 500 } })
    const d = res.data?.data ?? res.data

    stockItemsList.value = d?.items ?? d?.results ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadTransactions(); loadLocations(); loadStockItems() })
watch([typeFilter, locationFilter, itemFilter, stockItemFilter, dateFromFilter, dateToFilter], () => { page.value = 1; loadTransactions() })

const locationOptions = computed(() => locationsList.value.map(l => ({ value: String(l.id), label: l.name })))
const stockItemOptions = computed(() => stockItemsList.value.map((i: any) => ({ value: String(i.id), label: i.name })))
const movementTypeOptions = computed(() => movementTypes.map(v => ({ value: v, label: t(`movement_${v}`) })))

const hasActiveFilters = computed(() =>
  !!typeFilter.value
  || locationFilter.value !== undefined
  || stockItemFilter.value !== undefined
  || !!dateFromFilter.value
  || !!dateToFilter.value,
)

function clearAllFilters() {
  typeFilter.value = undefined
  locationFilter.value = undefined
  stockItemFilter.value = undefined
  dateFromFilter.value = ''
  dateToFilter.value = ''
}

// DataTable columns
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'created_at', label: t('tx_col_date') },
  { key: 'movement_type', label: t('tx_col_type') },
  { key: 'item', label: t('tx_col_item') },
  { key: 'location', label: t('tx_col_location') },
  { key: 'quantity_change', label: t('tx_col_qty_change'), align: 'right' },
  { key: 'quantity_before', label: t('tx_col_before'), align: 'right' },
  { key: 'quantity_after', label: t('tx_col_after'), align: 'right' },
  { key: 'reference', label: t('tx_col_reference') },
  { key: 'unit_cost', label: t('tx_col_unit_cost'), align: 'right' },
  { key: 'total_cost', label: t('tx_col_total_cost'), align: 'right' },
  { key: 'user', label: t('tx_col_user') },
])

const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p; loadTransactions() },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1; loadTransactions() },
}))

function refUserName(u: any) {
  if (!u)
    return '—'
  const full = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return full || u.email || '—'
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('stock_transactions_title')"
      :subtitle="t('stock_transactions_subtitle')"
    >
      <template #actions>
        <Button
          variant="ghost"
          icon="refresh"
          @click="loadTransactions"
        >
          {{ t('Refresh') }}
        </Button>
      </template>
    </PageHeader>

    <Card>
      <!-- Toolbar — flex-wrap on tablet, single column on mobile -->
      <div class="tx-toolbar">
        <div class="tx-tb-cell tx-tb-cell--wide">
          <Select
            :model-value="stockItemFilter !== undefined ? String(stockItemFilter) : ''"
            icon="box"
            :placeholder="t('All Items')"
            :options="stockItemOptions"
            @update:model-value="(v: string) => stockItemFilter = v ? Number(v) : undefined"
          />
        </div>
        <div class="tx-tb-cell">
          <Select
            :model-value="typeFilter ?? ''"
            icon="filter"
            :placeholder="t('All Types')"
            :options="movementTypeOptions"
            @update:model-value="(v: string) => typeFilter = v || undefined"
          />
        </div>
        <div class="tx-tb-cell">
          <Select
            :model-value="locationFilter !== undefined ? String(locationFilter) : ''"
            icon="store"
            :placeholder="t('All Locations')"
            :options="locationOptions"
            @update:model-value="(v: string) => locationFilter = v ? Number(v) : undefined"
          />
        </div>
        <div class="tx-tb-cell tx-tb-date">
          <Input
            v-model="dateFromFilter"
            icon="calendar"
            type="date"
            :placeholder="t('Date From')"
          />
        </div>
        <div class="tx-tb-cell tx-tb-date">
          <Input
            v-model="dateToFilter"
            icon="calendar"
            type="date"
            :placeholder="t('Date To')"
          />
        </div>
        <div class="tx-tb-actions">
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            :disabled="!hasActiveFilters"
            @click="clearAllFilters"
          >
            {{ t('Clear filters') }}
          </Button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- Main table -->
      <DataTable
        :columns="columns"
        :rows="transactions"
        row-key="id"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
        :empty-title="t('tx_empty_title')"
        :empty-sub="t('tx_empty_sub')"
        empty-icon="receipt"
      >
        <template #cell.created_at="{ row }">
          <span class="nowrap cell-muted">{{ formatDate(row.created_at) }}</span>
        </template>

        <template #cell.movement_type="{ row }">
          <Badge :tone="MOVEMENT_TONE[row.movement_type] ?? 'neutral'" dot>
            {{ t(`movement_${row.movement_type}`) }}
          </Badge>
        </template>

        <template #cell.item="{ row }">
          <span class="cell-strong">
            {{ row.stock_item?.name ?? row.item?.name ?? '—' }}
            <span
              v-if="row.batch?.batch_number"
              class="cell-muted"
              style="margin-left: 6px; font-weight: normal;"
            >
              · {{ t('Batch #') }}{{ row.batch.batch_number }}
            </span>
          </span>
        </template>

        <template #cell.location="{ row }">
          <span class="cell-muted">{{ row.location?.name ?? '—' }}</span>
        </template>

        <template #cell.quantity_change="{ row }">
          <span
            class="mono num-tabular cell-strong"
            :style="{ color: Number(row.quantity_change) >= 0 ? 'rgb(var(--v-theme-success-strong))' : 'rgb(var(--v-theme-error-strong))' }"
          >
            {{ Number(row.quantity_change) >= 0 ? '+' : '' }}{{ formatQty(row.quantity_change) }}
          </span>
        </template>

        <template #cell.quantity_before="{ row }">
          <span class="mono num-tabular cell-muted">{{ formatQty(row.quantity_before) }}</span>
        </template>

        <template #cell.quantity_after="{ row }">
          <span class="mono num-tabular">{{ formatQty(row.quantity_after) }}</span>
        </template>

        <template #cell.reference="{ row }">
          <span class="cell-muted">{{ row.reference_type ? `${row.reference_type} #${row.reference_id}` : '—' }}</span>
        </template>

        <template #cell.unit_cost="{ row }">
          <span class="mono num-tabular">{{ row.unit_cost != null ? formatCurrency(row.unit_cost) : '—' }}</span>
        </template>

        <template #cell.total_cost="{ row }">
          <span class="mono num-tabular cell-strong">{{ row.total_cost != null ? formatCurrency(row.total_cost) : '—' }}</span>
        </template>

        <template #cell.user="{ row }">
          <span class="cell-muted">{{ refUserName(row.user) }}</span>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            icon="info"
            :title="t('tx_action_view_detail')"
            @click="() => row"
          />
        </template>
      </DataTable>
    </Card>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped>
/* Toolbar — wraps; collapses to one column under 900px */
.tx-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  align-items: center;
}

.tx-tb-cell {
  flex: 1 1 180px;
  min-width: 160px;
  max-width: 240px;
}

.tx-tb-cell--wide {
  flex: 1 1 240px;
  min-width: 200px;
  max-width: 320px;
}

.tx-tb-date {
  flex: 1 1 160px;
  min-width: 150px;
  max-width: 200px;
}

.tx-tb-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
}

@media (max-width: 900px) {
  .tx-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .tx-tb-cell,
  .tx-tb-cell--wide,
  .tx-tb-date {
    flex: 1 1 100%;
    max-width: 100%;
    min-width: 0;
  }

  .tx-tb-actions {
    margin-left: 0;
    justify-content: flex-end;
  }
}

.nowrap {
  white-space: nowrap;
}
</style>

<route lang="yaml">
name: stock-transactions
meta:
  action: manage
  subject: all
</route>

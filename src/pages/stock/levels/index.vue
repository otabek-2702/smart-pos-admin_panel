<script setup lang="ts">
/* ============================================================
   ALPHA POS — Stock Levels
   Refactored to design primitives (no Vuetify).
   Lists /levels/, supports adjust/reserve/release actions.
   ============================================================ */
import { stockApi as axios } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import StateFill from '@/components/design/StateFill.vue'
import Switch from '@/components/design/Switch.vue'

const { t } = useI18n({ useScope: 'global' })
const { notify } = useNotify()
const { formatDateShort } = useFormatters()

// ---- state ----
const levels = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const exporting = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const locationFilter = ref<string>('')
const categoryFilter = ref<string>('')
const itemTypeFilter = ref<string>('')
const lowStockOnly = ref(false)

const locationsList = ref<any[]>([])
const categoriesList = ref<any[]>([])

const MOVEMENT_TYPES = ['ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS', 'WASTE', 'SPOILAGE', 'COUNT_ADJUSTMENT', 'RETURN_FROM_CUSTOMER', 'RETURN_TO_SUPPLIER', 'PURCHASE_IN', 'SALE_OUT']
const ITEM_TYPES = ['RAW', 'SEMI', 'FINISHED', 'PACKAGING']

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadLevels()
}, 350)

// ---- helpers ----
function formatQty(val: any) {
  if (val === null || val === undefined)
    return '0'
  const n = Number(val)
  if (!Number.isFinite(n))
    return '0'

  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

function readData<T = any>(res: any): T {
  return (res?.data?.data ?? res?.data) as T
}

function qtyTone(qty: number): 'success' | 'warning' | 'error' {
  if (qty <= 0)
    return 'error'
  if (qty < 5)
    return 'warning'

  return 'success'
}

// ---- load ----
function filterParams() {
  const params: any = {}
  if (search.value.trim())
    params.search = search.value.trim()
  if (locationFilter.value)
    params.location_id = locationFilter.value
  if (categoryFilter.value)
    params.category_id = categoryFilter.value
  if (itemTypeFilter.value)
    params.item_type = itemTypeFilter.value
  if (lowStockOnly.value)
    params.low_stock_only = 'true'

  return params
}

async function loadLevels() {
  loading.value = true
  try {
    const params: any = { ...filterParams(), page: page.value, per_page: itemsPerPage.value }

    const res = await axios.get('/levels/', { params })
    const d = readData<any>(res)

    levels.value = d?.levels ?? []
    total.value = d?.pagination?.total ?? levels.value.length
  }
  catch {
    notify(t('stock_levels_load_failed'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadLocations() {
  try {
    const res = await axios.get('/locations/', { params: { per_page: 200 } })
    const d = readData<any>(res)

    locationsList.value = d?.locations ?? []
  }
  catch { /* ignore */ }
}

async function loadCategories() {
  try {
    const res = await axios.get('/categories/', { params: { per_page: 200 } })
    const d = readData<any>(res)

    categoriesList.value = d?.categories ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => {
  loadLevels()
  loadLocations()
  loadCategories()
})

watch([page, itemsPerPage], loadLevels)
watch([locationFilter, categoryFilter, itemTypeFilter, lowStockOnly], () => {
  page.value = 1
  loadLevels()
})
watch(search, () => debouncedSearch())

// ---- options ----
const locationOptions = computed(() =>
  locationsList.value.map(l => ({ value: String(l.id), label: l.name })),
)
const categoryOptions = computed(() =>
  categoriesList.value.map(c => ({ value: String(c.id), label: c.name })),
)
const itemTypeOptions = computed(() =>
  ITEM_TYPES.map(v => ({ value: v, label: t(`item_type_${v}`) })),
)
const movementTypeOptions = computed(() =>
  MOVEMENT_TYPES.map(v => ({ value: v, label: t(`movement_type_${v}`) })),
)

// ---- columns ----
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'item', label: t('stock_levels_col_item') },
  { key: 'sku', label: t('SKU') },
  { key: 'location', label: t('Location') },
  { key: 'quantity', label: t('Quantity'), align: 'right' },
  { key: 'reserved_quantity', label: t('Reserved'), align: 'right' },
  { key: 'available_quantity', label: t('Available'), align: 'right' },
  { key: 'pending_in_quantity', label: t('Pending In'), align: 'right' },
  { key: 'last_movement_at', label: t('Last Movement') },
])

// ---- adjust / reserve / release modal ----
type Mode = 'adjust' | 'reserve' | 'release'

const actionMode = ref<Mode | null>(null)
const actionLevel = ref<any>(null)
const actionSaving = ref(false)
const actionForm = ref({
  quantity: '' as string,
  movement_type: 'ADJUSTMENT_PLUS',
  notes: '',
})

const actionTitle = computed(() => {
  if (actionMode.value === 'adjust')
    return t('stock_levels_action_adjust')
  if (actionMode.value === 'reserve')
    return t('stock_levels_action_reserve')
  if (actionMode.value === 'release')
    return t('stock_levels_action_release')

  return ''
})

const quantityLabel = computed(() => {
  if (actionMode.value === 'adjust')
    return `${t('Quantity')} (${t('stock_levels_signed_hint')})`

  return t('Quantity')
})

const projectedQty = computed(() => {
  if (!actionLevel.value)
    return 0
  const qty = Number(actionForm.value.quantity || 0)
  const current = Number(actionLevel.value.quantity ?? 0)
  if (actionMode.value === 'adjust')
    return current + qty

  return current
})

const projectedReserved = computed(() => {
  if (!actionLevel.value)
    return 0
  const qty = Math.abs(Number(actionForm.value.quantity || 0))
  const current = Number(actionLevel.value.reserved_quantity ?? 0)
  if (actionMode.value === 'reserve')
    return current + qty
  if (actionMode.value === 'release')
    return Math.max(0, current - qty)

  return current
})

// Guardrails: reserve can't exceed available, release can't exceed reserved.
const actionMax = computed<number | null>(() => {
  if (!actionLevel.value)
    return null
  if (actionMode.value === 'reserve')
    return Number(actionLevel.value.available_quantity ?? 0)
  if (actionMode.value === 'release')
    return Number(actionLevel.value.reserved_quantity ?? 0)

  return null
})

const actionExceedsMax = computed(() => {
  if (actionMax.value === null)
    return false
  const qty = Math.abs(Number(actionForm.value.quantity || 0))

  return qty > actionMax.value + 1e-9
})

const actionMaxHint = computed(() => {
  if (actionMode.value === 'reserve')
    return t('stock_levels_max_available', { n: formatQty(actionMax.value) })
  if (actionMode.value === 'release')
    return t('stock_levels_max_reserved', { n: formatQty(actionMax.value) })

  return ''
})

function openAction(mode: Mode, level: any) {
  actionMode.value = mode
  actionLevel.value = level
  actionForm.value = {
    quantity: '',
    movement_type: 'ADJUSTMENT_PLUS',
    notes: '',
  }
}

function closeAction() {
  if (actionSaving.value)
    return
  actionMode.value = null
  actionLevel.value = null
}

function fillMax() {
  if (actionMax.value !== null && actionMax.value > 0)
    actionForm.value.quantity = String(actionMax.value)
}

async function doAction() {
  if (!actionLevel.value)
    return
  const qty = Number(actionForm.value.quantity)
  if (!actionForm.value.quantity || Number.isNaN(qty) || qty === 0) {
    notify(t('stock_levels_qty_nonzero'), 'error')

    return
  }
  if (actionExceedsMax.value) {
    notify(actionMode.value === 'reserve' ? t('stock_levels_exceeds_available') : t('stock_levels_exceeds_reserved'), 'error')

    return
  }
  actionSaving.value = true

  const stock_item_id = actionLevel.value.stock_item_id ?? actionLevel.value.stock_item?.id
  const location_id = actionLevel.value.location_id ?? actionLevel.value.location?.id
  try {
    if (actionMode.value === 'adjust') {
      await axios.post('/adjust/', {
        stock_item_id,
        location_id,
        quantity: qty,
        movement_type: actionForm.value.movement_type,
        notes: actionForm.value.notes,
      })
    }
    else if (actionMode.value === 'reserve') {
      await axios.post('/reserve/', {
        stock_item_id,
        location_id,
        quantity: qty,
        notes: actionForm.value.notes,
      })
    }
    else {
      await axios.post('/release-reservation/', {
        stock_item_id,
        location_id,
        quantity: qty,
        notes: actionForm.value.notes,
      })
    }
    notify(t('Saved'))
    closeAction()
    await loadLevels()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    actionSaving.value = false
  }
}

// ---- DataTable pagination glue ----
const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

const hasFilters = computed(() =>
  !!(search.value || locationFilter.value || categoryFilter.value || itemTypeFilter.value || lowStockOnly.value),
)

function clearFilters() {
  search.value = ''
  locationFilter.value = ''
  categoryFilter.value = ''
  itemTypeFilter.value = ''
  lowStockOnly.value = false
}

// ---- active filter chips ----
interface FilterChip { key: string, label: string, clear: () => void }

const activeFilterChips = computed<FilterChip[]>(() => {
  const chips: FilterChip[] = []
  if (search.value.trim()) {
    chips.push({ key: 'search', label: `“${search.value.trim()}”`, clear: () => { search.value = '' } })
  }
  if (locationFilter.value) {
    const loc = locationsList.value.find(l => String(l.id) === locationFilter.value)
    chips.push({ key: 'location', label: loc?.name ?? t('Location'), clear: () => { locationFilter.value = '' } })
  }
  if (categoryFilter.value) {
    const cat = categoriesList.value.find(c => String(c.id) === categoryFilter.value)
    chips.push({ key: 'category', label: cat?.name ?? t('All Categories'), clear: () => { categoryFilter.value = '' } })
  }
  if (itemTypeFilter.value) {
    chips.push({ key: 'itemType', label: t(`item_type_${itemTypeFilter.value}`), clear: () => { itemTypeFilter.value = '' } })
  }
  if (lowStockOnly.value) {
    chips.push({ key: 'lowStock', label: t('Low Stock Only'), clear: () => { lowStockOnly.value = false } })
  }

  return chips
})

// ---- CSV export (respects current filters, walks all pages) ----
function csvCell(v: any): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

async function exportCsv() {
  if (exporting.value)
    return
  exporting.value = true
  try {
    const rows: any[] = []
    const perPage = 100
    let pageNum = 1
    // Safety cap: never fetch more than 100 pages (10k rows).
    for (let guard = 0; guard < 100; guard++) {
      const res = await axios.get('/levels/', { params: { ...filterParams(), page: pageNum, per_page: perPage } })
      const d = readData<any>(res)
      const batch: any[] = d?.levels ?? []
      rows.push(...batch)
      if (!d?.pagination?.has_next || batch.length === 0)
        break
      pageNum += 1
    }

    if (rows.length === 0) {
      notify(t('stock_levels_nothing_export'), 'warning')

      return
    }

    const cols: Array<[string, (r: any) => any]> = [
      [t('stock_levels_col_item'), r => r.stock_item?.name],
      [t('SKU'), r => r.stock_item?.sku],
      [t('Location'), r => r.location?.name],
      [t('Quantity'), r => formatQty(r.quantity)],
      [t('unit'), r => r.stock_item?.unit],
      [t('Reserved'), r => formatQty(r.reserved_quantity)],
      [t('Available'), r => formatQty(r.available_quantity)],
      [t('Pending In'), r => formatQty(r.pending_in_quantity)],
      [t('stock_levels_pending_out'), r => formatQty(r.pending_out_quantity)],
      [t('Last Movement'), r => (r.last_movement_at ? formatDateShort(r.last_movement_at) : '')],
    ]
    const head = cols.map(c => csvCell(c[0])).join(',')
    const body = rows.map(r => cols.map(c => csvCell(c[1](r))).join(',')).join('\n')
    const csv = `﻿${head}\n${body}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `stock-levels-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    notify(t('stock_levels_exported', { n: rows.length }), 'success')
  }
  catch {
    notify(t('stock_levels_export_failed'), 'error')
  }
  finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Stock Levels')"
      :subtitle="t('stock_levels_subtitle')"
    >
      <template #actions>
        <Button
          variant="secondary"
          icon="download"
          :loading="exporting"
          :disabled="loading || levels.length === 0"
          @click="exportCsv"
        >
          {{ t('stock_levels_export') }}
        </Button>
        <Button
          variant="secondary"
          icon="refresh"
          @click="loadLevels"
        >
          {{ t('Refresh') }}
        </Button>
      </template>
    </PageHeader>

    <div class="card">
      <!-- Toolbar -->
      <div class="toolbar levels-toolbar">
        <div class="grow tb-search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('stock_levels_search_placeholder')"
            :aria-label="t('stock_levels_search_placeholder')"
          />
        </div>

        <div class="tb-filter">
          <Select
            :model-value="locationFilter"
            :placeholder="t('All Locations')"
            :options="locationOptions"
            @update:model-value="(v: string) => locationFilter = v"
          />
        </div>

        <div class="tb-filter">
          <Select
            :model-value="categoryFilter"
            :placeholder="t('All Categories')"
            :options="categoryOptions"
            @update:model-value="(v: string) => categoryFilter = v"
          />
        </div>

        <div class="tb-filter">
          <Select
            :model-value="itemTypeFilter"
            :placeholder="t('Item Type')"
            :options="itemTypeOptions"
            @update:model-value="(v: string) => itemTypeFilter = v"
          />
        </div>

        <label class="row tb-toggle" style="gap:8px; cursor:pointer;">
          <Switch v-model="lowStockOnly" />
          <span style="font-size:13px;">{{ t('Low Stock Only') }}</span>
        </label>
      </div>

      <!-- Active filter chips -->
      <div
        v-if="activeFilterChips.length"
        class="lvl-chips"
      >
        <button
          v-for="chip in activeFilterChips"
          :key="chip.key"
          type="button"
          class="lvl-chip"
          :title="t('stock_levels_clear_filters')"
          @click="chip.clear()"
        >
          <span class="lvl-chip__label">{{ chip.label }}</span>
          <DesignIcon name="close" :size="13" />
        </button>
        <button
          type="button"
          class="lvl-chip lvl-chip--clear"
          @click="clearFilters"
        >
          {{ t('stock_levels_clear_filters') }}
        </button>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="columns"
        :rows="levels"
        row-key="id"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
      >
        <template #cell.item="{ row }">
          <span class="cell-strong">{{ row.stock_item?.name ?? '—' }}</span>
        </template>

        <template #cell.sku="{ row }">
          <span class="mono cell-muted">{{ row.stock_item?.sku ?? '—' }}</span>
        </template>

        <template #cell.location="{ row }">
          <span class="cell-strong">{{ row.location?.name ?? '—' }}</span>
        </template>

        <template #cell.quantity="{ row }">
          <Badge :tone="qtyTone(Number(row.quantity))">
            {{ formatQty(row.quantity) }} {{ row.stock_item?.unit ?? '' }}
          </Badge>
        </template>

        <template #cell.reserved_quantity="{ row }">
          <span class="mono">{{ formatQty(row.reserved_quantity) }}</span>
        </template>

        <template #cell.available_quantity="{ row }">
          <span
            class="mono"
            :class="Number(row.available_quantity) <= 0 ? 'cell-strong' : ''"
            :style="Number(row.available_quantity) <= 0 ? { color: 'rgb(var(--v-theme-error-strong))' } : undefined"
          >
            {{ formatQty(row.available_quantity) }}
          </span>
        </template>

        <template #cell.pending_in_quantity="{ row }">
          <span class="mono">{{ formatQty(row.pending_in_quantity) }}</span>
        </template>

        <template #cell.last_movement_at="{ row }">
          <span class="cell-muted nowrap">{{ row.last_movement_at ? formatDateShort(row.last_movement_at) : '—' }}</span>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            icon="edit"
            tone="primary"
            :title="t('stock_levels_action_adjust')"
            @click="openAction('adjust', row)"
          />
          <IconAction
            icon="lock"
            tone="warning"
            :title="t('stock_levels_action_reserve')"
            @click="openAction('reserve', row)"
          />
          <IconAction
            icon="unlock"
            tone="success"
            :title="t('stock_levels_action_release')"
            :disabled="Number(row.reserved_quantity ?? 0) === 0"
            @click="openAction('release', row)"
          />
        </template>

        <template #empty>
          <StateFill
            icon="box"
            :title="t('stock_levels_empty_title')"
            :sub="t('stock_levels_empty_sub')"
          >
            <div v-if="hasFilters" style="margin-top: 12px;">
              <Button variant="secondary" icon="close" @click="clearFilters">
                {{ t('stock_levels_clear_filters') }}
              </Button>
            </div>
          </StateFill>
        </template>
      </DataTable>
    </div>

    <!-- Adjust / reserve / release modal -->
    <Modal
      :open="actionMode !== null"
      :width="560"
      :title="actionTitle"
      :close-on-backdrop="!actionSaving"
      :close-on-esc="!actionSaving"
      @close="closeAction"
    >
      <div v-if="actionLevel" class="lvl-context">
        <p class="lvl-context__title">
          {{ actionLevel.stock_item?.name ?? '—' }}
          <span class="cell-muted">
            · {{ actionLevel.location?.name ?? '—' }}
          </span>
        </p>
        <p class="lvl-context__meta">
          {{ t('stock_levels_current') }}: <b>{{ formatQty(actionLevel.quantity) }}</b>
          · {{ t('Reserved') }}: <b>{{ formatQty(actionLevel.reserved_quantity) }}</b>
          · {{ t('Available') }}: <b>{{ formatQty(actionLevel.available_quantity) }}</b>
          <template v-if="Number(actionLevel.pending_in_quantity) > 0">
            · {{ t('Pending In') }}: <b>{{ formatQty(actionLevel.pending_in_quantity) }}</b>
          </template>
        </p>
      </div>

      <div class="grid cols-2 modal-grid" style="gap: var(--sp-4);">
        <Field :label="quantityLabel">
          <Input
            v-model="actionForm.quantity"
            type="number"
            step="0.0001"
            :placeholder="t('Quantity')"
          />
          <div v-if="actionMax !== null" class="lvl-max">
            <span :class="{ 'lvl-max--err': actionExceedsMax }">{{ actionMaxHint }}</span>
            <button
              v-if="actionMax > 0"
              type="button"
              class="lvl-max__btn"
              @click="fillMax"
            >
              {{ t('stock_levels_use_max') }}
            </button>
          </div>
          <div v-if="actionExceedsMax" class="lvl-err">
            {{ actionMode === 'reserve' ? t('stock_levels_exceeds_available') : t('stock_levels_exceeds_reserved') }}
          </div>
        </Field>

        <Field
          v-if="actionMode === 'adjust'"
          :label="t('Movement type')"
        >
          <Select
            :model-value="actionForm.movement_type"
            :options="movementTypeOptions"
            @update:model-value="(v: string) => actionForm.movement_type = v"
          />
        </Field>

        <Field :label="t('Notes')" style="grid-column: 1 / -1;">
          <Input
            v-model="actionForm.notes"
            :placeholder="t('Notes')"
          />
        </Field>
      </div>

      <div class="lvl-projection">
        <template v-if="actionMode === 'adjust'">
          {{ t('stock_levels_projected_qty') }}: <strong>{{ formatQty(projectedQty) }}</strong>
        </template>
        <template v-else>
          {{ t('stock_levels_projected_reserved') }}: <strong>{{ formatQty(projectedReserved) }}</strong>
        </template>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="actionSaving" @click="closeAction">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          :loading="actionSaving"
          :disabled="actionSaving || actionExceedsMax"
          @click="doAction"
        >
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
}

.levels-toolbar {
  flex-wrap: wrap;
  gap: 12px;
  row-gap: 12px;
}

.tb-search {
  max-width: 280px;
  min-width: 200px;
  flex: 1 1 200px;
}

.tb-filter {
  width: 200px;
  min-width: 160px;
  flex: 0 1 200px;
}

.tb-toggle {
  margin-left: auto;
}

.lvl-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 0 4px;
}

.lvl-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--primary-border, var(--border));
  background: var(--primary-weak, var(--surface-2));
  color: var(--primary, var(--text));
  border-radius: var(--r-pill, 99px);
  font-size: 12.5px;
  font-weight: var(--fw-semibold, 600);
  cursor: pointer;
  transition: all .13s;
}

.lvl-chip:hover {
  filter: brightness(0.97);
}

.lvl-chip__label {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lvl-chip--clear {
  background: transparent;
  border-color: transparent;
  color: var(--text-secondary);
  padding: 0 8px;
}

.lvl-chip--clear:hover {
  color: var(--text);
  text-decoration: underline;
}

.lvl-max {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.lvl-max--err {
  color: rgb(var(--v-theme-error-strong));
  font-weight: var(--fw-semibold, 600);
}

.lvl-max__btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--primary);
  font-size: 12px;
  font-weight: var(--fw-semibold, 600);
  cursor: pointer;
}

.lvl-max__btn:hover {
  text-decoration: underline;
}

.lvl-err {
  margin-top: 6px;
  font-size: 12px;
  color: rgb(var(--v-theme-error-strong));
}

.lvl-context {
  margin-bottom: var(--sp-4);
  padding: var(--sp-3);
  background: var(--surface-soft, var(--surface));
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.lvl-context__title {
  margin: 0;
  font-weight: 600;
}

.lvl-context__meta {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.lvl-projection {
  margin-top: var(--sp-4);
  padding: var(--sp-3);
  background: rgb(var(--v-theme-info-weak));
  color: rgb(var(--v-theme-info-strong));
  border: 1px solid rgb(var(--v-theme-info-border));
  border-radius: var(--r-md);
  font-size: 13px;
}

@media (max-width: 768px) {
  .modal-grid {
    grid-template-columns: 1fr;
  }

  .levels-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .tb-search,
  .tb-filter {
    width: 100%;
    max-width: 100%;
    flex: 1 1 100%;
  }

  .tb-toggle {
    margin-left: 0;
  }
}
</style>

<route lang="yaml">
name: stock-levels
meta:
  action: manage
  subject: all
</route>

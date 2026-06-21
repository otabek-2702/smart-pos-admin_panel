<script setup lang="ts">
/* ============================================================
   ALPHA POS — Stock Item drill-down
   Page route: /stock/items/:id
   Shows full item detail + level breakdown + movement history.
   Wires to:
     GET  /api/admins/stock/items/:id/
     GET  /api/admins/stock/transactions/item/:id/?days=
     GET  /api/admins/stock/levels/item/:id/
     PUT  /api/admins/stock/items/:id/
     DELETE /api/admins/stock/items/:id/
     POST /api/admins/stock/adjust/
     POST /api/admins/stock/reserve/
     POST /api/admins/stock/release-reservation/
   ============================================================ */
import { stockApi } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import Switch from '@/components/design/Switch.vue'
import StateFill from '@/components/design/StateFill.vue'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const { notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

// ---- ids ----
const itemId = computed(() => String(route.params.id ?? ''))

// ---- state ----
const item = ref<any>(null)
const levels = ref<any[]>([])
const levelsSummary = ref<{ total_quantity?: number, total_reserved?: number, total_available?: number }>({})
const transactions = ref<any[]>([])
const txSummary = ref<any>(null)
const loadingItem = ref(false)
const loadingLevels = ref(false)
const loadingTx = ref(false)
const days = ref<string>('30')

// Filter state (client-side over loaded tx)
const movementTypeFilter = ref<string>('')
const locationFilter = ref<string>('')
const search = ref<string>('')

// Locations lookup (for filter + adjust/reserve modals)
const locations = ref<any[]>([])
// Categories + units lookups (for edit modal)
const categoriesList = ref<any[]>([])
const unitsList = ref<any[]>([])

// Modals
const editOpen = ref(false)
const deleteOpen = ref(false)
const adjustOpen = ref(false)
const reserveOpen = ref(false)
const releaseOpen = ref(false)

// Action busy flags
const saving = ref(false)
const deleting = ref(false)
const adjusting = ref(false)
const reserving = ref(false)
const releasing = ref(false)

// ---- enums ----
const ITEM_TYPES = ['RAW', 'SEMI', 'FINISHED', 'PACKAGING']
const MOVEMENT_TYPES = [
  'PURCHASE_IN', 'SALE_OUT', 'TRANSFER_IN', 'TRANSFER_OUT',
  'PRODUCTION_IN', 'PRODUCTION_OUT', 'ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS',
  'WASTE', 'SPOILAGE', 'RETURN_FROM_CUSTOMER', 'RETURN_TO_SUPPLIER',
  'COUNT_ADJUSTMENT', 'OPENING_BALANCE', 'RESERVATION', 'RESERVATION_RELEASE',
]
const ADJUST_TYPES = ['ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS', 'WASTE', 'SPOILAGE', 'OPENING_BALANCE']

// Movement badge tone map
const MOVEMENT_TONE: Record<string, string> = {
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
  RESERVATION: 'warning',
  RESERVATION_RELEASE: 'info',
}
function movementTone(v?: string): 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral' {
  if (!v) return 'neutral'
  return (MOVEMENT_TONE[v] ?? 'neutral') as any
}

const ITEM_TYPE_TONE: Record<string, string> = {
  RAW: 'success',
  SEMI: 'warning',
  FINISHED: 'primary',
  PACKAGING: 'neutral',
}
function itemTypeTone(v?: string): 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral' {
  if (!v) return 'neutral'
  return (ITEM_TYPE_TONE[v] ?? 'neutral') as any
}

// ---- formatting helpers ----
function formatQty(val: any): string {
  if (val === null || val === undefined || val === '')
    return '—'
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}
function formatMoney(val: any): string {
  if (val === null || val === undefined || val === '')
    return '—'
  return formatCurrency(val)
}

// ---- loaders ----
async function loadItem() {
  if (!itemId.value) return
  loadingItem.value = true
  try {
    const res = await stockApi.get(`/items/${itemId.value}/`)
    const d = res.data?.data ?? res.data
    item.value = d?.item ?? d
  }
  catch {
    notify(t('Failed to load items'), 'error')
  }
  finally {
    loadingItem.value = false
  }
}

async function loadLevels() {
  if (!itemId.value) return
  loadingLevels.value = true
  try {
    const res = await stockApi.get(`/levels/item/${itemId.value}/`)
    const d = res.data?.data ?? res.data
    levels.value = d?.levels ?? []
    levelsSummary.value = {
      total_quantity: d?.total_quantity ?? 0,
      total_reserved: d?.total_reserved ?? 0,
      total_available: d?.total_available ?? 0,
    }
  }
  catch {
    levels.value = []
    levelsSummary.value = {}
  }
  finally {
    loadingLevels.value = false
  }
}

async function loadHistory() {
  if (!itemId.value) return
  loadingTx.value = true
  try {
    const res = await stockApi.get(`/transactions/item/${itemId.value}/`, { params: { days: Number(days.value) } })
    const d = res.data?.data ?? res.data
    transactions.value = d?.transactions ?? []
    txSummary.value = d?.summary ?? null
  }
  catch {
    transactions.value = []
    txSummary.value = null
  }
  finally {
    loadingTx.value = false
  }
}

async function loadLookups() {
  try {
    const [locRes, catRes, unitRes] = await Promise.all([
      stockApi.get('/locations/', { params: { per_page: 200 } }),
      stockApi.get('/categories/', { params: { per_page: 200 } }),
      stockApi.get('/units/', { params: { per_page: 200 } }),
    ])
    locations.value = (locRes.data?.data ?? locRes.data)?.locations ?? []
    categoriesList.value = (catRes.data?.data ?? catRes.data)?.categories ?? []
    unitsList.value = (unitRes.data?.data ?? unitRes.data)?.units ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => {
  loadItem()
  loadLevels()
  loadHistory()
  loadLookups()
})
watch(days, loadHistory)
watch(() => route.params.id, () => {
  loadItem()
  loadLevels()
  loadHistory()
})

// ---- option lists for selects ----
const locationOptions = computed(() => locations.value.map(l => ({ value: String(l.id), label: l.name })))
const categoryOptions = computed(() => categoriesList.value.map(c => ({ value: String(c.id), label: c.name })))
const unitOptions = computed(() => unitsList.value.map(u => ({ value: String(u.id), label: `${u.name}${u.short_name ? ` (${u.short_name})` : ''}` })))
const itemTypeOptions = computed(() => ITEM_TYPES.map(v => ({ value: v, label: t(`stock_item_type_${v}`) })))
const movementTypeOptions = computed(() => MOVEMENT_TYPES.map(v => ({ value: v, label: t(`stock_movement_${v}`) })))
const adjustTypeOptions = computed(() => ADJUST_TYPES.map(v => ({ value: v, label: t(`stock_movement_${v}`) })))
const periodOptions = computed(() => [
  { value: '7', label: t('item_drill_period_7d') },
  { value: '30', label: t('item_drill_period_30d') },
  { value: '90', label: t('item_drill_period_90d') },
  { value: '180', label: t('item_drill_period_180d') },
  { value: '365', label: t('item_drill_period_365d') },
])

// ---- filtered transactions (client-side filter as spec requires) ----
const filteredTransactions = computed(() => {
  let arr = transactions.value.slice()
  if (movementTypeFilter.value)
    arr = arr.filter(tx => tx.movement_type === movementTypeFilter.value)
  if (locationFilter.value) {
    const lid = Number(locationFilter.value)
    arr = arr.filter(tx => Number(tx.location_id ?? tx.location?.id) === lid)
  }
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    arr = arr.filter(tx => {
      const num = String(tx.transaction_number ?? '').toLowerCase()
      const notes = String(tx.notes ?? '').toLowerCase()
      return num.includes(q) || notes.includes(q)
    })
  }
  return arr
})

const hasTxFilters = computed(() => !!(movementTypeFilter.value || locationFilter.value || search.value))
function clearTxFilters() {
  movementTypeFilter.value = ''
  locationFilter.value = ''
  search.value = ''
}
function locationLabel(id: string) {
  return locationOptions.value.find(o => o.value === id)?.label ?? id
}

// Unit display (used as suffix on qty cells)
const unitShort = computed(() => item.value?.base_unit?.short_name ?? item.value?.base_unit?.name ?? '')

// ---- DataTable columns (history) ----
const txColumns = computed<DataTableColumn<any>[]>(() => [
  { key: 'created_at', label: t('Date') },
  { key: 'transaction_number', label: t('Tx #') },
  { key: 'movement_type', label: t('Movement') },
  { key: 'location_name', label: t('Location') },
  { key: 'quantity', label: t('Qty'), align: 'right' },
  { key: 'quantity_before', label: t('item_drill_qty_before'), align: 'right' },
  { key: 'quantity_after', label: t('item_drill_qty_after'), align: 'right' },
  { key: 'unit_cost', label: t('Unit cost'), align: 'right' },
  { key: 'total_cost', label: t('item_drill_total_cost'), align: 'right' },
  { key: 'notes', label: t('Notes') },
])

// ---- edit form state ----
const editForm = ref<any>({})
const editErrors = ref<Record<string, string>>({})

function openEdit() {
  if (!item.value) return
  editForm.value = {
    name: item.value.name ?? '',
    sku: item.value.sku ?? '',
    barcode: item.value.barcode ?? '',
    item_type: item.value.item_type ?? 'RAW',
    category_id: item.value.category?.id != null ? String(item.value.category.id) : '',
    base_unit_id: item.value.base_unit?.id != null ? String(item.value.base_unit.id) : '',
    min_stock_level: item.value.min_stock_level ?? '',
    max_stock_level: item.value.max_stock_level ?? '',
    reorder_point: item.value.reorder_point ?? '',
    cost_price: item.value.cost_price ?? '',
    is_purchasable: !!item.value.is_purchasable,
    is_sellable: !!item.value.is_sellable,
    is_producible: !!item.value.is_producible,
    track_batches: !!item.value.track_batches,
    track_expiry: !!item.value.track_expiry,
    default_expiry_days: item.value.default_expiry_days ?? '',
    storage_conditions: item.value.storage_conditions ?? '',
  }
  editErrors.value = {}
  editOpen.value = true
}

function validateEdit(): boolean {
  const errs: Record<string, string> = {}
  if (!editForm.value.name?.trim()) errs.name = t('Required')
  if (!editForm.value.item_type) errs.item_type = t('Required')
  if (!editForm.value.base_unit_id) errs.base_unit_id = t('Required')
  editErrors.value = errs
  return Object.keys(errs).length === 0
}

async function saveEdit() {
  if (!validateEdit()) return
  saving.value = true
  try {
    const payload: any = {
      name: editForm.value.name?.trim(),
      sku: editForm.value.sku?.trim() || null,
      barcode: editForm.value.barcode?.trim() || null,
      item_type: editForm.value.item_type,
      base_unit_id: Number(editForm.value.base_unit_id),
      is_purchasable: !!editForm.value.is_purchasable,
      is_sellable: !!editForm.value.is_sellable,
      is_producible: !!editForm.value.is_producible,
      track_batches: !!editForm.value.track_batches,
      track_expiry: !!editForm.value.track_expiry,
      storage_conditions: editForm.value.storage_conditions?.trim() || null,
    }
    if (editForm.value.category_id) payload.category_id = Number(editForm.value.category_id)
    if (editForm.value.min_stock_level !== '') payload.min_stock_level = Number(editForm.value.min_stock_level)
    if (editForm.value.max_stock_level !== '') payload.max_stock_level = Number(editForm.value.max_stock_level)
    if (editForm.value.reorder_point !== '') payload.reorder_point = Number(editForm.value.reorder_point)
    if (editForm.value.cost_price !== '') payload.cost_price = Number(editForm.value.cost_price)
    if (editForm.value.default_expiry_days !== '') payload.default_expiry_days = Number(editForm.value.default_expiry_days)

    await stockApi.put(`/items/${itemId.value}/`, payload)
    notify(t('Saved'))
    editOpen.value = false
    await loadItem()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

// ---- deactivate ----
function openDelete() {
  deleteOpen.value = true
}
const stockOnHand = computed(() => Number(levelsSummary.value.total_quantity ?? 0))
const canDeactivate = computed(() => stockOnHand.value <= 0)

async function confirmDelete() {
  deleting.value = true
  try {
    await stockApi.delete(`/items/${itemId.value}/`)
    notify(t('Deleted'))
    deleteOpen.value = false
    router.push({ name: 'stock-items' }).catch(() => router.push('/stock/items'))
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('item_drill_deactivate_blocked'), 'error')
  }
  finally {
    deleting.value = false
  }
}

// ---- adjust / reserve / release modals share a similar form ----
const adjForm = ref<{ location_id: string, quantity: string, movement_type: string, notes: string }>({
  location_id: '', quantity: '', movement_type: 'ADJUSTMENT_PLUS', notes: '',
})
const adjErrors = ref<Record<string, string>>({})

function openAdjust() {
  adjForm.value = { location_id: locationOptions.value[0]?.value ?? '', quantity: '', movement_type: 'ADJUSTMENT_PLUS', notes: '' }
  adjErrors.value = {}
  adjustOpen.value = true
}
function validateAdj(requireType = true): boolean {
  const errs: Record<string, string> = {}
  if (!adjForm.value.location_id) errs.location_id = t('Required')
  if (!adjForm.value.quantity || Number(adjForm.value.quantity) <= 0) errs.quantity = t('Required')
  if (requireType && !adjForm.value.movement_type) errs.movement_type = t('Required')
  adjErrors.value = errs
  return Object.keys(errs).length === 0
}
async function submitAdjust() {
  if (!validateAdj(true)) return
  adjusting.value = true
  try {
    await stockApi.post('/adjust/', {
      stock_item_id: Number(itemId.value),
      location_id: Number(adjForm.value.location_id),
      quantity: Number(adjForm.value.quantity),
      movement_type: adjForm.value.movement_type,
      notes: adjForm.value.notes?.trim() || undefined,
    })
    notify(t('Saved'))
    adjustOpen.value = false
    await Promise.all([loadItem(), loadLevels(), loadHistory()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    adjusting.value = false
  }
}

function openReserve() {
  adjForm.value = { location_id: locationOptions.value[0]?.value ?? '', quantity: '', movement_type: 'RESERVATION', notes: '' }
  adjErrors.value = {}
  reserveOpen.value = true
}
async function submitReserve() {
  if (!validateAdj(false)) return
  reserving.value = true
  try {
    await stockApi.post('/reserve/', {
      stock_item_id: Number(itemId.value),
      location_id: Number(adjForm.value.location_id),
      quantity: Number(adjForm.value.quantity),
      notes: adjForm.value.notes?.trim() || undefined,
    })
    notify(t('Saved'))
    reserveOpen.value = false
    await Promise.all([loadLevels(), loadHistory()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    reserving.value = false
  }
}

function openRelease() {
  adjForm.value = { location_id: locationOptions.value[0]?.value ?? '', quantity: '', movement_type: 'RESERVATION_RELEASE', notes: '' }
  adjErrors.value = {}
  releaseOpen.value = true
}
async function submitRelease() {
  if (!validateAdj(false)) return
  releasing.value = true
  try {
    await stockApi.post('/release-reservation/', {
      stock_item_id: Number(itemId.value),
      location_id: Number(adjForm.value.location_id),
      quantity: Number(adjForm.value.quantity),
      notes: adjForm.value.notes?.trim() || undefined,
    })
    notify(t('Saved'))
    releaseOpen.value = false
    await Promise.all([loadLevels(), loadHistory()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    releasing.value = false
  }
}

// ---- nav ----
function goBack() {
  router.push({ name: 'stock-items' }).catch(() => router.push('/stock/items'))
}

// Levels skeleton row count
const levelsSkeletonRows = computed(() => 3)
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="item?.name ? `${t('item_drill_title')} — ${item.name}` : t('item_drill_title')"
      :subtitle="t('item_drill_subtitle')"
    >
      <template #actions>
        <Button
          variant="ghost"
          icon="chevleft"
          @click="goBack"
        >
          {{ t('item_drill_back') }}
        </Button>
        <Button
          variant="secondary"
          icon="sliders"
          :disabled="!item"
          @click="openAdjust"
        >
          {{ t('item_drill_adjust') }}
        </Button>
        <Button
          variant="secondary"
          icon="lock"
          :disabled="!item"
          @click="openReserve"
        >
          {{ t('item_drill_reserve') }}
        </Button>
        <Button
          variant="secondary"
          icon="play"
          :disabled="!item"
          @click="openRelease"
        >
          {{ t('item_drill_release') }}
        </Button>
        <Button
          variant="primary"
          icon="pencil"
          :disabled="!item"
          @click="openEdit"
        >
          {{ t('Edit') }}
        </Button>
        <IconAction
          icon="trash"
          tone="danger"
          :title="t('Delete')"
          :disabled="!item"
          @click="openDelete"
        />
      </template>
    </PageHeader>

    <!-- KPI strip -->
    <div class="grid cols-4" style="margin-bottom: var(--sp-5);">
      <Kpi
        :data="{
          label: t('item_drill_total_on_hand'),
          icon: 'package',
          tone: 'primary',
          value: levelsSummary.total_quantity ?? null,
          sub: unitShort || undefined,
        }"
      />
      <Kpi
        :data="{
          label: t('item_drill_total_reserved'),
          icon: 'lock',
          tone: 'warning',
          value: levelsSummary.total_reserved ?? null,
          sub: unitShort || undefined,
        }"
      />
      <Kpi
        :data="{
          label: t('item_drill_total_available'),
          icon: 'check',
          tone: 'success',
          value: levelsSummary.total_available ?? null,
          sub: unitShort || undefined,
        }"
      />
      <Kpi
        :data="{
          label: t('item_drill_avg_cost'),
          icon: 'dollar',
          tone: 'info',
          money: true,
          value: item ? (item.cost_price ?? 0) : null,
        }"
      />
    </div>

    <!-- Overview card -->
    <div class="card" style="margin-bottom: var(--sp-5);">
      <div class="toolbar" style="border-bottom: 1px solid var(--border);">
        <div style="font-weight: var(--fw-semibold); font-size: var(--fs-md);">
          {{ t('item_drill_overview') }}
        </div>
      </div>

      <div v-if="loadingItem && !item" style="padding: var(--sp-5);">
        <div class="sk-box" style="height: 14px; width: 60%; margin-bottom: 12px; border-radius: 4px;" />
        <div class="sk-box" style="height: 14px; width: 40%; margin-bottom: 12px; border-radius: 4px;" />
        <div class="sk-box" style="height: 14px; width: 70%; border-radius: 4px;" />
      </div>

      <div v-else-if="item" class="grid cols-3" style="padding: var(--sp-5); gap: var(--sp-4);">
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('Name') }}</div>
          <div style="font-weight: var(--fw-semibold);">{{ item.name }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('SKU') }}</div>
          <div class="mono">{{ item.sku || '—' }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('Barcode') }}</div>
          <div class="mono">{{ item.barcode || '—' }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('Type') }}</div>
          <Badge :tone="itemTypeTone(item.item_type)">
            {{ item.item_type ? t(`stock_item_type_${item.item_type}`) : '—' }}
          </Badge>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('Category') }}</div>
          <div>{{ item.category?.name || '—' }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('item_drill_base_unit') }}</div>
          <div>{{ item.base_unit ? `${item.base_unit.name}${item.base_unit.short_name ? ` (${item.base_unit.short_name})` : ''}` : '—' }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('item_drill_min_stock') }}</div>
          <div class="mono">{{ formatQty(item.min_stock_level) }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('item_drill_max_stock') }}</div>
          <div class="mono">{{ formatQty(item.max_stock_level) }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('item_drill_reorder_point') }}</div>
          <div class="mono">{{ formatQty(item.reorder_point) }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('Cost Price') }}</div>
          <div class="mono">{{ formatMoney(item.cost_price) }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('item_drill_last_cost') }}</div>
          <div class="mono">{{ formatMoney(item.last_cost ?? item.last_purchase_price) }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('Status') }}</div>
          <Badge :tone="item.is_active ? 'success' : 'neutral'">
            {{ item.is_active ? t('Active') : t('Inactive') }}
          </Badge>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('item_drill_storage') }}</div>
          <div>{{ item.storage_conditions || '—' }}</div>
        </div>
        <div>
          <div class="cell-muted" style="font-size: var(--fs-sm); margin-bottom: 4px;">{{ t('Capabilities') }}</div>
          <div class="chips">
            <span v-if="item.is_purchasable" class="chip">{{ t('Purchasable') }}</span>
            <span v-if="item.is_sellable" class="chip">{{ t('Sellable') }}</span>
            <span v-if="item.is_producible" class="chip">{{ t('Producible') }}</span>
            <span v-if="item.track_batches" class="chip">{{ t('Track batches') }}</span>
            <span v-if="item.track_expiry" class="chip">{{ t('Track expiry') }}</span>
            <span v-if="!item.is_purchasable && !item.is_sellable && !item.is_producible && !item.track_batches && !item.track_expiry" class="cell-muted">—</span>
          </div>
        </div>
      </div>

      <div v-else style="padding: var(--sp-5);">
        <StateFill
          icon="alert"
          :title="t('Not found')"
          error
        />
      </div>
    </div>

    <!-- Stock by location card -->
    <div class="card" style="margin-bottom: var(--sp-5);">
      <div class="toolbar" style="border-bottom: 1px solid var(--border);">
        <div style="font-weight: var(--fw-semibold); font-size: var(--fs-md);">
          {{ t('item_drill_levels') }}
        </div>
      </div>

      <div v-if="loadingLevels && levels.length === 0" style="padding: var(--sp-4) var(--sp-5);">
        <div v-for="n in levelsSkeletonRows" :key="n" class="sk-box" style="height: 36px; margin-bottom: 8px; border-radius: 6px;" />
      </div>

      <div v-else-if="levels.length === 0" style="padding: var(--sp-4);">
        <StateFill
          icon="package"
          :title="t('item_drill_no_levels')"
        />
      </div>

      <div v-else class="tablewrap">
        <table class="dtable">
          <thead>
            <tr>
              <th>{{ t('Location') }}</th>
              <th class="num">{{ t('Qty') }}</th>
              <th class="num">{{ t('item_drill_total_reserved') }}</th>
              <th class="num">{{ t('item_drill_total_available') }}</th>
              <th class="num">{{ t('item_drill_last_cost') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lvl in levels" :key="lvl.id ?? lvl.location?.id">
              <td>{{ lvl.location?.name ?? lvl.location_name ?? '—' }}</td>
              <td class="num mono cell-strong">{{ formatQty(lvl.quantity) }}</td>
              <td class="num mono">{{ formatQty(lvl.reserved_quantity ?? lvl.reserved) }}</td>
              <td class="num mono">{{ formatQty(lvl.available_quantity ?? lvl.available) }}</td>
              <td class="num mono">{{ formatMoney(lvl.last_cost ?? lvl.unit_cost) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Movement history card -->
    <div class="card">
      <div class="toolbar" style="border-bottom: 1px solid var(--border);">
        <div style="font-weight: var(--fw-semibold); font-size: var(--fs-md); margin-right: auto;">
          {{ t('item_drill_history') }}
        </div>
        <div style="width: 200px;">
          <Select
            v-model="days"
            :options="periodOptions"
          />
        </div>
        <div style="width: 200px;">
          <Select
            :model-value="movementTypeFilter"
            :placeholder="t('Movement')"
            :options="movementTypeOptions"
            @update:model-value="(v: string) => movementTypeFilter = v"
          />
        </div>
        <div style="width: 200px;">
          <Select
            :model-value="locationFilter"
            :placeholder="t('Location')"
            :options="locationOptions"
            @update:model-value="(v: string) => locationFilter = v"
          />
        </div>
        <div style="width: 240px;">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search')"
          />
        </div>
        <Button
          variant="ghost"
          icon="refresh"
          @click="loadHistory"
        >
          {{ t('Refresh') }}
        </Button>
      </div>

      <!-- Active chips -->
      <div v-if="hasTxFilters" class="toolbar" style="padding-top: 0;">
        <div class="chips">
          <span class="cell-muted" style="font-size: 13px; margin-right: 2px;">{{ t('Filters') }}:</span>
          <span v-if="movementTypeFilter" class="chip">
            <span>{{ t('Movement') }}: <b>{{ t(`stock_movement_${movementTypeFilter}`) }}</b></span>
            <span class="chip__x" @click="movementTypeFilter = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>
          <span v-if="locationFilter" class="chip">
            <span>{{ t('Location') }}: <b>{{ locationLabel(locationFilter) }}</b></span>
            <span class="chip__x" @click="locationFilter = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>
          <span v-if="search" class="chip">
            <span>{{ t('Search') }}: <b>{{ search }}</b></span>
            <span class="chip__x" @click="search = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>
          <button class="chip--clear" @click="clearTxFilters">
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <!-- Tx summary mini-row -->
      <div v-if="txSummary" class="toolbar" style="padding-top: 0;">
        <div class="cell-muted" style="font-size: 13px;">
          {{ t('item_drill_summary') }}:
          <b class="mono">{{ filteredTransactions.length }}</b> / <b class="mono">{{ transactions.length }}</b>
        </div>
      </div>

      <DataTable
        :columns="txColumns"
        :rows="filteredTransactions"
        row-key="id"
        :loading="loadingTx"
        :per-page-options="[10, 25, 50, 100]"
        :empty-title="t('item_drill_no_history')"
        :empty-sub="t('Adjust the period or filters to see results.')"
        empty-icon="inbox"
      >
        <template #cell.created_at="{ row }">
          <span class="mono cell-muted nowrap">{{ formatDate(row.created_at) }}</span>
        </template>
        <template #cell.transaction_number="{ row }">
          <span class="mono">{{ row.transaction_number ?? '—' }}</span>
        </template>
        <template #cell.movement_type="{ row }">
          <Badge :tone="movementTone(row.movement_type)">
            {{ row.movement_type ? t(`stock_movement_${row.movement_type}`) : '—' }}
          </Badge>
        </template>
        <template #cell.location_name="{ row }">
          <span>{{ row.location_name ?? row.location?.name ?? '—' }}</span>
        </template>
        <template #cell.quantity="{ row }">
          <span class="mono cell-strong">
            {{ formatQty(row.quantity ?? row.quantity_change) }}
            <span v-if="unitShort" class="cell-muted" style="margin-left: 4px;">{{ unitShort }}</span>
          </span>
        </template>
        <template #cell.quantity_before="{ row }">
          <span class="mono cell-muted">{{ formatQty(row.quantity_before) }}</span>
        </template>
        <template #cell.quantity_after="{ row }">
          <span class="mono">{{ formatQty(row.quantity_after) }}</span>
        </template>
        <template #cell.unit_cost="{ row }">
          <span class="mono">{{ formatMoney(row.unit_cost) }}</span>
        </template>
        <template #cell.total_cost="{ row }">
          <span class="mono cell-strong">{{ formatMoney(row.total_cost) }}</span>
        </template>
        <template #cell.notes="{ row }">
          <span class="cell-muted">{{ row.notes || '—' }}</span>
        </template>
      </DataTable>
    </div>

    <!-- Edit modal -->
    <Modal
      :open="editOpen"
      :title="t('Edit')"
      :width="720"
      @close="editOpen = false"
      @update:open="(v: boolean) => editOpen = v"
    >
      <div class="form-grid">
        <Field :label="t('Name')" :error="editErrors.name">
          <Input v-model="editForm.name" />
        </Field>
        <Field :label="t('SKU')">
          <Input v-model="editForm.sku" />
        </Field>
        <Field :label="t('Barcode')">
          <Input v-model="editForm.barcode" />
        </Field>
        <Field :label="t('Type')" :error="editErrors.item_type">
          <Select
            v-model="editForm.item_type"
            :options="itemTypeOptions"
            :placeholder="t('Type')"
          />
        </Field>
        <Field :label="t('Category')">
          <Select
            v-model="editForm.category_id"
            :options="categoryOptions"
            :placeholder="t('Category')"
          />
        </Field>
        <Field :label="t('item_drill_base_unit')" :error="editErrors.base_unit_id">
          <Select
            v-model="editForm.base_unit_id"
            :options="unitOptions"
            :placeholder="t('item_drill_base_unit')"
          />
        </Field>
        <Field :label="t('item_drill_min_stock')">
          <Input v-model="editForm.min_stock_level" type="number" step="any" />
        </Field>
        <Field :label="t('item_drill_max_stock')">
          <Input v-model="editForm.max_stock_level" type="number" step="any" />
        </Field>
        <Field :label="t('item_drill_reorder_point')">
          <Input v-model="editForm.reorder_point" type="number" step="any" />
        </Field>
        <Field :label="t('Cost Price')">
          <Input v-model="editForm.cost_price" type="number" step="any" />
        </Field>
        <Field :label="t('Default expiry (days)')">
          <Input v-model="editForm.default_expiry_days" type="number" step="1" />
        </Field>
        <Field :label="t('item_drill_storage')" class="span-2">
          <textarea
            v-model="editForm.storage_conditions"
            class="control"
            rows="2"
            style="resize: vertical; min-height: 60px; padding: 8px 12px;"
          />
        </Field>

        <label class="row" style="gap: 10px;">
          <Switch v-model="editForm.is_purchasable" />
          <span>{{ t('Purchasable') }}</span>
        </label>
        <label class="row" style="gap: 10px;">
          <Switch v-model="editForm.is_sellable" />
          <span>{{ t('Sellable') }}</span>
        </label>
        <label class="row" style="gap: 10px;">
          <Switch v-model="editForm.is_producible" />
          <span>{{ t('Producible') }}</span>
        </label>
        <label class="row" style="gap: 10px;">
          <Switch v-model="editForm.track_batches" />
          <span>{{ t('Track batches') }}</span>
        </label>
        <label class="row" style="gap: 10px;">
          <Switch v-model="editForm.track_expiry" />
          <span>{{ t('Track expiry') }}</span>
        </label>
      </div>

      <template #footer>
        <Button variant="ghost" @click="editOpen = false">
          {{ t('Cancel') }}
        </Button>
        <Button variant="primary" :loading="saving" @click="saveEdit">
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Delete (deactivate) confirm modal -->
    <Modal
      :open="deleteOpen"
      :title="t('item_drill_deactivate_confirm')"
      :width="480"
      @close="deleteOpen = false"
      @update:open="(v: boolean) => deleteOpen = v"
    >
      <p style="margin: 0 0 var(--sp-3); color: var(--text-secondary);">
        <strong style="color: var(--text);">{{ item?.name }}</strong>
      </p>
      <div v-if="!canDeactivate" style="padding: var(--sp-3); background: rgb(var(--v-theme-error-weak)); color: rgb(var(--v-theme-error-strong)); border-radius: var(--r-xs); font-size: var(--fs-sm);">
        {{ t('item_drill_deactivate_blocked') }}
      </div>

      <template #footer>
        <Button variant="ghost" @click="deleteOpen = false">
          {{ t('Cancel') }}
        </Button>
        <Button variant="danger" :loading="deleting" :disabled="!canDeactivate" @click="confirmDelete">
          {{ t('Delete') }}
        </Button>
      </template>
    </Modal>

    <!-- Adjust stock modal -->
    <Modal
      :open="adjustOpen"
      :title="t('item_drill_adjust')"
      :width="520"
      @close="adjustOpen = false"
      @update:open="(v: boolean) => adjustOpen = v"
    >
      <div class="form-grid">
        <Field :label="t('Location')" :error="adjErrors.location_id" class="span-2">
          <Select
            v-model="adjForm.location_id"
            :options="locationOptions"
            :placeholder="t('Location')"
          />
        </Field>
        <Field :label="t('Movement')" :error="adjErrors.movement_type">
          <Select
            v-model="adjForm.movement_type"
            :options="adjustTypeOptions"
            :placeholder="t('Movement')"
          />
        </Field>
        <Field :label="t('Qty')" :error="adjErrors.quantity">
          <Input v-model="adjForm.quantity" type="number" step="any" />
        </Field>
        <Field :label="t('Notes')" class="span-2">
          <Input v-model="adjForm.notes" />
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" @click="adjustOpen = false">
          {{ t('Cancel') }}
        </Button>
        <Button variant="primary" :loading="adjusting" @click="submitAdjust">
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Reserve stock modal -->
    <Modal
      :open="reserveOpen"
      :title="t('item_drill_reserve')"
      :width="520"
      @close="reserveOpen = false"
      @update:open="(v: boolean) => reserveOpen = v"
    >
      <div class="form-grid">
        <Field :label="t('Location')" :error="adjErrors.location_id" class="span-2">
          <Select
            v-model="adjForm.location_id"
            :options="locationOptions"
            :placeholder="t('Location')"
          />
        </Field>
        <Field :label="t('Qty')" :error="adjErrors.quantity">
          <Input v-model="adjForm.quantity" type="number" step="any" />
        </Field>
        <Field :label="t('Notes')" class="span-2">
          <Input v-model="adjForm.notes" />
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" @click="reserveOpen = false">
          {{ t('Cancel') }}
        </Button>
        <Button variant="primary" :loading="reserving" @click="submitReserve">
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Release reservation modal -->
    <Modal
      :open="releaseOpen"
      :title="t('item_drill_release')"
      :width="520"
      @close="releaseOpen = false"
      @update:open="(v: boolean) => releaseOpen = v"
    >
      <div class="form-grid">
        <Field :label="t('Location')" :error="adjErrors.location_id" class="span-2">
          <Select
            v-model="adjForm.location_id"
            :options="locationOptions"
            :placeholder="t('Location')"
          />
        </Field>
        <Field :label="t('Qty')" :error="adjErrors.quantity">
          <Input v-model="adjForm.quantity" type="number" step="any" />
        </Field>
        <Field :label="t('Notes')" class="span-2">
          <Input v-model="adjForm.notes" />
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" @click="releaseOpen = false">
          {{ t('Cancel') }}
        </Button>
        <Button variant="primary" :loading="releasing" @click="submitRelease">
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

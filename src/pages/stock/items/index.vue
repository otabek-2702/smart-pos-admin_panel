<script setup lang="ts">
/* ============================================================
   Stock Items — refactored to design primitives
   Preserves all axios calls, filters, refs, computeds.
   Replaces Vuetify (VDataTableServer/VDialog/VBtn/VTextField/VSelect)
   with the design DataTable + Modal + Input + Select + IconAction.
   ============================================================ */
import ItemFormDialog from './ItemFormDialog.vue'
import { stockApi as axios } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import Select from '@/components/design/Select.vue'
import Switch from '@/components/design/Switch.vue'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const barcodeQuery = ref('')
const barcodeLoading = ref(false)
const typeFilter = ref<string | undefined>(undefined)
const categoryFilter = ref<number | undefined>(undefined)
const lowStockOnly = ref(false)
const statusFilter = ref<string>('all')

// Categories for filter dropdown
const categoriesList = ref<any[]>([])

// Dialogs
const dialog = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const deleteDialog = ref(false)
const deleting = ref(false)
const selectedItem = ref<any>(null)

// Units for dropdown
const unitsList = ref<any[]>([])

// Map item_type → Badge tone (design system tone)
const typeTone: Record<string, 'success' | 'warning' | 'primary' | 'neutral'> = {
  RAW: 'success',
  SEMI: 'warning',
  FINISHED: 'primary',
  PACKAGING: 'neutral',
}

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency } = useFormatters()

// Columns for the design DataTable
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'sku', label: t('SKU') },
  { key: 'name', label: t('Name') },
  { key: 'item_type', label: t('Type') },
  { key: 'category', label: t('Category') },
  { key: 'base_unit', label: t('Unit') },
  { key: 'cost_price', label: t('Cost Price'), align: 'right' },
  { key: 'is_active', label: t('Status') },
])

async function loadItems() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (typeFilter.value)
      params.item_type = typeFilter.value
    if (categoryFilter.value)
      params.category_id = categoryFilter.value
    if (lowStockOnly.value)
      params.low_stock = 'true'
    if (statusFilter.value === 'active')
      params.active_only = 'true'
    else if (statusFilter.value === 'inactive')
      params.active_only = 'false'

    const res = await axios.get('/items/', { params })
    const d = res.data?.data ?? res.data

    items.value = d?.items ?? []
    total.value = d.pagination?.total_items ?? d.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load items'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [catRes, unitRes] = await Promise.all([
      axios.get('/categories/', { params: { per_page: 200 } }),
      axios.get('/units/', { params: { per_page: 200 } }),
    ])

    const catD = catRes.data?.data ?? catRes.data
    const unitD = unitRes.data?.data ?? unitRes.data

    categoriesList.value = catD?.categories ?? []
    unitsList.value = unitD?.units ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadItems(); loadMeta() })
watch([page, itemsPerPage], loadItems)
watch([search, typeFilter, categoryFilter, lowStockOnly, statusFilter], () => { page.value = 1; loadItems() })

const categoryOptions = computed(() => categoriesList.value.map(c => ({ title: c.name, value: c.id })))
const unitOptions = computed(() => unitsList.value.map(u => ({ title: `${u.name} (${u.short_name})`, value: u.id })))

// Design Select needs { value, label } objects (strings)
const categorySelectOptions = computed(() => categoriesList.value.map(c => ({ value: String(c.id), label: c.name })))
const typeSelectOptions = computed(() => ['RAW', 'SEMI', 'FINISHED', 'PACKAGING'].map(v => ({ value: v, label: t(`item_type_${v}`) })))
const statusSelectOptions = computed(() => [
  { value: 'all', label: t('All Statuses') },
  { value: 'active', label: t('item_status_active') },
  { value: 'inactive', label: t('item_status_inactive') },
])

function openCreate() {
  dialogMode.value = 'create'
  selectedItem.value = null
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item
  dialog.value = true
}

function confirmDelete(item: any) {
  selectedItem.value = item
  deleteDialog.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await axios.delete(`/items/${selectedItem.value.id}/`)
    notify(t('Item deleted'))
    deleteDialog.value = false
    await loadItems()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting item'), 'error')
  }
  finally {
    deleting.value = false
  }
}

async function lookupBarcode() {
  const code = (barcodeQuery.value || '').trim()
  if (!code)
    return
  barcodeLoading.value = true
  try {
    const res = await axios.get(`/items/barcode/${encodeURIComponent(code)}/`)
    const d = res.data?.data ?? res.data
    const item = d?.item ?? d
    const id = item?.id
    if (id) {
      notify(t('items_ext_open'))
      router.push({ path: '/stock/items', query: { id: String(id) } })
      barcodeQuery.value = ''
    }
    else {
      notify(t('items_ext_not_found'), 'error')
    }
  }
  catch (e: any) {
    const status = e?.response?.status
    if (status === 404)
      notify(t('items_ext_not_found'), 'error')
    else
      notify(e?.response?.data?.message ?? t('items_ext_not_found'), 'error')
  }
  finally {
    barcodeLoading.value = false
  }
}

async function toggleActive(item: any) {
  try {
    await axios.patch(`/items/${item.id}/`, { is_active: !item.is_active })
    notify(item.is_active ? t('Item deactivated') : t('Item activated'))
    await loadItems()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error updating item'), 'error')
  }
}

// DataTable pagination passthrough (controlled by server)
const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))
</script>

<template>
  <div>
    <div class="card">
      <!-- Toolbar -->
      <div class="toolbar items-toolbar">
        <div class="grow tb-search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search items...')"
            :aria-label="t('Search items...')"
          />
        </div>

        <div class="tb-filter tb-filter--md">
          <Input
            v-model="barcodeQuery"
            icon="barcode"
            :placeholder="t('items_ext_barcode_placeholder')"
            :aria-label="t('items_ext_barcode_tab')"
            :disabled="barcodeLoading"
            @keydown.enter.prevent="lookupBarcode"
          />
        </div>

        <div class="tb-filter tb-filter--sm">
          <Select
            :model-value="typeFilter ?? ''"
            :placeholder="t('All Types')"
            :options="typeSelectOptions"
            @update:model-value="(v: string) => typeFilter = v ? v : undefined"
          />
        </div>

        <div class="tb-filter tb-filter--sm">
          <Select
            :model-value="statusFilter"
            :placeholder="t('All Statuses')"
            :options="statusSelectOptions"
            @update:model-value="(v: string) => statusFilter = v || 'all'"
          />
        </div>

        <div class="tb-filter tb-filter--md">
          <Select
            :model-value="categoryFilter !== undefined ? String(categoryFilter) : ''"
            :placeholder="t('All Categories')"
            :options="categorySelectOptions"
            @update:model-value="(v: string) => categoryFilter = v ? Number(v) : undefined"
          />
        </div>

        <label class="row tb-switch" style="gap:8px; cursor:pointer;">
          <Switch v-model="lowStockOnly" />
          <span style="font-size:13px;">{{ t('Low stock only') }}</span>
        </label>

        <div class="tb-spacer" />

        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('Add Item') }}
        </Button>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="columns"
        :rows="items"
        row-key="id"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
        :empty-title="t('items_no_results_title')"
        :empty-sub="t('items_no_results_sub')"
        empty-icon="inbox"
      >
        <template #cell.sku="{ row }">
          <span class="cell-strong mono">{{ row.sku ?? '—' }}</span>
        </template>

        <template #cell.item_type="{ row }">
          <Badge :tone="typeTone[row.item_type] ?? 'neutral'">
            {{ row.item_type ? t(`item_type_${row.item_type}`) : (row.item_type_display ?? '—') }}
          </Badge>
        </template>

        <template #cell.category="{ row }">
          <span class="cell-muted">{{ row.category?.name ?? '—' }}</span>
        </template>

        <template #cell.base_unit="{ row }">
          <span class="cell-muted">{{ row.base_unit?.short_name ?? row.base_unit?.name ?? '—' }}</span>
        </template>

        <template #cell.cost_price="{ row }">
          <span class="mono cell-strong">{{ formatCurrency(row.cost_price ?? 0) }}</span>
        </template>

        <template #cell.is_active="{ row }">
          <Badge :tone="row.is_active ? 'success' : 'neutral'" dot>
            {{ row.is_active ? t('Active') : t('Inactive') }}
          </Badge>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            icon="edit"
            :title="t('Edit')"
            @click="openEdit(row)"
          />
          <IconAction
            :icon="row.is_active ? 'pause' : 'play'"
            :tone="row.is_active ? 'warning' : 'success'"
            :title="row.is_active ? t('Deactivate') : t('Activate')"
            @click="toggleActive(row)"
          />
          <IconAction
            icon="trash"
            tone="danger"
            :title="t('Delete')"
            @click="confirmDelete(row)"
          />
        </template>
      </DataTable>
    </div>

    <!-- Create / Edit Dialog (kept as ItemFormDialog) -->
    <ItemFormDialog
      v-model="dialog"
      :mode="dialogMode"
      :item="selectedItem"
      :category-options="categoryOptions"
      :unit-options="unitOptions"
      @saved="loadItems"
    />

    <!-- Delete confirmation -->
    <Modal
      :open="deleteDialog"
      :width="440"
      :title="t('Delete Item')"
      :subtitle="t('This action cannot be undone')"
      @close="deleteDialog = false"
    >
      <div class="row" style="gap:14px;align-items:flex-start;">
        <div
          class="kpi__icon t-error"
          style="width:44px;height:44px;flex:0 0 44px;"
        >
          <DesignIcon name="alert" :size="22" />
        </div>
        <div>
          <p style="margin:0;font-weight:600;">
            {{ selectedItem?.name }}
          </p>
          <p class="muted" style="margin:6px 0 0;font-size:14px;">
            {{ t('items_confirm_delete_body') }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="deleting"
          @click="deleteDialog = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          :loading="deleting"
          :disabled="deleting"
          @click="doDelete"
        >
          {{ t('Delete') }}
        </Button>
      </template>
    </Modal>

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
/* --- Responsive toolbar --- */
.items-toolbar {
  flex-wrap: wrap;
  row-gap: 8px;
}

.tb-search {
  max-width: 280px;
  min-width: 200px;
  flex: 1 1 200px;
}

.tb-filter {
  flex: 0 1 auto;
}

.tb-filter--md { width: 200px; }
.tb-filter--sm { width: 170px; }

.tb-switch {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.tb-spacer {
  margin-left: auto;
}

/* Tablet collapse */
@media (max-width: 1100px) {
  .tb-spacer {
    margin-left: 0;
    flex-basis: 100%;
    height: 0;
  }
  .tb-filter--md,
  .tb-filter--sm {
    width: auto;
    flex: 1 1 160px;
    min-width: 160px;
  }
  .tb-search {
    max-width: none;
    flex: 1 1 100%;
  }
}

/* Mobile collapse — every filter stretches full width */
@media (max-width: 900px) {
  .items-toolbar {
    gap: 10px;
  }
  .tb-filter,
  .tb-search,
  .tb-switch {
    flex: 1 1 100% !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
  }
}

.row {
  display: flex;
  align-items: center;
}
</style>

<route lang="yaml">
name: stock-items
meta:
  action: manage
  subject: all
</route>

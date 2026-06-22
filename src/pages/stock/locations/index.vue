<script setup lang="ts">
/* ============================================================
   ALPHA POS — Stock Locations (extended)
   - Design-system primitives only (no Vuetify on the page itself)
   - Row "Set as default" action → POST /locations/:id/set-default/
   - Row click → opens "Stock at Location" modal (GET /levels/location/:id/)
   - KPIs (total / active / production / default), tree/list toggle,
     filters: type, parent, production_only, include_inactive, search
   ============================================================ */
import { stockApi as axios } from '@/plugins/axios'
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
import StateFill from '@/components/design/StateFill.vue'
import Switch from '@/components/design/Switch.vue'

const { t } = useI18n({ useScope: 'global' })
const { notify } = useNotify()
const { formatDate } = useFormatters()

// ---- state ----
// NOTE: BE view (stock/views/location_views.py) only reads `type`, `parent_id`, `tree` from
// request.GET. It IGNORES page/per_page/include_stats/include_inactive/production_only/search.
// → All filtering/pagination/search is done CLIENT-SIDE below.
const allLocations = ref<any[]>([])
const loading = ref(false)

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const typeFilter = ref<string | undefined>(undefined)
const parentFilter = ref<number | undefined>(undefined)
const productionOnly = ref(false)
const includeInactive = ref(false)
const treeView = ref(false)

// Modals
const dialog = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)

const deleteDialog = ref(false)
const deleting = ref(false)

const setDefaultDialog = ref(false)
const settingDefault = ref(false)

const stockModalOpen = ref(false)
const stockLoading = ref(false)
const stockLevels = ref<any[]>([])
const stockForLocation = ref<any>(null)

const selectedItem = ref<any>(null)

const locationTypes = ['WAREHOUSE', 'KITCHEN', 'BAR', 'STORAGE', 'PREP']

const typeTone: Record<string, 'primary' | 'warning' | 'info' | 'neutral' | 'success'> = {
  WAREHOUSE: 'primary',
  KITCHEN: 'warning',
  BAR: 'info',
  STORAGE: 'neutral',
  PREP: 'success',
}

const form = ref({
  name: '',
  type: 'WAREHOUSE',
  parent_id: null as number | null,
  is_default: false,
  is_production_area: false,
  sort_order: 0,
  is_active: true,
})

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
}, 350)

// ---- load ----
// BE only honors `type`, `parent_id`, `tree`. Everything else is filtered client-side.
async function loadLocations() {
  loading.value = true
  try {
    const params: any = {}
    if (typeFilter.value)
      params.type = typeFilter.value
    if (parentFilter.value)
      params.parent_id = parentFilter.value
    if (treeView.value)
      params.tree = 'true'

    const res = await axios.get('/locations/', { params })
    const d = res.data?.data ?? res.data

    allLocations.value = d?.locations ?? []
  }
  catch {
    notify(t('msg_no_locations'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadLocations)
// Only re-fetch on filters BE actually honors (type/parent/tree).
watch([typeFilter, parentFilter, treeView], () => {
  page.value = 1
  loadLocations()
})
// Client-side filters: just reset page; computed `locations` reacts.
watch([productionOnly, includeInactive], () => {
  page.value = 1
})
watch(search, () => debouncedSearch())

// ---- options / lookups ----
const typeOptions = computed(() =>
  locationTypes.map(v => ({ value: v, label: t(`location_type_${v}`) })),
)
const parentOptions = computed(() =>
  allLocations.value
    .filter(l => selectedItem.value ? l.id !== selectedItem.value.id : true)
    .map(l => ({
      value: String(l.id),
      label: `${l.name} (${t(`location_type_${l.type}`)})`,
    })),
)
const filterParentOptions = computed(() =>
  allLocations.value.map(l => ({ value: String(l.id), label: l.name })),
)

// ---- client-side filtering + pagination ----
const filteredLocations = computed(() => {
  const q = search.value.trim().toLowerCase()
  return allLocations.value.filter((l) => {
    if (!includeInactive.value && !l.is_active) return false
    if (productionOnly.value && !l.is_production_area) return false
    if (q) {
      const hay = `${l.name ?? ''} ${l.type ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})
const total = computed(() => filteredLocations.value.length)
const locations = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  return filteredLocations.value.slice(start, start + itemsPerPage.value)
})

// ---- KPI stats (over the full set, not just current page) ----
const kpiTotal = computed(() => allLocations.value.length)
const kpiActive = computed(() => allLocations.value.filter(l => l.is_active).length)
const kpiProduction = computed(() => allLocations.value.filter(l => l.is_production_area).length)
const kpiDefault = computed(() => {
  const d = allLocations.value.find(l => l.is_default)
  return d?.name ?? '—'
})

// ---- modals ----
function openCreate() {
  dialogMode.value = 'create'
  selectedItem.value = null
  form.value = {
    name: '',
    type: 'WAREHOUSE',
    parent_id: null,
    is_default: false,
    is_production_area: false,
    sort_order: 0,
    is_active: true,
  }
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item
  form.value = {
    name: item.name ?? '',
    type: item.type ?? 'WAREHOUSE',
    parent_id: item.parent_id ?? null,
    is_default: !!item.is_default,
    is_production_area: !!item.is_production_area,
    sort_order: item.sort_order ?? 0,
    is_active: item.is_active ?? true,
  }
  dialog.value = true
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    // BE update whitelist: name, type, is_default, is_production_area, sort_order.
    // `is_active` is dropped — must use POST /locations/:id/set-default/ or DELETE for deactivate.
    const payload: any = { ...form.value }
    if (!payload.parent_id)
      delete payload.parent_id
    const desiredActive = !!payload.is_active
    delete payload.is_active

    if (dialogMode.value === 'create') {
      await axios.post('/locations/', payload)
    }
    else {
      // BE detail view accepts GET/PUT/DELETE — NOT PATCH.
      await axios.put(`/locations/${selectedItem.value.id}/`, payload)

      // Handle is_active separately via dedicated endpoints.
      const wasActive = !!selectedItem.value?.is_active
      if (wasActive !== desiredActive) {
        if (desiredActive)
          await axios.post(`/locations/${selectedItem.value.id}/activate/`)
        else
          await axios.delete(`/locations/${selectedItem.value.id}/`)
      }
    }

    notify(dialogMode.value === 'create' ? t('msg_location_created') : t('msg_location_updated'))
    dialog.value = false
    await loadLocations()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('msg_no_locations'), 'error')
  }
  finally {
    saving.value = false
  }
}

// ---- delete ----
function confirmDelete(item: any) {
  selectedItem.value = item
  deleteDialog.value = true
}
async function doDelete() {
  if (deleting.value) return
  deleting.value = true
  try {
    await axios.delete(`/locations/${selectedItem.value.id}/`)
    notify(t('msg_location_deactivated'))
    deleteDialog.value = false
    await loadLocations()
  }
  catch (e: any) {
    const msg = e?.response?.data?.message
    notify(msg ?? t('err_has_stock'), 'error')
  }
  finally {
    deleting.value = false
  }
}

// ---- set as default ----
function confirmSetDefault(item: any) {
  selectedItem.value = item
  setDefaultDialog.value = true
}
async function doSetDefault() {
  if (settingDefault.value || !selectedItem.value) return
  settingDefault.value = true
  try {
    await axios.post(`/locations/${selectedItem.value.id}/set-default/`)
    notify(t('msg_default_set'))
    setDefaultDialog.value = false
    await loadLocations()
  }
  catch (e: any) {
    const msg = e?.response?.data?.message
    notify(msg ?? t('err_cannot_set_inactive_default'), 'error')
  }
  finally {
    settingDefault.value = false
  }
}

// ---- view stock at location ----
async function openStockModal(item: any) {
  stockForLocation.value = item
  stockModalOpen.value = true
  stockLoading.value = true
  stockLevels.value = []
  try {
    const res = await axios.get(`/levels/location/${item.id}/`)
    const d = res.data?.data ?? res.data
    stockLevels.value = d?.levels ?? d?.results ?? []
  }
  catch {
    stockLevels.value = []
  }
  finally {
    stockLoading.value = false
  }
}

function fmtDecimal(v: any) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/ | /g, ' ')
}

function fmtNumber(v: any) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('fr-FR').replace(/ | /g, ' ')
}

// ---- filters / chips ----
const hasFilters = computed(() =>
  !!(search.value || typeFilter.value || parentFilter.value
    || productionOnly.value || includeInactive.value),
)
function clearAll() {
  search.value = ''
  typeFilter.value = undefined
  parentFilter.value = undefined
  productionOnly.value = false
  includeInactive.value = false
}

// ---- DataTable columns ----
// NOTE: item_count / total_quantity intentionally omitted: BE view doesn't forward
// include_stats to the service, so `row.stats` is always undefined.
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'name', label: t('col_name') },
  { key: 'type', label: t('col_type') },
  { key: 'parent', label: t('col_parent') },
  { key: 'is_default', label: t('col_is_default') },
  { key: 'is_production_area', label: t('col_is_production_area') },
  { key: 'is_active', label: t('col_is_active') },
  { key: 'sort_order', label: t('col_sort_order'), align: 'right' },
  { key: 'created_at', label: t('col_created_at'), align: 'right' },
])

const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

function parentNameOf(row: any) {
  // BE serializer only emits `parent_id` (no nested `parent` object).
  // Look up against the full unpaginated set so it resolves even when parent is off the current page.
  if (!row.parent_id) return '—'
  return allLocations.value.find(l => l.id === row.parent_id)?.name ?? '—'
}
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="t('locations_ext_title')"
      :subtitle="t('locations_ext_subtitle')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('btn_add_location') }}
        </Button>
      </template>
    </PageHeader>

    <!-- KPI strip -->
    <div class="grid cols-4 kpi-grid" style="margin-bottom: var(--sp-5);">
      <Kpi
        :data="{
          label: t('kpi_total_locations'),
          icon: 'building',
          tone: 'primary',
          value: loading && locations.length === 0 ? null : kpiTotal,
        }"
      />
      <Kpi
        :data="{
          label: t('kpi_active_locations'),
          icon: 'checkcircle',
          tone: 'success',
          value: loading && locations.length === 0 ? null : kpiActive,
        }"
      />
      <Kpi
        :data="{
          label: t('kpi_production_areas'),
          icon: 'package',
          tone: 'warning',
          value: loading && locations.length === 0 ? null : kpiProduction,
        }"
      />
      <Kpi
        :data="{
          label: t('kpi_default_location'),
          icon: 'star',
          tone: 'info',
          value: loading && locations.length === 0 ? null : kpiDefault,
        }"
      />
    </div>

    <!-- Main table card -->
    <div class="card">
      <!-- Toolbar -->
      <div class="toolbar toolbar--wrap">
        <div class="grow toolbar__search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('filter_search')"
            :aria-label="t('filter_search')"
          />
        </div>

        <div class="toolbar__type">
          <Select
            :model-value="typeFilter ?? ''"
            :placeholder="t('filter_type')"
            :options="typeOptions"
            @update:model-value="(v: string) => typeFilter = v ? v : undefined"
          />
        </div>

        <div class="toolbar__parent">
          <Select
            :model-value="parentFilter != null ? String(parentFilter) : ''"
            :placeholder="t('filter_parent')"
            :options="filterParentOptions"
            @update:model-value="(v: string) => parentFilter = v ? Number(v) : undefined"
          />
        </div>

        <label class="row" style="gap: 8px; cursor: pointer;">
          <Switch v-model="productionOnly" />
          <span style="font-size: 13px;">{{ t('filter_production_only') }}</span>
        </label>

        <label class="row" style="gap: 8px; cursor: pointer;">
          <Switch v-model="includeInactive" />
          <span style="font-size: 13px;">{{ t('filter_include_inactive') }}</span>
        </label>

        <div class="row toolbar__view" style="gap: 8px; margin-left: auto;">
          <Button
            :variant="treeView ? 'primary' : 'secondary'"
            size="sm"
            icon="layout"
            @click="treeView = !treeView"
          >
            {{ treeView ? t('btn_tree_view') : t('btn_list_view') }}
          </Button>
        </div>
      </div>

      <!-- Active filter chips -->
      <div v-if="hasFilters" class="toolbar" style="padding-top: 0;">
        <div class="chips">
          <span class="tertiary" style="font-size: 13px; margin-right: 2px;">{{ t('Filters') }}:</span>

          <span v-if="search" class="chip">
            <span>{{ t('filter_search') }}: <b>{{ search }}</b></span>
            <span class="chip__x" @click="search = ''"><DesignIcon name="close" :size="13" /></span>
          </span>

          <span v-if="typeFilter" class="chip">
            <span>{{ t('col_type') }}: <b>{{ t(`location_type_${typeFilter}`) }}</b></span>
            <span class="chip__x" @click="typeFilter = undefined"><DesignIcon name="close" :size="13" /></span>
          </span>

          <span v-if="parentFilter" class="chip">
            <span>{{ t('col_parent') }}: <b>{{ filterParentOptions.find(o => o.value === String(parentFilter))?.label }}</b></span>
            <span class="chip__x" @click="parentFilter = undefined"><DesignIcon name="close" :size="13" /></span>
          </span>

          <span v-if="productionOnly" class="chip">
            <span>{{ t('filter_production_only') }}</span>
            <span class="chip__x" @click="productionOnly = false"><DesignIcon name="close" :size="13" /></span>
          </span>

          <span v-if="includeInactive" class="chip">
            <span>{{ t('filter_include_inactive') }}</span>
            <span class="chip__x" @click="includeInactive = false"><DesignIcon name="close" :size="13" /></span>
          </span>

          <button class="chip--clear" @click="clearAll">
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- DataTable -->
      <DataTable
        :columns="columns"
        :rows="locations"
        row-key="id"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
        @row-click="(r: any) => openStockModal(r)"
      >
        <!-- Name -->
        <template #cell.name="{ row }">
          <div class="row" style="gap: 8px;">
            <DesignIcon
              v-if="row.is_default"
              name="star"
              :size="16"
              style="color: rgb(var(--v-theme-warning-strong));"
            />
            <span class="cell-strong">{{ row.name }}</span>
          </div>
        </template>

        <!-- Type -->
        <template #cell.type="{ row }">
          <Badge :tone="(typeTone[row.type] ?? 'neutral') as any">
            {{ row.type ? t(`location_type_${row.type}`) : '—' }}
          </Badge>
        </template>

        <!-- Parent -->
        <template #cell.parent="{ row }">
          <span class="cell-muted">{{ parentNameOf(row) }}</span>
        </template>

        <!-- Is default -->
        <template #cell.is_default="{ row }">
          <Badge v-if="row.is_default" tone="primary">
            {{ t('badge_default') }}
          </Badge>
          <span v-else class="cell-muted">—</span>
        </template>

        <!-- Production area -->
        <template #cell.is_production_area="{ row }">
          <Badge v-if="row.is_production_area" tone="warning">
            {{ t('badge_production') }}
          </Badge>
          <span v-else class="cell-muted">—</span>
        </template>

        <!-- Active status -->
        <template #cell.is_active="{ row }">
          <Badge :tone="row.is_active ? 'success' : 'neutral'" dot>
            {{ row.is_active ? t('status_active') : t('status_inactive') }}
          </Badge>
        </template>

        <!-- Sort order -->
        <template #cell.sort_order="{ row }">
          <span class="mono cell-muted">{{ row.sort_order ?? 0 }}</span>
        </template>

        <!-- Created -->
        <template #cell.created_at="{ row }">
          <span class="mono cell-muted nowrap">{{ row.created_at ? formatDate(row.created_at) : '—' }}</span>
        </template>

        <!-- Inline row actions -->
        <template #row-actions="{ row }">
          <IconAction
            icon="package"
            tone="primary"
            :title="t('action_view_stock')"
            @click.stop="openStockModal(row)"
          />
          <IconAction
            v-if="!row.is_default && row.is_active"
            icon="star"
            tone="warning"
            :title="t('action_set_default')"
            @click.stop="confirmSetDefault(row)"
          />
          <IconAction
            icon="edit"
            :title="t('action_edit')"
            @click.stop="openEdit(row)"
          />
          <IconAction
            v-if="row.is_active"
            icon="trash"
            tone="danger"
            :title="t('action_delete')"
            @click.stop="confirmDelete(row)"
          />
        </template>

        <!-- Empty state -->
        <template #empty>
          <StateFill
            icon="building"
            :title="t('msg_no_locations')"
            :sub="t('locations_ext_subtitle')"
          >
            <div v-if="hasFilters" style="margin-top: 12px;">
              <Button variant="secondary" @click="clearAll">
                {{ t('Clear filters') }}
              </Button>
            </div>
          </StateFill>
        </template>
      </DataTable>
    </div>

    <!-- Create / Edit modal -->
    <Modal
      :open="dialog"
      :width="540"
      :title="dialogMode === 'create' ? t('modal_create_title') : t('modal_edit_title')"
      @close="dialog = false"
    >
      <div class="grid cols-2 modal-grid" style="gap: var(--sp-4);">
        <div class="modal-grid__full" style="grid-column: span 2;">
          <Field :label="t('field_name')">
            <Input v-model="form.name" />
          </Field>
        </div>

        <Field :label="t('field_type')">
          <Select
            v-model="form.type"
            :options="typeOptions"
          />
        </Field>

        <Field :label="t('field_parent_id')" :hint="t('field_parent_id_hint')">
          <Select
            :model-value="form.parent_id != null ? String(form.parent_id) : ''"
            :placeholder="t('field_parent_id_hint')"
            :options="parentOptions"
            @update:model-value="(v: string) => form.parent_id = v ? Number(v) : null"
          />
        </Field>

        <Field :label="t('field_sort_order')">
          <Input
            v-model="form.sort_order"
            type="number"
            min="0"
          />
        </Field>

        <div />

        <Field :label="t('field_is_default')" :hint="t('field_is_default_hint')">
          <Switch v-model="form.is_default" />
        </Field>

        <Field :label="t('field_is_production_area')" :hint="t('field_is_production_area_hint')">
          <Switch v-model="form.is_production_area" />
        </Field>

        <Field v-if="dialogMode === 'edit'" :label="t('col_is_active')">
          <Switch v-model="form.is_active" />
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="saving" @click="dialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          :disabled="!form.name || saving"
          @click="save"
        >
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Confirm delete (deactivate) -->
    <Modal
      :open="deleteDialog"
      :width="440"
      :title="t('confirm_delete_title')"
      :subtitle="t('confirm_delete_msg')"
      @close="deleteDialog = false"
    >
      <div class="row" style="gap: 14px; align-items: flex-start;">
        <div
          class="kpi__icon t-error"
          style="width: 44px; height: 44px; flex: 0 0 44px;"
        >
          <DesignIcon name="alert" :size="22" />
        </div>
        <div>
          <p style="margin: 0; font-weight: 600;">
            {{ selectedItem?.name }}
          </p>
          <p class="muted" style="margin: 6px 0 0; font-size: 14px;">
            {{ t('confirm_delete_msg') }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="deleting" @click="deleteDialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          :loading="deleting"
          :disabled="deleting"
          @click="doDelete"
        >
          {{ t('action_delete') }}
        </Button>
      </template>
    </Modal>

    <!-- Confirm set default -->
    <Modal
      :open="setDefaultDialog"
      :width="440"
      :title="t('confirm_set_default_title')"
      :subtitle="t('confirm_set_default_msg')"
      @close="setDefaultDialog = false"
    >
      <div class="row" style="gap: 14px; align-items: flex-start;">
        <div
          class="kpi__icon t-warning"
          style="width: 44px; height: 44px; flex: 0 0 44px;"
        >
          <DesignIcon name="star" :size="22" />
        </div>
        <div>
          <p style="margin: 0; font-weight: 600;">
            {{ selectedItem?.name }}
          </p>
          <p class="muted" style="margin: 6px 0 0; font-size: 14px;">
            {{ t('confirm_set_default_msg') }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="settingDefault" @click="setDefaultDialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="star"
          :loading="settingDefault"
          :disabled="settingDefault"
          @click="doSetDefault"
        >
          {{ t('btn_set_default') }}
        </Button>
      </template>
    </Modal>

    <!-- Stock at location modal -->
    <Modal
      :open="stockModalOpen"
      :width="720"
      :title="`${t('modal_stock_title')}: ${stockForLocation?.name ?? ''}`"
      :subtitle="stockForLocation?.type ? t(`location_type_${stockForLocation.type}`) : undefined"
      @close="stockModalOpen = false"
    >
      <div v-if="stockLoading" class="row" style="justify-content: center; padding: 32px 0;">
        <DesignIcon name="refresh" :size="20" />
        <span style="margin-left: 8px;" class="cell-muted">{{ t('Loading') }}…</span>
      </div>

      <div v-else-if="stockLevels.length === 0">
        <StateFill
          icon="inbox"
          :title="t('msg_no_stock_at_location')"
        />
      </div>

      <div v-else class="tablewrap">
        <table
          class="dtable"
          style="background: var(--surface); border-radius: 10px; border: 1px solid var(--border); overflow: hidden;"
        >
          <thead>
            <tr>
              <th>{{ t('stock_col_item') }}</th>
              <th>{{ t('stock_col_sku') }}</th>
              <th class="num">
                {{ t('stock_col_quantity') }}
              </th>
              <th class="num">
                {{ t('stock_col_reserved') }}
              </th>
              <th class="num">
                {{ t('stock_col_available') }}
              </th>
              <th>{{ t('stock_col_unit') }}</th>
              <th class="num">
                {{ t('stock_col_last_movement') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(lv, i) in stockLevels" :key="i">
              <td class="cell-strong">
                {{ lv.stock_item?.name ?? lv.item_name ?? '—' }}
              </td>
              <td class="cell-muted mono">
                {{ lv.stock_item?.sku ?? lv.sku ?? '—' }}
              </td>
              <td class="num mono cell-strong">
                {{ fmtDecimal(lv.quantity) }}
              </td>
              <td class="num mono cell-muted">
                {{ fmtDecimal(lv.reserved_quantity) }}
              </td>
              <td class="num mono cell-strong">
                {{ fmtDecimal(lv.available_quantity ?? (Number(lv.quantity ?? 0) - Number(lv.reserved_quantity ?? 0))) }}
              </td>
              <td class="cell-muted">
                {{ lv.stock_item?.unit ?? lv.unit ?? '—' }}
              </td>
              <td class="num mono cell-muted nowrap">
                {{ lv.last_movement_at ? formatDate(lv.last_movement_at) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <Button variant="ghost" @click="stockModalOpen = false">
          {{ t('Close') }}
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

.toolbar--wrap {
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar__search {
  max-inline-size: 280px;
  min-inline-size: 200px;
}

.toolbar__type {
  inline-size: 180px;
}

.toolbar__parent {
  inline-size: 200px;
}

.tablewrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 1100px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .toolbar__search,
  .toolbar__type,
  .toolbar__parent {
    inline-size: 100%;
    max-inline-size: none;
    min-inline-size: 0;
    flex: 1 1 100%;
  }
  .toolbar__view {
    margin-left: 0 !important;
    inline-size: 100%;
    justify-content: flex-end;
  }
  .modal-grid {
    grid-template-columns: 1fr;
  }
  .modal-grid__full {
    grid-column: span 1 !important;
  }
}

@media (max-width: 420px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<route lang="yaml">
name: stock-locations
meta:
  action: manage
  subject: all
</route>

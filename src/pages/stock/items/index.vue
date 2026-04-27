<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'
import ItemFormDialog from './ItemFormDialog.vue'

const { t } = useI18n({ useScope: 'global' })

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const typeFilter = ref<string | undefined>(undefined)
const categoryFilter = ref<number | undefined>(undefined)

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

const typeColor: Record<string, string> = {
  RAW: 'success',
  SEMI: 'warning',
  FINISHED: 'primary',
  PACKAGING: 'secondary',
}

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency } = useFormatters()

const headers = [
  { title: t('SKU'), key: 'sku', sortable: false },
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Type'), key: 'item_type', sortable: false },
  { title: t('Category'), key: 'category', sortable: false },
  { title: t('Unit'), key: 'base_unit', sortable: false },
  { title: t('Cost Price'), key: 'cost_price', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadItems() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (typeFilter.value) params.item_type = typeFilter.value
    if (categoryFilter.value) params.category_id = categoryFilter.value

    const res = await axios.get('/items/', { params })
    const d = res.data
    items.value = d.items ?? []
    total.value = d.pagination?.total_items ?? items.value.length
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
    categoriesList.value = catRes.data.categories ?? []
    unitsList.value = unitRes.data.units ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadItems(); loadMeta() })
watch([page, itemsPerPage], loadItems)
watch([search, typeFilter, categoryFilter], () => { page.value = 1; loadItems() })

const categoryOptions = computed(() => categoriesList.value.map(c => ({ title: c.name, value: c.id })))
const unitOptions = computed(() => unitsList.value.map(u => ({ title: `${u.name} (${u.short_name})`, value: u.id })))

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
    loadItems()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting item'), 'error')
  }
  finally {
    deleting.value = false
  }
}

async function toggleActive(item: any) {
  try {
    await axios.patch(`/items/${item.id}/`, { is_active: !item.is_active })
    notify(item.is_active ? t('Item deactivated') : t('Item activated'))
    loadItems()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error updating item'), 'error')
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search items...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 220px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="typeFilter"
          :items="['RAW', 'SEMI', 'FINISHED', 'PACKAGING']"
          :placeholder="t('All Types')"
          density="compact"
          style="min-inline-size: 150px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="categoryFilter"
          :items="categoryOptions"
          :placeholder="t('All Categories')"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn prepend-icon="bx-plus" @click="openCreate">{{ t('Add Item') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="items"
        :items-length="total"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="total"
          />
        </template>

        <template v-if="loading && items.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:130px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.sku="{ item }">
          <span class="font-weight-medium text-body-2">{{ item.raw.sku ?? '—' }}</span>
        </template>
        <template #item.item_type="{ item }">
          <VChip :color="typeColor[item.raw.item_type] ?? 'default'" size="small" variant="tonal">{{ item.raw.item_type_display ?? item.raw.item_type }}</VChip>
        </template>
        <template #item.category="{ item }">
          {{ item.raw.category?.name ?? '—' }}
        </template>
        <template #item.base_unit="{ item }">
          {{ item.raw.base_unit?.short_name ?? item.raw.base_unit?.name ?? '—' }}
        </template>
        <template #item.cost_price="{ item }">
          {{ formatCurrency(item.raw.cost_price ?? 0) }}
        </template>
        <template #item.is_active="{ item }">
          <VChip :color="item.raw.is_active ? 'success' : 'default'" size="small" variant="tonal">
            {{ item.raw.is_active ? t('Active') : t('Inactive') }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn icon variant="text" size="small" @click="openEdit(item.raw)">
              <VIcon size="18" icon="bx-edit" />
              <VTooltip activator="parent" location="top">{{ t('Edit') }}</VTooltip>
            </VBtn>
            <VBtn icon variant="text" size="small" :color="item.raw.is_active ? 'warning' : 'success'" @click="toggleActive(item.raw)">
              <VIcon size="18" :icon="item.raw.is_active ? 'bx-pause' : 'bx-play'" />
              <VTooltip activator="parent" location="top">{{ item.raw.is_active ? t('Deactivate') : t('Activate') }}</VTooltip>
            </VBtn>
            <VBtn icon variant="text" size="small" color="error" @click="confirmDelete(item.raw)">
              <VIcon size="18" icon="bx-trash" />
              <VTooltip activator="parent" location="top">{{ t('Delete') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create / Edit Dialog -->
    <ItemFormDialog
      v-model="dialog"
      :mode="dialogMode"
      :item="selectedItem"
      :category-options="categoryOptions"
      :unit-options="unitOptions"
      @saved="loadItems"
    />

    <VDialog v-model="deleteDialog" max-width="400">
      <VCard :title="t('Delete Item')">
        <VCardText>{{ t('Are you sure you want to delete') }} <strong>{{ selectedItem?.name }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="deleteDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn color="error" :loading="deleting" @click="doDelete">{{ t('Delete') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-items
meta:
  action: manage
  subject: all
</route>

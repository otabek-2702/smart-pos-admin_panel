<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })

const categories = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const typeFilter = ref<string | undefined>(undefined)

const dialog = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const deleteDialog = ref(false)
const deleting = ref(false)
const selectedItem = ref<any>(null)

const categoryTypes = ['RAW_MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'PACKAGING']

const typeColor: Record<string, string> = {
  RAW_MATERIAL: 'success',
  SEMI_FINISHED: 'warning',
  FINISHED_GOOD: 'primary',
  PACKAGING: 'secondary',
}

const form = ref({
  name: '',
  type: 'RAW_MATERIAL',
  parent_id: null as number | null,
  sort_order: 0,
  is_active: true,
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const headers = [
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Type'), key: 'type', sortable: false },
  { title: t('Parent'), key: 'parent', sortable: false },
  { title: t('Sort'), key: 'sort_order', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadCategories() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (typeFilter.value) params.type = typeFilter.value

    const res = await axios.get('/categories/', { params })
    const d = res.data
    categories.value = d.categories ?? []
    total.value = d.pagination?.total_items ?? d.count ?? categories.value.length
  }
  catch {
    notify(t('Failed to load categories'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadCategories)
watch([page, itemsPerPage], loadCategories)
watch([search, typeFilter], () => { page.value = 1; loadCategories() })

function openCreate() {
  dialogMode.value = 'create'
  form.value = { name: '', type: 'RAW_MATERIAL', parent_id: null, sort_order: 0, is_active: true }
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item
  form.value = {
    name: item.name ?? '',
    type: item.type ?? 'RAW_MATERIAL',
    parent_id: item.parent_id ?? null,
    sort_order: item.sort_order ?? 0,
    is_active: item.is_active ?? true,
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    const payload: any = { ...form.value }
    if (!payload.parent_id) delete payload.parent_id
    if (dialogMode.value === 'create')
      await axios.post('/categories/', payload)
    else
      await axios.patch(`/categories/${selectedItem.value.id}/`, payload)
    notify(dialogMode.value === 'create' ? t('Category created') : t('Category updated'))
    dialog.value = false
    loadCategories()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving category'), 'error')
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(item: any) {
  selectedItem.value = item
  deleteDialog.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await axios.delete(`/categories/${selectedItem.value.id}/`)
    notify(t('Category deleted'))
    deleteDialog.value = false
    loadCategories()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting category'), 'error')
  }
  finally {
    deleting.value = false
  }
}

async function toggleActive(item: any) {
  try {
    await axios.patch(`/categories/${item.id}/`, { is_active: !item.is_active })
    notify(item.is_active ? t('Category deactivated') : t('Category activated'))
    loadCategories()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error updating category'), 'error')
  }
}

// parent select options (flat list, excluding current item in edit mode)
const parentOptions = computed(() =>
  categories.value
    .filter(c => selectedItem.value ? c.id !== selectedItem.value.id : true)
    .map(c => ({ title: c.name, value: c.id })),
)
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search categories...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 240px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="typeFilter"
          :items="categoryTypes"
          :placeholder="t('All Types')"
          density="compact"
          style="min-inline-size: 160px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn prepend-icon="bx-plus" @click="openCreate">{{ t('Add Category') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="categories"
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

        <template v-if="loading && categories.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:120px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:30px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.type="{ item }">
          <VChip :color="typeColor[item.raw.type] ?? 'default'" size="small" variant="tonal">{{ item.raw.type_display ?? item.raw.type }}</VChip>
        </template>
        <template #item.parent="{ item }">
          {{ item.raw.parent?.name ?? '—' }}
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

    <VDialog v-model="dialog" max-width="480" persistent>
      <VCard :title="dialogMode === 'create' ? t('Add Category') : t('Edit Category')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VTextField v-model="form.name" :label="t('Name')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.type" :items="categoryTypes" :label="t('Type')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="form.sort_order" :label="t('Sort Order')" type="number" />
            </VCol>
            <VCol cols="12">
              <VSelect
                v-model="form.parent_id"
                :items="parentOptions"
                :label="t('Parent Category')"
                :placeholder="t('None')"
                clearable
              />
            </VCol>
            <VCol v-if="dialogMode === 'edit'" cols="12">
              <VSwitch v-model="form.is_active" :label="t('Active')" color="success" />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="dialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :loading="saving" @click="save">{{ t('Save') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="deleteDialog" max-width="400">
      <VCard :title="t('Delete Category')">
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
name: stock-categories
meta:
  action: manage
  subject: all
</route>

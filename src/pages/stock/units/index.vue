<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })

const units = ref<any[]>([])
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

const unitTypes = ['WEIGHT', 'VOLUME', 'COUNT', 'LENGTH', 'TIME']

const typeColor: Record<string, string> = {
  WEIGHT: 'primary',
  VOLUME: 'info',
  COUNT: 'success',
  LENGTH: 'warning',
  TIME: 'secondary',
}

const form = ref({
  name: '',
  short_name: '',
  unit_type: 'COUNT',
  is_base_unit: false,
  base_unit_id: null as number | null,
  conversion_factor: 1,
  decimal_places: 2,
  is_active: true,
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const headers = [
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Short'), key: 'short_name', sortable: false },
  { title: t('Type'), key: 'unit_type', sortable: false },
  { title: t('Base Unit'), key: 'is_base_unit', sortable: false },
  { title: t('Conversion'), key: 'conversion_factor', sortable: false },
  { title: t('Decimals'), key: 'decimal_places', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadUnits() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (typeFilter.value) params.unit_type = typeFilter.value

    const res = await axios.get('/units/', { params })
    const d = res.data
    units.value = d.units ?? []
    total.value = d.count ?? units.value.length
  }
  catch {
    notify(t('Failed to load units'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(loadUnits)
watch([page, itemsPerPage], loadUnits)
watch([search, typeFilter], () => { page.value = 1; loadUnits() })

function openCreate() {
  dialogMode.value = 'create'
  form.value = { name: '', short_name: '', unit_type: 'COUNT', is_base_unit: false, base_unit_id: null, conversion_factor: 1, decimal_places: 2, is_active: true }
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item
  form.value = {
    name: item.name ?? '',
    short_name: item.short_name ?? '',
    unit_type: item.unit_type ?? 'COUNT',
    is_base_unit: item.is_base_unit ?? false,
    base_unit_id: item.base_unit_id ?? null,
    conversion_factor: item.conversion_factor ?? 1,
    decimal_places: item.decimal_places ?? 2,
    is_active: item.is_active ?? true,
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    const payload: any = { ...form.value }
    if (payload.is_base_unit) delete payload.base_unit_id
    if (!payload.base_unit_id) delete payload.base_unit_id
    if (dialogMode.value === 'create')
      await axios.post('/units/', payload)
    else
      await axios.patch(`/units/${selectedItem.value.id}/`, payload)
    notify(dialogMode.value === 'create' ? t('Unit created') : t('Unit updated'))
    dialog.value = false
    loadUnits()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving unit'), 'error')
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
    await axios.delete(`/units/${selectedItem.value.id}/`)
    notify(t('Unit deleted'))
    deleteDialog.value = false
    loadUnits()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting unit'), 'error')
  }
  finally {
    deleting.value = false
  }
}

// base unit options for same type
const baseUnitOptions = computed(() =>
  units.value
    .filter(u => u.is_base_unit && u.unit_type === form.value.unit_type && (selectedItem.value ? u.id !== selectedItem.value.id : true))
    .map(u => ({ title: `${u.name} (${u.short_name})`, value: u.id })),
)
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search units...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 220px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="typeFilter"
          :items="unitTypes"
          :placeholder="t('All Types')"
          density="compact"
          style="min-inline-size: 160px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn prepend-icon="bx-plus" @click="openCreate">{{ t('Add Unit') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="units"
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

        <template v-if="loading && units.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:40px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:50px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:30px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.unit_type="{ item }">
          <VChip :color="typeColor[item.raw.unit_type] ?? 'default'" size="small" variant="tonal">{{ item.raw.unit_type_display ?? item.raw.unit_type }}</VChip>
        </template>
        <template #item.is_base_unit="{ item }">
          <VChip v-if="item.raw.is_base_unit" color="primary" size="small" variant="tonal">{{ t('Base') }}</VChip>
          <span v-else class="text-disabled text-body-2">{{ item.raw.base_unit?.short_name ?? '—' }}</span>
        </template>
        <template #item.conversion_factor="{ item }">
          {{ item.raw.is_base_unit ? '1' : item.raw.conversion_factor }}
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
            <VBtn icon variant="text" size="small" color="error" @click="confirmDelete(item.raw)">
              <VIcon size="18" icon="bx-trash" />
              <VTooltip activator="parent" location="top">{{ t('Delete') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog v-model="dialog" max-width="480" persistent>
      <VCard :title="dialogMode === 'create' ? t('Add Unit') : t('Edit Unit')">
        <VCardText>
          <VRow>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.name" :label="t('Name')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.short_name" :label="t('Short Name')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.unit_type" :items="unitTypes" :label="t('Type')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="form.decimal_places" :label="t('Decimal Places')" type="number" :min="0" :max="6" />
            </VCol>
            <VCol cols="12">
              <VSwitch v-model="form.is_base_unit" :label="t('This is the base unit for its type')" color="primary" />
            </VCol>
            <template v-if="!form.is_base_unit">
              <VCol cols="12" sm="6">
                <VSelect
                  v-model="form.base_unit_id"
                  :items="baseUnitOptions"
                  :label="t('Base Unit')"
                  :placeholder="t('Select base unit')"
                  clearable
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField v-model.number="form.conversion_factor" :label="t('Conversion Factor')" type="number" step="0.001" />
              </VCol>
            </template>
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
      <VCard :title="t('Delete Unit')">
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
name: stock-units
meta:
  action: manage
  subject: all
</route>

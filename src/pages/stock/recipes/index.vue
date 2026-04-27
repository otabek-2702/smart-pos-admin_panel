<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'
import RecipeDetailDialog from './RecipeDetailDialog.vue'

const { t } = useI18n({ useScope: 'global' })

const recipes = ref<any[]>([])
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
const detailDialog = ref(false)
const detailItem = ref<any>(null)

const itemsList = ref<any[]>([])
const unitsList = ref<any[]>([])

const recipeTypes = ['PRODUCTION', 'ASSEMBLY', 'PREPARATION', 'DISASSEMBLY']
const difficultyLevels = ['EASY', 'MEDIUM', 'HARD']

const typeColor: Record<string, string> = {
  PRODUCTION: 'primary',
  ASSEMBLY: 'success',
  PREPARATION: 'warning',
  DISASSEMBLY: 'error',
}

const form = ref({
  name: '',
  code: '',
  recipe_type: 'PRODUCTION',
  output_item_id: null as number | null,
  output_quantity: 1,
  output_unit_id: null as number | null,
  estimated_time_minutes: null as number | null,
  difficulty_level: 'MEDIUM',
  notes: '',
  is_active: true,
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const headers = [
  { title: t('Code'), key: 'code', sortable: false },
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Type'), key: 'recipe_type', sortable: false },
  { title: t('Output'), key: 'output', sortable: false },
  { title: t('Qty'), key: 'output_quantity', sortable: false },
  { title: t('Version'), key: 'version', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadRecipes() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (typeFilter.value) params.recipe_type = typeFilter.value

    const res = await axios.get('/recipes/', { params })
    const d = res.data
    recipes.value = d.recipes ?? []
    total.value = d.pagination?.total_items ?? recipes.value.length
  }
  catch {
    notify(t('Failed to load recipes'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [itemsRes, unitsRes] = await Promise.all([
      axios.get('/items/', { params: { per_page: 300 } }),
      axios.get('/units/', { params: { per_page: 200 } }),
    ])
    itemsList.value = itemsRes.data.items ?? []
    unitsList.value = unitsRes.data.units ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadRecipes(); loadMeta() })
watch([page, itemsPerPage], loadRecipes)
watch([search, typeFilter], () => { page.value = 1; loadRecipes() })

const itemOptions = computed(() => itemsList.value.map(i => ({ title: `${i.name} (${i.sku ?? '—'})`, value: i.id })))
const unitOptions = computed(() => unitsList.value.map(u => ({ title: `${u.name} (${u.short_name})`, value: u.id })))

function openCreate() {
  dialogMode.value = 'create'
  form.value = { name: '', code: '', recipe_type: 'PRODUCTION', output_item_id: null, output_quantity: 1, output_unit_id: null, estimated_time_minutes: null, difficulty_level: 'MEDIUM', notes: '', is_active: true }
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item
  form.value = {
    name: item.name ?? '',
    code: item.code ?? '',
    recipe_type: item.recipe_type ?? 'PRODUCTION',
    output_item_id: item.output_item?.id ?? null,
    output_quantity: item.output_quantity ?? 1,
    output_unit_id: item.output_unit?.id ?? null,
    estimated_time_minutes: item.estimated_time_minutes ?? null,
    difficulty_level: item.difficulty_level ?? 'MEDIUM',
    notes: item.notes ?? '',
    is_active: item.is_active ?? true,
  }
  dialog.value = true
}

function openDetail(item: any) {
  detailItem.value = item
  detailDialog.value = true
}

async function save() {
  saving.value = true
  try {
    const payload: any = { ...form.value }
    if (!payload.output_item_id) delete payload.output_item_id
    if (!payload.output_unit_id) delete payload.output_unit_id
    if (!payload.estimated_time_minutes) delete payload.estimated_time_minutes
    if (!payload.notes) delete payload.notes
    if (!payload.code) delete payload.code

    if (dialogMode.value === 'create')
      await axios.post('/recipes/', payload)
    else
      await axios.patch(`/recipes/${selectedItem.value.id}/`, payload)
    notify(dialogMode.value === 'create' ? t('Recipe created') : t('Recipe updated'))
    dialog.value = false
    loadRecipes()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving recipe'), 'error')
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
    await axios.delete(`/recipes/${selectedItem.value.id}/`)
    notify(t('Recipe deleted'))
    deleteDialog.value = false
    loadRecipes()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting recipe'), 'error')
  }
  finally {
    deleting.value = false
  }
}

async function toggleActive(item: any) {
  try {
    await axios.patch(`/recipes/${item.id}/`, { is_active: !item.is_active })
    notify(item.is_active ? t('Recipe deactivated') : t('Recipe activated'))
    loadRecipes()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error updating recipe'), 'error')
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search recipes...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 220px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="typeFilter"
          :items="recipeTypes"
          :placeholder="t('All Types')"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn prepend-icon="bx-plus" @click="openCreate">{{ t('Add Recipe') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="recipes"
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

        <template v-if="loading && recipes.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:130px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:110px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:40px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:30px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.code="{ item }">
          <span class="font-weight-medium text-body-2">{{ item.raw.code ?? '—' }}</span>
        </template>
        <template #item.recipe_type="{ item }">
          <VChip :color="typeColor[item.raw.recipe_type] ?? 'default'" size="small" variant="tonal">{{ item.raw.recipe_type }}</VChip>
        </template>
        <template #item.output="{ item }">
          {{ item.raw.output_item_name ?? '—' }}
        </template>
        <template #item.output_quantity="{ item }">
          {{ item.raw.output_quantity }} {{ item.raw.output_unit ?? '' }}
        </template>
        <template #item.is_active="{ item }">
          <VChip :color="item.raw.is_active ? 'success' : 'default'" size="small" variant="tonal">
            {{ item.raw.is_active ? t('Active') : t('Inactive') }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn icon variant="text" size="small" @click="openDetail(item.raw)">
              <VIcon size="18" icon="bx-show" />
              <VTooltip activator="parent" location="top">{{ t('View Ingredients') }}</VTooltip>
            </VBtn>
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

    <RecipeDetailDialog v-model="detailDialog" :recipe="detailItem" />
    <!-- Create / Edit Dialog -->
    <VDialog v-model="dialog" max-width="560" persistent>
      <VCard :title="dialogMode === 'create' ? t('Add Recipe') : t('Edit Recipe')">
        <VCardText>
          <VRow>
            <VCol cols="12" sm="8">
              <VTextField v-model="form.name" :label="t('Name')" required />
            </VCol>
            <VCol cols="12" sm="4">
              <VTextField v-model="form.code" :label="t('Code')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.recipe_type" :items="recipeTypes" :label="t('Type')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.difficulty_level" :items="difficultyLevels" :label="t('Difficulty')" />
            </VCol>
            <VCol cols="12" sm="8">
              <VSelect v-model="form.output_item_id" :items="itemOptions" :label="t('Output Item')" clearable />
            </VCol>
            <VCol cols="12" sm="4">
              <VTextField v-model.number="form.output_quantity" :label="t('Output Qty')" type="number" step="0.01" />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.output_unit_id" :items="unitOptions" :label="t('Output Unit')" clearable />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="form.estimated_time_minutes" :label="t('Est. Time (min)')" type="number" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.notes" :label="t('Notes')" />
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
      <VCard :title="t('Delete Recipe')">
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
name: stock-recipes
meta:
  action: manage
  subject: all
</route>

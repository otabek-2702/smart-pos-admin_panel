<script setup lang="ts">
import DataTableFooter from '@core/components/DataTableFooter.vue'
import axios from '@axios'

const { t } = useI18n({ useScope: 'global' })

// ---- state ----
const categories = ref<any[]>([])
const totalCategories = ref(0)
const loading = ref(false)
const stats = ref<any>(null)
const search = ref('')
const page = ref(1)
const itemsPerPage = ref(10)

// Dialog
const dialogOpen = ref(false)
const editingCategory = ref<any>(null)
const dialogLoading = ref(false)

// Delete confirm
const deleteDialog = ref(false)
const deletingCategory = ref<any>(null)

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

// Form — single color only
const form = ref({
  name: '',
  description: '',
  color: '',
})

// Color mode: 'none' = no color (empty), 'pick' = user chose a color
const colorMode = ref<'none' | 'pick'>('none')

// Color menu
const colorMenuOpen = ref(false)

// Intensity: controls how vivid the color appears (blends with white)
const intensityOptions = [
  { label: '70%', value: 0.7 },
  { label: '50%', value: 0.5 },
  { label: '35%', value: 0.35 },
  { label: '20%', value: 0.2 },
]
const intensity = ref(0.7)

// Base color (full saturation) — the raw picked color before intensity
const baseColor = ref('#e74c3c')

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function applyIntensity(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(
    r + (255 - r) * (1 - alpha),
    g + (255 - g) * (1 - alpha),
    b + (255 - b) * (1 - alpha),
  )
}

// When base color or intensity changes, update form.color
watch([() => baseColor.value, intensity], ([hex, a]) => {
  if (colorMode.value === 'pick' && hex)
    form.value.color = applyIntensity(hex, a)
})

// Sync colorMode with form.color
watch(colorMode, mode => {
  if (mode === 'none') {
    form.value.color = ''
  }
  else if (!form.value.color) {
    baseColor.value = '#e74c3c'
    form.value.color = applyIntensity(baseColor.value, intensity.value)
  }
})

watch(() => form.value.color, val => {
  if (val && colorMode.value === 'none')
    colorMode.value = 'pick'
})

// Drag state
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// Debounced search
const debouncedSearch = useDebounceFn(() => { page.value = 1; loadCategories() }, 400)

// ---- helpers ----
function cardColor(cat: any): string {
  return cat.colors?.[0] ?? '#9e9e9e'
}

// ---- load ----
async function loadCategories() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    const res = await axios.get('/categories', { params })
    const d = res.data?.data
    categories.value = (d?.categories ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
    totalCategories.value = d?.pagination?.total_categories ?? d?.pagination?.total ?? categories.value.length
  }
  catch {
    notify(t('Failed to load categories'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await axios.get('/categories/stats')
    stats.value = res.data?.data ?? res.data
  }
  catch { /* ignore */ }
}

onMounted(() => {
  loadCategories()
  loadStats()
})

watch(search, debouncedSearch)
watch([page, itemsPerPage], loadCategories)

// ---- drag & drop ----
function onDragStart(e: DragEvent, index: number) {
  draggedIndex.value = index
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDragLeave() {
  dragOverIndex.value = null
}

function onDrop(targetIndex: number) {
  if (draggedIndex.value === null || draggedIndex.value === targetIndex) {
    draggedIndex.value = null
    dragOverIndex.value = null
    return
  }
  const items = [...categories.value]
  const [dragged] = items.splice(draggedIndex.value, 1)
  items.splice(targetIndex, 0, dragged)
  categories.value = items
  draggedIndex.value = null
  dragOverIndex.value = null
  saveOrder(items)
}

function onDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
}

async function saveOrder(items: any[]) {
  try {
    await Promise.all(
      items.map((cat, idx) =>
        axios.put(`/categories/${cat.id}/update`, { ...cat, sort_order: idx })
      )
    )
  }
  catch { /* ignore */ }
}

// ---- dirty tracking ----
const initialForm = ref({ name: '', description: '', color: '' })
const isDirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(initialForm.value))

function tryCloseDialog(val: boolean) {
  if (val) return
  if (isDirty.value) {
    notify(t('Unsaved changes! Use the close button to discard.'), 'warning')
    return
  }
  dialogOpen.value = false
}

// ---- CRUD ----
function openCreate() {
  editingCategory.value = null
  colorMode.value = 'none'
  baseColor.value = '#e74c3c'
  intensity.value = 0.7
  form.value = { name: '', description: '', color: '' }
  nextTick(() => { initialForm.value = { ...form.value } })
  dialogOpen.value = true
}

function openEdit(cat: any) {
  editingCategory.value = cat
  const existingColor = cat.colors?.[0] ?? ''
  baseColor.value = existingColor || '#e74c3c'
  intensity.value = 0.7
  colorMode.value = existingColor ? 'pick' : 'none'
  form.value = {
    name: cat.name ?? '',
    description: cat.description ?? '',
    color: existingColor,
  }
  nextTick(() => { initialForm.value = { ...form.value } })
  dialogOpen.value = true
}

async function saveCategory() {
  dialogLoading.value = true
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description,
      colors: [form.value.color],
      sort_order: editingCategory.value?.sort_order ?? categories.value.length,
    }
    if (editingCategory.value) {
      await axios.put(`/categories/${editingCategory.value.id}/update`, payload)
      notify(t('Category updated'))
    }
    else {
      await axios.post('/categories/create', payload)
      notify(t('Category created'))
    }
    dialogOpen.value = false
    loadCategories()
    loadStats()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving category'), 'error')
  }
  finally {
    dialogLoading.value = false
  }
}

function confirmDelete(cat: any) {
  deletingCategory.value = cat
  deleteDialog.value = true
}

async function deleteCategory() {
  if (!deletingCategory.value) return
  try {
    await axios.delete(`/categories/${deletingCategory.value.id}/delete`)
    notify(t('Category deleted'))
    deleteDialog.value = false
    loadCategories()
    loadStats()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting category'), 'error')
  }
}
</script>

<template>
  <div class="categories-page">
    <!-- Stats row — compact, always shown -->
    <VRow class="mb-3 flex-0-0">
      <VCol cols="4">
        <VCard>
          <VCardText class="d-flex align-center gap-2 py-3">
            <VAvatar color="primary" variant="tonal" size="32" rounded>
              <VIcon icon="bx-category" size="16" />
            </VAvatar>
            <div>
              <div v-if="stats" class="text-subtitle-1 font-weight-bold lh-1">{{ stats.total_categories ?? '—' }}</div>
              <div v-else class="sk-box mb-1" style="width:36px;height:16px;border-radius:4px;" />
              <div class="text-caption text-disabled">{{ t('Total') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="4">
        <VCard>
          <VCardText class="d-flex align-center gap-2 py-3">
            <VAvatar color="success" variant="tonal" size="32" rounded>
              <VIcon icon="bx-check-circle" size="16" />
            </VAvatar>
            <div>
              <div v-if="stats" class="text-subtitle-1 font-weight-bold lh-1">{{ stats.active_categories ?? '—' }}</div>
              <div v-else class="sk-box mb-1" style="width:36px;height:16px;border-radius:4px;" />
              <div class="text-caption text-disabled">{{ t('Active') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="4">
        <VCard>
          <VCardText class="d-flex align-center gap-2 py-3">
            <VAvatar color="warning" variant="tonal" size="32" rounded>
              <VIcon icon="bx-minus-circle" size="16" />
            </VAvatar>
            <div>
              <div v-if="stats" class="text-subtitle-1 font-weight-bold lh-1">{{ stats.inactive_categories ?? '—' }}</div>
              <div v-else class="sk-box mb-1" style="width:36px;height:16px;border-radius:4px;" />
              <div class="text-caption text-disabled">{{ t('Inactive') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Toolbar — always shown -->
    <div class="d-flex flex-wrap gap-3 align-center mb-4">
      <VTextField
        v-model="search"
        :placeholder="t('Search')"
        prepend-inner-icon="bx-search"
        density="compact"
        style="max-inline-size: 240px;"
        hide-details
        clearable
      />
      <VSpacer />
      <VBtn prepend-icon="bx-plus" @click="openCreate">
        {{ t('Add Category') }}
      </VBtn>
    </div>

    <!-- Category card grid -->
    <div class="category-grid mb-4">
      <!-- Skeleton cards on initial load -->
      <template v-if="loading && categories.length === 0">
        <div
          v-for="n in 8"
          :key="`sk-${n}`"
          class="category-card"
          style="pointer-events:none;"
        >
          <div class="sk-box category-card__stripe" />
          <div class="category-card__body">
            <div class="sk-box category-card__icon" />
            <div class="sk-box mt-2" style="width:80%;height:13px;border-radius:4px;" />
            <div class="sk-box mt-2" style="width:52px;height:18px;border-radius:8px;" />
          </div>
        </div>
      </template>

      <template v-else>
        <VCard
          v-for="(cat, index) in categories"
          :key="cat.id"
          class="category-card"
          flat
          :class="{
            'is-dragging': draggedIndex === index,
            'is-drag-over': dragOverIndex === index && draggedIndex !== index,
          }"
          draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover="onDragOver($event, index)"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop(index)"
          @dragend="onDragEnd"
          @click="openEdit(cat)"
        >
          <div
            class="category-card__stripe"
            :style="{ background: cardColor(cat) }"
          />
          <div class="category-card__body">
            <div
              class="category-card__icon"
              :style="{ background: cardColor(cat) }"
            />
            <div class="d-flex align-center justify-space-between mt-2 gap-1">
              <span class="category-card__name">{{ cat.name }}</span>
              <VIcon icon="bx-grid-vertical" size="16" class="drag-hint" />
            </div>
            <VChip
              class="mt-2"
              size="x-small"
              :color="cat.status === 'ACTIVE' ? 'success' : 'warning'"
              variant="tonal"
              label
            >
              {{ cat.status === 'ACTIVE' ? t('Active') : t('Inactive') }}
            </VChip>
          </div>
        </VCard>

        <!-- Empty state -->
        <div
          v-if="categories.length === 0"
          class="category-grid__empty"
        >
          <VIcon icon="bx-category" size="56" color="disabled" />
          <p class="text-disabled mt-3">
            {{ t('No categories found') }}
          </p>
        </div>
      </template>
    </div>

    <VCard style="margin-block-start: auto; padding-block-start: 8px;">
      <DataTableFooter
        v-model:page="page"
        v-model:items-per-page="itemsPerPage"
        :total-items="totalCategories"
      />
    </VCard>

    <!-- Create/Edit Dialog -->
    <VDialog
      :model-value="dialogOpen"
      max-width="480"
      @update:model-value="tryCloseDialog"
    >
      <VCard :title="editingCategory ? t('Edit Category') : t('Add Category')">
        <DialogCloseBtn @click="dialogOpen = false" />
        <VCardText class="pb-2">
          <!-- POS Preview -->
          <div class="pos-preview mb-4">
            <span class="text-caption text-disabled d-block mb-2">{{ t('POS Preview') }}</span>
            <div class="pos-preview__bar">
              <div
                class="pos-category-btn pos-category-btn--active"
                :style="{ backgroundColor: form.color || '#9e9e9e' }"
              >
                {{ form.name || t('Name') }}
              </div>
              <div class="pos-category-btn pos-category-btn--dim">
                {{ t('Other') }}
              </div>
              <div class="pos-category-btn pos-category-btn--dim">
                {{ t('Other') }}
              </div>
            </div>

            <div class="pos-preview__products mt-3">
              <div class="pos-product-card" :style="{ backgroundColor: form.color || '#9e9e9e' }">
                <div class="pos-product-card__name">{{ t('Product') }} 1</div>
                <div class="pos-product-card__price">25 000 so'm</div>
              </div>
              <div class="pos-product-card" :style="{ backgroundColor: form.color || '#9e9e9e' }">
                <div class="pos-product-card__name">{{ t('Product') }} 2</div>
                <div class="pos-product-card__price">18 000 so'm</div>
              </div>
              <div class="pos-product-card" :style="{ backgroundColor: form.color || '#9e9e9e' }">
                <div class="pos-product-card__name">{{ t('Product') }} 3</div>
                <div class="pos-product-card__price">32 000 so'm</div>
              </div>
            </div>
          </div>

          <VRow>
            <VCol cols="12">
              <VTextField
                v-model="form.name"
                :label="t('Name')"
                density="compact"
                autofocus
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="form.description"
                :label="t('Description')"
                density="compact"
              />
            </VCol>

            <!-- Color picker -->
            <VCol cols="12">
              <div class="d-flex align-center gap-3">
                <VMenu
                  v-model="colorMenuOpen"
                  :close-on-content-click="false"
                  location="bottom start"
                >
                  <template #activator="{ props: menuProps }">
                    <div
                      v-bind="menuProps"
                      class="color-dot"
                      :style="{ background: form.color || 'rgba(var(--v-theme-on-surface), 0.12)' }"
                    />
                  </template>
                  <VColorPicker
                    v-model="baseColor"
                    mode="hex"
                    :modes="['hex']"
                    show-swatches
                    elevation="0"
                  />
                </VMenu>
                <span v-if="form.color" class="text-body-2 text-medium-emphasis">{{ form.color.toUpperCase() }}</span>
                <span v-else class="text-body-2 text-disabled">{{ t('No Color') }}</span>
                <VSpacer />
                <VBtn
                  v-if="form.color"
                  icon
                  variant="text"
                  size="x-small"
                  @click="form.color = ''; colorMode = 'none'"
                >
                  <VIcon icon="bx-x" size="18" />
                </VBtn>
              </div>
            </VCol>

            <!-- Intensity -->
            <VCol v-if="form.color" cols="12">
              <span class="text-caption text-disabled d-block mb-1">{{ t('Intensity') }}</span>
              <div class="d-flex gap-2">
                <button
                  v-for="opt in intensityOptions"
                  :key="opt.value"
                  type="button"
                  class="intensity-btn"
                  :class="{ 'intensity-btn--active': intensity === opt.value }"
                  :style="{ backgroundColor: applyIntensity(baseColor, opt.value) }"
                  @click="intensity = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </VCol>
          </VRow>
        </VCardText>

        <VCardActions class="justify-space-between pb-4 px-4">
          <VBtn
            v-if="editingCategory"
            color="error"
            variant="text"
            prepend-icon="bx-trash"
            @click="confirmDelete(editingCategory); dialogOpen = false"
          >
            {{ t('Delete') }}
          </VBtn>
          <VSpacer />
          <VBtn
            :loading="dialogLoading"
            @click="saveCategory"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Delete Confirm -->
    <VDialog
      v-model="deleteDialog"
      max-width="400"
    >
      <VCard :title="t('Delete Category')">
        <VCardText>{{ t('Are you sure you want to delete this category?') }}</VCardText>
        <VCardActions class="justify-end">
          <VBtn
            variant="tonal"
            color="secondary"
            @click="deleteDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="error"
            @click="deleteCategory"
          >
            {{ t('Delete') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Snackbar -->
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
/* ── Page layout ── */
.categories-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 64px - 56px - 40px);
}

/* ── Card grid ── */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
  gap: 14px;
}

.category-card {
  border-radius: 12px;
  overflow: hidden;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  user-select: none;
}

.category-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  transform: translateY(-3px);
}

.category-card:active {
  cursor: grabbing;
}

.category-card.is-dragging {
  opacity: 0.4;
  transform: scale(0.96);
}

.category-card.is-drag-over {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
  transform: translateY(-2px);
}

.category-card__stripe {
  height: 5px;
  width: 100%;
}

.category-card__body {
  padding: 12px 12px 14px;
}

.category-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-card__name {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.drag-hint {
  opacity: 0.3;
  flex-shrink: 0;
}

.category-grid__empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 0;
}

/* ── POS Preview ── */
.pos-preview {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  padding: 14px;
}

.pos-preview__bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pos-category-btn {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 140px;
}

.pos-category-btn--dim {
  background: rgba(var(--v-theme-on-surface), 0.1);
  color: rgba(var(--v-theme-on-surface), 0.4);
}

/* ── POS Product preview ── */
.pos-preview__products {
  display: flex;
  gap: 8px;
}

.pos-product-card {
  flex: 1;
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
  color: #fff;
  min-width: 0;
}

.pos-product-card__name {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pos-product-card__price {
  font-size: 0.625rem;
  opacity: 0.85;
  margin-top: 1px;
}

/* ── Color dot ── */
.color-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  transition: box-shadow 0.15s;
  flex-shrink: 0;
}

.color-dot:hover {
  box-shadow: 0 0 0 3px rgba(var(--v-theme-on-surface), 0.15);
}

/* ── Intensity buttons ── */
.intensity-btn {
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.12s, transform 0.12s;
}

.intensity-btn:hover {
  transform: scale(1.05);
}

.intensity-btn--active {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.3);
}

</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

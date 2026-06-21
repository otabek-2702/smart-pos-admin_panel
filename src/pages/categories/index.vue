<script setup lang="ts">
import axios from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import Switch from '@/components/design/Switch.vue'

const { t } = useI18n({ useScope: 'global' })

// ---- state ----
const categories = ref<any[]>([])
const totalCategories = ref(0)
const loading = ref(false)
const stats = ref<any>(null)
const search = ref('')
const statusFilter = ref<string>('')
const includeDeleted = ref(false)
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
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
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
    if (search.value)
      params.search = search.value
    if (statusFilter.value)
      params.status = statusFilter.value
    if (includeDeleted.value)
      params.include_deleted = true
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
watch([statusFilter, includeDeleted], () => { page.value = 1; loadCategories() })

// ---- drag & drop ----
function onDragStart(e: DragEvent, index: number) {
  draggedIndex.value = index
  if (e.dataTransfer)
    e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (e.dataTransfer)
    e.dataTransfer.dropEffect = 'move'
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
    await axios.post('/categories/reorder', {
      orders: items.map((cat, idx) => ({ id: cat.id, sort_order: idx })),
    })
  }
  catch { /* ignore */ }
}

// ---- dirty tracking ----
const initialForm = ref({ name: '', description: '', color: '' })
const isDirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(initialForm.value))

function tryCloseDialog(val: boolean) {
  if (val)
    return
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
      await axios.patch(`/categories/${editingCategory.value.id}`, payload)
      notify(t('Category updated'))
    }
    else {
      await axios.post('/categories', payload)
      notify(t('Category created'))
    }
    dialogOpen.value = false
    await Promise.all([loadCategories(), loadStats()])
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
  if (!deletingCategory.value)
    return
  try {
    await axios.delete(`/categories/${deletingCategory.value.id}`)
    notify(t('Category deleted'))
    deleteDialog.value = false
    await Promise.all([loadCategories(), loadStats()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting category'), 'error')
  }
}

// ---- helpers / formatters ----
async function copySlug(slug: string) {
  try {
    await navigator.clipboard.writeText(slug)
    notify(t('Slug copied'))
  }
  catch {
    notify(t('Error'), 'error')
  }
}

// ---- KPI data ----
const kpiTotal = computed(() => ({
  label: t('Total'),
  value: stats.value ? (stats.value.total_categories ?? null) : null,
  icon: 'tag',
  tone: 'primary' as const,
  sub: t('Categories'),
}))
const kpiActive = computed(() => ({
  label: t('category_status_ACTIVE'),
  value: stats.value ? (stats.value.active_categories ?? null) : null,
  icon: 'checkcircle',
  tone: 'success' as const,
}))
const kpiInactive = computed(() => ({
  label: t('category_status_INACTIVE'),
  value: stats.value ? (stats.value.inactive_categories ?? null) : null,
  icon: 'pause',
  tone: 'warning' as const,
}))

// ---- Status filter options ----
const statusOptions = computed(() => [
  { value: 'ACTIVE', label: t('category_status_ACTIVE') },
  { value: 'INACTIVE', label: t('category_status_INACTIVE') },
])

// Map raw BE status to design Badge tone
function statusTone(s: string): 'success' | 'neutral' {
  return s === 'ACTIVE' ? 'success' : 'neutral'
}

// ---- Pagination (chip-and-page pattern from products/index.vue) ----
const totalPages = computed(() => Math.max(1, Math.ceil(totalCategories.value / itemsPerPage.value)))
const pageStart = computed(() => totalCategories.value === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1)
const pageEnd = computed(() => Math.min(totalCategories.value, page.value * itemsPerPage.value))

const pageList = computed<(number | '…')[]>(() => {
  const tp = totalPages.value
  const cp = page.value
  const arr: (number | '…')[] = []
  if (tp <= 7) {
    for (let i = 1; i <= tp; i++) arr.push(i)
    return arr
  }
  const add = (n: number | '…') => arr.push(n)
  add(1)
  if (cp > 4) add('…')
  const start = Math.max(2, cp - 1)
  const end = Math.min(tp - 1, cp + 1)
  for (let i = start; i <= end; i++) add(i)
  if (cp < tp - 3) add('…')
  add(tp)
  return arr
})

function goPage(p: number | '…') {
  if (p === '…' || p === page.value || p < 1 || p > totalPages.value)
    return
  page.value = p
}

// ---- Active filter chips ----
const activeFilters = computed(() => {
  const list: { k: string; label: string; val: string; clear: () => void }[] = []
  if (search.value)
    list.push({ k: 'q', label: t('Search'), val: search.value, clear: () => { search.value = '' } })
  if (statusFilter.value)
    list.push({ k: 's', label: t('Status'), val: t(`category_status_${statusFilter.value}`), clear: () => { statusFilter.value = '' } })
  if (includeDeleted.value)
    list.push({ k: 'd', label: t('Include deleted'), val: t('Yes'), clear: () => { includeDeleted.value = false } })
  return list
})

function clearAllFilters() {
  search.value = ''
  statusFilter.value = ''
  includeDeleted.value = false
}
</script>

<template>
  <div class="page categories-page">
    <!-- Page header -->
    <PageHeader
      :title="t('Categories')"
      :subtitle="t('Group products into POS categories')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('Add Category') }}
        </Button>
      </template>
    </PageHeader>

    <!-- KPI strip -->
    <div
      class="grid cols-4"
      style="margin-bottom: var(--sp-5);"
    >
      <Kpi :data="kpiTotal" />
      <Kpi :data="kpiActive" />
      <Kpi :data="kpiInactive" />
    </div>

    <!-- Toolbar -->
    <Card>
      <div class="toolbar toolbar--wrap">
        <div class="tb-search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search')"
          />
        </div>

        <div class="tb-status">
          <Select
            v-model="statusFilter"
            icon="filter"
            :placeholder="t('All Category Statuses')"
            :options="statusOptions"
          />
        </div>

        <div
          class="row tb-switch"
          style="gap:10px;align-items:center;"
        >
          <Switch v-model="includeDeleted" />
          <span style="font-size:13px;color:var(--text-secondary);font-weight:500;">
            {{ t('Show deleted categories') }}
          </span>
        </div>
      </div>

      <!-- Filter chips -->
      <div
        v-if="activeFilters.length > 0"
        class="toolbar"
        style="padding-top:0;"
      >
        <div class="chips">
          <span
            class="tertiary"
            style="font-size:13px;margin-right:2px;"
          >{{ t('Filters') }}:</span>
          <span
            v-for="f in activeFilters"
            :key="f.k"
            class="chip"
          >
            <span>{{ f.label }}: <b>{{ f.val }}</b></span>
            <span
              class="chip__x"
              @click="f.clear()"
            >
              <DesignIcon
                name="close"
                :size="13"
              />
            </span>
          </span>
          <button
            class="chip--clear"
            @click="clearAllFilters"
          >
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- Card grid -->
      <div
        class="category-grid"
        style="padding: var(--sp-4);"
      >
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
              <div
                class="sk-box"
                style="width:80%;height:13px;border-radius:4px;margin-top:8px;"
              />
              <div
                class="sk-box"
                style="width:52px;height:18px;border-radius:8px;margin-top:8px;"
              />
            </div>
          </div>
        </template>

        <template v-else-if="categories.length > 0">
          <div
            v-for="(cat, index) in categories"
            :key="cat.id"
            class="category-card"
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
              <div
                class="row"
                style="gap:4px;align-items:center;justify-content:space-between;margin-top:8px;"
              >
                <span class="category-card__name">{{ cat.name }}</span>
                <DesignIcon
                  name="grid"
                  :size="16"
                  class="drag-hint"
                />
              </div>
              <p
                v-if="cat.description"
                class="category-card__desc"
              >
                {{ cat.description }}
              </p>
              <div
                class="row"
                style="gap:6px;align-items:center;justify-content:space-between;margin-top:8px;"
              >
                <Badge
                  :tone="statusTone(cat.status)"
                  dot
                >
                  {{ t(`category_status_${cat.status}`) }}
                </Badge>
                <span
                  v-if="cat.sort_order !== undefined && cat.sort_order !== null"
                  class="mono category-card__order"
                >#{{ cat.sort_order }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Empty state -->
        <div
          v-else
          class="category-grid__empty"
        >
          <div class="statefill">
            <div class="statefill__icon">
              <DesignIcon
                name="tag"
                :size="24"
              />
            </div>
            <div class="statefill__title">
              {{ t('No categories found') }}
            </div>
            <div
              v-if="activeFilters.length > 0"
              style="margin-top:12px;"
            >
              <Button
                variant="secondary"
                @click="clearAllFilters"
              >
                {{ t('Clear filters') }}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalCategories > 0"
        class="pagination"
      >
        <div
          class="row"
          style="gap: 8px; align-items: center;"
        >
          <span>{{ t('Rows per page') }}:</span>
          <div
            class="control control--select control--sm"
            style="width: 84px;"
          >
            <select v-model.number="itemsPerPage">
              <option :value="10">
                10
              </option>
              <option :value="25">
                25
              </option>
              <option :value="50">
                50
              </option>
              <option :value="100">
                100
              </option>
            </select>
            <svg
              class="chev"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <span class="pagination__spacer" />
        <span class="muted">
          {{ pageStart }}–{{ pageEnd }} {{ t('of') }} {{ totalCategories }}
        </span>
        <div class="pglist">
          <button
            class="pgbtn"
            :disabled="page <= 1"
            @click="goPage(page - 1)"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            v-for="(p, i) in pageList"
            :key="`pg-${i}-${p}`"
            class="pgbtn"
            :class="{ 'is-active': p === page }"
            :disabled="p === '…'"
            @click="goPage(p)"
          >
            {{ p }}
          </button>
          <button
            class="pgbtn"
            :disabled="page >= totalPages"
            @click="goPage(page + 1)"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </Card>

    <!-- Create/Edit Modal -->
    <Modal
      :open="dialogOpen"
      :title="editingCategory ? t('Edit Category') : t('Add Category')"
      :width="500"
      @close="tryCloseDialog(false)"
    >
      <!-- POS Preview -->
      <div class="pos-preview">
        <span
          class="muted"
          style="display:block;font-size:12px;margin-bottom:8px;"
        >{{ t('POS Preview') }}</span>
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

        <div class="pos-preview__products">
          <div
            class="pos-product-card"
            :style="{ backgroundColor: form.color || '#9e9e9e' }"
          >
            <div class="pos-product-card__name">
              {{ t('Product') }} 1
            </div>
            <div class="pos-product-card__price">
              {{ t('category_sample_price_1') }}
            </div>
          </div>
          <div
            class="pos-product-card"
            :style="{ backgroundColor: form.color || '#9e9e9e' }"
          >
            <div class="pos-product-card__name">
              {{ t('Product') }} 2
            </div>
            <div class="pos-product-card__price">
              {{ t('category_sample_price_2') }}
            </div>
          </div>
          <div
            class="pos-product-card"
            :style="{ backgroundColor: form.color || '#9e9e9e' }"
          >
            <div class="pos-product-card__name">
              {{ t('Product') }} 3
            </div>
            <div class="pos-product-card__price">
              {{ t('category_sample_price_3') }}
            </div>
          </div>
        </div>
      </div>

      <div
        class="form-grid"
        style="margin-top: var(--sp-4);"
      >
        <Field
          :label="t('Name')"
          class="span-2"
        >
          <Input
            v-model="form.name"
            :placeholder="t('Name')"
          />
        </Field>

        <Field
          :label="t('Description')"
          class="span-2"
        >
          <Input
            v-model="form.description"
            :placeholder="t('Description')"
          />
        </Field>

        <!-- Slug (read-only, edit mode only) -->
        <Field
          v-if="editingCategory && editingCategory.slug"
          :label="t('Slug')"
          class="span-2"
        >
          <div
            class="row"
            style="gap:8px;align-items:center;"
          >
            <div
              class="control is-disabled"
              style="flex:1;"
            >
              <DesignIcon
                name="tag"
                :size="16"
              />
              <input
                :value="editingCategory.slug"
                disabled
                class="mono"
              >
            </div>
            <IconAction
              icon="copy"
              tone="primary"
              :title="t('Copy slug')"
              @click="copySlug(editingCategory.slug)"
            />
          </div>
        </Field>

        <!-- Color picker -->
        <Field
          :label="t('Color')"
          class="span-2"
        >
          <div
            class="row"
            style="gap:12px;align-items:center;flex-wrap:wrap;"
          >
            <VMenu
              v-model="colorMenuOpen"
              :close-on-content-click="false"
              location="bottom start"
            >
              <template #activator="{ props: menuProps }">
                <div
                  v-bind="menuProps"
                  class="color-dot"
                  :style="{ background: form.color || 'var(--surface-inset)' }"
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
            <span
              v-if="form.color"
              class="mono"
              style="font-size:13px;color:var(--text-secondary);"
            >{{ form.color.toUpperCase() }}</span>
            <span
              v-else
              style="font-size:13px;color:var(--text-tertiary);"
            >{{ t('No Color') }}</span>
            <span style="flex:1;" />
            <IconAction
              v-if="form.color"
              icon="close"
              :title="t('Clear')"
              @click="form.color = ''; colorMode = 'none'"
            />
          </div>
        </Field>

        <!-- Intensity -->
        <Field
          v-if="form.color"
          :label="t('Intensity')"
          class="span-2"
        >
          <div
            class="row"
            style="gap:8px;flex-wrap:wrap;"
          >
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
        </Field>
      </div>

      <template #footer>
        <Button
          v-if="editingCategory"
          variant="danger"
          icon="trash"
          @click="confirmDelete(editingCategory); dialogOpen = false"
        >
          {{ t('Delete') }}
        </Button>
        <span style="flex:1;" />
        <Button
          variant="ghost"
          :disabled="dialogLoading"
          @click="dialogOpen = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="dialogLoading"
          :disabled="dialogLoading"
          @click="saveCategory"
        >
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Delete Confirm -->
    <Modal
      :open="deleteDialog"
      :title="t('Delete Category')"
      :subtitle="t('This action cannot be undone')"
      :width="440"
      @close="deleteDialog = false"
    >
      <div
        class="row"
        style="gap:14px;align-items:flex-start;"
      >
        <div
          class="kpi__icon t-error"
          style="width:44px;height:44px;flex:0 0 44px;"
        >
          <DesignIcon
            name="alert"
            :size="22"
          />
        </div>
        <div>
          <p style="margin:0;font-weight:600;">
            {{ deletingCategory?.name }}
          </p>
          <p
            class="muted"
            style="margin:6px 0 0;font-size:14px;"
          >
            {{ t('Are you sure you want to delete this category?') }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          @click="deleteDialog = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          @click="deleteCategory"
        >
          {{ t('Delete') }}
        </Button>
      </template>
    </Modal>

    <!-- Snackbar (page-level notify pattern) -->
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
/* ── Card grid ── */
.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
  gap: 14px;
}

.category-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
  user-select: none;
}

.category-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.10);
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
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary);
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
  color: var(--text);
}

.category-card__desc {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-secondary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.category-card__order {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  background: var(--surface-inset);
  padding: 2px 6px;
  border-radius: var(--r-xs);
  font-variant-numeric: tabular-nums;
}

.drag-hint {
  opacity: 0.3;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.category-grid__empty {
  grid-column: 1 / -1;
  padding: 32px 0;
}

/* ── POS Preview ── */
.pos-preview {
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
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
  background: var(--surface-2);
  color: var(--text-tertiary);
}

/* ── POS Product preview ── */
.pos-preview__products {
  display: flex;
  gap: 8px;
  margin-top: 10px;
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
  border: 1px solid var(--border);
  transition: box-shadow 0.15s;
  flex-shrink: 0;
}

.color-dot:hover {
  box-shadow: 0 0 0 3px var(--surface-2);
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
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-weak);
}

/* ── Toolbar ── */
.toolbar--wrap {
  flex-wrap: wrap;
  gap: 12px;
}

.tb-search {
  flex: 1;
  max-width: 300px;
  min-width: 220px;
}

.tb-status {
  width: 200px;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .grid.cols-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
  .tb-search,
  .tb-status {
    width: 100%;
    max-width: 100%;
    flex: 1 1 100%;
  }
  .tb-switch { flex: 1 1 100%; }
}
@media (max-width: 720px) {
  .grid.cols-4 { grid-template-columns: 1fr; }
  .category-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
}
@media (max-width: 480px) {
  .pos-preview__products { flex-wrap: wrap; }
  .pos-product-card { flex: 1 1 calc(50% - 4px); }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

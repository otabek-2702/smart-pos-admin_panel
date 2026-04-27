<script setup lang="ts">
import AppPriceInput from '@core/components/AppPriceInput.vue'
import DataTableFooter from '@core/components/DataTableFooter.vue'
import axios from '@axios'

const { t } = useI18n({ useScope: 'global' })

// ---- state ----
const products = ref<any[]>([])
const totalProducts = ref(0)
const loading = ref(false)

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const categoryFilter = ref<number | undefined>(undefined)

const categoriesList = ref<any[]>([])
const categoryOptions = computed(() =>
  categoriesList.value.map((c: any) => ({ title: c.name, value: c.id }))
)

// id → hex color lookup for categories
const categoryColorMap = computed(() => {
  const map: Record<number, string> = {}
  for (const c of categoriesList.value)
    if (c.colors?.[0]) map[c.id] = c.colors[0]
  return map
})

// Dialog
const dialogOpen = ref(false)
const editingProduct = ref<any>(null)
const dialogLoading = ref(false)

// Confirm delete
const deleteDialog = ref(false)
const deletingProduct = ref<any>(null)

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

// Form
const form = ref({
  name: '',
  description: '',
  price: 0,
  category_id: null as number | null,
  color: '',
})

// Color picker
const colorMenuOpen = ref(false)

// Characteristic colors
const characteristicColors = computed(() => [
  { hex: '#E53935', key: 'Spicy', label: t('Spicy') },
  { hex: '#FDD835', key: 'Cheese', label: t('Cheese') },
  { hex: '#43A047', key: 'Jalapeño', label: t('Jalapeño') },
  { hex: '#8D6E63', key: 'Grilled', label: t('Grilled') },
  { hex: '#1E88E5', key: 'Seafood', label: t('Seafood') },
  { hex: '#EC407A', key: 'Sweet', label: t('Sweet') },
  { hex: '#FB8C00', key: 'Chicken', label: t('Chicken') },
  { hex: '#00ACC1', key: 'Cold', label: t('Cold') },
  { hex: '#7CB342', key: 'Vegetarian', label: t('Vegetarian') },
  { hex: '#8E24AA', key: 'Premium', label: t('Premium') },
])

// Preview: selected category color
const previewColor = computed(() => {
  if (!form.value.category_id) return '#9e9e9e'
  return categoryColorMap.value[form.value.category_id] || '#9e9e9e'
})

const headers = [
  { title: t('ID'), key: 'id', sortable: false, width: '60px' },
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Price'), key: 'price', sortable: false },
  { title: t('Category'), key: 'category', sortable: false },
  { title: t('Created'), key: 'created_at', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' },
]

const { formatCurrency, formatDateShort: formatDate } = useFormatters()

// ---- load ----
async function loadProducts() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (categoryFilter.value) params.category_ids = categoryFilter.value

    const res = await axios.get('/products', { params })
    const d = res.data?.data
    products.value = d?.products ?? []
    totalProducts.value = d?.pagination?.total_products ?? products.value.length
  }
  catch {
    notify(t('Failed to load products'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const res = await axios.get('/categories', { params: { per_page: 100 } })
    categoriesList.value = res.data?.data?.categories ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => {
  loadProducts()
  loadCategories()
})

watch([page, itemsPerPage], loadProducts)

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadProducts()
}, 400)
watch(search, debouncedSearch)

watch(categoryFilter, () => {
  page.value = 1
  loadProducts()
})

// ---- dirty tracking ----
const initialForm = ref({ name: '', description: '', price: 0, category_id: null as number | null, color: '' })
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
  editingProduct.value = null
  form.value = { name: '', description: '', price: 0, category_id: null, color: '' }
  initialForm.value = { ...form.value }
  dialogOpen.value = true
}

function openEdit(product: any) {
  editingProduct.value = product
  form.value = {
    name: product.name ?? '',
    description: product.description ?? '',
    price: product.price ?? 0,
    category_id: product.category?.id ?? product.category_id ?? null,
    color: product.colors?.[0] ?? '',
  }
  initialForm.value = { ...form.value }
  dialogOpen.value = true
}

async function saveProduct() {
  dialogLoading.value = true
  try {
    const payload = {
      name: form.value.name,
      description: form.value.description,
      price: form.value.price,
      category_id: form.value.category_id,
      colors: form.value.color ? [form.value.color] : [],
    }
    if (editingProduct.value) {
      await axios.put(`/products/${editingProduct.value.id}/update`, payload)
      notify(t('Product updated'))
    }
    else {
      await axios.post('/products/create', payload)
      notify(t('Product created'))
    }
    dialogOpen.value = false
    loadProducts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving product'), 'error')
  }
  finally {
    dialogLoading.value = false
  }
}

function confirmDelete(product: any) {
  deletingProduct.value = product
  deleteDialog.value = true
}

async function deleteProduct() {
  if (!deletingProduct.value) return
  try {
    await axios.delete(`/products/${deletingProduct.value.id}/delete`)
    notify(t('Product deleted'))
    deleteDialog.value = false
    loadProducts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting product'), 'error')
  }
}
</script>

<template>
  <div>
    <VCard>
      <!-- Toolbar — always shown -->
      <VCardText class="d-flex flex-wrap gap-3 align-center py-3">
        <VTextField
          v-model="search"
          :placeholder="t('Search')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="max-inline-size: 240px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="categoryFilter"
          :items="categoryOptions"
          :placeholder="t('All Categories')"
          density="compact"
          style="min-inline-size: 220px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn prepend-icon="bx-plus" @click="openCreate">
          {{ t('Add Product') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="products"
        :items-length="totalProducts"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
      >
        <!-- Custom footer with numbered pagination -->
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="totalProducts"
          />
        </template>

        <!-- Skeleton rows on initial load -->
        <template v-if="loading && products.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:30px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell">
              <div class="d-flex align-center gap-2">
                <div class="sk-box" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;" />
                <div class="sk-box" style="width:110px;height:13px;border-radius:4px;" />
              </div>
            </td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell">
              <div class="d-flex align-center gap-2">
                <div class="sk-box" style="width:10px;height:10px;border-radius:3px;flex-shrink:0;" />
                <div class="sk-box" style="width:80px;height:22px;border-radius:12px;" />
              </div>
            </td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell" style="text-align:end;">
              <div class="d-flex justify-end gap-1">
                <div class="sk-box" style="width:28px;height:28px;border-radius:50%;" />
                <div class="sk-box" style="width:28px;height:28px;border-radius:50%;" />
              </div>
            </td>
          </tr>
        </template>

        <template #item.id="{ item }">
          <span class="text-sm text-disabled font-weight-medium">#{{ item.raw.id }}</span>
        </template>

        <template #item.name="{ item }">
          <div class="d-flex align-center gap-2">
            <div
              :style="{ background: categoryColorMap[item.raw.category?.id] || 'rgba(var(--v-theme-on-surface),0.12)' }"
              style="width:10px;height:10px;border-radius:3px;flex-shrink:0;"
            />
            <span class="font-weight-medium">{{ item.raw.name }}</span>
          </div>
        </template>

        <template #item.price="{ item }">
          <span class="font-weight-medium">{{ formatCurrency(item.raw.price) }}</span>
        </template>

        <template #item.category="{ item }">
          <VChip
            v-if="item.raw.category"
            size="small"
            variant="tonal"
            :style="categoryColorMap[item.raw.category.id]
              ? { backgroundColor: categoryColorMap[item.raw.category.id] + '28', color: categoryColorMap[item.raw.category.id] }
              : {}"
          >
            {{ item.raw.category.name }}
          </VChip>
          <span v-else class="text-disabled">—</span>
        </template>

        <template #item.created_at="{ item }">
          <span class="text-sm text-disabled">{{ formatDate(item.raw.created_at) }}</span>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn icon variant="text" size="small" @click="openEdit(item.raw)">
              <VIcon icon="bx-edit" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Edit') }}</VTooltip>
            </VBtn>
            <VBtn icon variant="text" size="small" color="error" @click="confirmDelete(item.raw)">
              <VIcon icon="bx-trash" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Delete') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create/Edit Dialog -->
    <VDialog :model-value="dialogOpen" max-width="500" @update:model-value="tryCloseDialog">
      <VCard :title="editingProduct ? t('Edit Product') : t('Add Product')">
        <DialogCloseBtn @click="dialogOpen = false" />
        <VCardText class="pb-2">
          <!-- POS Preview -->
          <div class="pos-preview mb-3">
            <span class="text-caption text-disabled d-block mb-2">{{ t('POS Preview') }}</span>
            <div class="pos-preview__cards">
              <div class="pos-product-card" :style="{ backgroundColor: previewColor }">
                <div class="pos-product-card__name">{{ form.name || t('Name') }}</div>
                <div class="pos-product-card__price">{{ form.price ? formatCurrency(form.price) + ' so\'m' : '0 so\'m' }}</div>
                <div
                  v-if="form.color"
                  class="pos-product-card__stripe"
                  :style="{ backgroundColor: form.color }"
                />
              </div>
            </div>
          </div>

          <VRow>
            <VCol cols="12">
              <VTextField v-model="form.name" :label="t('Name')" density="compact" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.description" :label="t('Description')" density="compact" />
            </VCol>
            <VCol cols="6">
              <AppPriceInput v-model="form.price" :label="t('Price')" density="compact" />
            </VCol>
            <VCol cols="6">
              <VSelect
                v-model="form.category_id"
                :label="t('Category')"
                :items="categoryOptions"
                density="compact"
                clearable
              />
            </VCol>

            <!-- Product color (characteristic) -->
            <VCol cols="12">
              <span class="text-caption text-disabled">{{ t('Product Color') }}</span>
              <div class="char-colors mt-1">
                <VTooltip
                  v-for="c in characteristicColors"
                  :key="c.key"
                  location="top"
                >
                  <template #activator="{ props: tip }">
                    <button
                      v-bind="tip"
                      type="button"
                      class="char-dot"
                      :class="{ 'char-dot--active': form.color === c.hex }"
                      :style="{ backgroundColor: c.hex }"
                      @click="form.color = form.color === c.hex ? '' : c.hex"
                    />
                  </template>
                  {{ c.label }}
                </VTooltip>

                <!-- Custom color -->
                <VMenu
                  v-model="colorMenuOpen"
                  :close-on-content-click="false"
                  location="top"
                >
                  <template #activator="{ props: menuProps }">
                    <VTooltip location="top">
                      <template #activator="{ props: tip }">
                        <button
                          v-bind="{ ...menuProps, ...tip }"
                          type="button"
                          class="char-dot char-dot--custom"
                          :class="{ 'char-dot--active': form.color && !characteristicColors.some(c => c.hex === form.color) }"
                          :style="form.color && !characteristicColors.some(c => c.hex === form.color) ? { backgroundColor: form.color } : {}"
                        >
                          <VIcon icon="bx-palette" size="14" />
                        </button>
                      </template>
                      {{ t('Custom') }}
                    </VTooltip>
                  </template>
                  <VColorPicker
                    v-model="form.color"
                    mode="hex"
                    :modes="['hex']"
                    show-swatches
                    elevation="0"
                  />
                </VMenu>

                <!-- Clear -->
                <button
                  v-if="form.color"
                  type="button"
                  class="char-dot char-dot--clear"
                  @click="form.color = ''"
                >
                  <VIcon icon="bx-x" size="14" />
                </button>
              </div>
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end pt-0 pb-4 px-4">
          <VBtn :loading="dialogLoading" @click="saveProduct">
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Delete Confirm Dialog -->
    <VDialog v-model="deleteDialog" max-width="400">
      <VCard :title="t('Delete Product')">
        <VCardText>{{ t('Are you sure you want to delete this product?') }}</VCardText>
        <VCardActions class="justify-end">
          <VBtn variant="tonal" color="secondary" @click="deleteDialog = false">
            {{ t('Cancel') }}
          </VBtn>
          <VBtn color="error" @click="deleteProduct">
            {{ t('Delete') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Snackbar -->
    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped>/* ── POS Preview ── */
.pos-preview {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  padding: 14px;
}

.pos-preview__cards {
  display: flex;
  gap: 10px;
}

.pos-product-card {
  width: 100%;
  max-width: 220px;
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
  color: #fff;
  position: relative;
  overflow: hidden;
}

.pos-product-card__name {
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pos-product-card__price {
  font-size: 0.75rem;
  opacity: 0.85;
  margin-top: 2px;
}

.pos-product-card__stripe {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
}

/* ── Characteristic colors ── */
.char-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.char-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.char-dot:hover {
  transform: scale(1.15);
}

.char-dot--active {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.3);
}

.char-dot--custom {
  background: rgba(var(--v-theme-on-surface), 0.1);
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.char-dot--clear {
  background: rgba(var(--v-theme-on-surface), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

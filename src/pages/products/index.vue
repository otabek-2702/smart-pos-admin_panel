<script setup lang="ts">
import AppPriceInput from '@core/components/AppPriceInput.vue'
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

// Snackbar
const snackbar = ref(false)
const snackbarMsg = ref('')
const snackbarColor = ref('success')

// Form
const form = ref({
  name: '',
  description: '',
  price: 0,
  category_id: null as number | null,
})

const headers = [
  { title: t('ID'), key: 'id', sortable: false, width: '60px' },
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Price'), key: 'price', sortable: false },
  { title: t('Category'), key: 'category', sortable: false },
  { title: t('Created'), key: 'created_at', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' },
]

// ---- helpers ----
function notify(msg: string, color = 'success') {
  snackbarMsg.value = msg
  snackbarColor.value = color
  snackbar.value = true
}

function formatDate(val: string) {
  if (!val) return '—'
  const d = new Date(val)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function formatCurrency(val: number | string) {
  const num = Number(val) || 0
  const parts = String(num).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return parts.join('.')
}

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
const initialForm = ref({ name: '', description: '', price: 0, category_id: null as number | null })
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
  form.value = { name: '', description: '', price: 0, category_id: null }
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
  }
  initialForm.value = { ...form.value }
  dialogOpen.value = true
}

async function saveProduct() {
  dialogLoading.value = true
  try {
    if (editingProduct.value) {
      await axios.put(`/products/${editingProduct.value.id}/update`, form.value)
      notify(t('Product updated'))
    }
    else {
      await axios.post('/products/create', form.value)
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
          <div class="v-data-table-footer" style="align-items:center;">
            <div class="v-data-table-footer__items-per-page">
              <span>{{ t('Items per page:') }}</span>
              <VSelect
                v-model="itemsPerPage"
                :items="[5, 10, 25, 50]"
                density="compact"
                variant="plain"
                hide-details
                style="width:75px;"
                @update:model-value="page = 1"
              />
            </div>
            <div class="v-data-table-footer__info">
              {{ Math.min((page - 1) * itemsPerPage + 1, totalProducts) }}-{{ Math.min(page * itemsPerPage, totalProducts) }} {{ t('of') }} {{ totalProducts }}
            </div>
            <div class="v-data-table-footer__pagination" style="display:flex;align-items:center;">
              <VPagination
                v-model="page"
                :length="Math.ceil(totalProducts / itemsPerPage) || 1"
                :total-visible="5"
                density="compact"
                variant="text"
                rounded="lg"
              />
            </div>
          </div>
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
    <VDialog :model-value="dialogOpen" max-width="500" :persistent="isDirty" @update:model-value="tryCloseDialog">
      <VCard :title="editingProduct ? t('Edit Product') : t('Add Product')">
        <DialogCloseBtn @click="dialogOpen = false" />
        <VCardText class="pb-2">
          <VRow>
            <VCol cols="12">
              <VTextField v-model="form.name" :label="t('Name')" density="compact" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.description" :label="t('Description')" density="compact" />
            </VCol>
            <VCol cols="12">
              <AppPriceInput v-model="form.price" :label="t('Price')" density="compact" />
            </VCol>
            <VCol cols="12">
              <VSelect
                v-model="form.category_id"
                :label="t('Category')"
                :items="categoryOptions"
                density="compact"
                clearable
              />
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

<style scoped>
.sk-row { height: 52px; }
.sk-cell { padding: 0 16px; }
.sk-box {
  background: rgba(var(--v-theme-on-surface), 0.08);
  animation: sk-pulse 1.5s ease-in-out infinite;
}
@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

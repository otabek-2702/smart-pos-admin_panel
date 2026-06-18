<script setup lang="ts">
import axios from '@/plugins/axios'

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
  categoriesList.value.map((c: any) => ({ title: c.name, value: c.id })),
)

// id → hex color lookup for categories
const categoryColorMap = computed(() => {
  const map: Record<number, string> = {}
  for (const c of categoriesList.value) {
    if (c.colors?.[0])
      map[c.id] = c.colors[0]
  }

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
  is_instant: false,
})

// Price input display (formatted with NBSP grouping)
const priceDisplay = ref('')

function fmtPrice(n: number): string {
  if (!n)
    return ''
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function onPriceInput(e: Event) {
  const input = e.target as HTMLInputElement
  const cleaned = input.value.replace(/\D/g, '')
  const num = Number(cleaned) || 0
  form.value.price = num
  priceDisplay.value = cleaned === '' ? '' : fmtPrice(num)
  nextTick(() => {
    input.value = priceDisplay.value
  })
}

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
  if (!form.value.category_id)
    return '#9e9e9e'

  return categoryColorMap.value[form.value.category_id] || '#9e9e9e'
})

// Headers preserved (kept for parity with prior version)
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
    if (search.value)
      params.search = search.value
    if (categoryFilter.value)
      params.category_ids = categoryFilter.value

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

function tryCloseDialog() {
  if (isDirty.value) {
    notify(t('Unsaved changes! Use the close button to discard.'), 'warning')

    return
  }
  dialogOpen.value = false
}

// ---- CRUD ----
function openCreate() {
  editingProduct.value = null
  form.value = { name: '', description: '', price: 0, category_id: null, color: '', is_instant: false }
  initialForm.value = { ...form.value }
  priceDisplay.value = ''
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
    is_instant: product.is_instant ?? false,
  }
  initialForm.value = { ...form.value }
  priceDisplay.value = fmtPrice(form.value.price)
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
      is_instant: form.value.is_instant,
    }

    if (editingProduct.value) {
      await axios.patch(`/products/${editingProduct.value.id}`, payload)
      notify(t('Product updated'))
    }
    else {
      await axios.post('/products', payload)
      notify(t('Product created'))
    }
    dialogOpen.value = false
    await loadProducts()
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
  if (!deletingProduct.value)
    return
  try {
    await axios.delete(`/products/${deletingProduct.value.id}`)
    notify(t('Product deleted'))
    deleteDialog.value = false
    await loadProducts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting product'), 'error')
  }
}

// ---- Active filter chips ----
const activeFilters = computed(() => {
  const list: { k: string, label: string, val: string, clear: () => void }[] = []
  if (search.value)
    list.push({ k: 'q', label: t('Search'), val: search.value, clear: () => { search.value = '' } })
  if (categoryFilter.value) {
    const cat = categoriesList.value.find((c: any) => c.id === categoryFilter.value)
    list.push({
      k: 'c',
      label: t('Category'),
      val: cat?.name ?? String(categoryFilter.value),
      clear: () => { categoryFilter.value = undefined },
    })
  }
  return list
})

function clearAll() {
  search.value = ''
  categoryFilter.value = undefined
}

// ---- Pagination ----
const totalPages = computed(() => Math.max(1, Math.ceil(totalProducts.value / itemsPerPage.value)))
const pageStart = computed(() => totalProducts.value === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1)
const pageEnd = computed(() => Math.min(totalProducts.value, page.value * itemsPerPage.value))

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
</script>

<template>
  <div class="page">
    <!-- ============== HEAD ============== -->
    <div class="page__head">
      <div style="min-width:0;">
        <h1 class="page__title">
          {{ t('Products') }}
        </h1>
        <div class="page__subtitle">
          {{ t('Catalog of products served at the POS') }}
        </div>
      </div>
      <div class="page__head-actions">
        <button
          class="btn btn--primary"
          @click="openCreate"
        >
          <svg
            class="ic"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line
              x1="12"
              y1="5"
              x2="12"
              y2="19"
            />
            <line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
            />
          </svg>
          {{ t('Add Product') }}
        </button>
      </div>
    </div>

    <!-- ============== CARD ============== -->
    <div class="card">
      <!-- Toolbar -->
      <div class="toolbar">
        <div
          class="grow"
          style="max-width:280px;"
        >
          <div class="control">
            <svg
              class="ic"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle
                cx="11"
                cy="11"
                r="8"
              />
              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
              />
            </svg>
            <input
              v-model="search"
              type="text"
              :placeholder="t('Search')"
            >
          </div>
        </div>

        <div style="width:220px;">
          <div class="control control--select">
            <svg
              class="ic"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <select
              v-model="categoryFilter"
              :value="categoryFilter"
            >
              <option :value="undefined">
                {{ t('All Categories') }}
              </option>
              <option
                v-for="opt in categoryOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.title }}
              </option>
            </select>
            <svg
              class="ic chev"
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
      </div>

      <!-- Active filter chips -->
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
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line
                  x1="18"
                  y1="6"
                  x2="6"
                  y2="18"
                />
                <line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                />
              </svg>
            </span>
          </span>
          <button
            class="chip--clear"
            @click="clearAll"
          >
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- Table -->
      <div class="tablewrap">
        <table class="dtable">
          <thead>
            <tr>
              <th style="width:80px;">
                {{ t('ID') }}
              </th>
              <th>{{ t('Name') }}</th>
              <th>{{ t('Price') }}</th>
              <th>{{ t('Category') }}</th>
              <th>{{ t('Created') }}</th>
              <th class="num">
                {{ t('Actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Skeleton rows -->
            <template v-if="loading && products.length === 0">
              <tr
                v-for="n in itemsPerPage"
                :key="`sk-${n}`"
              >
                <td>
                  <div
                    class="skel"
                    style="width:30px;height:13px;"
                  />
                </td>
                <td>
                  <div
                    class="row"
                    style="gap:8px;"
                  >
                    <div
                      class="skel"
                      style="width:10px;height:10px;border-radius:50%;flex:0 0 10px;"
                    />
                    <div
                      class="skel"
                      style="width:140px;height:13px;"
                    />
                  </div>
                </td>
                <td>
                  <div
                    class="skel"
                    style="width:80px;height:13px;"
                  />
                </td>
                <td>
                  <div
                    class="skel"
                    style="width:90px;height:22px;border-radius:12px;"
                  />
                </td>
                <td>
                  <div
                    class="skel"
                    style="width:90px;height:13px;"
                  />
                </td>
                <td>
                  <div
                    class="row"
                    style="justify-content:flex-end;gap:4px;"
                  >
                    <div
                      class="skel"
                      style="width:28px;height:28px;border-radius:50%;"
                    />
                    <div
                      class="skel"
                      style="width:28px;height:28px;border-radius:50%;"
                    />
                  </div>
                </td>
              </tr>
            </template>

            <!-- Empty -->
            <tr v-else-if="!loading && products.length === 0">
              <td
                colspan="6"
                style="padding:0;"
              >
                <div class="statefill">
                  <div class="statefill__icon">
                    <svg
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                      <line
                        x1="3"
                        y1="6"
                        x2="21"
                        y2="6"
                      />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  </div>
                  <div class="statefill__title">
                    {{ t('No products match your filters') }}
                  </div>
                  <div
                    v-if="activeFilters.length > 0"
                    style="margin-top:12px;"
                  >
                    <button
                      class="btn btn--secondary btn--sm"
                      @click="clearAll"
                    >
                      {{ t('Clear all') }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Real rows -->
            <tr
              v-for="p in products"
              v-else
              :key="p.id"
            >
              <td>
                <span class="mono cell-muted">#{{ p.id }}</span>
              </td>
              <td>
                <div
                  class="row"
                  style="gap:10px;"
                >
                  <div
                    :style="{ background: categoryColorMap[p.category?.id] || 'var(--border-strong)' }"
                    style="width:10px;height:10px;border-radius:3px;flex:0 0 10px;"
                  />
                  <span class="cell-strong">{{ p.name }}</span>
                  <span
                    v-if="p.is_instant"
                    class="badge t-warning"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="11"
                      height="11"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    {{ t('Instant') }}
                  </span>
                </div>
              </td>
              <td>
                <span class="mono cell-strong">{{ formatCurrency(p.price) }}</span>
              </td>
              <td>
                <span
                  v-if="p.category"
                  class="badge t-neutral"
                  :style="categoryColorMap[p.category.id]
                    ? { backgroundColor: `${categoryColorMap[p.category.id]}28`, color: categoryColorMap[p.category.id], borderColor: `${categoryColorMap[p.category.id]}40` }
                    : {}"
                >
                  {{ p.category.name }}
                </span>
                <span
                  v-else
                  class="tertiary"
                >—</span>
              </td>
              <td>
                <span class="mono cell-muted nowrap">{{ formatDate(p.created_at) }}</span>
              </td>
              <td>
                <div
                  class="row"
                  style="justify-content:flex-end;gap:2px;"
                >
                  <button
                    class="iconaction is-primary"
                    :title="t('Edit')"
                    @click="openEdit(p)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
                    </svg>
                  </button>
                  <button
                    class="iconaction is-danger"
                    :title="t('Delete')"
                    @click="confirmDelete(p)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalProducts > 0"
        class="pagination"
      >
        <span class="muted">
          {{ pageStart }}–{{ pageEnd }} {{ t('of') }} {{ totalProducts }}
        </span>
        <span class="pagination__spacer" />
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
    </div>

    <!-- ============== CREATE / EDIT MODAL ============== -->
    <div
      v-if="dialogOpen"
      class="overlay"
      @click.self="tryCloseDialog"
    >
      <div
        class="modal"
        style="max-width:560px;"
      >
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h2 class="modal__title">
              {{ editingProduct ? t('Edit Product') : t('Add Product') }}
            </h2>
            <div class="modal__sub">
              {{ editingProduct ? editingProduct.name : t('Catalog of products served at the POS') }}
            </div>
          </div>
          <button
            class="iconaction"
            :title="t('Close')"
            @click="tryCloseDialog"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              />
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              />
            </svg>
          </button>
        </div>

        <div class="modal__body">
          <!-- POS Preview -->
          <div class="pos-preview">
            <span
              class="field__label"
              style="display:block;margin-bottom:8px;"
            >{{ t('POS Preview') }}</span>
            <div class="pos-preview__cards">
              <div
                class="pos-product-card"
                :style="{ backgroundColor: previewColor }"
              >
                <div class="pos-product-card__name">
                  {{ form.name || t('Name') }}
                </div>
                <div class="pos-product-card__price">
                  {{ form.price ? `${formatCurrency(form.price)} so'm` : '0 so\'m' }}
                </div>
                <div
                  v-if="form.color"
                  class="pos-product-card__stripe"
                  :style="{ backgroundColor: form.color }"
                />
              </div>
            </div>
          </div>

          <div class="form-grid">
            <div
              class="field span-2"
            >
              <label class="field__label">{{ t('Name') }}</label>
              <div class="control">
                <input
                  v-model="form.name"
                  type="text"
                >
              </div>
            </div>

            <div
              class="field span-2"
            >
              <label class="field__label">{{ t('Description') }}</label>
              <div class="control">
                <input
                  v-model="form.description"
                  type="text"
                >
              </div>
            </div>

            <div
              class="field span-2"
            >
              <label class="field__label">{{ t('Instant — skip the kitchen / KDS') }}</label>
              <div
                class="row"
                style="gap:12px;justify-content:space-between;"
              >
                <span
                  class="field__hint"
                  style="flex:1;"
                >{{ t('Cold drinks, packaged items, etc. Skips PREPARING; never appears on chef display.') }}</span>
                <div
                  class="switch"
                  :class="{ 'is-on': form.is_instant }"
                  @click="form.is_instant = !form.is_instant"
                />
              </div>
            </div>

            <div class="field">
              <label class="field__label">{{ t('Price') }}</label>
              <div class="control">
                <input
                  type="text"
                  inputmode="numeric"
                  :value="priceDisplay"
                  @input="onPriceInput"
                >
              </div>
            </div>

            <div class="field">
              <label class="field__label">{{ t('Category') }}</label>
              <div class="control control--select">
                <select v-model="form.category_id">
                  <option :value="null">
                    {{ t('All Categories') }}
                  </option>
                  <option
                    v-for="opt in categoryOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.title }}
                  </option>
                </select>
                <svg
                  class="ic chev"
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

            <div
              class="field span-2"
            >
              <label class="field__label">{{ t('Product Color') }}</label>
              <div class="char-colors">
                <button
                  v-for="c in characteristicColors"
                  :key="c.key"
                  type="button"
                  class="char-dot"
                  :class="{ 'char-dot--active': form.color === c.hex }"
                  :style="{ backgroundColor: c.hex }"
                  :title="c.label"
                  @click="form.color = form.color === c.hex ? '' : c.hex"
                />
                <button
                  v-if="form.color"
                  type="button"
                  class="char-dot char-dot--clear"
                  :title="t('Clear')"
                  @click="form.color = ''"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line
                      x1="18"
                      y1="6"
                      x2="6"
                      y2="18"
                    />
                    <line
                      x1="6"
                      y1="6"
                      x2="18"
                      y2="18"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal__foot">
          <button
            class="btn btn--ghost"
            :disabled="dialogLoading"
            @click="tryCloseDialog"
          >
            {{ t('Cancel') }}
          </button>
          <button
            class="btn btn--primary"
            :class="{ 'is-loading': dialogLoading }"
            :disabled="dialogLoading"
            @click="saveProduct"
          >
            <svg
              class="ic"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ t('Save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ============== DELETE CONFIRM MODAL ============== -->
    <div
      v-if="deleteDialog"
      class="overlay"
      @click.self="deleteDialog = false"
    >
      <div
        class="modal"
        style="max-width:440px;"
      >
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h2 class="modal__title">
              {{ t('Delete Product') }}
            </h2>
          </div>
          <button
            class="iconaction"
            :title="t('Close')"
            @click="deleteDialog = false"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
              />
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
              />
            </svg>
          </button>
        </div>

        <div class="modal__body">
          <div
            class="row"
            style="gap:14px;align-items:flex-start;"
          >
            <div
              class="kpi__icon t-error"
              style="width:44px;height:44px;flex:0 0 44px;"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <line
                  x1="12"
                  y1="9"
                  x2="12"
                  y2="13"
                />
                <line
                  x1="12"
                  y1="17"
                  x2="12.01"
                  y2="17"
                />
              </svg>
            </div>
            <div>
              <p style="margin:0;font-weight:600;">
                {{ deletingProduct?.name }} {{ t('will be removed.') }}
              </p>
              <p
                class="muted"
                style="margin:6px 0 0;font-size:14px;"
              >
                {{ t('Are you sure you want to delete this product?') }}
              </p>
            </div>
          </div>
        </div>

        <div class="modal__foot">
          <button
            class="btn btn--ghost"
            @click="deleteDialog = false"
          >
            {{ t('Cancel') }}
          </button>
          <button
            class="btn btn--danger"
            @click="deleteProduct"
          >
            <svg
              class="ic"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {{ t('Delete') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Snackbar (Vuetify allowed off-page for global toast) -->
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
/* ── POS Preview ── */
.pos-preview {
  background: var(--surface-inset);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 14px;
  margin-bottom: var(--sp-4);
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
  transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.char-dot:hover {
  transform: scale(1.15);
}

.char-dot--active {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-weak-2);
}

.char-dot--clear {
  background: var(--surface-inset);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })

const links = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')

const linkTypes = ref<any[]>([])
const deductStatuses = ref<any[]>([])

const dialog = ref(false)
const saving = ref(false)
const unlinkDialog = ref(false)
const unlinking = ref(false)
const selectedItem = ref<any>(null)

// Options for selectors
const products = ref<any[]>([])
const recipes = ref<any[]>([])
const stockItems = ref<any[]>([])
const units = ref<any[]>([])

const form = ref({
  product_id: null as number | null,
  link_type: 'RECIPE',
  recipe_id: null as number | null,
  stock_item_id: null as number | null,
  quantity_per_sale: 1,
  unit_id: null as number | null,
  deduct_on_status: 'PREPARING',
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const typeColor: Record<string, string> = {
  RECIPE: 'primary',
  DIRECT_ITEM: 'info',
  COMPONENT_BASED: 'warning',
}

const headers = [
  { title: t('Product'), key: 'product', sortable: false },
  { title: t('Link Type'), key: 'link_type', sortable: false },
  { title: t('Stock Item / Recipe'), key: 'linked_to', sortable: false },
  { title: t('Deduct On'), key: 'deduct_on_status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadLinks() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value

    const res = await axios.get('/product-links/', { params })
    const d = res.data
    links.value = d.links ?? []
    total.value = d.pagination?.total_items ?? d.count ?? links.value.length
    if (d.link_types) linkTypes.value = d.link_types
    if (d.deduct_statuses) deductStatuses.value = d.deduct_statuses
  }
  catch {
    notify(t('Failed to load product links'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadOptions() {
  try {
    const [prodRes, recRes, itemRes, unitRes] = await Promise.all([
      axios.get('/products', { params: { per_page: 200 } }),
      axios.get('/recipes/', { params: { per_page: 300, is_active: true } }),
      axios.get('/items/', { params: { per_page: 300 } }),
      axios.get('/units/', { params: { per_page: 200 } }),
    ])
    products.value = (prodRes.data.products ?? prodRes.data.results ?? []).map((p: any) => ({ title: p.name, value: p.id }))
    recipes.value = (recRes.data.recipes ?? recRes.data.results ?? []).map((r: any) => ({ title: r.name, value: r.id }))
    stockItems.value = (itemRes.data.items ?? itemRes.data.results ?? []).map((i: any) => ({ title: i.name, value: i.id }))
    units.value = (unitRes.data.units ?? unitRes.data.results ?? []).map((u: any) => ({ title: `${u.name} (${u.short_name})`, value: u.id }))
  }
  catch {
    // silent — options will be empty
  }
}

onMounted(() => { loadLinks(); loadOptions() })
watch([page, itemsPerPage], loadLinks)
watch(search, () => { page.value = 1; loadLinks() })

function openLink() {
  form.value = {
    product_id: null,
    link_type: 'RECIPE',
    recipe_id: null,
    stock_item_id: null,
    quantity_per_sale: 1,
    unit_id: null,
    deduct_on_status: 'PREPARING',
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    if (form.value.link_type === 'RECIPE') {
      await axios.post(`/products/${form.value.product_id}/link-recipe/`, {
        recipe_id: form.value.recipe_id,
        deduct_on_status: form.value.deduct_on_status,
      })
    }
    else {
      await axios.post(`/products/${form.value.product_id}/link-item/`, {
        stock_item_id: form.value.stock_item_id,
        quantity_per_sale: form.value.quantity_per_sale,
        unit_id: form.value.unit_id,
        deduct_on_status: form.value.deduct_on_status,
      })
    }
    notify(t('Product linked'))
    dialog.value = false
    loadLinks()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error linking product'), 'error')
  }
  finally {
    saving.value = false
  }
}

function confirmUnlink(item: any) {
  selectedItem.value = item
  unlinkDialog.value = true
}

async function doUnlink() {
  unlinking.value = true
  try {
    await axios.delete(`/products/${selectedItem.value.product_id ?? selectedItem.value.product?.id}/unlink/`)
    notify(t('Product unlinked'))
    unlinkDialog.value = false
    loadLinks()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error unlinking product'), 'error')
  }
  finally {
    unlinking.value = false
  }
}

const linkTypeItems = computed(() =>
  [{ title: t('Recipe'), value: 'RECIPE' }, { title: t('Direct Item'), value: 'DIRECT_ITEM' }],
)

const deductStatusItems = computed(() =>
  deductStatuses.value.length
    ? deductStatuses.value.map((s: any) => ({ title: s.label, value: s.value }))
    : [
        { title: t('Order Created'), value: 'CREATED' },
        { title: t('Preparing'), value: 'PREPARING' },
        { title: t('Ready'), value: 'READY' },
        { title: t('Paid'), value: 'PAID' },
      ],
)
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search product links...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 240px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn prepend-icon="bx-link" @click="openLink">{{ t('Link Product') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="links"
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

        <template v-if="loading && links.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:120px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:140px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.product="{ item }">
          {{ item.raw.product?.name ?? item.raw.product_name ?? '—' }}
        </template>
        <template #item.link_type="{ item }">
          <VChip :color="typeColor[item.raw.link_type] ?? 'default'" size="small" variant="tonal">
            {{ item.raw.link_type_display ?? item.raw.link_type }}
          </VChip>
        </template>
        <template #item.linked_to="{ item }">
          {{ item.raw.recipe?.name ?? item.raw.stock_item?.name ?? item.raw.linked_name ?? '—' }}
        </template>
        <template #item.deduct_on_status="{ item }">
          <VChip color="info" size="small" variant="tonal">
            {{ item.raw.deduct_on_status_display ?? item.raw.deduct_on_status }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn icon variant="text" size="small" color="error" @click="confirmUnlink(item.raw)">
              <VIcon size="18" icon="bx-unlink" />
              <VTooltip activator="parent" location="top">{{ t('Unlink') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog v-model="dialog" max-width="520" persistent>
      <VCard :title="t('Link Product')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VSelect
                v-model="form.product_id"
                :items="products"
                :label="t('Product')"
                :placeholder="t('Select product')"
                required
              />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect
                v-model="form.link_type"
                :items="linkTypeItems"
                :label="t('Link Type')"
                required
              />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect
                v-model="form.deduct_on_status"
                :items="deductStatusItems"
                :label="t('Deduct On')"
                required
              />
            </VCol>
            <template v-if="form.link_type === 'RECIPE'">
              <VCol cols="12">
                <VSelect
                  v-model="form.recipe_id"
                  :items="recipes"
                  :label="t('Recipe')"
                  :placeholder="t('Select recipe')"
                  required
                />
              </VCol>
            </template>
            <template v-if="form.link_type === 'DIRECT_ITEM'">
              <VCol cols="12">
                <VSelect
                  v-model="form.stock_item_id"
                  :items="stockItems"
                  :label="t('Stock Item')"
                  :placeholder="t('Select stock item')"
                  required
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VTextField
                  v-model.number="form.quantity_per_sale"
                  :label="t('Quantity per Sale')"
                  type="number"
                  step="0.01"
                  :min="0.01"
                />
              </VCol>
              <VCol cols="12" sm="6">
                <VSelect
                  v-model="form.unit_id"
                  :items="units"
                  :label="t('Unit')"
                  :placeholder="t('Select unit')"
                />
              </VCol>
            </template>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="dialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :loading="saving" @click="save">{{ t('Save') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="unlinkDialog" max-width="400">
      <VCard :title="t('Unlink Product')">
        <VCardText>{{ t('Are you sure you want to unlink') }} <strong>{{ selectedItem?.product?.name ?? selectedItem?.product_name }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="unlinkDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn color="error" :loading="unlinking" @click="doUnlink">{{ t('Unlink') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-product-links
meta:
  action: manage
  subject: all
</route>

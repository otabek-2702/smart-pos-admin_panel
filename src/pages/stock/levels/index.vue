<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })

const levels = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const locationFilter = ref<number | undefined>(undefined)
const lowStockOnly = ref(false)

const locationsList = ref<any[]>([])

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDateShort } = useFormatters()

const headers = [
  { title: t('Item'), key: 'item', sortable: false },
  { title: t('SKU'), key: 'sku', sortable: false },
  { title: t('Location'), key: 'location', sortable: false },
  { title: t('Quantity'), key: 'quantity', sortable: false },
  { title: t('Reserved'), key: 'reserved_quantity', sortable: false },
  { title: t('Available'), key: 'available_quantity', sortable: false },
  { title: t('Pending In'), key: 'pending_in_quantity', sortable: false },
  { title: t('Last Movement'), key: 'last_movement_at', sortable: false },
]

function formatQty(val: any) {
  if (val === null || val === undefined) return '0'
  const n = Number(val)
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

async function loadLevels() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (locationFilter.value) params.location_id = locationFilter.value
    if (lowStockOnly.value) params.low_stock = true

    const res = await axios.get('/levels/', { params })
    const d = res.data
    levels.value = d.levels ?? []
    total.value = d.pagination?.total_items ?? levels.value.length
  }
  catch {
    notify(t('Failed to load stock levels'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadLocations() {
  try {
    const res = await axios.get('/locations/', { params: { per_page: 200 } })
    locationsList.value = res.data.locations ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadLevels(); loadLocations() })
watch([page, itemsPerPage], loadLevels)
watch([search, locationFilter, lowStockOnly], () => { page.value = 1; loadLevels() })

const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))

function qtyColor(qty: number) {
  if (qty <= 0) return 'error'
  if (qty < 5) return 'warning'
  return 'success'
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search by item name or SKU...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 260px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="locationFilter"
          :items="locationOptions"
          :placeholder="t('All Locations')"
          density="compact"
          style="min-inline-size: 200px;"
          hide-details
          clearable
        />
        <VSwitch
          v-model="lowStockOnly"
          :label="t('Low Stock Only')"
          density="compact"
          hide-details
          class="flex-grow-0"
        />
        <VSpacer />
        <VBtn variant="tonal" prepend-icon="bx-refresh" @click="loadLevels">{{ t('Refresh') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="levels"
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

        <template v-if="loading && levels.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:130px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:50px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:50px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:13px;border-radius:4px;" /></td>
          </tr>
        </template>

        <template #item.item="{ item }">
          <span class="font-weight-medium">{{ item.raw.stock_item?.name ?? '—' }}</span>
        </template>
        <template #item.sku="{ item }">
          <span class="text-body-2 text-disabled">{{ item.raw.stock_item?.sku ?? '—' }}</span>
        </template>
        <template #item.location="{ item }">
          {{ item.raw.location?.name ?? '—' }}
        </template>
        <template #item.quantity="{ item }">
          <VChip :color="qtyColor(item.raw.quantity)" size="small" variant="tonal">
            {{ formatQty(item.raw.quantity) }} {{ item.raw.stock_item?.unit ?? '' }}
          </VChip>
        </template>
        <template #item.reserved_quantity="{ item }">
          {{ formatQty(item.raw.reserved_quantity) }}
        </template>
        <template #item.available_quantity="{ item }">
          <span :class="Number(item.raw.available_quantity) <= 0 ? 'text-error font-weight-medium' : ''">
            {{ formatQty(item.raw.available_quantity) }}
          </span>
        </template>
        <template #item.pending_in_quantity="{ item }">
          {{ formatQty(item.raw.pending_in_quantity) }}
        </template>
        <template #item.last_movement_at="{ item }">
          {{ formatDateShort(item.raw.last_movement_at) }}
        </template>
      </VDataTableServer>
    </VCard>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-levels
meta:
  action: manage
  subject: all
</route>

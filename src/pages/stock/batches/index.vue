<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })

const batches = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const statusFilter = ref<string | undefined>(undefined)
const locationFilter = ref<number | undefined>(undefined)
const expiryFilter = ref<string | undefined>(undefined)

const locationsList = ref<any[]>([])
const statusOptions = ref<any[]>([])

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDateShort } = useFormatters()

const BATCH_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'success',
  RESERVED: 'warning',
  QUARANTINE: 'error',
  EXPIRED: 'error',
  CONSUMED: 'secondary',
}

const QUALITY_STATUS_COLOR: Record<string, string> = {
  PASSED: 'success',
  FAILED: 'error',
  PENDING: 'warning',
}

const headers = [
  { title: t('Batch #'), key: 'batch_number', sortable: false },
  { title: t('Item'), key: 'item', sortable: false },
  { title: t('Location'), key: 'location', sortable: false },
  { title: t('Current Qty'), key: 'current_quantity', sortable: false },
  { title: t('Available'), key: 'available_quantity', sortable: false },
  { title: t('Unit Cost'), key: 'unit_cost', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Expiry'), key: 'expiry_date', sortable: false },
  { title: t('Quality'), key: 'quality_status', sortable: false },
]

function formatQty(val: any) {
  if (val === null || val === undefined) return '0'
  const n = Number(val)
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

async function loadBatches() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value
    if (locationFilter.value) params.location_id = locationFilter.value
    if (expiryFilter.value === 'expiring_soon') params.expiring_days = 7
    else if (expiryFilter.value === 'expired') params.expired = true

    const res = await axios.get('/batches/', { params })
    const d = res.data
    batches.value = d.batches ?? []
    total.value = d.pagination?.total_items ?? batches.value.length

    if (d.statuses && statusOptions.value.length === 0)
      statusOptions.value = d.statuses.map((s: any) => ({ title: s.label, value: s.value }))
  }
  catch {
    notify(t('Failed to load batches'), 'error')
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

onMounted(() => { loadBatches(); loadLocations() })
watch([page, itemsPerPage], loadBatches)
watch([search, statusFilter, locationFilter, expiryFilter], () => { page.value = 1; loadBatches() })

const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search by item name...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 240px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="statusFilter"
          :items="statusOptions"
          :placeholder="t('All Statuses')"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="locationFilter"
          :items="locationOptions"
          :placeholder="t('All Locations')"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="expiryFilter"
          :items="[{ title: t('Expiring Soon (7 days)'), value: 'expiring_soon' }, { title: t('Expired'), value: 'expired' }]"
          :placeholder="t('All Expiry')"
          density="compact"
          style="min-inline-size: 200px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn variant="tonal" prepend-icon="bx-refresh" @click="loadBatches">{{ t('Refresh') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="batches"
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

        <template v-if="loading && batches.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:140px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:110px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:22px;border-radius:12px;" /></td>
          </tr>
        </template>

        <template #item.batch_number="{ item }">
          <span class="font-weight-medium text-body-2">{{ item.raw.batch_number }}</span>
        </template>
        <template #item.item="{ item }">
          <span class="font-weight-medium">{{ item.raw.stock_item?.name ?? '—' }}</span>
        </template>
        <template #item.location="{ item }">
          {{ item.raw.location_name ?? '—' }}
        </template>
        <template #item.current_quantity="{ item }">
          {{ formatQty(item.raw.current_quantity) }}
        </template>
        <template #item.available_quantity="{ item }">
          <span :class="Number(item.raw.available_quantity) <= 0 ? 'text-error font-weight-medium' : ''">
            {{ formatQty(item.raw.available_quantity) }}
          </span>
        </template>
        <template #item.unit_cost="{ item }">
          {{ formatCurrency(item.raw.unit_cost) }}
        </template>
        <template #item.status="{ item }">
          <VChip :color="BATCH_STATUS_COLOR[item.raw.status] ?? 'default'" size="small" variant="tonal">
            {{ item.raw.status_display ?? item.raw.status }}
          </VChip>
        </template>
        <template #item.expiry_date="{ item }">
          <span class="text-body-2">{{ item.raw.expiry_date ? formatDateShort(item.raw.expiry_date) : '—' }}</span>
        </template>
        <template #item.quality_status="{ item }">
          <VChip :color="QUALITY_STATUS_COLOR[item.raw.quality_status] ?? 'default'" size="small" variant="tonal">
            {{ item.raw.quality_status?.replace(/_/g, ' ') ?? '—' }}
          </VChip>
        </template>
      </VDataTableServer>
    </VCard>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-batches
meta:
  action: manage
  subject: all
</route>

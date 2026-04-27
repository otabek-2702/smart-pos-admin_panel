<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })

const transactions = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const typeFilter = ref<string | undefined>(undefined)
const locationFilter = ref<number | undefined>(undefined)
const itemFilter = ref<string>('')

const locationsList = ref<any[]>([])

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

// Real movement types from the API
const movementTypes = [
  'PURCHASE_IN', 'SALE_OUT', 'TRANSFER_IN', 'TRANSFER_OUT',
  'PRODUCTION_IN', 'PRODUCTION_OUT', 'ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS',
  'WASTE', 'SPOILAGE', 'RETURN_FROM_CUSTOMER', 'RETURN_TO_SUPPLIER',
  'COUNT_ADJUSTMENT', 'OPENING_BALANCE',
]

const typeColor: Record<string, string> = {
  PURCHASE_IN: 'success',
  SALE_OUT: 'error',
  TRANSFER_IN: 'info',
  TRANSFER_OUT: 'secondary',
  PRODUCTION_IN: 'primary',
  PRODUCTION_OUT: 'warning',
  ADJUSTMENT_PLUS: 'success',
  ADJUSTMENT_MINUS: 'error',
  WASTE: 'error',
  SPOILAGE: 'error',
  RETURN_FROM_CUSTOMER: 'warning',
  RETURN_TO_SUPPLIER: 'warning',
  COUNT_ADJUSTMENT: 'secondary',
  OPENING_BALANCE: 'info',
}

const typeIcon: Record<string, string> = {
  PURCHASE_IN: 'bx-plus-circle',
  SALE_OUT: 'bx-minus-circle',
  TRANSFER_IN: 'bx-import',
  TRANSFER_OUT: 'bx-export',
  PRODUCTION_IN: 'bx-cog',
  PRODUCTION_OUT: 'bx-cog',
  ADJUSTMENT_PLUS: 'bx-plus',
  ADJUSTMENT_MINUS: 'bx-minus',
  WASTE: 'bx-trash',
  SPOILAGE: 'bx-error',
  RETURN_FROM_CUSTOMER: 'bx-undo',
  RETURN_TO_SUPPLIER: 'bx-undo',
  COUNT_ADJUSTMENT: 'bx-list-check',
  OPENING_BALANCE: 'bx-history',
}

const headers = [
  { title: t('Date'), key: 'created_at', sortable: false },
  { title: t('Type'), key: 'movement_type', sortable: false },
  { title: t('Item'), key: 'item', sortable: false },
  { title: t('Location'), key: 'location', sortable: false },
  { title: t('Qty Change'), key: 'quantity_change', sortable: false },
  { title: t('Before'), key: 'quantity_before', sortable: false },
  { title: t('After'), key: 'quantity_after', sortable: false },
  { title: t('Reference'), key: 'reference', sortable: false },
]

function formatQty(val: any) {
  if (val === null || val === undefined) return '0'
  const n = Number(val)
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

async function loadTransactions() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (typeFilter.value) params.movement_type = typeFilter.value
    if (locationFilter.value) params.location_id = locationFilter.value
    if (itemFilter.value) params.search = itemFilter.value

    const res = await axios.get('/transactions/', { params })
    const d = res.data
    transactions.value = d.transactions ?? []
    total.value = d.pagination?.total_items ?? transactions.value.length
  }
  catch {
    notify(t('Failed to load transactions'), 'error')
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

onMounted(() => { loadTransactions(); loadLocations() })
watch([page, itemsPerPage], loadTransactions)
watch([typeFilter, locationFilter, itemFilter], () => { page.value = 1; loadTransactions() })

const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="itemFilter"
          :placeholder="t('Search by item...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 200px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="typeFilter"
          :items="movementTypes"
          :placeholder="t('All Types')"
          density="compact"
          style="min-inline-size: 200px;"
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
        <VSpacer />
        <VBtn variant="tonal" prepend-icon="bx-refresh" @click="loadTransactions">{{ t('Refresh') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="transactions"
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
            :per-page-options="[10, 25, 50, 100]"
          />
        </template>

        <template v-if="loading && transactions.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:110px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:110px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:130px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:50px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:50px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:13px;border-radius:4px;" /></td>
          </tr>
        </template>

        <template #item.created_at="{ item }">
          <span class="text-body-2">{{ formatDate(item.raw.created_at) }}</span>
        </template>
        <template #item.movement_type="{ item }">
          <VChip :color="typeColor[item.raw.movement_type] ?? 'default'" size="small" variant="tonal">
            <VIcon start :icon="typeIcon[item.raw.movement_type] ?? 'bx-circle'" size="13" />
            {{ item.raw.movement_type?.replace(/_/g, ' ') }}
          </VChip>
        </template>
        <template #item.item="{ item }">
          <span class="font-weight-medium">{{ item.raw.stock_item?.name ?? item.raw.item?.name ?? '—' }}</span>
        </template>
        <template #item.location="{ item }">
          {{ item.raw.location?.name ?? '—' }}
        </template>
        <template #item.quantity_change="{ item }">
          <span :class="Number(item.raw.quantity_change) >= 0 ? 'text-success' : 'text-error'" class="font-weight-medium">
            {{ Number(item.raw.quantity_change) >= 0 ? '+' : '' }}{{ formatQty(item.raw.quantity_change) }}
          </span>
        </template>
        <template #item.quantity_before="{ item }">
          <span class="text-disabled text-body-2">{{ formatQty(item.raw.quantity_before) }}</span>
        </template>
        <template #item.quantity_after="{ item }">
          <span class="text-body-2">{{ formatQty(item.raw.quantity_after) }}</span>
        </template>
        <template #item.reference="{ item }">
          <span class="text-body-2 text-disabled">{{ item.raw.reference_type ? `${item.raw.reference_type} #${item.raw.reference_id}` : '—' }}</span>
        </template>
      </VDataTableServer>
    </VCard>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-transactions
meta:
  action: manage
  subject: all
</route>

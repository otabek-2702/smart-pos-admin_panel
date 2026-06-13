<script setup lang="ts">
import { stockApi as axios } from '@/plugins/axios'
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
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const, width: '120px' },
]

const MOVEMENT_TYPES = ['ADJUSTMENT', 'WASTE', 'COUNT', 'RETURN', 'PURCHASE', 'SALE']

function formatQty(val: any) {
  if (val === null || val === undefined)
    return '0'
  const n = Number(val)

  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

async function loadLevels() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (locationFilter.value)
      params.location_id = locationFilter.value
    if (lowStockOnly.value)
      params.low_stock = true

    const res = await axios.get('/levels/', { params })
    const d = res.data?.data ?? res.data

    levels.value = d?.levels ?? []
    total.value = d.pagination?.total_items ?? d.pagination?.total ?? levels.value.length
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
    const d = res.data?.data ?? res.data

    locationsList.value = d?.locations ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadLevels(); loadLocations() })
watch([page, itemsPerPage], loadLevels)
watch([search, locationFilter, lowStockOnly], () => { page.value = 1; loadLevels() })

const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))

function qtyColor(qty: number) {
  if (qty <= 0)
    return 'error'
  if (qty < 5)
    return 'warning'

  return 'success'
}

// -------- adjust / reserve / release --------
type Mode = 'adjust' | 'reserve' | 'release'

const actionDialog = ref(false)
const actionMode = ref<Mode>('adjust')
const actionLevel = ref<any>(null)
const actionSaving = ref(false)
const actionForm = ref({
  quantity: 0,
  movement_type: 'ADJUSTMENT',
  notes: '',
})

function openAction(mode: Mode, level: any) {
  actionMode.value = mode
  actionLevel.value = level
  actionForm.value = {
    quantity: 0,
    movement_type: mode === 'adjust' ? 'ADJUSTMENT' : 'ADJUSTMENT',
    notes: '',
  }
  actionDialog.value = true
}

const actionTitle = computed(() => {
  if (actionMode.value === 'adjust') return t('Adjust quantity')
  if (actionMode.value === 'reserve') return t('Reserve stock')

  return t('Release reservation')
})

const projectedQty = computed(() => {
  if (!actionLevel.value)
    return 0
  const qty = Number(actionForm.value.quantity || 0)
  const current = Number(actionLevel.value.quantity ?? 0)
  if (actionMode.value === 'adjust')
    return current + qty // signed (negative reduces)

  return current
})

const projectedReserved = computed(() => {
  if (!actionLevel.value)
    return 0
  const qty = Math.abs(Number(actionForm.value.quantity || 0))
  const current = Number(actionLevel.value.reserved_quantity ?? 0)
  if (actionMode.value === 'reserve')
    return current + qty
  if (actionMode.value === 'release')
    return Math.max(0, current - qty)

  return current
})

async function doAction() {
  if (!actionLevel.value || actionForm.value.quantity === 0) {
    notify(t('Quantity must not be zero'), 'error')

    return
  }
  actionSaving.value = true
  const stock_item_id = actionLevel.value.stock_item_id ?? actionLevel.value.stock_item?.id
  const location_id = actionLevel.value.location_id ?? actionLevel.value.location?.id
  try {
    if (actionMode.value === 'adjust') {
      await axios.post('/adjust/', {
        stock_item_id,
        location_id,
        quantity: actionForm.value.quantity,
        movement_type: actionForm.value.movement_type,
        notes: actionForm.value.notes,
      })
    }
    else if (actionMode.value === 'reserve') {
      await axios.post('/reserve/', {
        stock_item_id,
        location_id,
        quantity: actionForm.value.quantity,
        notes: actionForm.value.notes,
      })
    }
    else {
      await axios.post('/release-reservation/', {
        stock_item_id,
        location_id,
        quantity: actionForm.value.quantity,
        notes: actionForm.value.notes,
      })
    }
    notify(t('Saved'))
    actionDialog.value = false
    await loadLevels()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    actionSaving.value = false
  }
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
        <VBtn
          variant="tonal"
          prepend-icon="bx-refresh"
          @click="loadLevels"
        >
          {{ t('Refresh') }}
        </VBtn>
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

        <template
          v-if="loading && levels.length === 0"
          #body
        >
          <tr
            v-for="n in itemsPerPage"
            :key="n"
            class="sk-row"
          >
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:130px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:70px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:100px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:22px;border-radius:12px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:50px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:22px;border-radius:12px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:50px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:90px;height:13px;border-radius:4px;"
              />
            </td>
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
          <VChip
            :color="qtyColor(item.raw.quantity)"
            size="small"
            variant="tonal"
            class="status-pill num-tabular"
          >
            {{ formatQty(item.raw.quantity) }} {{ item.raw.stock_item?.unit ?? '' }}
          </VChip>
        </template>
        <template #item.reserved_quantity="{ item }">
          <span class="num-tabular">{{ formatQty(item.raw.reserved_quantity) }}</span>
        </template>
        <template #item.available_quantity="{ item }">
          <span :class="['num-tabular', Number(item.raw.available_quantity) <= 0 ? 'text-error font-weight-medium' : '']">
            {{ formatQty(item.raw.available_quantity) }}
          </span>
        </template>
        <template #item.pending_in_quantity="{ item }">
          <span class="num-tabular">{{ formatQty(item.raw.pending_in_quantity) }}</span>
        </template>
        <template #item.last_movement_at="{ item }">
          {{ formatDateShort(item.raw.last_movement_at) }}
        </template>
        <template #item.actions="{ item }">
          <div
            class="d-flex justify-end"
            style="gap:2px;"
          >
            <VBtn
              icon
              variant="text"
              size="small"
              color="primary"
              @click="openAction('adjust', item.raw)"
            >
              <VIcon icon="bx-edit" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Adjust') }}</VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              color="warning"
              @click="openAction('reserve', item.raw)"
            >
              <VIcon icon="bx-lock" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Reserve') }}</VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              color="success"
              :disabled="Number(item.raw.reserved_quantity ?? 0) === 0"
              @click="openAction('release', item.raw)"
            >
              <VIcon icon="bx-lock-open" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Release reservation') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Adjust / reserve / release dialog -->
    <VDialog
      v-model="actionDialog"
      max-width="520"
      persistent
    >
      <VCard :title="actionTitle">
        <VCardText>
          <div
            v-if="actionLevel"
            class="text-body-2 mb-3"
          >
            <strong>{{ actionLevel.stock_item?.name ?? actionLevel.item?.name ?? '—' }}</strong>
            <span class="text-disabled"> @ {{ actionLevel.location?.name ?? actionLevel.location_name ?? '—' }}</span>
            <div class="text-caption text-disabled mt-1">
              {{ t('Current') }}: {{ formatQty(actionLevel.quantity) }}
              · {{ t('Reserved') }}: {{ formatQty(actionLevel.reserved_quantity) }}
              · {{ t('Available') }}: {{ formatQty(actionLevel.available_quantity) }}
            </div>
          </div>

          <VRow>
            <VCol cols="12" sm="6">
              <VTextField
                v-model.number="actionForm.quantity"
                :label="t('Quantity') + (actionMode === 'adjust' ? ' (' + t('signed: +/−') + ')' : '')"
                type="number"
                step="0.01"
                autofocus
              />
            </VCol>
            <VCol
              v-if="actionMode === 'adjust'"
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="actionForm.movement_type"
                :items="MOVEMENT_TYPES"
                :label="t('Movement type')"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="actionForm.notes"
                :label="t('Notes')"
              />
            </VCol>
          </VRow>

          <VAlert
            v-if="actionMode === 'adjust'"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ t('Projected qty') }}: <strong>{{ formatQty(projectedQty) }}</strong>
          </VAlert>
          <VAlert
            v-else
            type="info"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ t('Projected reserved') }}: <strong>{{ formatQty(projectedReserved) }}</strong>
          </VAlert>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="actionDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="actionSaving"
            @click="doAction"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-levels
meta:
  action: manage
  subject: all
</route>

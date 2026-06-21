<script setup lang="ts">
import { stockApi as axios } from '@/plugins/axios'
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
const stockItemFilter = ref<number | undefined>(undefined)
const includeZeroStock = ref(false)
const expiringWithinDays = ref<number | undefined>(undefined)

// Extended: status select filter all|expiring|expired
const extStatusFilter = ref<'all' | 'expiring' | 'expired'>('all')
const extDaysAhead = ref<number>(7)
const extStatusOptions = computed(() => [
  { title: t('All Statuses'), value: 'all' },
  { title: t('batches_ext_tab_expiring'), value: 'expiring' },
  { title: t('batches_ext_tab_expired'), value: 'expired' },
])

// Consume modal state
const consumeDialog = ref(false)
const consumeBatch = ref<any | null>(null)
const consumeQty = ref<number | undefined>(undefined)
const consumeNotes = ref('')
const consumeSubmitting = ref(false)

// Auto-consume modal state
const autoConsumeDialog = ref(false)
const autoConsumeStockItem = ref<number | undefined>(undefined)
const autoConsumeLocation = ref<number | undefined>(undefined)
const autoConsumeQty = ref<number | undefined>(undefined)
const autoConsumeSubmitting = ref(false)
const autoConsumeResult = ref<any | null>(null)

const locationsList = ref<any[]>([])
const stockItemsList = ref<any[]>([])
const statusOptions = computed(() => ['AVAILABLE', 'RESERVED', 'QUARANTINE', 'EXPIRED', 'CONSUMED'].map(v => ({ title: t(`batch_status_${v}`), value: v })))

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
  { title: t('Received date'), key: 'received_date', sortable: false },
  { title: t('Initial qty'), key: 'initial_quantity', sortable: false },
  { title: t('Current Qty'), key: 'current_quantity', sortable: false },
  { title: t('Reserved qty'), key: 'reserved_quantity', sortable: false },
  { title: t('Available'), key: 'available_quantity', sortable: false },
  { title: t('Unit Cost'), key: 'unit_cost', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Expiry'), key: 'expiry_date', sortable: false },
  { title: t('Quality'), key: 'quality_status', sortable: false },
  { title: t('batches_ext_col_actions'), key: 'actions', sortable: false, width: 80 },
]

function formatQty(val: any) {
  if (val === null || val === undefined)
    return '0'
  const n = Number(val)

  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

async function loadBatches() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (statusFilter.value)
      params.status = statusFilter.value
    if (locationFilter.value)
      params.location_id = locationFilter.value
    if (stockItemFilter.value)
      params.stock_item_id = stockItemFilter.value
    if (includeZeroStock.value)
      params.has_stock_only = 'false'
    if (expiringWithinDays.value && Number(expiringWithinDays.value) > 0)
      params.expiring_within_days = Number(expiringWithinDays.value)
    if (expiryFilter.value === 'expiring_soon')
      params.expiring_within_days = 7
    else if (expiryFilter.value === 'expired')
      params.expired_only = true

    // Extended: route to /batches/expiring/ or /batches/expired/ depending on ext status filter
    let endpoint = '/batches/'
    if (extStatusFilter.value === 'expiring') {
      endpoint = '/batches/expiring/'
      const d = Number(extDaysAhead.value)
      if (d && d > 0)
        params.days = d
    }
    else if (extStatusFilter.value === 'expired') {
      endpoint = '/batches/expired/'
    }

    const res = await axios.get(endpoint, { params })
    const d = res.data?.data ?? res.data

    batches.value = d?.batches ?? d?.results ?? (Array.isArray(d) ? d : [])
    total.value = d.pagination?.total_items ?? d.pagination?.total ?? batches.value.length
  }
  catch {
    notify(t('Failed to load batches'), 'error')
  }
  finally {
    loading.value = false
  }
}

function openConsumeDialog(row: any) {
  consumeBatch.value = row
  consumeQty.value = undefined
  consumeNotes.value = ''
  consumeDialog.value = true
}

async function submitConsume() {
  if (!consumeBatch.value) {
    notify(t('batches_ext_select_batch_first'), 'error')

    return
  }
  const qty = Number(consumeQty.value)
  if (!qty || qty <= 0) {
    notify(t('batches_ext_qty_must_be_positive'), 'error')

    return
  }
  const avail = Number(consumeBatch.value.available_quantity)
  if (qty > avail) {
    notify(t('batches_ext_qty_must_be_positive'), 'error')

    return
  }
  // Confirm
  // eslint-disable-next-line no-alert
  const confirmMsg = t('batches_ext_confirm_consume', { qty, batch: consumeBatch.value.batch_number })
  if (!window.confirm(confirmMsg))
    return

  consumeSubmitting.value = true
  try {
    const body: any = { quantity: qty }
    if (consumeNotes.value)
      body.notes = consumeNotes.value
    await axios.post(`/batches/${consumeBatch.value.id}/consume/`, body)
    notify(t('batches_ext_consume_success', { qty, batch: consumeBatch.value.batch_number }), 'success')
    consumeDialog.value = false
    await loadBatches()
  }
  catch {
    notify(t('Failed'), 'error')
  }
  finally {
    consumeSubmitting.value = false
  }
}

function openAutoConsumeDialog() {
  autoConsumeStockItem.value = undefined
  autoConsumeLocation.value = undefined
  autoConsumeQty.value = undefined
  autoConsumeResult.value = null
  autoConsumeDialog.value = true
}

async function submitAutoConsume() {
  if (!autoConsumeStockItem.value || !autoConsumeLocation.value) {
    notify(t('batches_ext_select_item_location'), 'error')

    return
  }
  const qty = Number(autoConsumeQty.value)
  if (!qty || qty <= 0) {
    notify(t('batches_ext_qty_must_be_positive'), 'error')

    return
  }
  autoConsumeSubmitting.value = true
  try {
    const body = {
      stock_item_id: autoConsumeStockItem.value,
      location_id: autoConsumeLocation.value,
      quantity: qty,
    }
    const res = await axios.post('/batches/auto-consume/', body)
    const d = res.data?.data ?? res.data

    autoConsumeResult.value = d
    const totalConsumed = d?.total_consumed ?? qty
    const batchCount = Array.isArray(d?.batches) ? d.batches.length : 0
    notify(t('batches_ext_auto_consume_success', { qty: totalConsumed, count: batchCount }), 'success')
    await loadBatches()
  }
  catch {
    notify(t('batches_ext_no_stock_available'), 'error')
  }
  finally {
    autoConsumeSubmitting.value = false
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

async function loadStockItems() {
  try {
    const res = await axios.get('/items/', { params: { per_page: 500 } })
    const d = res.data?.data ?? res.data

    stockItemsList.value = d?.items ?? d?.results ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadBatches(); loadLocations(); loadStockItems() })
watch([page, itemsPerPage], loadBatches)
watch([search, statusFilter, locationFilter, expiryFilter, stockItemFilter, includeZeroStock, expiringWithinDays], () => { page.value = 1; loadBatches() })
watch([extStatusFilter, extDaysAhead], () => { page.value = 1; loadBatches() })

const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))
const stockItemOptions = computed(() => stockItemsList.value.map((i: any) => ({ title: i.name, value: i.id })))
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
        <VAutocomplete
          v-model="stockItemFilter"
          :items="stockItemOptions"
          :placeholder="t('All Items')"
          density="compact"
          style="min-inline-size: 200px;"
          hide-details
          clearable
        />
        <VTextField
          v-model.number="expiringWithinDays"
          type="number"
          :placeholder="t('Expiring within (days)')"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
          clearable
          min="0"
        />
        <VSwitch
          v-model="includeZeroStock"
          :label="t('Include zero-stock batches')"
          density="compact"
          hide-details
          color="primary"
        />
        <VSelect
          v-model="extStatusFilter"
          :items="extStatusOptions"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
        />
        <VTextField
          v-if="extStatusFilter === 'expiring'"
          v-model.number="extDaysAhead"
          type="number"
          :label="t('batches_ext_filter_days')"
          :hint="t('batches_ext_filter_days_hint')"
          density="compact"
          style="min-inline-size: 160px;"
          hide-details
          min="1"
          max="3650"
        />
        <VSpacer />
        <VBtn
          variant="tonal"
          prepend-icon="bx-cog"
          color="primary"
          @click="openAutoConsumeDialog"
        >
          {{ t('batches_ext_btn_auto_consume') }}
        </VBtn>
        <VBtn
          variant="tonal"
          prepend-icon="bx-refresh"
          @click="loadBatches"
        >
          {{ t('Refresh') }}
        </VBtn>
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

        <template
          v-if="loading && batches.length === 0"
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
                style="width:140px;height:13px;border-radius:4px;"
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
                style="width:110px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:22px;border-radius:12px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:70px;height:22px;border-radius:12px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:22px;border-radius:4px;"
              />
            </td>
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
        <template #item.received_date="{ item }">
          <span class="text-body-2">{{ item.raw.received_date ? formatDateShort(item.raw.received_date) : '—' }}</span>
        </template>
        <template #item.initial_quantity="{ item }">
          <span class="num-tabular">{{ formatQty(item.raw.initial_quantity) }}</span>
        </template>
        <template #item.current_quantity="{ item }">
          <span class="num-tabular">{{ formatQty(item.raw.current_quantity) }}</span>
        </template>
        <template #item.reserved_quantity="{ item }">
          <span class="num-tabular">{{ formatQty(item.raw.reserved_quantity) }}</span>
        </template>
        <template #item.available_quantity="{ item }">
          <span :class="['num-tabular', Number(item.raw.available_quantity) <= 0 ? 'text-error font-weight-medium' : '']">
            {{ formatQty(item.raw.available_quantity) }}
          </span>
        </template>
        <template #item.unit_cost="{ item }">
          <span class="num-tabular">{{ formatCurrency(item.raw.unit_cost) }}</span>
        </template>
        <template #item.status="{ item }">
          <VChip
            :color="BATCH_STATUS_COLOR[item.raw.status] ?? 'default'"
            size="small"
            variant="tonal"
            class="status-pill"
          >
            {{ item.raw.status ? t(`batch_status_${item.raw.status}`) : '—' }}
          </VChip>
        </template>
        <template #item.expiry_date="{ item }">
          <span class="text-body-2">{{ item.raw.expiry_date ? formatDateShort(item.raw.expiry_date) : '—' }}</span>
        </template>
        <template #item.quality_status="{ item }">
          <VChip
            :color="QUALITY_STATUS_COLOR[item.raw.quality_status] ?? 'default'"
            size="small"
            variant="tonal"
            class="status-pill"
          >
            {{ item.raw.quality_status ? t(`quality_status_${item.raw.quality_status}`) : '—' }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div style="display:flex; gap:2px;">
            <VBtn
              icon
              variant="text"
              size="small"
              color="primary"
              :disabled="Number(item.raw.available_quantity) <= 0"
              @click="openConsumeDialog(item.raw)"
            >
              <VIcon size="18">
                bx-minus-circle
              </VIcon>
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('batches_ext_action_consume') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Consume from batch modal -->
    <VDialog
      v-model="consumeDialog"
      max-width="520"
    >
      <VCard>
        <VCardTitle>{{ t('batches_ext_consume_title') }}</VCardTitle>
        <VCardSubtitle>{{ t('batches_ext_consume_subtitle') }}</VCardSubtitle>
        <VCardText class="d-flex flex-column gap-3">
          <div
            v-if="consumeBatch"
            class="text-body-2"
          >
            <div>
              <strong>{{ t('batches_ext_field_batch') }}:</strong> {{ consumeBatch.batch_number }}
            </div>
            <div>
              <strong>{{ t('batches_ext_col_item') }}:</strong> {{ consumeBatch.stock_item?.name ?? '—' }}
            </div>
            <div>
              <strong>{{ t('batches_ext_col_location') }}:</strong> {{ consumeBatch.location_name ?? '—' }}
            </div>
            <div>
              <strong>{{ t('batches_ext_col_available') }}:</strong> {{ formatQty(consumeBatch.available_quantity) }}
            </div>
          </div>
          <VTextField
            v-model.number="consumeQty"
            type="number"
            :label="t('batches_ext_field_quantity')"
            :hint="consumeBatch ? t('batches_ext_field_quantity_hint', { qty: formatQty(consumeBatch.available_quantity) }) : ''"
            persistent-hint
            density="compact"
            min="0.0001"
            step="0.0001"
          />
          <VTextarea
            v-model="consumeNotes"
            :label="t('batches_ext_field_notes')"
            :placeholder="t('batches_ext_field_notes_placeholder')"
            rows="3"
            density="compact"
            hide-details
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="consumeDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            :loading="consumeSubmitting"
            @click="submitConsume"
          >
            {{ t('batches_ext_btn_consume') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Auto-consume modal -->
    <VDialog
      v-model="autoConsumeDialog"
      max-width="560"
    >
      <VCard>
        <VCardTitle>{{ t('batches_ext_auto_consume_title') }}</VCardTitle>
        <VCardSubtitle>{{ t('batches_ext_auto_consume_subtitle') }}</VCardSubtitle>
        <VCardText class="d-flex flex-column gap-3">
          <VAutocomplete
            v-model="autoConsumeStockItem"
            :items="stockItemOptions"
            :label="t('batches_ext_field_stock_item')"
            density="compact"
            hide-details
          />
          <VSelect
            v-model="autoConsumeLocation"
            :items="locationOptions"
            :label="t('batches_ext_field_location')"
            density="compact"
            hide-details
          />
          <VTextField
            v-model.number="autoConsumeQty"
            type="number"
            :label="t('batches_ext_field_quantity')"
            density="compact"
            min="0.0001"
            step="0.0001"
            hide-details
          />
          <div
            v-if="autoConsumeResult && Array.isArray(autoConsumeResult.batches)"
            class="mt-2"
          >
            <div class="text-body-2 font-weight-medium mb-2">
              {{ t('batches_ext_auto_consume_success', { qty: autoConsumeResult.total_consumed, count: autoConsumeResult.batches.length }) }}
            </div>
            <VTable density="compact">
              <thead>
                <tr>
                  <th>{{ t('batches_ext_col_batch_number') }}</th>
                  <th>{{ t('batches_ext_field_quantity') }}</th>
                  <th>{{ t('batches_ext_col_unit_cost') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(b, i) in (autoConsumeResult.batches as any[])"
                  :key="i"
                >
                  <td>{{ b.batch_number }}</td>
                  <td class="num-tabular">
                    {{ formatQty(b.quantity) }}
                  </td>
                  <td class="num-tabular">
                    {{ formatCurrency(b.unit_cost) }}
                  </td>
                </tr>
              </tbody>
            </VTable>
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="autoConsumeDialog = false"
          >
            {{ t('Close') }}
          </VBtn>
          <VBtn
            color="primary"
            variant="elevated"
            :loading="autoConsumeSubmitting"
            @click="submitAutoConsume"
          >
            {{ t('batches_ext_btn_auto_consume') }}
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
name: stock-batches
meta:
  action: manage
  subject: all
</route>

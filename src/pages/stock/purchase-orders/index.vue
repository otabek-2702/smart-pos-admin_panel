<script setup lang="ts">
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'
import { useStateAction } from '@/composables/useStateAction'
import { PURCHASE_ORDER_STATUS_COLOR as statusColor, PAYMENT_STATUS_COLOR as paymentColor } from '@/constants/statusColors'

const { t } = useI18n({ useScope: 'global' })

const orders = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const statusFilter = ref<string | undefined>(undefined)
const paymentFilter = ref<string | undefined>(undefined)
const supplierFilter = ref<number | undefined>(undefined)

const suppliersList = ref<any[]>([])
const locationsList = ref<any[]>([])

// Create dialog
const createDialog = ref(false)
const saving = ref(false)
const form = ref({
  supplier_id: null as number | null,
  delivery_location_id: null as number | null,
  order_date: new Date().toISOString().substring(0, 10),
  expected_date: '',
  currency: 'UZS',
  notes: '',
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDateShort } = useFormatters()

const statuses = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CANCELLED']
const paymentStatuses = ['UNPAID', 'PARTIAL', 'PAID']

const headers = [
  { title: '', key: 'data-table-expand', sortable: false, width: '40px' },
  { title: t('Order #'), key: 'order_number', sortable: false },
  { title: t('Supplier'), key: 'supplier_name', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Payment'), key: 'payment_status', sortable: false },
  { title: t('Total'), key: 'total', sortable: false },
  { title: t('Date'), key: 'order_date', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadOrders() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value
    if (paymentFilter.value) params.payment_status = paymentFilter.value
    if (supplierFilter.value) params.supplier_id = supplierFilter.value

    const res = await axios.get('/purchase-orders/', { params })
    const d = res.data
    orders.value = d.orders ?? []
    total.value = d.pagination?.total_items ?? orders.value.length
  }
  catch {
    notify(t('Failed to load purchase orders'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [suppRes, locRes] = await Promise.all([
      axios.get('/suppliers/', { params: { per_page: 200, is_active: true } }),
      axios.get('/locations/', { params: { per_page: 200 } }),
    ])
    suppliersList.value = suppRes.data.suppliers ?? []
    locationsList.value = locRes.data.locations ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadOrders(); loadMeta() })
watch([page, itemsPerPage], loadOrders)
watch([statusFilter, paymentFilter, supplierFilter], () => { page.value = 1; loadOrders() })

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadOrders()
}, 400)
watch(search, debouncedSearch)

const supplierOptions = computed(() => suppliersList.value.map(s => ({ title: s.name, value: s.id })))
const locationOptions = computed(() => locationsList.value.map(l => ({ title: l.name, value: l.id })))

async function createOrder() {
  if (!form.value.delivery_location_id) {
    notify(t('Delivery location is required'), 'error')
    return
  }
  saving.value = true
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}')
    const payload: any = { ...form.value, created_by_id: userData.id }
    if (!payload.expected_date) delete payload.expected_date
    if (!payload.notes) delete payload.notes
    await axios.post('/purchase-orders/', payload)
    notify(t('Purchase order created'))
    createDialog.value = false
    loadOrders()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error creating order'), 'error')
  }
  finally {
    saving.value = false
  }
}

const actionLabels: Record<string, string> = {
  send: 'Send to Supplier',
  confirm: 'Confirm Order',
  cancel: 'Cancel Order',
  receive: 'Mark as Received',
}

const { actionDialog, actionItem, actionType, actioning, openAction, doAction } = useStateAction('/purchase-orders/', loadOrders, notify, t)

function canSend(item: any) { return item.status === 'DRAFT' }
function canConfirm(item: any) { return item.status === 'SENT' }
function canReceive(item: any) { return ['CONFIRMED', 'PARTIAL'].includes(item.status) }
function canCancel(item: any) { return !['RECEIVED', 'CANCELLED'].includes(item.status) }
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search orders...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 240px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="statusFilter"
          :items="statuses"
          :placeholder="t('All Statuses')"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="paymentFilter"
          :items="paymentStatuses"
          :placeholder="t('Payment Status')"
          density="compact"
          style="min-inline-size: 160px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="supplierFilter"
          :items="supplierOptions"
          :placeholder="t('All Suppliers')"
          density="compact"
          style="min-inline-size: 180px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn prepend-icon="bx-plus" @click="createDialog = true">{{ t('New Order') }}</VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="orders"
        :items-length="total"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
        expand-on-click
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="total"
          />
        </template>

        <template v-if="loading && orders.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:20px;height:20px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:90px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:120px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell" style="text-align:end;"><div class="d-flex justify-end gap-1"><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /><div class="sk-box" style="width:28px;height:28px;border-radius:6px;" /></div></td>
          </tr>
        </template>

        <template #item.order_number="{ item }">
          <span class="font-weight-medium">{{ item.raw.order_number }}</span>
        </template>
        <template #item.supplier_name="{ item }">
          {{ item.raw.supplier_name ?? item.raw.supplier?.name ?? '—' }}
        </template>
        <template #item.status="{ item }">
          <VChip :color="statusColor[item.raw.status] ?? 'default'" size="small" variant="tonal">{{ item.raw.status }}</VChip>
        </template>
        <template #item.payment_status="{ item }">
          <VChip v-if="item.raw.payment_status" :color="paymentColor[item.raw.payment_status] ?? 'default'" size="small" variant="tonal">{{ item.raw.payment_status }}</VChip>
          <span v-else class="text-disabled">—</span>
        </template>
        <template #item.total="{ item }">
          {{ formatCurrency(item.raw.total ?? item.raw.subtotal ?? 0) }}
        </template>
        <template #item.order_date="{ item }">
          {{ formatDateShort(item.raw.order_date) }}
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn v-if="canSend(item.raw)" icon variant="text" size="small" color="info" @click.stop="openAction(item.raw, 'send')">
              <VIcon size="18" icon="bx-send" />
              <VTooltip activator="parent" location="top">{{ t('Send') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canConfirm(item.raw)" icon variant="text" size="small" color="success" @click.stop="openAction(item.raw, 'confirm')">
              <VIcon size="18" icon="bx-check" />
              <VTooltip activator="parent" location="top">{{ t('Confirm') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canReceive(item.raw)" icon variant="text" size="small" color="primary" @click.stop="openAction(item.raw, 'receive')">
              <VIcon size="18" icon="bx-package" />
              <VTooltip activator="parent" location="top">{{ t('Receive') }}</VTooltip>
            </VBtn>
            <VBtn v-if="canCancel(item.raw)" icon variant="text" size="small" color="error" @click.stop="openAction(item.raw, 'cancel')">
              <VIcon size="18" icon="bx-x" />
              <VTooltip activator="parent" location="top">{{ t('Cancel') }}</VTooltip>
            </VBtn>
          </div>
        </template>

        <!-- Expanded row: order items -->
        <template #expanded-row="{ item, columns }">
          <tr>
            <td :colspan="columns.length">
              <div class="pa-3">
                <div class="d-flex gap-4 mb-3 text-body-2 flex-wrap">
                  <span><span class="text-disabled">{{ t('Supplier') }}: </span>{{ item.raw.supplier_name ?? item.raw.supplier?.name ?? '—' }}</span>
                  <span><span class="text-disabled">{{ t('Location') }}: </span>{{ typeof item.raw.delivery_location === 'string' ? item.raw.delivery_location : item.raw.delivery_location?.name ?? '—' }}</span>
                  <span v-if="item.raw.expected_date || item.raw.expected_date"><span class="text-disabled">{{ t('Expected') }}: </span>{{ formatDateShort(item.raw.expected_date ?? item.raw.expected_date) }}</span>
                </div>
                <VTable density="compact">
                  <thead>
                    <tr>
                      <th>{{ t('Item') }}</th>
                      <th>{{ t('Qty Ordered') }}</th>
                      <th>{{ t('Qty Received') }}</th>
                      <th>{{ t('Unit Price') }}</th>
                      <th>{{ t('Total') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(li, idx) in ((item.raw.items ?? item.raw.line_items ?? []) as any[])" :key="idx">
                      <td>{{ li.item?.name ?? li.stock_item?.name ?? '—' }}</td>
                      <td>{{ li.quantity_ordered ?? li.quantity ?? '—' }}</td>
                      <td>{{ li.quantity_received ?? '—' }}</td>
                      <td>{{ formatCurrency(li.unit_price ?? li.price ?? 0) }}</td>
                      <td>{{ formatCurrency((li.unit_price ?? li.price ?? 0) * (li.quantity_ordered ?? li.quantity ?? 1)) }}</td>
                    </tr>
                    <tr v-if="!(item.raw.items?.length ?? item.raw.line_items?.length)">
                      <td colspan="5" class="text-center text-disabled">{{ t('No items') }}</td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </td>
          </tr>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create Dialog -->
    <VDialog v-model="createDialog" max-width="480" persistent>
      <VCard :title="t('New Purchase Order')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VSelect v-model="form.supplier_id" :items="supplierOptions" :label="t('Supplier')" required />
            </VCol>
            <VCol cols="12">
              <VSelect v-model="form.delivery_location_id" :items="locationOptions" :label="t('Delivery Location *')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.order_date" :label="t('Order Date')" type="date" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.expected_date" :label="t('Expected Delivery')" type="date" />
            </VCol>
            <VCol cols="12" sm="4">
              <VTextField v-model="form.currency" :label="t('Currency')" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.notes" :label="t('Notes')" />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="createDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :loading="saving" @click="createOrder">{{ t('Create') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Action Confirm Dialog -->
    <VDialog v-model="actionDialog" max-width="400">
      <VCard :title="t(actionLabels[actionType] ?? actionType)">
        <VCardText>{{ t('Confirm action for order') }} <strong>{{ actionItem?.order_number }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn variant="tonal" color="default" @click="actionDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn :color="actionType === 'cancel' ? 'error' : 'primary'" :loading="actioning" @click="doAction">{{ t('Confirm') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">{{ snackbarMsg }}</VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-purchase-orders
meta:
  action: manage
  subject: all
</route>

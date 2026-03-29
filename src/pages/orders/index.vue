<script setup lang="ts">
import axios from '@axios'

const { t } = useI18n({ useScope: 'global' })

// ---- state ----
const orders = ref<any[]>([])
const totalOrders = ref(0)
const loading = ref(false)
const stats = ref<any>(null)

const page = ref(1)
const itemsPerPage = ref(10)
const statusFilter = ref<string[]>([])
const paymentFilter = ref<string | undefined>(undefined)

const expandedRows = ref<number[]>([])

// Snackbar
const snackbar = ref(false)
const snackbarMsg = ref('')
const snackbarColor = ref('success')

const orderStatuses = ['OPEN', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED']
const paymentStatuses = ['PAID', 'UNPAID']

const statusColor: Record<string, string> = {
  OPEN: 'primary',
  PREPARING: 'warning',
  READY: 'success',
  COMPLETED: 'secondary',
  CANCELED: 'error',
}

const paymentColor: Record<string, string> = {
  PAID: 'success',
  UNPAID: 'warning',
  REFUNDED: 'error',
}

const headers = [
  { title: '', key: 'data-table-expand', sortable: false },
  { title: '#', key: 'display_id', sortable: false },
  { title: t('Type'), key: 'order_type', sortable: false },
  { title: t('Cashier'), key: 'cashier', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Payment'), key: 'is_paid', sortable: false },
  { title: t('Total'), key: 'total_amount', sortable: false },
  { title: t('Items'), key: 'items_count', sortable: false },
  { title: t('Date'), key: 'created_at', sortable: false },
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
  return new Date(val).toLocaleString()
}

function formatCurrency(val: number | string) {
  return new Intl.NumberFormat('uz-UZ').format(Number(val) || 0)
}

// ---- load ----
async function loadOrders() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value.length) params.statuses = statusFilter.value.join(',')
    if (paymentFilter.value) params.is_paid = paymentFilter.value === 'PAID'

    const res = await axios.get('/orders', { params })
    const d = res.data?.data
    orders.value = d?.orders ?? []
    totalOrders.value = d?.pagination?.total_orders ?? orders.value.length
  }
  catch {
    notify(t('Failed to load orders'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await axios.get('/orders/stats')
    stats.value = res.data?.data ?? res.data
  }
  catch { /* ignore */ }
}

onMounted(() => {
  loadOrders()
  loadStats()
})

watch([page, itemsPerPage], loadOrders)
watch([statusFilter, paymentFilter], () => {
  page.value = 1
  loadOrders()
})

// ---- actions ----
async function markPaid(order: any) {
  try {
    await axios.post(`/orders/${order.id}/pay`)
    notify(t('Order marked as paid'))
    loadOrders()
    loadStats()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error updating order'), 'error')
  }
}

async function cancelOrder(order: any) {
  try {
    await axios.post(`/orders/${order.id}/cancel`)
    notify(t('Order cancelled'))
    loadOrders()
    loadStats()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error cancelling order'), 'error')
  }
}

function toggleExpand(id: number) {
  const idx = expandedRows.value.indexOf(id)
  if (idx >= 0)
    expandedRows.value.splice(idx, 1)
  else
    expandedRows.value.push(id)
}
</script>

<template>
  <div>
    <!-- Stats row -->
    <VRow
      v-if="stats"
      class="mb-4"
    >
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar
              color="primary"
              variant="tonal"
              size="40"
              rounded
            >
              <VIcon icon="bx-receipt" />
            </VAvatar>
            <div>
              <div class="text-h6">
                {{ stats.total_orders ?? '—' }}
              </div>
              <div class="text-sm">
                {{ t('Total') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar
              color="warning"
              variant="tonal"
              size="40"
              rounded
            >
              <VIcon icon="bx-time" />
            </VAvatar>
            <div>
              <div class="text-h6">
                {{ stats.preparing_orders ?? '—' }}
              </div>
              <div class="text-sm">
                {{ t('Preparing') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar
              color="success"
              variant="tonal"
              size="40"
              rounded
            >
              <VIcon icon="bx-check-double" />
            </VAvatar>
            <div>
              <div class="text-h6">
                {{ stats.ready_orders ?? '—' }}
              </div>
              <div class="text-sm">
                {{ t('Ready') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar
              color="error"
              variant="tonal"
              size="40"
              rounded
            >
              <VIcon icon="bx-x-circle" />
            </VAvatar>
            <div>
              <div class="text-h6">
                {{ stats.cancelled_orders ?? '—' }}
              </div>
              <div class="text-sm">
                {{ t('Cancelled') }}
              </div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Main table card -->
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VSelect
          v-model="statusFilter"
          :items="orderStatuses"
          :placeholder="t('Filter by Status')"
          density="compact"
          style="min-inline-size: 220px;"
          hide-details
          clearable
          multiple
        />
        <VSelect
          v-model="paymentFilter"
          :items="paymentStatuses"
          :placeholder="t('Payment Status')"
          density="compact"
          style="min-inline-size: 200px;"
          hide-details
          clearable
        />
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="orders"
        :items-length="totalOrders"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
        expand-on-click
        :expanded="expandedRows.map(String)"
        @update:page="page = $event"
        @update:items-per-page="itemsPerPage = $event"
      >
        <template #item.display_id="{ item }">
          <span class="font-weight-medium">#{{ item.display_id ?? item.id }}</span>
        </template>
        <template #item.order_type="{ item }">
          <VChip
            size="small"
            color="secondary"
            variant="tonal"
          >
            {{ item.order_type }}
          </VChip>
        </template>
        <template #item.cashier="{ item }">
          {{ item.cashier?.name ?? '—' }}
        </template>
        <template #item.status="{ item }">
          <VChip
            size="small"
            :color="statusColor[item.status] ?? 'default'"
            variant="tonal"
          >
            {{ item.status }}
          </VChip>
        </template>
        <template #item.is_paid="{ item }">
          <VChip
            size="small"
            :color="item.is_paid ? 'success' : 'warning'"
            variant="tonal"
          >
            {{ item.is_paid ? 'PAID' : 'UNPAID' }}
          </VChip>
        </template>
        <template #item.total_amount="{ item }">
          {{ formatCurrency(item.total_amount ?? 0) }}
        </template>
        <template #item.items_count="{ item }">
          {{ item.items_count ?? item.items?.length ?? '—' }}
        </template>
        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex gap-1 justify-end">
            <VBtn
              v-if="!item.is_paid && item.status !== 'CANCELED'"
              size="small"
              color="success"
              variant="tonal"
              @click.stop="markPaid(item)"
            >
              {{ t('Pay') }}
            </VBtn>
            <VBtn
              v-if="item.status !== 'CANCELED' && item.status !== 'COMPLETED'"
              size="small"
              color="error"
              variant="tonal"
              @click.stop="cancelOrder(item)"
            >
              {{ t('Cancel') }}
            </VBtn>
          </div>
        </template>

        <!-- Expanded row -->
        <template #expanded-row="{ item }">
          <tr>
            <td :colspan="headers.length">
              <div class="pa-3">
                <div class="text-body-2 font-weight-medium mb-2">
                  {{ t('Order Items') }}
                </div>
                <VTable density="compact">
                  <thead>
                    <tr>
                      <th>{{ t('Product') }}</th>
                      <th>{{ t('Qty') }}</th>
                      <th>{{ t('Price') }}</th>
                      <th>{{ t('Subtotal') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(orderItem, idx) in (item.items ?? [])"
                      :key="idx"
                    >
                      <td>{{ orderItem.product__name ?? '—' }}</td>
                      <td>{{ orderItem.quantity ?? orderItem.qty ?? '—' }}</td>
                      <td>{{ formatCurrency(orderItem.price ?? orderItem.unit_price ?? 0) }}</td>
                      <td>{{ formatCurrency((orderItem.price ?? orderItem.unit_price ?? 0) * (orderItem.quantity ?? orderItem.qty ?? 1)) }}</td>
                    </tr>
                    <tr v-if="!(item.items?.length)">
                      <td
                        colspan="4"
                        class="text-center text-disabled"
                      >
                        {{ t('No items') }}
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </td>
          </tr>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Snackbar -->
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
meta:
  action: manage
  subject: all
</route>

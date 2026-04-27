<script setup lang="ts">
import { ORDER_STATUS_COLOR as statusColor } from '@/constants/statusColors'
import axios from '@axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

// ---- state ----
const orders = ref<any[]>([])
const totalOrders = ref(0)
const loading = ref(false)
const stats = ref<any>(null)

const page = ref(1)
const itemsPerPage = ref(10)
const statusFilter = ref<string[]>([])
const paymentFilter = ref<string | undefined>(undefined)
const search = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadOrders()
}, 400)

const orderStatuses = ['OPEN', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED']
const paymentStatuses = ['PAID', 'UNPAID']

const headers = [
  { title: '', key: 'data-table-expand', sortable: false, width: '40px' },
  { title: '#', key: 'display_id', sortable: false },
  { title: t('Type'), key: 'order_type', sortable: false },
  { title: t('Info'), key: 'info', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Payment'), key: 'is_paid', sortable: false },
  { title: t('Total'), key: 'total_amount', sortable: false },
  { title: t('Items'), key: 'items_count', sortable: false },
  { title: t('Date'), key: 'created_at', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const, width: '80px' },
]

// ---- load ----
async function loadOrders() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value.length) params.statuses = statusFilter.value.join(',')
    if (paymentFilter.value) params.is_paid = paymentFilter.value === 'PAID'
    if (search.value.trim()) params.search = search.value.trim()
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value

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
watch([statusFilter, paymentFilter, dateFrom, dateTo], () => {
  page.value = 1
  loadOrders()
})
watch(search, () => debouncedSearch())

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
</script>

<template>
  <div>
    <!-- Stats row -->
    <VRow class="mb-4">
      <VCol cols="6" sm="3">
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar color="primary" variant="tonal" size="40" rounded>
              <VIcon icon="bx-receipt" />
            </VAvatar>
            <div>
              <div v-if="stats" class="text-h6">{{ stats.total_orders ?? '—' }}</div>
              <div v-else class="sk-box mb-1" style="width:40px;height:20px;border-radius:4px;" />
              <div class="text-sm">{{ t('Total') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="3">
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar color="warning" variant="tonal" size="40" rounded>
              <VIcon icon="bx-time" />
            </VAvatar>
            <div>
              <div v-if="stats" class="text-h6">{{ stats.preparing_orders ?? '—' }}</div>
              <div v-else class="sk-box mb-1" style="width:40px;height:20px;border-radius:4px;" />
              <div class="text-sm">{{ t('Preparing') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="3">
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar color="success" variant="tonal" size="40" rounded>
              <VIcon icon="bx-check-double" />
            </VAvatar>
            <div>
              <div v-if="stats" class="text-h6">{{ stats.ready_orders ?? '—' }}</div>
              <div v-else class="sk-box mb-1" style="width:40px;height:20px;border-radius:4px;" />
              <div class="text-sm">{{ t('Ready') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="3">
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar color="info" variant="tonal" size="40" rounded>
              <VIcon icon="bx-money" />
            </VAvatar>
            <div>
              <div v-if="stats" class="text-h6">{{ formatCurrency(stats.total_revenue ?? 0) }}</div>
              <div v-else class="sk-box mb-1" style="width:70px;height:20px;border-radius:4px;" />
              <div class="text-sm">{{ t('Revenue') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Main table card -->
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search orders...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 200px; max-inline-size: 280px;"
          hide-details
          clearable
        />
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
        <VTextField
          v-model="dateFrom"
          type="date"
          :label="t('From')"
          density="compact"
          hide-details
          style="min-inline-size: 150px; max-inline-size: 170px;"
          clearable
        />
        <VTextField
          v-model="dateTo"
          type="date"
          :label="t('To')"
          density="compact"
          hide-details
          style="min-inline-size: 150px; max-inline-size: 170px;"
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
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="totalOrders"
          />
        </template>

        <template v-if="loading && orders.length === 0" #body>
          <tr v-for="n in itemsPerPage" :key="n" class="sk-row">
            <td class="sk-cell"><div class="sk-box" style="width:20px;height:20px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:40px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:80px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:60px;height:22px;border-radius:12px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:70px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:30px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell"><div class="sk-box" style="width:100px;height:13px;border-radius:4px;" /></td>
            <td class="sk-cell" style="text-align:end;">
              <div class="d-flex justify-end gap-1">
                <div class="sk-box" style="width:50px;height:28px;border-radius:6px;" />
                <div class="sk-box" style="width:60px;height:28px;border-radius:6px;" />
              </div>
            </td>
          </tr>
        </template>

        <template #item.display_id="{ item }">
          <span class="font-weight-medium">#{{ item.raw.display_id ?? item.raw.id }}</span>
        </template>
        <template #item.order_type="{ item }">
          <VChip size="small" color="secondary" variant="tonal">{{ item.raw.order_type }}</VChip>
        </template>
        <!-- phone for delivery, description for hall -->
        <template #item.info="{ item }">
          <span class="text-body-2 text-disabled">
            {{ item.raw.phone_number && item.raw.phone_number !== '+998' ? item.raw.phone_number : (item.raw.description || '—') }}
          </span>
        </template>
        <template #item.status="{ item }">
          <VChip size="small" :color="statusColor[item.raw.status] ?? 'default'" variant="tonal">
            {{ item.raw.status }}
          </VChip>
        </template>
        <template #item.is_paid="{ item }">
          <VChip size="small" :color="item.raw.is_paid ? 'success' : 'warning'" variant="tonal">
            {{ item.raw.is_paid ? t('PAID') : t('UNPAID') }}
          </VChip>
        </template>
        <template #item.total_amount="{ item }">
          {{ formatCurrency(item.raw.total_amount ?? 0) }}
        </template>
        <template #item.items_count="{ item }">
          {{ item.raw.items_count ?? item.raw.items?.length ?? '—' }}
        </template>
        <template #item.created_at="{ item }">
          {{ formatDate(item.raw.created_at) }}
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn
              v-if="!item.raw.is_paid && item.raw.status !== 'CANCELED'"
              icon
              variant="text"
              size="small"
              color="success"
              @click.stop="markPaid(item.raw)"
            >
              <VIcon icon="bx-dollar" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Pay') }}</VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status !== 'CANCELED' && item.raw.status !== 'COMPLETED'"
              icon
              variant="text"
              size="small"
              color="error"
              @click.stop="cancelOrder(item.raw)"
            >
              <VIcon icon="bx-x-circle" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Cancel') }}</VTooltip>
            </VBtn>
          </div>
        </template>

        <!-- Expanded row -->
        <template #expanded-row="{ item, columns }">
          <tr>
            <td :colspan="columns.length">
              <div class="pa-3">
                <div class="text-body-2 font-weight-medium mb-2">{{ t('Order Items') }}</div>
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
                    <tr v-for="(orderItem, idx) in ((item.raw.items ?? []) as any[])" :key="idx">
                      <td>{{ orderItem['product__name'] ?? '—' }}</td>
                      <td>{{ orderItem.quantity ?? '—' }}</td>
                      <td>{{ formatCurrency(orderItem.price ?? 0) }}</td>
                      <td>{{ formatCurrency((Number(orderItem.price) || 0) * (orderItem.quantity ?? 1)) }}</td>
                    </tr>
                    <tr v-if="!(item.raw.items?.length)">
                      <td colspan="4" class="text-center text-disabled">{{ t('No items') }}</td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </td>
          </tr>
        </template>
      </VDataTableServer>
    </VCard>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

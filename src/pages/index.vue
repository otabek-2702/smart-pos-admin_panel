<script setup lang="ts">
import axios from '@axios'

const { t } = useI18n({ useScope: 'global' })

const userStats = ref<any>(null)
const inkassaBalance = ref<any>(null)
const inkassaStats = ref<any>(null)
const recentOrders = ref<any[]>([])
const loading = ref(true)

const orderHeaders = [
  { title: '#', key: 'display_id', sortable: false },
  { title: 'Type', key: 'type', sortable: false },
  { title: 'Cashier', key: 'cashier', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Payment', key: 'payment_status', sortable: false },
  { title: 'Total', key: 'total_price', sortable: false },
  { title: 'Items', key: 'items_count', sortable: false },
  { title: 'Date', key: 'created_at', sortable: false },
]

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

async function loadDashboard() {
  loading.value = true
  try {
    const [uStats, iBalance, iStats, orders] = await Promise.allSettled([
      axios.get('/users/stats'),
      axios.get('/inkassa/balance'),
      axios.get('/inkassa/stats'),
      axios.get('/orders', { params: { page: 1, per_page: 5 } }),
    ])

    if (uStats.status === 'fulfilled') userStats.value = uStats.value.data?.data ?? uStats.value.data
    if (iBalance.status === 'fulfilled') inkassaBalance.value = iBalance.value.data?.data ?? iBalance.value.data
    if (iStats.status === 'fulfilled') inkassaStats.value = iStats.value.data?.data ?? iStats.value.data
    if (orders.status === 'fulfilled') {
      const d = orders.value.data?.data ?? orders.value.data
      recentOrders.value = Array.isArray(d) ? d : (d?.results ?? d?.orders ?? [])
    }
  }
  finally {
    loading.value = false
  }
}

function formatCurrency(val: number | string) {
  const num = Number(val) || 0
  return new Intl.NumberFormat('uz-UZ').format(num)
}

function formatDate(val: string) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString()
}

onMounted(loadDashboard)
</script>

<template>
  <div>
    <!-- Stat cards -->
    <VRow class="mb-4">
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <CardStatisticsHorizontal
          :title="t('Total Orders')"
          :stats="inkassaStats ? String(inkassaStats.total_orders ?? inkassaStats.orders_count ?? '—') : '…'"
          :subtitle="t('All time')"
          icon="bx-receipt"
          color="primary"
          :change="0"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <CardStatisticsHorizontal
          :title="t('Total Revenue')"
          :stats="inkassaBalance ? formatCurrency(inkassaBalance.balance ?? inkassaBalance.total ?? 0) : '…'"
          :subtitle="t('Cash balance')"
          icon="bx-wallet"
          color="success"
          :change="0"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <CardStatisticsHorizontal
          :title="t('Total Users')"
          :stats="userStats ? String(userStats.total ?? '—') : '…'"
          :subtitle="t('Registered users')"
          icon="bx-group"
          color="info"
          :change="0"
        />
      </VCol>
      <VCol
        cols="12"
        sm="6"
        lg="3"
      >
        <CardStatisticsHorizontal
          :title="t('Active Users')"
          :stats="userStats ? String(userStats.active ?? '—') : '…'"
          :subtitle="t('Currently active')"
          icon="bx-user-check"
          color="warning"
          :change="0"
        />
      </VCol>
    </VRow>

    <!-- Recent Orders -->
    <VCard :title="t('Recent Orders')">
      <VDataTable
        :headers="orderHeaders"
        :items="recentOrders"
        :loading="loading"
        hide-default-footer
        density="compact"
      >
        <template #item.display_id="{ item }">
          <span class="font-weight-medium">#{{ item.display_id ?? item.id }}</span>
        </template>
        <template #item.type="{ item }">
          <VChip
            size="small"
            color="secondary"
            variant="tonal"
          >
            {{ item.type }}
          </VChip>
        </template>
        <template #item.cashier="{ item }">
          {{ item.cashier?.first_name ?? item.cashier?.username ?? '—' }}
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
        <template #item.payment_status="{ item }">
          <VChip
            size="small"
            :color="paymentColor[item.payment_status] ?? 'default'"
            variant="tonal"
          >
            {{ item.payment_status }}
          </VChip>
        </template>
        <template #item.total_price="{ item }">
          {{ formatCurrency(item.total_price ?? item.total ?? 0) }}
        </template>
        <template #item.items_count="{ item }">
          {{ item.items_count ?? item.items?.length ?? '—' }}
        </template>
        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>
      </VDataTable>
    </VCard>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

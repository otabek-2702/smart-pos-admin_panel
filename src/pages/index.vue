<script setup lang="ts">
import { ORDER_STATUS_COLOR as statusColor } from '@/constants/statusColors'
import axios from '@axios'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency, formatDate } = useFormatters()

const orderStats = ref<any>(null)
const userStats = ref<any>(null)
const inkassaBalance = ref<any>(null)
const inkassaStats = ref<any>(null)
const productStats = ref<any>(null)
const recentOrders = ref<any[]>([])
const loading = ref(true)

// ---- period filter ----
type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all'
const selectedPeriod = ref<Period>('all')
const dateFrom = ref('')
const dateTo = ref('')

const periodOptions: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
]

function getDateRange(period: Period): { date_from?: string; date_to?: string } {
  if (dateFrom.value && dateTo.value)
    return { date_from: dateFrom.value, date_to: dateTo.value }
  if (dateFrom.value)
    return { date_from: dateFrom.value }
  if (dateTo.value)
    return { date_to: dateTo.value }

  const now = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  switch (period) {
    case 'today':
      return { date_from: fmt(now), date_to: fmt(now) }
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      return { date_from: fmt(y), date_to: fmt(y) }
    }
    case 'week': {
      const w = new Date(now)
      w.setDate(w.getDate() - 7)
      return { date_from: fmt(w), date_to: fmt(now) }
    }
    case 'month': {
      const m = new Date(now)
      m.setMonth(m.getMonth() - 1)
      return { date_from: fmt(m), date_to: fmt(now) }
    }
    case 'year': {
      const yr = new Date(now)
      yr.setFullYear(yr.getFullYear() - 1)
      return { date_from: fmt(yr), date_to: fmt(now) }
    }
    default:
      return {}
  }
}

function onPeriodChange() {
  dateFrom.value = ''
  dateTo.value = ''
  loadDashboard()
}

watch([dateFrom, dateTo], () => {
  if (dateFrom.value || dateTo.value)
    loadDashboard()
})

const orderHeaders = [
  { title: '#', key: 'display_id', sortable: false, width: '60px' },
  { title: t('Type'), key: 'order_type', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Payment'), key: 'is_paid', sortable: false },
  { title: t('Total'), key: 'total_amount', sortable: false },
  { title: t('Items'), key: 'items_count', sortable: false, width: '70px' },
  { title: t('Date'), key: 'created_at', sortable: false },
]

const orderTypeColors: Record<string, string> = {
  HALL: 'info',
  DELIVERY: 'warning',
  PICKUP: 'success',
}

async function loadDashboard() {
  loading.value = true
  try {
    const dateParams = getDateRange(selectedPeriod.value)
    const [oStats, uStats, iBalance, iStats, pStats, orders] = await Promise.allSettled([
      axios.get('/orders/stats', { params: { ...dateParams } }),
      axios.get('/users/stats'),
      axios.get('/inkassa/balance'),
      axios.get('/inkassa/stats', { params: { ...dateParams } }),
      axios.get('/products/stats'),
      axios.get('/orders', { params: { page: 1, per_page: 8, ...dateParams } }),
    ])

    if (oStats.status === 'fulfilled') orderStats.value = oStats.value.data?.data ?? oStats.value.data
    if (uStats.status === 'fulfilled') userStats.value = uStats.value.data?.data ?? uStats.value.data
    if (iBalance.status === 'fulfilled') inkassaBalance.value = iBalance.value.data?.data ?? iBalance.value.data
    if (iStats.status === 'fulfilled') inkassaStats.value = iStats.value.data?.data ?? iStats.value.data
    if (pStats.status === 'fulfilled') productStats.value = pStats.value.data?.data ?? pStats.value.data
    if (orders.status === 'fulfilled') {
      const d = orders.value.data?.data ?? orders.value.data
      recentOrders.value = d?.orders ?? []
    }
  }
  finally {
    loading.value = false
  }
}

onMounted(loadDashboard)

const paidPercentage = computed(() => {
  if (!orderStats.value) return 0
  const total = orderStats.value.total_orders || 0
  if (!total) return 0
  return Math.round((orderStats.value.paid_orders / total) * 100)
})

const avgOrderValue = computed(() => {
  if (!orderStats.value) return 0
  const paid = orderStats.value.paid_orders || 0
  const revenue = Number(orderStats.value.total_revenue) || 0
  if (!paid) return 0
  return Math.round(revenue / paid)
})
</script>

<template>
  <div>
    <!-- Period filter bar -->
    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center gap-3">
        <VBtnToggle
          v-model="selectedPeriod"
          mandatory
          density="compact"
          color="primary"
          divided
          @update:model-value="onPeriodChange"
        >
          <VBtn
            v-for="opt in periodOptions"
            :key="opt.value"
            :value="opt.value"
            size="small"
          >
            {{ t(opt.label) }}
          </VBtn>
        </VBtnToggle>
        <VSpacer />
        <VTextField
          v-model="dateFrom"
          type="date"
          :label="t('From')"
          density="compact"
          hide-details
          style="max-inline-size: 170px;"
          clearable
        />
        <VTextField
          v-model="dateTo"
          type="date"
          :label="t('To')"
          density="compact"
          hide-details
          style="max-inline-size: 170px;"
          clearable
        />
      </VCardText>
    </VCard>

    <!-- Row 1: KPI cards -->
    <VRow class="mb-4">
      <VCol cols="12" sm="6" lg="3">
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar color="success" variant="tonal" size="48" rounded>
              <VIcon icon="bx-money" size="24" />
            </VAvatar>
            <div>
              <div v-if="orderStats" class="text-h5 font-weight-bold">
                {{ formatCurrency(orderStats.total_revenue ?? 0) }}
              </div>
              <div v-else class="sk-box mb-1" style="width:100px;height:22px;border-radius:4px;" />
              <div class="text-body-2 text-disabled">{{ t('Total Revenue') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar color="primary" variant="tonal" size="48" rounded>
              <VIcon icon="bx-wallet" size="24" />
            </VAvatar>
            <div>
              <div v-if="inkassaBalance" class="text-h5 font-weight-bold">
                {{ formatCurrency(inkassaBalance.balance ?? 0) }}
              </div>
              <div v-else class="sk-box mb-1" style="width:90px;height:22px;border-radius:4px;" />
              <div class="text-body-2 text-disabled">{{ t('Cash Balance') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar color="info" variant="tonal" size="48" rounded>
              <VIcon icon="bx-receipt" size="24" />
            </VAvatar>
            <div>
              <div v-if="orderStats" class="text-h5 font-weight-bold">{{ orderStats.total_orders ?? 0 }}</div>
              <div v-else class="sk-box mb-1" style="width:50px;height:22px;border-radius:4px;" />
              <div class="text-body-2 text-disabled">{{ t('Total Orders') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" sm="6" lg="3">
        <VCard>
          <VCardText class="d-flex align-center gap-3">
            <VAvatar color="secondary" variant="tonal" size="48" rounded>
              <VIcon icon="bx-trending-up" size="24" />
            </VAvatar>
            <div>
              <div v-if="orderStats" class="text-h5 font-weight-bold">{{ formatCurrency(avgOrderValue) }}</div>
              <div v-else class="sk-box mb-1" style="width:80px;height:22px;border-radius:4px;" />
              <div class="text-body-2 text-disabled">{{ t('Avg Order Value') }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Row 2: Order status cards + Payment + Prep time -->
    <VRow class="mb-4">
      <VCol cols="6" sm="4" md="2">
        <VCard>
          <VCardText class="text-center pa-3">
            <div v-if="orderStats" class="text-h5 font-weight-bold text-primary">{{ orderStats.preparing_orders ?? 0 }}</div>
            <div v-else class="sk-box mx-auto mb-1" style="width:30px;height:20px;border-radius:4px;" />
            <div class="text-caption text-disabled">{{ t('Preparing') }}</div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="4" md="2">
        <VCard>
          <VCardText class="text-center pa-3">
            <div v-if="orderStats" class="text-h5 font-weight-bold text-success">{{ orderStats.ready_orders ?? 0 }}</div>
            <div v-else class="sk-box mx-auto mb-1" style="width:30px;height:20px;border-radius:4px;" />
            <div class="text-caption text-disabled">{{ t('Ready') }}</div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="4" md="2">
        <VCard>
          <VCardText class="text-center pa-3">
            <div v-if="orderStats" class="text-h5 font-weight-bold text-error">{{ orderStats.cancelled_orders ?? 0 }}</div>
            <div v-else class="sk-box mx-auto mb-1" style="width:30px;height:20px;border-radius:4px;" />
            <div class="text-caption text-disabled">{{ t('Cancelled') }}</div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="4" md="2">
        <VCard>
          <VCardText class="text-center pa-3">
            <div v-if="orderStats" class="text-h5 font-weight-bold text-info">
              {{ orderStats.average_preparation_time_formatted ?? '—' }}
            </div>
            <div v-else class="sk-box mx-auto mb-1" style="width:50px;height:20px;border-radius:4px;" />
            <div class="text-caption text-disabled">{{ t('Avg Prep Time') }}</div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="4" md="2">
        <VCard>
          <VCardText class="text-center pa-3">
            <div v-if="orderStats" class="text-h5 font-weight-bold text-success">{{ paidPercentage }}%</div>
            <div v-else class="sk-box mx-auto mb-1" style="width:40px;height:20px;border-radius:4px;" />
            <div class="text-caption text-disabled">{{ t('Paid') }} ({{ orderStats?.paid_orders ?? 0 }}/{{ orderStats?.total_orders ?? 0 }})</div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="4" md="2">
        <VCard>
          <VCardText class="text-center pa-3">
            <div v-if="productStats" class="text-h5 font-weight-bold text-secondary">{{ productStats.total_products ?? 0 }}</div>
            <div v-else class="sk-box mx-auto mb-1" style="width:30px;height:20px;border-radius:4px;" />
            <div class="text-caption text-disabled">{{ t('Products') }}</div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Row 3: Users + Cashier Performance + Products by Category -->
    <VRow class="mb-4">
      <!-- Users stats card -->
      <VCol cols="12" sm="6" md="3">
        <VCard>
          <VCardText>
            <div class="d-flex align-center gap-3 mb-3">
              <VAvatar color="warning" variant="tonal" size="40" rounded>
                <VIcon icon="bx-group" size="20" />
              </VAvatar>
              <div>
                <div v-if="userStats" class="text-h6 font-weight-bold">{{ userStats.total_users ?? 0 }}</div>
                <div class="text-caption text-disabled">{{ t('Total Users') }}</div>
              </div>
            </div>
            <template v-if="userStats">
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span class="text-disabled">{{ t('Active') }}</span>
                <span class="font-weight-medium">{{ userStats.active_users }}</span>
              </div>
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span class="text-disabled">{{ t('Cashiers') }}</span>
                <span class="font-weight-medium">{{ userStats.by_role?.cashier ?? 0 }}</span>
              </div>
              <div class="d-flex justify-space-between text-body-2">
                <span class="text-disabled">{{ t('Suspended') }}</span>
                <span class="font-weight-medium">{{ userStats.suspended_users }}</span>
              </div>
            </template>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Cashier Performance -->
      <VCol cols="12" sm="6" md="4">
        <VCard>
          <VCardText class="pb-2">
            <div class="text-overline text-disabled mb-2">{{ t('Cashier Performance') }}</div>
            <template v-if="inkassaStats?.cashier_performance?.length">
              <div
                v-for="c in (inkassaStats.cashier_performance as any[])"
                :key="(c as any).cashier_id"
                class="d-flex align-center justify-space-between py-1"
              >
                <div class="d-flex align-center gap-2">
                  <VAvatar size="28" color="primary" variant="tonal">
                    <span class="text-caption">{{ ((c as any).cashier_name ?? '?')[0] }}</span>
                  </VAvatar>
                  <div>
                    <div class="text-body-2 font-weight-medium">{{ (c as any).cashier_name }}</div>
                    <div class="text-caption text-disabled">{{ (c as any).order_count }} {{ t('Orders').toLowerCase() }}</div>
                  </div>
                </div>
                <span class="text-body-2 font-weight-medium text-success">{{ formatCurrency((c as any).total_revenue) }}</span>
              </div>
            </template>
            <template v-else-if="loading">
              <div v-for="n in 3" :key="n" class="d-flex align-center gap-2 py-1">
                <div class="sk-box" style="width:28px;height:28px;border-radius:50%;" />
                <div class="sk-box" style="width:100px;height:12px;border-radius:4px;" />
              </div>
            </template>
            <div v-else class="text-center text-disabled text-body-2 py-2">{{ t('No data') }}</div>
          </VCardText>
        </VCard>
      </VCol>

      <!-- Products by Category -->
      <VCol cols="12" md="5">
        <VCard>
          <VCardText class="pb-2">
            <div class="text-overline text-disabled mb-2">{{ t('Products by Category') }}</div>
            <template v-if="productStats?.by_category?.length">
              <div
                v-for="cat in (productStats.by_category as any[])"
                :key="(cat as any).category__name"
                class="d-flex align-center justify-space-between py-1"
              >
                <span class="text-body-2">{{ (cat as any).category__name }}</span>
                <VChip size="x-small" color="primary" variant="tonal">{{ (cat as any).count }}</VChip>
              </div>
            </template>
            <template v-else-if="loading">
              <div v-for="n in 4" :key="n" class="d-flex justify-space-between py-1">
                <div class="sk-box" style="width:80px;height:12px;border-radius:4px;" />
                <div class="sk-box" style="width:30px;height:18px;border-radius:8px;" />
              </div>
            </template>
            <div v-else class="text-center text-disabled text-body-2 py-2">{{ t('No data') }}</div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <!-- Row 4: Recent orders + Top products + Category revenue -->
    <VRow>
      <VCol cols="12" lg="7">
        <VCard :title="t('Recent Orders')">
          <VDataTable
            :headers="orderHeaders"
            :items="recentOrders"
            :loading="loading"
            hide-default-footer
            density="compact"
          >
            <template v-if="loading && recentOrders.length === 0" #body>
              <tr v-for="n in 8" :key="n" class="sk-row" style="height:44px;">
                <td class="sk-cell"><div class="sk-box" style="width:35px;height:13px;border-radius:4px;" /></td>
                <td class="sk-cell"><div class="sk-box" style="width:70px;height:20px;border-radius:12px;" /></td>
                <td class="sk-cell"><div class="sk-box" style="width:70px;height:20px;border-radius:12px;" /></td>
                <td class="sk-cell"><div class="sk-box" style="width:55px;height:20px;border-radius:12px;" /></td>
                <td class="sk-cell"><div class="sk-box" style="width:70px;height:13px;border-radius:4px;" /></td>
                <td class="sk-cell"><div class="sk-box" style="width:20px;height:13px;border-radius:4px;" /></td>
                <td class="sk-cell"><div class="sk-box" style="width:90px;height:13px;border-radius:4px;" /></td>
              </tr>
            </template>
            <template #item.display_id="{ item }">
              <span class="font-weight-medium">#{{ item.raw.display_id ?? item.raw.id }}</span>
            </template>
            <template #item.order_type="{ item }">
              <VChip size="small" :color="orderTypeColors[item.raw.order_type] ?? 'secondary'" variant="tonal">{{ item.raw.order_type }}</VChip>
            </template>
            <template #item.status="{ item }">
              <VChip size="small" :color="statusColor[item.raw.status] ?? 'default'" variant="tonal">{{ item.raw.status }}</VChip>
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
          </VDataTable>
        </VCard>
      </VCol>

      <VCol cols="12" lg="5">
        <!-- Top Products -->
        <VCard :title="t('Top Products')" class="mb-4">
          <VCardText class="pa-0">
            <template v-if="inkassaStats?.top_products?.length">
              <VList density="compact">
                <VListItem
                  v-for="(p, idx) in (inkassaStats.top_products as any[])"
                  :key="(p as any).product_id"
                >
                  <template #prepend>
                    <VAvatar size="28" color="primary" variant="tonal" class="text-caption font-weight-bold">
                      {{ idx + 1 }}
                    </VAvatar>
                  </template>
                  <template #title>
                    <span class="font-weight-medium">{{ (p as any).product_name }}</span>
                  </template>
                  <template #subtitle>
                    {{ (p as any).quantity_sold }} {{ t('sold') }}
                  </template>
                  <template #append>
                    <span class="text-body-2 font-weight-medium text-success">{{ formatCurrency((p as any).revenue) }}</span>
                  </template>
                </VListItem>
              </VList>
            </template>
            <template v-else-if="loading">
              <div v-for="n in 5" :key="n" class="d-flex align-center gap-3 px-4 py-2">
                <div class="sk-box" style="width:28px;height:28px;border-radius:50%;" />
                <div>
                  <div class="sk-box mb-1" style="width:120px;height:13px;border-radius:4px;" />
                  <div class="sk-box" style="width:80px;height:11px;border-radius:4px;" />
                </div>
              </div>
            </template>
            <div v-else class="text-center text-disabled py-4 text-body-2">{{ t('No data') }}</div>
          </VCardText>
        </VCard>

        <!-- Revenue by Category -->
        <VCard :title="t('Revenue by Category')">
          <VCardText class="pa-0">
            <template v-if="inkassaStats?.category_revenue?.length">
              <VList density="compact">
                <VListItem
                  v-for="cat in (inkassaStats.category_revenue as any[])"
                  :key="(cat as any).category"
                >
                  <template #title>
                    <span class="font-weight-medium">{{ (cat as any).category }}</span>
                  </template>
                  <template #subtitle>
                    {{ (cat as any).items_sold }} {{ t('items sold') }}
                  </template>
                  <template #append>
                    <span class="text-body-2 font-weight-medium text-success">{{ formatCurrency((cat as any).revenue) }}</span>
                  </template>
                </VListItem>
              </VList>
            </template>
            <template v-else-if="loading">
              <div v-for="n in 4" :key="n" class="d-flex align-center justify-space-between px-4 py-2">
                <div class="sk-box" style="width:100px;height:13px;border-radius:4px;" />
                <div class="sk-box" style="width:70px;height:13px;border-radius:4px;" />
              </div>
            </template>
            <div v-else class="text-center text-disabled py-4 text-body-2">{{ t('No data') }}</div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

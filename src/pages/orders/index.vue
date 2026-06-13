<script setup lang="ts">
import { ORDER_STATUS_COLOR as statusColor } from '@/constants/statusColors'
import axios from '@/plugins/axios'
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
    if (statusFilter.value.length)
      params.statuses = statusFilter.value.join(',')
    if (paymentFilter.value)
      params.payment_status = paymentFilter.value
    if (search.value.trim())
      params.search = search.value.trim()
    if (dateFrom.value)
      params.date_from = dateFrom.value
    if (dateTo.value)
      params.date_to = dateTo.value

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
    await Promise.all([loadOrders(), loadStats()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error updating order'), 'error')
  }
}

async function cancelOrder(order: any) {
  try {
    await axios.post(`/orders/${order.id}/cancel`)
    notify(t('Order cancelled'))
    await Promise.all([loadOrders(), loadStats()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error cancelling order'), 'error')
  }
}

async function exportOneC() {
  if (!dateFrom.value || !dateTo.value) {
    notify(t('Pick a date range to export'), 'error')
    return
  }
  try {
    const res = await axios.get('/exports/1c', {
      params: { from: dateFrom.value, to: dateTo.value },
      responseType: 'blob',
    })

    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/xml' }))
    const a = document.createElement('a')

    a.href = url
    a.download = `orders-${dateFrom.value}-to-${dateTo.value}.xml`
    a.click()
    URL.revokeObjectURL(url)
    notify(t('Export downloaded'))
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Export failed'), 'error')
  }
}
</script>

<template>
  <div>
    <!-- Page head -->
    <div class="page-head">
      <div>
        <h1 class="page-head__title">
          {{ t('Orders') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Track, settle and reconcile every order') }}
        </div>
      </div>
      <div class="page-head__actions">
        <VBtn
          color="primary"
          prepend-icon="bx-export"
          :disabled="!dateFrom || !dateTo"
          @click="exportOneC"
        >
          {{ t('Export to 1C') }}
        </VBtn>
      </div>
    </div>

    <!-- KPI strip -->
    <VRow class="mb-4">
      <VCol
        cols="6"
        sm="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-primary">
              <VIcon icon="bx-receipt" />
            </div>
            <div class="kpi-card__label">
              {{ t('Total') }}
            </div>
          </div>
          <div
            v-if="stats"
            class="kpi-card__value"
          >
            {{ stats.total_orders ?? '—' }}
          </div>
          <div
            v-else
            class="sk-box"
            style="width:60px;height:32px;border-radius:4px;"
          />
        </div>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-warning">
              <VIcon icon="bx-time" />
            </div>
            <div class="kpi-card__label">
              {{ t('Preparing') }}
            </div>
          </div>
          <div
            v-if="stats"
            class="kpi-card__value"
          >
            {{ stats.preparing_orders ?? '—' }}
          </div>
          <div
            v-else
            class="sk-box"
            style="width:60px;height:32px;border-radius:4px;"
          />
        </div>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-success">
              <VIcon icon="bx-check-double" />
            </div>
            <div class="kpi-card__label">
              {{ t('Ready') }}
            </div>
          </div>
          <div
            v-if="stats"
            class="kpi-card__value"
          >
            {{ stats.ready_orders ?? '—' }}
          </div>
          <div
            v-else
            class="sk-box"
            style="width:60px;height:32px;border-radius:4px;"
          />
        </div>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-info">
              <VIcon icon="bx-money" />
            </div>
            <div class="kpi-card__label">
              {{ t('Revenue') }}
            </div>
          </div>
          <div
            v-if="stats"
            class="kpi-card__value"
          >
            {{ formatCurrency(stats.total_revenue ?? 0) }}
          </div>
          <div
            v-else
            class="sk-box"
            style="width:110px;height:32px;border-radius:4px;"
          />
        </div>
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
        <VSpacer />
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

      <!-- Active filter chips -->
      <VCardText
        v-if="search || statusFilter.length || paymentFilter || dateFrom || dateTo"
        class="pt-0"
      >
        <div class="filter-chips">
          <span class="text-tertiary" style="font-size:13px;">{{ t('Filters') }}:</span>
          <span
            v-if="search"
            class="filter-chip"
          >
            <span>{{ t('Search') }}: <b>{{ search }}</b></span>
            <VIcon
              icon="bx-x"
              size="14"
              style="cursor:pointer;"
              @click="search = ''"
            />
          </span>
          <span
            v-for="s in statusFilter"
            :key="s"
            class="filter-chip"
          >
            <span>{{ t('Status') }}: <b>{{ s }}</b></span>
            <VIcon
              icon="bx-x"
              size="14"
              style="cursor:pointer;"
              @click="statusFilter = statusFilter.filter(x => x !== s)"
            />
          </span>
          <span
            v-if="paymentFilter"
            class="filter-chip"
          >
            <span>{{ t('Payment') }}: <b>{{ paymentFilter }}</b></span>
            <VIcon
              icon="bx-x"
              size="14"
              style="cursor:pointer;"
              @click="paymentFilter = undefined"
            />
          </span>
          <span
            v-if="dateFrom"
            class="filter-chip"
          >
            <span>{{ t('From') }}: <b>{{ dateFrom }}</b></span>
            <VIcon
              icon="bx-x"
              size="14"
              style="cursor:pointer;"
              @click="dateFrom = ''"
            />
          </span>
          <span
            v-if="dateTo"
            class="filter-chip"
          >
            <span>{{ t('To') }}: <b>{{ dateTo }}</b></span>
            <VIcon
              icon="bx-x"
              size="14"
              style="cursor:pointer;"
              @click="dateTo = ''"
            />
          </span>
        </div>
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

        <template
          v-if="loading && orders.length === 0"
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
                style="width:20px;height:20px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:40px;height:13px;border-radius:4px;"
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
                style="width:100px;height:13px;border-radius:4px;"
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
                style="width:60px;height:22px;border-radius:12px;"
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
                style="width:30px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:100px;height:13px;border-radius:4px;"
              />
            </td>
            <td
              class="sk-cell"
              style="text-align:end;"
            >
              <div class="d-flex justify-end gap-1">
                <div
                  class="sk-box"
                  style="width:50px;height:28px;border-radius:6px;"
                />
                <div
                  class="sk-box"
                  style="width:60px;height:28px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>

        <template #item.display_id="{ item }">
          <span class="font-weight-semibold text-mono">#{{ item.raw.display_id ?? item.raw.id }}</span>
        </template>
        <template #item.order_type="{ item }">
          <VChip
            size="small"
            :color="item.raw.order_type === 'DELIVERY' ? 'info' : item.raw.order_type === 'PICKUP' ? 'primary' : 'default'"
            variant="tonal"
            class="status-pill"
          >
            {{ item.raw.order_type }}
          </VChip>
        </template>
        <!-- phone for delivery, description for hall -->
        <template #item.info="{ item }">
          <span class="text-body-2 text-muted">
            {{ item.raw.phone_number && item.raw.phone_number !== '+998' ? item.raw.phone_number : (item.raw.description || '—') }}
          </span>
        </template>
        <template #item.status="{ item }">
          <VChip
            size="small"
            :color="statusColor[item.raw.status] ?? 'default'"
            variant="tonal"
            class="status-pill"
          >
            {{ item.raw.status }}
          </VChip>
        </template>
        <template #item.is_paid="{ item }">
          <VChip
            size="small"
            :color="item.raw.is_paid ? 'success' : 'error'"
            variant="tonal"
            class="status-pill"
          >
            {{ item.raw.is_paid ? t('PAID') : t('UNPAID') }}
          </VChip>
        </template>
        <template #item.total_amount="{ item }">
          <span class="num-tabular font-weight-semibold">{{ formatCurrency(item.raw.total_amount ?? 0) }}</span>
        </template>
        <template #item.items_count="{ item }">
          <span class="num-tabular text-muted">{{ item.raw.items_count ?? item.raw.items?.length ?? '—' }}</span>
        </template>
        <template #item.created_at="{ item }">
          <span class="num-tabular text-muted">{{ formatDate(item.raw.created_at) }}</span>
        </template>
        <template #item.actions="{ item }">
          <div
            class="d-flex justify-end"
            style="gap:2px;"
          >
            <VBtn
              v-if="!item.raw.is_paid && item.raw.status !== 'CANCELED'"
              icon
              variant="text"
              size="small"
              color="success"
              @click.stop="markPaid(item.raw)"
            >
              <VIcon
                icon="bx-dollar"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Pay') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status !== 'CANCELED' && item.raw.status !== 'COMPLETED'"
              icon
              variant="text"
              size="small"
              color="error"
              @click.stop="cancelOrder(item.raw)"
            >
              <VIcon
                icon="bx-x-circle"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Cancel') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>

        <!-- Expanded row -->
        <template #expanded-row="{ item, columns }">
          <tr>
            <td :colspan="columns.length">
              <div class="expanded-wrap">
                <div class="expanded-label">
                  {{ t('Order Items') }}
                </div>
                <VTable density="compact" class="expanded-table">
                  <thead>
                    <tr>
                      <th>{{ t('Product') }}</th>
                      <th class="text-end">{{ t('Qty') }}</th>
                      <th class="text-end">{{ t('Price') }}</th>
                      <th class="text-end">{{ t('Subtotal') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(orderItem, idx) in ((item.raw.items ?? []) as any[])"
                      :key="idx"
                    >
                      <td class="font-weight-semibold">{{ orderItem.product__name ?? '—' }}</td>
                      <td class="text-end num-tabular">{{ orderItem.quantity ?? '—' }}</td>
                      <td class="text-end num-tabular text-muted">{{ formatCurrency(orderItem.price ?? 0) }}</td>
                      <td class="text-end num-tabular font-weight-semibold">{{ formatCurrency((Number(orderItem.price) || 0) * (orderItem.quantity ?? 1)) }}</td>
                    </tr>
                    <tr v-if="!(item.raw.items?.length)">
                      <td
                        colspan="4"
                        class="text-center text-tertiary"
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

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped lang="scss">
.expanded-wrap {
  padding: var(--sp-4);
  background: rgb(var(--v-theme-surface-inset));
}

.expanded-label {
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  color: rgb(var(--v-theme-text-secondary));
  margin-block-end: 10px;
}

.expanded-table {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-md);
  overflow: hidden;
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

<script setup lang="ts">
/* ============================================================
   ALPHA POS — Orders page
   1:1 port of .tmp-alpha-design/alpha-design-source/Orders.jsx
   filters + chips · sortable/sticky table · expandable rows ·
   selection + bulk actions · inline actions · states
   All existing axios calls / refs / computed / watchers preserved.
   ============================================================ */
import { ORDER_STATUS_COLOR as statusColor } from '@/constants/statusColors'
import axios from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Checkbox from '@/components/design/Checkbox.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import StateFill from '@/components/design/StateFill.vue'
import DateRangePicker from '@/components/design/DateRangePicker.vue'
import OrdersInsights from '@/components/design/OrdersInsights.vue'
import PaymentBreakdown from '@/components/design/PaymentBreakdown.vue'

const { t } = useI18n({ useScope: 'global' })
const { notify } = useNotify()
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
const dateRange = ref<{ from: string, to: string, preset?: string }>({ from: '', to: '', preset: 'all' })
const dateFrom = computed({ get: () => dateRange.value.from, set: v => dateRange.value = { ...dateRange.value, from: v } })
const dateTo = computed({ get: () => dateRange.value.to, set: v => dateRange.value = { ...dateRange.value, to: v } })
// New filters mirroring BE /orders query params
const orderTypeFilter = ref<string | undefined>(undefined)
const cashierFilter = ref<string | undefined>(undefined)
const categoryFilter = ref<string[]>([])
// Lookups for cashier / category selects
const cashierOptions = ref<{ value: string, label: string }[]>([])
const categoryOptions = ref<{ value: string, label: string }[]>([])
const statusPickerOpen = ref(false)
const categoryPickerOpen = ref(false)
const statusPickerRef = ref<HTMLElement | null>(null)
const categoryPickerRef = ref<HTMLElement | null>(null)

// Close popovers when clicking outside their root + close one when opening
// the other (so they don't stack overlapping content).
onClickOutside(statusPickerRef, () => { statusPickerOpen.value = false })
onClickOutside(categoryPickerRef, () => { categoryPickerOpen.value = false })
watch(statusPickerOpen, (v) => { if (v) categoryPickerOpen.value = false })
watch(categoryPickerOpen, (v) => { if (v) statusPickerOpen.value = false })

const expanded = ref<Set<number | string>>(new Set())
const selected = ref<Set<number | string>>(new Set())

const sortKey = ref<string>('id')
const sortDir = ref<'asc' | 'desc'>('desc')

// Per-row + bulk loading state to prevent duplicate POSTs
const actingOnId = ref<number | string | null>(null)
const bulking = ref(false)

// Destructive-action confirm dialogs
type ConfirmKind = 'cancel-one' | 'cancel-bulk' | 'pay-one' | 'pay-bulk'
const confirmDialog = ref<{ kind: ConfirmKind, order?: any } | null>(null)
function openConfirm(kind: ConfirmKind, order?: any) {
  confirmDialog.value = { kind, order }
}
function closeConfirm() {
  confirmDialog.value = null
}

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadOrders()
}, 400)

const orderStatuses = ['OPEN', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED']
const paymentStatuses = ['PAID', 'UNPAID']
const orderTypes = ['HALL', 'DELIVERY', 'PICKUP']

// Status tone map mirrored from the design bundle
const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'success', COMPLETED: 'success', READY: 'success', PAID: 'success',
  PREPARING: 'warning', PENDING: 'warning', OPEN: 'warning', INACTIVE: 'neutral',
  CANCELLED: 'error', CANCELED: 'error', UNPAID: 'error',
  CASHIER: 'info', USER: 'neutral', MANAGER: 'primary', ADMIN: 'primary',
  HALL: 'neutral', DELIVERY: 'info', PICKUP: 'primary',
}
function tone(v: string | undefined) {
  if (!v) return 'neutral'
  return STATUS_TONE[v] ?? statusColor[v] ?? 'neutral'
}

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
    if (orderTypeFilter.value)
      params.order_type = orderTypeFilter.value
    if (cashierFilter.value)
      params.cashier_id = cashierFilter.value
    if (categoryFilter.value.length)
      params.category_ids = categoryFilter.value.join(',')
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
    const params: any = {}
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    if (cashierFilter.value) params.cashier_id = cashierFilter.value
    const res = await axios.get('/orders/stats', { params })

    stats.value = res.data?.data ?? res.data
  }
  catch { /* ignore */ }
}

async function loadCashiers() {
  try {
    const res = await axios.get('/users', { params: { role: 'CASHIER', per_page: 100 } })
    const d = res.data?.data ?? res.data
    const list: any[] = d?.users ?? []
    cashierOptions.value = list.map((u: any) => ({
      value: String(u.id),
      label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || String(u.id),
    }))
  }
  catch { /* ignore */ }
}

async function loadCategoriesLookup() {
  try {
    const res = await axios.get('/categories', { params: { per_page: 100 } })
    const d = res.data?.data ?? res.data
    const list: any[] = d?.categories ?? d?.items ?? []
    categoryOptions.value = list.map((c: any) => ({
      value: String(c.id),
      label: c.name ?? String(c.id),
    }))
  }
  catch { /* ignore */ }
}

onMounted(() => {
  loadOrders()
  loadStats()
  loadCashiers()
  loadCategoriesLookup()
})

watch([page, itemsPerPage], loadOrders)
watch([statusFilter, paymentFilter, dateRange, orderTypeFilter, cashierFilter, categoryFilter], () => {
  page.value = 1
  loadOrders()
  loadStats()
})
watch(search, () => debouncedSearch())

// ---- actions ----
async function markPaid(order: any) {
  if (actingOnId.value === order.id) return
  actingOnId.value = order.id
  try {
    await axios.post(`/orders/${order.id}/pay`)
    notify(t('Order marked as paid'))
    await Promise.all([loadOrders(), loadStats()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error updating order'), 'error')
  }
  finally {
    actingOnId.value = null
  }
}

async function cancelOrder(order: any) {
  if (actingOnId.value === order.id) return
  actingOnId.value = order.id
  try {
    await axios.post(`/orders/${order.id}/cancel`)
    notify(t('Order cancelled'))
    await Promise.all([loadOrders(), loadStats()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error cancelling order'), 'error')
  }
  finally {
    actingOnId.value = null
  }
}

// Wrappers triggered from confirm dialog
async function confirmCancelOne() {
  const o = confirmDialog.value?.order
  closeConfirm()
  if (o) await cancelOrder(o)
}
async function confirmPayOne() {
  const o = confirmDialog.value?.order
  closeConfirm()
  if (o) await markPaid(o)
}
async function confirmCancelBulk() {
  closeConfirm()
  await bulkCancel()
}
async function confirmPayBulk() {
  closeConfirm()
  await bulkMarkPaid()
}

// ---- bulk + selection ----
async function bulkMarkPaid() {
  if (bulking.value) return
  bulking.value = true
  try {
    const ids = [...selected.value]
    for (const id of ids) {
      const o = orders.value.find((x: any) => x.id === id)
      if (o) await markPaid(o)
    }
    selected.value = new Set()
  }
  finally {
    bulking.value = false
  }
}
async function bulkCancel() {
  if (bulking.value) return
  bulking.value = true
  try {
    const ids = [...selected.value]
    for (const id of ids) {
      const o = orders.value.find((x: any) => x.id === id)
      if (o) await cancelOrder(o)
    }
    selected.value = new Set()
  }
  finally {
    bulking.value = false
  }
}

function onBulkExport() {
  notify(t('Exporting {n} orders…', { n: selected.value.size }), 'info')
  // BE endpoint pending — no actual export call
}

function toggleRow(id: number | string) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
}
function toggleSelect(id: number | string, ev?: Event) {
  if (ev) ev.stopPropagation()
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  selected.value = new Set(selected.value)
}
const allSelected = computed(() => orders.value.length > 0 && orders.value.every((o: any) => selected.value.has(o.id)))
const someSelected = computed(() => selected.value.size > 0 && !allSelected.value)
function toggleSelectAll() {
  if (allSelected.value) selected.value = new Set()
  else selected.value = new Set(orders.value.map((o: any) => o.id))
}

// ---- sort ----
function setSort(key: string) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = 'asc' }
}
const sortedOrders = computed(() => {
  const arr = [...orders.value]
  const k = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  arr.sort((a: any, b: any) => {
    let av: any, bv: any
    if (k === 'id') { av = a.order_number ?? a.display_id ?? 0; bv = b.order_number ?? b.display_id ?? 0 }
    else if (k === 'total') { av = Number(a.total_amount) || 0; bv = Number(b.total_amount) || 0 }
    else if (k === 'at') { av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime() }
    else if (k === 'status') { av = a.status; bv = b.status }
    else { av = (a as any)[k]; bv = (b as any)[k] }
    if (av == null) return 1
    if (bv == null) return -1
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
  return arr
})

// ---- pagination ----
const totalPages = computed(() => Math.max(1, Math.ceil(totalOrders.value / itemsPerPage.value)))
const pageList = computed(() => {
  const tp = totalPages.value
  const p = page.value
  const list: (number | string)[] = []
  const push = (x: number | string) => list.push(x)
  if (tp <= 7) { for (let i = 1; i <= tp; i++) push(i); return list }
  push(1)
  if (p > 3) push('…')
  const start = Math.max(2, p - 1)
  const end = Math.min(tp - 1, p + 1)
  for (let i = start; i <= end; i++) push(i)
  if (p < tp - 2) push('…')
  push(tp)
  return list
})
const rangeStart = computed(() => totalOrders.value === 0 ? 0 : (page.value - 1) * itemsPerPage.value + 1)
const rangeEnd = computed(() => Math.min(page.value * itemsPerPage.value, totalOrders.value))

// ---- filter chips ----
const hasFilters = computed(() =>
  !!(search.value || statusFilter.value.length || paymentFilter.value || dateFrom.value || dateTo.value
    || orderTypeFilter.value || cashierFilter.value || categoryFilter.value.length),
)
function clearAll() {
  search.value = ''
  statusFilter.value = []
  paymentFilter.value = undefined
  dateRange.value = { from: '', to: '', preset: 'all' }
  orderTypeFilter.value = undefined
  cashierFilter.value = undefined
  categoryFilter.value = []
}
function cashierLabel(id: string | undefined) {
  if (!id) return ''
  return cashierOptions.value.find(o => o.value === id)?.label ?? id
}
function categoryLabel(id: string) {
  return categoryOptions.value.find(o => o.value === id)?.label ?? id
}

// ---- formatters ----
function infoOf(o: any) {
  const ph = o.phone_number && o.phone_number !== '+998' ? o.phone_number : null
  return ph || o.description || '—'
}
function itemsOf(o: any) {
  return o.items_count ?? o.items?.length ?? '—'
}

// ---- DataTable columns ----
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'id', label: t('Order #'), sortable: true },
  { key: 'type', label: t('Type') },
  { key: 'info', label: t('Info') },
  { key: 'customer', label: t('Customer') },
  { key: 'cashier', label: t('Cashier') },
  { key: 'status', label: t('Status'), sortable: true },
  { key: 'payment', label: t('Payment') },
  { key: 'total', label: t('Total'), sortable: true, align: 'right' },
  { key: 'items', label: t('Items'), align: 'right' },
  { key: 'at', label: t('Date'), sortable: true, align: 'right' },
  { key: 'paid_at', label: t('Paid at'), align: 'right' },
])

// Bridge our internal sort state to DataTable's sort prop
const dtSort = computed(() => ({
  key: sortKey.value === 'id'
    ? 'id'
    : sortKey.value === 'total'
      ? 'total'
      : sortKey.value === 'at' ? 'at' : sortKey.value === 'status' ? 'status' : sortKey.value,
  dir: sortDir.value,
}))
function onDtSort(s: { key: string | null, dir: 'asc' | 'desc' }) {
  if (!s.key) return
  sortKey.value = s.key
  sortDir.value = s.dir
}

// Selection sync with DataTable
function onDtSelection(next: Set<string | number>) {
  selected.value = next
}

// Pagination passthrough
const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: totalOrders.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

const noResultsMsg = computed(() => t('No orders match your filters'))
const noResultsSub = computed(() => t('Adjust the search, status or date range to see results.'))

// ---- Stats-level payment breakdown ----
// BE shape (per /orders/stats): payment_breakdown: { CASH: '<dec>', CARD: '<dec>', DIGITAL: '<dec>' }
// Adapt flat object to PaymentBreakdown's Array<{ type, amount }> shape.
const statsPaymentMethods = computed(() => {
  const pb = stats.value?.payment_breakdown
  if (!pb || typeof pb !== 'object') return []
  const out: Array<{ type: string, amount: number }> = []
  for (const [k, v] of Object.entries(pb)) {
    const amount = Number(v) || 0
    if (amount > 0) out.push({ type: k, amount })
  }
  return out
})
const statsPaymentTotal = computed(() =>
  statsPaymentMethods.value.reduce((a, m) => a + m.amount, 0),
)

// ---- OrdersInsights bridge ----
// Click a status segment/legend: toggle membership in the multi-status array.
function onStatusToggle(s: string) {
  if (statusFilter.value.includes(s))
    statusFilter.value = statusFilter.value.filter(x => x !== s)
  else
    statusFilter.value = [...statusFilter.value, s]
}
// Click a payment legend: set, or clear if already that value.
function onPaymentToggle(p: string) {
  paymentFilter.value = paymentFilter.value === p ? undefined : p
}
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="t('Orders')"
      :subtitle="t('Track, settle and reconcile every order')"
    >
    </PageHeader>

    <!-- KPI strip -->
    <div class="grid cols-4 kpi-grid" style="margin-bottom: var(--sp-5);">
      <Kpi
        :data="{
          label: t('Total'),
          icon: 'receipt',
          tone: 'primary',
          value: stats ? (stats.total_orders ?? 0) : null,
        }"
      />
      <Kpi
        :data="{
          label: t('Preparing'),
          icon: 'clock',
          tone: 'warning',
          value: stats ? (stats.preparing_orders ?? 0) : null,
        }"
      />
      <Kpi
        :data="{
          label: t('Ready'),
          icon: 'check',
          tone: 'success',
          value: stats ? (stats.ready_orders ?? 0) : null,
        }"
      />
      <Kpi
        :data="{
          label: t('Revenue'),
          icon: 'dollar',
          tone: 'info',
          money: true,
          value: stats ? (stats.total_revenue ?? 0) : null,
        }"
      />
    </div>

    <!-- Insights strip (additive port from v3) -->
    <OrdersInsights
      v-if="!loading && orders.length"
      :orders="orders"
      :status="statusFilter"
      :payment="paymentFilter"
      @status="onStatusToggle"
      @payment="onPaymentToggle"
    />

    <!-- Stats-level payment breakdown (from /orders/stats payment_breakdown) -->
    <div
      v-if="statsPaymentMethods.length"
      class="card stats-paybreak-card"
    >
      <div class="stats-paybreak-head">
        <span class="kpi__label">{{ t('Payment breakdown') }}</span>
      </div>
      <PaymentBreakdown
        :methods="statsPaymentMethods"
        :total="statsPaymentTotal"
      />
    </div>

    <!-- Main table card -->
    <div class="card">
      <!-- Toolbar -->
      <div class="toolbar orders-toolbar">
        <div class="grow tb-search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search orders...')"
            :aria-label="t('Search orders')"
          />
        </div>

        <!-- Multi-status filter (popover with checkboxes) -->
        <div ref="statusPickerRef" class="tb-filter tb-filter--md" style="position: relative;">
          <div
            class="control control--select"
            style="cursor: pointer;"
            tabindex="0"
            @click="statusPickerOpen = !statusPickerOpen"
            @keydown.enter.prevent="statusPickerOpen = !statusPickerOpen"
          >
            <DesignIcon name="filter" :size="18" />
            <span
              :style="{ color: statusFilter.length ? 'var(--text)' : 'var(--text-tertiary)', flex: 1, paddingInline: '4px' }"
            >
              {{ statusFilter.length
                ? statusFilter.map(s => t(`order_status_${s}`)).join(', ')
                : t('Filter by Status') }}
            </span>
            <DesignIcon name="chevdown" :size="18" class="chev" />
          </div>
          <div
            v-if="statusPickerOpen"
            class="card"
            style="position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:50; padding:8px; max-height:260px; overflow:auto;"
          >
            <label
              v-for="s in orderStatuses"
              :key="s"
              class="row"
              style="gap:8px; padding:6px 4px; cursor:pointer;"
            >
              <Checkbox
                :model-value="statusFilter.includes(s)"
                @update:model-value="(v: boolean) => {
                  if (v && !statusFilter.includes(s)) statusFilter = [...statusFilter, s]
                  else if (!v) statusFilter = statusFilter.filter(x => x !== s)
                }"
              />
              <span>{{ t(`order_status_${s}`) }}</span>
            </label>
          </div>
        </div>


        <!-- Order type (HALL / DELIVERY / PICKUP) -->
        <div class="tb-filter tb-filter--xs">
          <Select
            :model-value="orderTypeFilter ?? ''"
            :placeholder="t('Order type')"
            :options="orderTypes.map(o => ({ value: o, label: t(`order_type_${o}`) }))"
            @update:model-value="(v: string) => orderTypeFilter = v ? v : undefined"
          />
        </div>

        <!-- Cashier -->
        <div class="tb-filter tb-filter--sm">
          <Select
            :model-value="cashierFilter ?? ''"
            :placeholder="t('All cashiers')"
            :options="cashierOptions"
            @update:model-value="(v: string) => cashierFilter = v ? v : undefined"
          />
        </div>

        <!-- Category multi-select (popover) -->
        <div ref="categoryPickerRef" class="tb-filter tb-filter--md" style="position: relative;">
          <div
            class="control control--select"
            style="cursor: pointer;"
            tabindex="0"
            @click="categoryPickerOpen = !categoryPickerOpen"
            @keydown.enter.prevent="categoryPickerOpen = !categoryPickerOpen"
          >
            <span
              :style="{ color: categoryFilter.length ? 'var(--text)' : 'var(--text-tertiary)', flex: 1, paddingInline: '4px' }"
            >
              {{ categoryFilter.length
                ? categoryFilter.map(id => categoryLabel(id)).join(', ')
                : t('All categories') }}
            </span>
            <DesignIcon name="chevdown" :size="18" class="chev" />
          </div>
          <div
            v-if="categoryPickerOpen"
            class="card"
            style="position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:50; padding:8px; max-height:260px; overflow:auto;"
          >
            <label
              v-for="c in categoryOptions"
              :key="c.value"
              class="row"
              style="gap:8px; padding:6px 4px; cursor:pointer;"
            >
              <Checkbox
                :model-value="categoryFilter.includes(c.value)"
                @update:model-value="(v: boolean) => {
                  if (v && !categoryFilter.includes(c.value)) categoryFilter = [...categoryFilter, c.value]
                  else if (!v) categoryFilter = categoryFilter.filter(x => x !== c.value)
                }"
              />
              <span>{{ c.label }}</span>
            </label>
          </div>
        </div>

      </div>

      <!-- Compact filter strip: single date range popover + payment segmented control -->
      <div class="filterstrip">
        <div class="filterstrip__group">
          <span class="filterstrip__lbl">{{ t('Period') }}</span>
          <DateRangePicker
            v-model="dateRange"
            align="left"
            :placeholder="t('All time')"
          />
        </div>

        <div class="filterstrip__group">
          <span class="filterstrip__lbl">{{ t('Payment') }}</span>
          <div class="segctl">
            <button
              type="button"
              class="segctl__btn"
              :class="{ 'is-active': !paymentFilter }"
              @click="paymentFilter = undefined"
            >
              {{ t('All') }}
            </button>
            <button
              v-for="p in paymentStatuses"
              :key="p"
              type="button"
              class="segctl__btn"
              :class="{ 'is-active': paymentFilter === p }"
              @click="paymentFilter = p"
            >
              {{ t(`payment_status_${p}`) }}
            </button>
          </div>
        </div>
      </div>

      <!-- Active filter chips -->
      <div v-if="hasFilters" class="toolbar" style="padding-top: 0;">
        <div class="chips">
          <span class="tertiary" style="font-size: 13px; margin-right: 2px;">{{ t('Filters') }}:</span>

          <span v-if="search" class="chip">
            <span>{{ t('Search') }}: <b>{{ search }}</b></span>
            <span class="chip__x" @click="search = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>

          <span v-for="s in statusFilter" :key="s" class="chip">
            <span>{{ t('Status') }}: <b>{{ t(`order_status_${s}`) }}</b></span>
            <span class="chip__x" @click="statusFilter = statusFilter.filter(x => x !== s)">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>

          <span v-if="paymentFilter" class="chip">
            <span>{{ t('Payment') }}: <b>{{ t(`payment_status_${paymentFilter}`) }}</b></span>
            <span class="chip__x" @click="paymentFilter = undefined">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>

          <span v-if="orderTypeFilter" class="chip">
            <span>{{ t('Type') }}: <b>{{ t(`order_type_${orderTypeFilter}`) }}</b></span>
            <span class="chip__x" @click="orderTypeFilter = undefined">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>

          <span v-if="cashierFilter" class="chip">
            <span>{{ t('Cashier') }}: <b>{{ cashierLabel(cashierFilter) }}</b></span>
            <span class="chip__x" @click="cashierFilter = undefined">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>

          <span v-for="cid in categoryFilter" :key="`cat-${cid}`" class="chip">
            <span>{{ t('Category') }}: <b>{{ categoryLabel(cid) }}</b></span>
            <span class="chip__x" @click="categoryFilter = categoryFilter.filter(x => x !== cid)">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>

<span v-if="dateFrom" class="chip">
            <span>{{ t('Date from') }}: <b>{{ dateFrom }}</b></span>
            <span class="chip__x" @click="dateFrom = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>

          <span v-if="dateTo" class="chip">
            <span>{{ t('Date to') }}: <b>{{ dateTo }}</b></span>
            <span class="chip__x" @click="dateTo = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>

          <button class="chip--clear" @click="clearAll">
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- DataTable: sortable / selectable / expandable, server-paginated -->
      <DataTable
        :columns="columns"
        :rows="sortedOrders"
        row-key="id"
        :loading="loading"
        selectable
        expandable
        :sort="dtSort"
        :selection="selected"
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
        @sort="onDtSort"
        @update:selection="onDtSelection"
        @row-click="(o: any) => toggleRow(o.id)"
      >
        <!-- Order # -->
        <template #cell.id="{ row: o }">
          <span class="cell-strong mono">#{{ o.order_number ?? o.display_id ?? '—' }}</span>
        </template>

        <!-- Type -->
        <template #cell.type="{ row: o }">
          <Badge :tone="(tone(o.order_type) as any)">
            {{ o.order_type ? t(`order_type_${o.order_type}`) : '—' }}
          </Badge>
        </template>

        <!-- Info -->
        <template #cell.info="{ row: o }">
          <span class="cell-muted">{{ infoOf(o) }}</span>
        </template>

        <!-- Customer -->
        <template #cell.customer="{ row: o }">
          <span class="cell-muted">{{ o.user?.name ?? '—' }}</span>
        </template>

        <!-- Cashier -->
        <template #cell.cashier="{ row: o }">
          <span class="cell-muted">{{ o.cashier?.name ?? '—' }}</span>
        </template>

        <!-- Status with dot -->
        <template #cell.status="{ row: o }">
          <Badge :tone="(tone(o.status) as any)" dot>
            {{ o.status ? t(`order_status_${o.status}`) : '—' }}
          </Badge>
        </template>

        <!-- Payment -->
        <template #cell.payment="{ row: o }">
          <Badge :tone="o.is_paid ? 'success' : 'error'">
            {{ t(`payment_status_${o.is_paid ? 'PAID' : 'UNPAID'}`) }}
          </Badge>
        </template>

        <!-- Paid at -->
        <template #cell.paid_at="{ row: o }">
          <span class="mono cell-muted nowrap">{{ o.paid_at ? formatDate(o.paid_at) : '—' }}</span>
        </template>

        <!-- Total -->
        <template #cell.total="{ row: o }">
          <span class="mono cell-strong">{{ formatCurrency(o.total_amount ?? 0) }}</span>
        </template>

        <!-- Items -->
        <template #cell.items="{ row: o }">
          <span class="mono cell-muted">{{ itemsOf(o) }}</span>
        </template>

        <!-- Date -->
        <template #cell.at="{ row: o }">
          <span class="mono cell-muted nowrap">{{ formatDate(o.created_at) }}</span>
        </template>

        <!-- Bulk actions -->
        <template #bulk-actions>
          <Button
            variant="secondary"
            size="sm"
            icon="dollar"
            :loading="bulking"
            :disabled="bulking"
            @click="openConfirm('pay-bulk')"
          >
            {{ t('Mark paid') }}
          </Button>
          <Button
            variant="danger-soft"
            size="sm"
            icon="close"
            :loading="bulking"
            :disabled="bulking"
            @click="openConfirm('cancel-bulk')"
          >
            {{ t('Cancel') }}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon="download"
            @click="onBulkExport"
          >
            {{ t('Export') }}
          </Button>
        </template>

        <!-- Inline row actions -->
        <template #row-actions="{ row: o }">
          <IconAction
            v-if="!o.is_paid && o.status !== 'CANCELED'"
            icon="dollar"
            tone="success"
            :title="t('Pay')"
            :disabled="actingOnId === o.id"
            @click="openConfirm('pay-one', o)"
          />
          <IconAction
            v-if="o.status !== 'CANCELED' && o.status !== 'COMPLETED'"
            icon="close"
            tone="danger"
            :title="t('Cancel')"
            :disabled="actingOnId === o.id"
            @click="openConfirm('cancel-one', o)"
          />
          <IconAction icon="more" :title="t('More')" />
        </template>

        <!-- Expanded row: order items -->
        <template #expanded="{ row: o }">
          <div class="kpi__label" style="margin-bottom: 10px;">
            {{ t('Order Items') }}
          </div>
          <div class="tablewrap">
            <table
              class="dtable"
              style="background: var(--surface); border-radius: 10px; border: 1px solid var(--border); overflow: hidden;"
            >
              <thead>
                <tr>
                  <th>{{ t('Product') }}</th>
                  <th class="num">
                    {{ t('Qty') }}
                  </th>
                  <th class="num">
                    {{ t('Price') }}
                  </th>
                  <th class="num">
                    {{ t('Subtotal') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(li, i) in ((o.items ?? []) as any[])" :key="i">
                  <td class="cell-strong">
                    {{ li.product__name ?? '—' }}
                  </td>
                  <td class="num mono">
                    {{ li.quantity ?? '—' }}
                  </td>
                  <td class="num mono cell-muted">
                    {{ formatCurrency(li.price ?? 0) }}
                  </td>
                  <td class="num mono cell-strong">
                    {{ formatCurrency((Number(li.price) || 0) * (li.quantity ?? 1)) }}
                  </td>
                </tr>
                <tr v-if="!(o.items?.length)">
                  <td colspan="4" class="center cell-muted">
                    {{ t('No items') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Per-method payment breakdown (additive port from v3) -->
          <div
            v-if="o.is_paid && o.payments?.length"
            class="orders-paybreak-wrap"
          >
            <PaymentBreakdown
              :methods="o.payments"
              :total="Number(o.total_amount) || 0"
            />
          </div>
        </template>

        <!-- Empty state -->
        <template #empty>
          <StateFill
            icon="receipt"
            :title="noResultsMsg"
            :sub="noResultsSub"
          >
            <div v-if="hasFilters" style="margin-top: 12px;">
              <Button variant="secondary" @click="clearAll">
                {{ t('Clear filters') }}
              </Button>
            </div>
          </StateFill>
        </template>
      </DataTable>
    </div>

    <!-- Confirm action modal (cancel / mark paid, single or bulk) -->
    <Modal
      :open="confirmDialog !== null"
      :width="440"
      class="confirm-modal"
      :title="confirmDialog?.kind === 'cancel-one' ? t('Cancel this order?')
        : confirmDialog?.kind === 'cancel-bulk' ? t('Cancel selected orders?')
          : confirmDialog?.kind === 'pay-one' ? t('Mark this order as paid?')
            : t('Mark selected orders as paid?')"
      :subtitle="(confirmDialog?.kind === 'cancel-one' || confirmDialog?.kind === 'cancel-bulk')
        ? t('This action cannot be undone')
        : t('Payment status will change immediately.')"
      @close="closeConfirm"
    >
      <div v-if="confirmDialog" class="row" style="gap:14px;align-items:flex-start;">
        <div
          class="kpi__icon"
          :class="(confirmDialog.kind === 'cancel-one' || confirmDialog.kind === 'cancel-bulk') ? 't-error' : 't-success'"
          style="width:44px;height:44px;flex:0 0 44px;"
        >
          <DesignIcon name="alert" :size="22" />
        </div>
        <div>
          <p v-if="confirmDialog.order" style="margin:0;font-weight:600;">
            #{{ confirmDialog.order.order_number ?? confirmDialog.order.display_id ?? '—' }}
            · {{ formatCurrency(confirmDialog.order.total_amount ?? 0) }}
          </p>
          <p v-else style="margin:0;font-weight:600;">
            {{ t('{count} selected', { count: selected.size }) }}
          </p>
          <p class="muted" style="margin:6px 0 0;font-size:14px;">
            <template v-if="confirmDialog.kind === 'cancel-one' || confirmDialog.kind === 'cancel-bulk'">
              {{ t('Cancelling may require a refund and impact the customer.') }}
            </template>
            <template v-else>
              {{ t('No refund flow will be triggered.') }}
            </template>
          </p>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="bulking || actingOnId !== null" @click="closeConfirm">
          {{ t('Close') }}
        </Button>
        <Button
          v-if="confirmDialog?.kind === 'cancel-one'"
          variant="danger"
          :loading="actingOnId !== null"
          :disabled="actingOnId !== null"
          @click="confirmCancelOne"
        >
          {{ t('Cancel order') }}
        </Button>
        <Button
          v-else-if="confirmDialog?.kind === 'cancel-bulk'"
          variant="danger"
          :loading="bulking"
          :disabled="bulking"
          @click="confirmCancelBulk"
        >
          {{ t('Cancel orders') }}
        </Button>
        <Button
          v-else-if="confirmDialog?.kind === 'pay-one'"
          variant="primary"
          :loading="actingOnId !== null"
          :disabled="actingOnId !== null"
          @click="confirmPayOne"
        >
          {{ t('Mark paid') }}
        </Button>
        <Button
          v-else
          variant="primary"
          :loading="bulking"
          :disabled="bulking"
          @click="confirmPayBulk"
        >
          {{ t('Mark paid') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
/* Layout-only safeguards. All visual styling comes from
   src/styles/design-shell.css (verbatim ported alpha-design-system.css). */
.row {
  display: flex;
  align-items: center;
}

/* Compact filter strip — segmented controls for date + payment */
.filterstrip {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.filterstrip--date {
  padding-top: 10px;
  padding-bottom: 14px;
}
.filterstrip__group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filterstrip__lbl {
  font-size: var(--fs-micro);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.segctl {
  display: inline-flex;
  background: var(--surface-inset);
  border-radius: var(--r-sm);
  padding: 3px;
  gap: 2px;
}
.segctl__btn {
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 6px;
  font-family: inherit;
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background .12s, color .12s;
  white-space: nowrap;
}
.segctl__btn:hover:not(.is-active) {
  color: var(--text);
}
.segctl__btn.is-active {
  background: var(--surface);
  color: var(--primary);
  box-shadow: var(--shadow-xs);
  font-weight: var(--fw-semibold);
}
@media (max-width: 768px) {
  .filterstrip { gap: 12px; padding: 10px 14px; }
  .filterstrip__group { flex: 1 1 100%; flex-direction: column; align-items: flex-start; gap: 6px; }
  .segctl { overflow-x: auto; max-width: 100%; }
  .segctl__btn { padding: 6px 10px; }
}

/* --- Responsive toolbar --- */
.orders-toolbar {
  flex-wrap: wrap;
  row-gap: 8px;
}

.tb-search {
  max-width: 280px;
  min-width: 220px;
  flex: 1 1 220px;
}

.tb-filter {
  flex: 0 1 auto;
}

.tb-filter--md { width: 200px; }
.tb-filter--sm { width: 180px; }
.tb-filter--xs { width: 160px; }

.tb-daterange {
  margin-left: auto;
  flex-wrap: wrap;
}

.tb-date {
  width: 160px;
}

/* --- Tablet collapse --- */
@media (max-width: 1100px) {
  .tb-daterange {
    margin-left: 0;
  }
}

/* --- Intermediate tablet: shrink fixed filter widths so toolbar doesn't overflow narrow tablets (769-899px) --- */
@media (max-width: 900px) {
  .tb-filter--md { width: 160px; }
  .tb-filter--sm { width: 140px; }
  .tb-filter--xs { width: 120px; }
  .tb-date { width: 140px; }
}

/* --- Mobile collapse (canonical 768px phone breakpoint) --- */
@media (max-width: 768px) {
  .orders-toolbar > * {
    width: 100%;
    max-width: 100%;
    flex: 1 1 100%;
  }

  .tb-search,
  .tb-filter,
  .tb-filter--md,
  .tb-filter--sm,
  .tb-filter--xs {
    width: 100%;
    max-width: 100%;
  }

  .tb-daterange {
    width: 100%;
    margin-left: 0;
  }

  .tb-date {
    flex: 1 1 calc(50% - 16px);
    width: auto;
  }
}

/* --- KPI grid responsive collapse --- */
@media (max-width: 1100px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Keep 2-up down to small-phone breakpoint (420px) per canonical spec; collapse to 1-col only below */
@media (max-width: 420px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}

/* --- Expanded row inner table --- */
:deep(.tablewrap) {
  overflow-x: auto;
}
:deep(.tablewrap .dtable) {
  min-width: 480px;
}

/* --- Modal mobile safety --- */
:deep(.confirm-modal .modal__panel),
:deep(.confirm-modal .modal) {
  max-width: calc(100vw - 24px);
}

/* --- Expanded row: payment breakdown wrapper --- */
.orders-paybreak-wrap {
  margin-block-start: var(--sp-4);
  max-width: 480px;
}
@media (max-width: 768px) {
  .orders-paybreak-wrap { max-width: 100%; }
}

/* --- Stats-level payment breakdown card --- */
.stats-paybreak-card {
  padding: var(--sp-4);
  margin-block-end: var(--sp-5);
}
.stats-paybreak-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-end: var(--sp-2);
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

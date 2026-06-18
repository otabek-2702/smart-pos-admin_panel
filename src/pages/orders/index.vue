<script setup lang="ts">
import { ORDER_STATUS_COLOR as statusColor } from '@/constants/statusColors'
import axios from '@/plugins/axios'

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
const dateFrom = ref('')
const dateTo = ref('')

const expanded = ref<Set<number | string>>(new Set())
const selected = ref<Set<number | string>>(new Set())

const sortKey = ref<string>('id')
const sortDir = ref<'asc' | 'desc'>('desc')

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadOrders()
}, 400)

const orderStatuses = ['OPEN', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED']
const paymentStatuses = ['PAID', 'UNPAID']

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

// ---- bulk + selection ----
async function bulkMarkPaid() {
  const ids = [...selected.value]
  for (const id of ids) {
    const o = orders.value.find((x: any) => x.id === id)
    if (o) await markPaid(o)
  }
  selected.value = new Set()
}
async function bulkCancel() {
  const ids = [...selected.value]
  for (const id of ids) {
    const o = orders.value.find((x: any) => x.id === id)
    if (o) await cancelOrder(o)
  }
  selected.value = new Set()
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
    if (k === 'id') { av = a.display_id ?? a.id; bv = b.display_id ?? b.id }
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
  !!(search.value || statusFilter.value.length || paymentFilter.value || dateFrom.value || dateTo.value),
)
function clearAll() {
  search.value = ''
  statusFilter.value = []
  paymentFilter.value = undefined
  dateFrom.value = ''
  dateTo.value = ''
}

// ---- formatters ----
function infoOf(o: any) {
  const ph = o.phone_number && o.phone_number !== '+998' ? o.phone_number : null
  return ph || o.description || '—'
}
function itemsOf(o: any) {
  return o.items_count ?? o.items?.length ?? '—'
}
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <div class="page__head">
      <div>
        <h1 class="page__title">
          {{ t('Orders') }}
        </h1>
        <div class="page__subtitle">
          {{ t('Track, settle and reconcile every order') }}
        </div>
      </div>
      <div class="page__head-actions">
        <button
          class="btn btn--primary"
          :class="{ 'is-disabled': !dateFrom || !dateTo }"
          :disabled="!dateFrom || !dateTo"
          @click="exportOneC"
        >
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {{ t('Export to 1C') }}
        </button>
      </div>
    </div>

    <!-- KPI strip -->
    <div class="grid cols-4" style="margin-bottom: var(--sp-5);">
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Total') }}
          </div>
        </div>
        <div v-if="stats" class="kpi__value">
          {{ stats.total_orders ?? '—' }}
        </div>
        <div v-else class="skel" style="width:60px;height:32px;border-radius:4px;" />
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-warning">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Preparing') }}
          </div>
        </div>
        <div v-if="stats" class="kpi__value">
          {{ stats.preparing_orders ?? '—' }}
        </div>
        <div v-else class="skel" style="width:60px;height:32px;border-radius:4px;" />
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Ready') }}
          </div>
        </div>
        <div v-if="stats" class="kpi__value">
          {{ stats.ready_orders ?? '—' }}
        </div>
        <div v-else class="skel" style="width:60px;height:32px;border-radius:4px;" />
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Revenue') }}
          </div>
        </div>
        <div v-if="stats" class="kpi__value">
          {{ formatCurrency(stats.total_revenue ?? 0) }}
        </div>
        <div v-else class="skel" style="width:110px;height:32px;border-radius:4px;" />
      </div>
    </div>

    <!-- Main table card -->
    <div class="card">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="grow" style="max-width: 280px;">
          <div class="control">
            <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input v-model="search" :placeholder="t('Search orders...')">
          </div>
        </div>

        <div style="width: 200px;">
          <div class="control control--select">
            <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <select :value="statusFilter[0] ?? ''" @change="(e: any) => { const v = e.target.value; statusFilter = v ? [v] : [] }">
              <option value="">
                {{ t('Filter by Status') }}
              </option>
              <option v-for="s in orderStatuses" :key="s" :value="s">
                {{ s }}
              </option>
            </select>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div style="width: 180px;">
          <div class="control control--select">
            <select v-model="paymentFilter">
              <option :value="undefined">
                {{ t('Payment Status') }}
              </option>
              <option v-for="p in paymentStatuses" :key="p" :value="p">
                {{ p }}
              </option>
            </select>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div class="row" style="gap: 8px; margin-left: auto;">
          <div class="control control--sm" style="width: 160px;">
            <input v-model="dateFrom" type="date" :aria-label="t('From')">
          </div>
          <span class="tertiary">→</span>
          <div class="control control--sm" style="width: 160px;">
            <input v-model="dateTo" type="date" :aria-label="t('To')">
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </span>

          <span v-for="s in statusFilter" :key="s" class="chip">
            <span>{{ t('Status') }}: <b>{{ s }}</b></span>
            <span class="chip__x" @click="statusFilter = statusFilter.filter(x => x !== s)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </span>

          <span v-if="paymentFilter" class="chip">
            <span>{{ t('Payment') }}: <b>{{ paymentFilter }}</b></span>
            <span class="chip__x" @click="paymentFilter = undefined">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </span>

          <span v-if="dateFrom" class="chip">
            <span>{{ t('From') }}: <b>{{ dateFrom }}</b></span>
            <span class="chip__x" @click="dateFrom = ''">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </span>

          <span v-if="dateTo" class="chip">
            <span>{{ t('To') }}: <b>{{ dateTo }}</b></span>
            <span class="chip__x" @click="dateTo = ''">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          </span>

          <button class="chip--clear" @click="clearAll">
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- Bulk actions bar -->
      <div v-if="selected.size > 0" class="bulkbar">
        <span class="bulkbar__count">{{ selected.size }} {{ t('selected') }}</span>
        <div class="row" style="gap: 8px; margin-left: auto;">
          <button class="btn btn--secondary btn--sm" @click="bulkMarkPaid">
            <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            {{ t('Mark paid') }}
          </button>
          <button class="btn btn--danger-soft btn--sm" @click="bulkCancel">
            <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            {{ t('Cancel') }}
          </button>
          <button class="btn btn--ghost btn--sm" @click="selected = new Set()">
            {{ t('Clear') }}
          </button>
        </div>
      </div>

      <!-- Table -->
      <table class="dtable">
        <thead>
          <tr>
            <th style="width: 36px;">
              <span
                class="checkbox"
                :class="{ 'is-checked': allSelected, 'is-indeterminate': someSelected }"
                @click="toggleSelectAll"
              >
                <svg v-if="allSelected" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <svg v-else-if="someSelected" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </th>
            <th style="width: 28px;" />
            <th class="sortable" @click="setSort('id')">
              # <span v-if="sortKey === 'id'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th>{{ t('Type') }}</th>
            <th>{{ t('Info') }}</th>
            <th class="sortable" @click="setSort('status')">
              {{ t('Status') }} <span v-if="sortKey === 'status'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th>{{ t('Payment') }}</th>
            <th class="num sortable" @click="setSort('total')">
              {{ t('Total') }} <span v-if="sortKey === 'total'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th class="num">
              {{ t('Items') }}
            </th>
            <th class="num sortable" @click="setSort('at')">
              {{ t('Date') }} <span v-if="sortKey === 'at'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
            <th class="num" style="width: 110px;">
              {{ t('Actions') }}
            </th>
          </tr>
        </thead>

        <tbody>
          <!-- Skeleton rows -->
          <template v-if="loading && orders.length === 0">
            <tr v-for="n in itemsPerPage" :key="`sk-${n}`">
              <td><div class="skel" style="width:18px;height:18px;border-radius:5px;" /></td>
              <td><div class="skel" style="width:16px;height:16px;border-radius:4px;" /></td>
              <td><div class="skel" style="width:50px;height:14px;border-radius:4px;" /></td>
              <td><div class="skel" style="width:70px;height:22px;border-radius:12px;" /></td>
              <td><div class="skel" style="width:120px;height:14px;border-radius:4px;" /></td>
              <td><div class="skel" style="width:80px;height:22px;border-radius:12px;" /></td>
              <td><div class="skel" style="width:60px;height:22px;border-radius:12px;" /></td>
              <td class="num"><div class="skel" style="width:80px;height:14px;border-radius:4px;margin-left:auto;" /></td>
              <td class="num"><div class="skel" style="width:30px;height:14px;border-radius:4px;margin-left:auto;" /></td>
              <td class="num"><div class="skel" style="width:110px;height:14px;border-radius:4px;margin-left:auto;" /></td>
              <td />
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-else-if="orders.length === 0">
            <td colspan="11">
              <div class="statefill">
                <div class="statefill__icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div class="statefill__title">
                  {{ t('No orders match your filters') }}
                </div>
                <div class="statefill__sub">
                  {{ t('Adjust the search, status or date range to see results.') }}
                </div>
                <div v-if="hasFilters" style="margin-top: 12px;">
                  <button class="btn btn--secondary" @click="clearAll">
                    {{ t('Clear filters') }}
                  </button>
                </div>
              </div>
            </td>
          </tr>

          <!-- Data rows -->
          <template v-for="o in sortedOrders" v-else :key="o.id">
            <tr
              :class="{ 'is-selected': selected.has(o.id) }"
              style="cursor: pointer;"
              @click="toggleRow(o.id)"
            >
              <td @click.stop>
                <span
                  class="checkbox"
                  :class="{ 'is-checked': selected.has(o.id) }"
                  @click="toggleSelect(o.id, $event)"
                >
                  <svg v-if="selected.has(o.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </td>
              <td>
                <svg
                  width="14" height="14" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  :style="{ transform: expanded.has(o.id) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .12s', color: 'var(--text-tertiary)' }"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </td>
              <td>
                <span class="cell-strong mono">#{{ o.display_id ?? o.id }}</span>
              </td>
              <td>
                <span class="badge" :class="`t-${tone(o.order_type)}`">{{ o.order_type }}</span>
              </td>
              <td>
                <span class="cell-muted">{{ infoOf(o) }}</span>
              </td>
              <td>
                <span class="badge badge--dot" :class="`t-${tone(o.status)}`">{{ o.status }}</span>
              </td>
              <td>
                <span class="badge" :class="o.is_paid ? 't-success' : 't-error'">
                  {{ o.is_paid ? t('PAID') : t('UNPAID') }}
                </span>
              </td>
              <td class="num">
                <span class="mono cell-strong">{{ formatCurrency(o.total_amount ?? 0) }}</span>
              </td>
              <td class="num">
                <span class="mono cell-muted">{{ itemsOf(o) }}</span>
              </td>
              <td class="num">
                <span class="mono cell-muted nowrap">{{ formatDate(o.created_at) }}</span>
              </td>
              <td class="num" @click.stop>
                <div class="row-actions">
                  <button
                    v-if="!o.is_paid && o.status !== 'CANCELED'"
                    class="iconaction is-success"
                    :title="t('Pay')"
                    @click="markPaid(o)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </button>
                  <button
                    v-if="o.status !== 'CANCELED' && o.status !== 'COMPLETED'"
                    class="iconaction is-danger"
                    :title="t('Cancel')"
                    @click="cancelOrder(o)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </button>
                  <button class="iconaction" :title="t('More')" @click.stop>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>

            <!-- Expanded row -->
            <tr v-if="expanded.has(o.id)" class="row-expand">
              <td colspan="11">
                <div class="expand-inner">
                  <div class="kpi__label" style="margin-bottom: 10px;">
                    {{ t('Order Items') }}
                  </div>
                  <table class="dtable" style="background: var(--surface); border-radius: 10px; border: 1px solid var(--border); overflow: hidden;">
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
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination">
        <div class="row" style="gap: 8px; align-items: center;">
          <span>{{ t('Rows per page') }}:</span>
          <div class="control control--select control--sm" style="width: 84px;">
            <select v-model.number="itemsPerPage">
              <option :value="10">
                10
              </option>
              <option :value="25">
                25
              </option>
              <option :value="50">
                50
              </option>
              <option :value="100">
                100
              </option>
            </select>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <div class="pagination__spacer" />
        <span class="mono">{{ rangeStart }}–{{ rangeEnd }} {{ t('of') }} {{ totalOrders }}</span>
        <div class="pglist">
          <button class="pgbtn" :disabled="page === 1" @click="page = Math.max(1, page - 1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            v-for="(p, i) in pageList"
            :key="`p-${i}`"
            class="pgbtn"
            :class="{ 'is-active': p === page }"
            :disabled="p === '…'"
            @click="typeof p === 'number' && (page = p)"
          >
            {{ p }}
          </button>
          <button class="pgbtn" :disabled="page === totalPages" @click="page = Math.min(totalPages, page + 1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

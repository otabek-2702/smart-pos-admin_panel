<script setup lang="ts">
/* ============================================================
   SUPPLIER DRILL — profile, items, ledger, payments
   Dynamic route /stock/suppliers/:id
   Uses design primitives (PageHeader, Kpi, Card, DataTable,
   Modal, Field, Input, Select, Switch, Button, Badge,
   StatusBadge, IconAction, DesignIcon, Segmented, StateFill).
   API: stockApi → /api/admins/stock/suppliers/{id}/*
   ============================================================ */
import type { DataTableColumn } from '@/components/design/DataTable.vue'
import { stockApi } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Segmented from '@/components/design/Segmented.vue'
import Select from '@/components/design/Select.vue'
import Switch from '@/components/design/Switch.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()
const route = useRoute()
const router = useRouter()

const supplierId = computed(() => String(route.params.id))

// ============================================================
// State
// ============================================================
const supplier = ref<any>(null)
const loading = ref(false)
const tab = ref<'overview' | 'items' | 'ledger'>('overview')

// items (local filter)
const itemPreferredOnly = ref(false)

// ledger
const ledgerLoading = ref(false)
const ledgerRows = ref<any[]>([])
const ledgerPage = ref(1)
const ledgerPerPage = ref(20)
const ledgerTotal = ref(0)
const ledgerTypeFilter = ref<string>('')
const ledgerSourceFilter = ref<string>('')

// modals
const editOpen = ref(false)
const editSaving = ref(false)
const payOpen = ref(false)
const paySaving = ref(false)
const addItemOpen = ref(false)
const addItemSaving = ref(false)
const deactivateOpen = ref(false)
const deactivating = ref(false)
const removeItemOpen = ref(false)
const removingItem = ref<any>(null)

// async select datasources for add-item modal
const stockItemOptions = ref<{ value: string; label: string }[]>([])
const unitOptions = ref<{ value: string; label: string }[]>([])
const stockItemQuery = ref('')

// ============================================================
// Forms
// ============================================================
const editForm = ref({
  code: '',
  name: '',
  legal_name: '',
  contact_person: '',
  email: '',
  phone: '',
  mobile: '',
  address: '',
  city: '',
  country: '',
  tax_id: '',
  payment_terms_days: 30,
  credit_limit: 0,
  currency: 'UZS',
  lead_time_days: 1,
  minimum_order_value: 0,
  rating: 3,
  notes: '',
})

const payForm = ref({
  amount: 0,
  source_account: 'SAFE',
  commission: 0,
  note: '',
})

const addItemForm = ref({
  stock_item_id: '',
  unit_id: '',
  supplier_sku: '',
  supplier_name: '',
  price: 0,
  currency: 'UZS',
  min_order_qty: 1,
  pack_size: 1,
  lead_time_days: 0,
  is_preferred: false,
  notes: '',
})

const CURRENCY_OPTS = [
  { value: 'UZS', label: 'UZS' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'RUB', label: 'RUB' },
]

// ============================================================
// Load
// ============================================================
async function loadSupplier() {
  loading.value = true
  try {
    const res = await stockApi.get(`/suppliers/${supplierId.value}/`, {
      params: { include_items: 'true', include_stats: 'true' },
    })
    const d = res.data?.data ?? res.data
    supplier.value = d?.supplier ?? d ?? null
    if (!supplier.value)
      notify(t('supplier_not_found'), 'error')
  }
  catch {
    notify(t('supplier_failed_load'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadItemsRefresh() {
  try {
    const res = await stockApi.get(`/suppliers/${supplierId.value}/items/`)
    const d = res.data?.data ?? res.data
    const items = d?.supplier?.items ?? d?.items ?? []
    if (supplier.value)
      supplier.value.items = items
  }
  catch {
    notify(t('supplier_failed_load_items'), 'error')
  }
}

async function loadLedger() {
  ledgerLoading.value = true
  try {
    const res = await stockApi.get(`/suppliers/${supplierId.value}/ledger/`, {
      params: { page: ledgerPage.value, per_page: ledgerPerPage.value },
    })
    const d = res.data?.data ?? res.data
    ledgerRows.value = d?.transactions ?? []
    ledgerTotal.value = d?.pagination?.total ?? 0
  }
  catch {
    notify(t('supplier_failed_load_ledger'), 'error')
  }
  finally {
    ledgerLoading.value = false
  }
}

onMounted(loadSupplier)
watch(tab, (v) => {
  if (v === 'ledger' && ledgerRows.value.length === 0)
    loadLedger()
})
watch([ledgerPage, ledgerPerPage], () => {
  if (tab.value === 'ledger')
    loadLedger()
})

// ============================================================
// KPI strip
// ============================================================
const kpiBalance = computed(() => ({
  label: t('supplier_kpi_balance'),
  value: supplier.value ? Number(supplier.value.current_balance ?? 0) : null,
  icon: 'wallet',
  tone: 'warning' as const,
  money: true,
  sub: supplier.value?.currency ?? t('currency_default'),
}))
const kpiCreditLimit = computed(() => ({
  label: t('supplier_kpi_credit_limit'),
  value: supplier.value ? Number(supplier.value.credit_limit ?? 0) : null,
  icon: 'shield',
  tone: 'info' as const,
  money: true,
  sub: supplier.value?.currency ?? t('currency_default'),
}))
const kpiTotalOrders = computed(() => ({
  label: t('supplier_kpi_total_orders'),
  value: supplier.value ? Number(supplier.value.stats?.total_orders ?? 0) : null,
  icon: 'box',
  tone: 'primary' as const,
}))
const kpiTotalValue = computed(() => ({
  label: t('supplier_kpi_total_value'),
  value: supplier.value ? Number(supplier.value.stats?.total_value ?? 0) : null,
  icon: 'cart',
  tone: 'success' as const,
  money: true,
}))
const kpiAvgOrder = computed(() => ({
  label: t('supplier_kpi_avg_order'),
  value: supplier.value ? Number(supplier.value.stats?.avg_order_value ?? 0) : null,
  icon: 'trend',
  tone: 'info' as const,
  money: true,
}))
const kpiItemsCount = computed(() => ({
  label: t('supplier_kpi_items_count'),
  value: supplier.value ? Number(supplier.value.item_count ?? supplier.value.items?.length ?? 0) : null,
  icon: 'list',
  tone: 'neutral' as const,
}))
const kpiLeadTime = computed(() => ({
  label: t('supplier_kpi_lead_time'),
  value: supplier.value
    ? `${supplier.value.lead_time_days ?? 0} ${t('days_short')}`
    : null,
  icon: 'truck',
  tone: 'neutral' as const,
}))
const kpiPaymentTerms = computed(() => ({
  label: t('supplier_kpi_payment_terms'),
  value: supplier.value
    ? `${supplier.value.payment_terms_days ?? 0} ${t('days_short')}`
    : null,
  icon: 'clock',
  tone: 'neutral' as const,
}))

// ============================================================
// Items table
// ============================================================
const itemColumns: DataTableColumn<any>[] = [
  { key: 'stock_item_name', label: t('items_col_stock_item') },
  { key: 'supplier_sku', label: t('items_col_supplier_sku') },
  { key: 'supplier_name', label: t('items_col_supplier_name') },
  { key: 'unit_short', label: t('items_col_unit') },
  { key: 'price', label: t('items_col_price'), align: 'right' },
  { key: 'min_order_qty', label: t('items_col_min_order_qty'), align: 'right' },
  { key: 'pack_size', label: t('items_col_pack_size'), align: 'right' },
  { key: 'lead_time_days', label: t('items_col_lead_time_days'), align: 'right' },
  { key: 'is_preferred', label: t('items_col_is_preferred') },
  { key: 'last_price_update', label: t('items_col_last_price_update') },
]

const filteredItems = computed<any[]>(() => {
  const items = supplier.value?.items ?? []
  if (itemPreferredOnly.value)
    return items.filter((it: any) => !!it.is_preferred)
  return items
})

// ============================================================
// Ledger table
// ============================================================
const ledgerColumns: DataTableColumn<any>[] = [
  { key: 'created_at', label: t('ledger_col_created_at') },
  { key: 'type', label: t('ledger_col_type') },
  { key: 'amount', label: t('ledger_col_amount'), align: 'right' },
  { key: 'balance_after', label: t('ledger_col_balance_after'), align: 'right' },
  { key: 'source_account', label: t('ledger_col_source_account') },
  { key: 'fee', label: t('ledger_col_fee'), align: 'right' },
  { key: 'reference', label: t('ledger_col_reference') },
  { key: 'note', label: t('ledger_col_note') },
]

const TXN_TONE: Record<string, 'warning' | 'success' | 'info' | 'neutral'> = {
  PURCHASE: 'warning',
  PAYMENT: 'success',
  RETURN: 'info',
  ADJUSTMENT: 'neutral',
}
const SRC_TONE: Record<string, 'info' | 'primary' | 'neutral'> = {
  SAFE: 'info',
  BANK: 'primary',
  DRAWER: 'neutral',
}
const SIGN_FROM_TYPE: Record<string, '+' | '-'> = {
  PURCHASE: '+',
  ADJUSTMENT: '+',
  PAYMENT: '-',
  RETURN: '-',
}

const filteredLedger = computed<any[]>(() => {
  return ledgerRows.value.filter((r) => {
    if (ledgerTypeFilter.value && r.type !== ledgerTypeFilter.value)
      return false
    if (ledgerSourceFilter.value && r.source_account !== ledgerSourceFilter.value)
      return false
    return true
  })
})

const txnTypeOptions = computed(() => [
  { value: 'PURCHASE', label: t('supplier_txn_type_PURCHASE') },
  { value: 'PAYMENT', label: t('supplier_txn_type_PAYMENT') },
  { value: 'RETURN', label: t('supplier_txn_type_RETURN') },
  { value: 'ADJUSTMENT', label: t('supplier_txn_type_ADJUSTMENT') },
])
const sourceOptions = computed(() => [
  { value: 'SAFE', label: t('supplier_source_SAFE') },
  { value: 'BANK', label: t('supplier_source_BANK') },
  { value: 'DRAWER', label: t('supplier_source_DRAWER') },
])
const payAccountOptions = computed(() => [
  { value: 'SAFE', label: t('supplier_source_SAFE') },
  { value: 'BANK', label: t('supplier_source_BANK') },
])

const ledgerPagination = computed(() => ({
  page: ledgerPage.value,
  perPage: ledgerPerPage.value,
  total: ledgerTotal.value,
  onPage: (n: number) => { ledgerPage.value = n },
  onPerPage: (n: number) => { ledgerPerPage.value = n; ledgerPage.value = 1 },
}))

// ============================================================
// Edit modal
// ============================================================
function openEdit() {
  if (!supplier.value)
    return
  const s = supplier.value
  editForm.value = {
    code: s.code ?? '',
    name: s.name ?? '',
    legal_name: s.legal_name ?? '',
    contact_person: s.contact_person ?? '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    mobile: s.mobile ?? '',
    address: s.address ?? '',
    city: s.city ?? '',
    country: s.country ?? '',
    tax_id: s.tax_id ?? '',
    payment_terms_days: s.payment_terms_days ?? 30,
    credit_limit: Number(s.credit_limit ?? 0),
    currency: s.currency ?? 'UZS',
    lead_time_days: s.lead_time_days ?? 1,
    minimum_order_value: Number(s.minimum_order_value ?? 0),
    rating: s.rating ?? 3,
    notes: s.notes ?? '',
  }
  editOpen.value = true
}

async function submitEdit() {
  if (!editForm.value.name?.trim()) {
    notify(t('supplier_field_name'), 'error')
    return
  }
  editSaving.value = true
  try {
    await stockApi.put(`/suppliers/${supplierId.value}/`, editForm.value)
    notify(t('update_success'))
    editOpen.value = false
    await loadSupplier()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('update_failed'), 'error')
  }
  finally {
    editSaving.value = false
  }
}

// ============================================================
// Pay modal
// ============================================================
function openPay() {
  payForm.value = { amount: 0, source_account: 'SAFE', commission: 0, note: '' }
  payOpen.value = true
}

async function submitPay() {
  if (!payForm.value.amount || Number(payForm.value.amount) <= 0) {
    notify(t('pay_amount_required'), 'error')
    return
  }
  paySaving.value = true
  try {
    const body: any = {
      amount: Number(payForm.value.amount),
      source_account: payForm.value.source_account,
      note: payForm.value.note,
    }
    if (payForm.value.source_account === 'BANK')
      body.commission = Number(payForm.value.commission) || 0
    await stockApi.post(`/suppliers/${supplierId.value}/pay/`, body)
    notify(t('pay_success'))
    payOpen.value = false
    await Promise.all([loadSupplier(), loadLedger()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('pay_failed'), 'error')
  }
  finally {
    paySaving.value = false
  }
}

// ============================================================
// Add item modal
// ============================================================
async function loadStockItems(q = '') {
  try {
    const res = await stockApi.get('/items/search/', { params: { q } })
    const d = res.data?.data ?? res.data
    const list = d?.items ?? d?.results ?? d ?? []
    stockItemOptions.value = list.map((it: any) => ({
      value: String(it.id),
      label: it.name ?? `#${it.id}`,
    }))
  }
  catch {
    stockItemOptions.value = []
  }
}

async function loadUnits() {
  try {
    const res = await stockApi.get('/units/')
    const d = res.data?.data ?? res.data
    const list = d?.units ?? d?.results ?? d ?? []
    unitOptions.value = list.map((u: any) => ({
      value: String(u.id),
      label: u.name ?? u.short_name ?? `#${u.id}`,
    }))
  }
  catch {
    unitOptions.value = []
  }
}

const debouncedItemSearch = useDebounceFn((q: string) => loadStockItems(q), 300)
watch(stockItemQuery, q => debouncedItemSearch(q))

function openAddItem() {
  addItemForm.value = {
    stock_item_id: '',
    unit_id: '',
    supplier_sku: '',
    supplier_name: '',
    price: 0,
    currency: 'UZS',
    min_order_qty: 1,
    pack_size: 1,
    lead_time_days: 0,
    is_preferred: false,
    notes: '',
  }
  stockItemQuery.value = ''
  loadStockItems()
  loadUnits()
  addItemOpen.value = true
}

async function submitAddItem() {
  if (!addItemForm.value.stock_item_id || !addItemForm.value.unit_id || !(Number(addItemForm.value.price) > 0)) {
    notify(t('add_item_failed'), 'error')
    return
  }
  addItemSaving.value = true
  try {
    const body = {
      stock_item_id: Number(addItemForm.value.stock_item_id),
      unit_id: Number(addItemForm.value.unit_id),
      price: Number(addItemForm.value.price),
      currency: addItemForm.value.currency,
      supplier_sku: addItemForm.value.supplier_sku,
      supplier_name: addItemForm.value.supplier_name,
      min_order_qty: Number(addItemForm.value.min_order_qty) || 0,
      pack_size: Number(addItemForm.value.pack_size) || 0,
      lead_time_days: Number(addItemForm.value.lead_time_days) || 0,
      is_preferred: !!addItemForm.value.is_preferred,
      notes: addItemForm.value.notes,
    }
    await stockApi.post(`/suppliers/${supplierId.value}/items/`, body)
    notify(t('add_item_success'))
    addItemOpen.value = false
    await loadItemsRefresh()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('add_item_failed'), 'error')
  }
  finally {
    addItemSaving.value = false
  }
}

// ============================================================
// Deactivate
// ============================================================
function openDeactivate() {
  deactivateOpen.value = true
}

async function submitDeactivate() {
  deactivating.value = true
  try {
    await stockApi.delete(`/suppliers/${supplierId.value}/`)
    notify(t('deactivate_success'))
    deactivateOpen.value = false
    router.push('/stock/suppliers')
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('deactivate_failed'), 'error')
  }
  finally {
    deactivating.value = false
  }
}

// ============================================================
// Remove item (UI only — endpoint not yet exposed; confirm + toast)
// ============================================================
function askRemoveItem(item: any) {
  removingItem.value = item
  removeItemOpen.value = true
}

async function submitRemoveItem() {
  // Endpoint not exposed yet on backend; surface a failure for honesty
  // until BE wires DELETE /supplier-items/{id}/.
  notify(t('remove_item_failed'), 'error')
  removeItemOpen.value = false
  removingItem.value = null
}

// ============================================================
// Helpers
// ============================================================
const statusBadgeTone = computed(() => (supplier.value?.is_active ? 'success' : 'neutral'))
const statusBadgeText = computed(() =>
  supplier.value?.is_active ? t('supplier_status_active') : t('supplier_status_inactive'),
)

const RATING_STAR_FULL = '★'
const RATING_STAR_EMPTY = '☆'

function ratingStars(n: number | null | undefined): string {
  const r = Math.max(0, Math.min(5, Number(n) || 0))
  return RATING_STAR_FULL.repeat(r) + RATING_STAR_EMPTY.repeat(5 - r)
}

function signedAmount(row: any): string {
  const sign = SIGN_FROM_TYPE[row.type] ?? ''
  const amt = formatCurrency(Math.abs(Number(row.amount ?? 0)))
  return `${sign}${amt}`
}

const tabOptions = computed(() => [
  { value: 'overview', label: t('tab_overview'), icon: 'info' },
  { value: 'items', label: t('tab_items'), icon: 'box' },
  { value: 'ledger', label: t('tab_ledger'), icon: 'receipt' },
])

function backToList() {
  router.push('/stock/suppliers')
}
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="supplier?.name || t('supplier_drill_title')"
      :subtitle="t('supplier_drill_subtitle')"
    >
      <template #actions>
        <Button
          variant="ghost"
          icon="chevleft"
          @click="backToList"
        >
          {{ t('supplier_back_to_list') }}
        </Button>
        <Button
          variant="ghost"
          icon="refresh"
          :disabled="loading"
          @click="loadSupplier"
        >
          {{ t('supplier_action_refresh') }}
        </Button>
        <Button
          variant="secondary"
          icon="edit"
          :disabled="!supplier"
          @click="openEdit"
        >
          {{ t('supplier_action_edit') }}
        </Button>
        <Button
          variant="primary"
          icon="wallet"
          :disabled="!supplier"
          @click="openPay"
        >
          {{ t('supplier_action_pay') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          :disabled="!supplier || !supplier.is_active"
          @click="openDeactivate"
        >
          {{ t('supplier_action_deactivate') }}
        </Button>
      </template>
    </PageHeader>

    <!-- Identity strip (name / status / code / rating) -->
    <Card
      v-if="supplier"
      class-name="card--padded"
      style="margin-bottom: var(--sp-5); padding: 16px;"
    >
      <div
        class="row"
        style="gap:16px; align-items:center; flex-wrap:wrap;"
      >
        <div class="avatar avatar--md" style="flex: 0 0 auto;">
          {{ (supplier.name?.[0] || '?').toUpperCase() }}
        </div>
        <div style="min-width:0; flex:1;">
          <div
            class="row"
            style="gap:10px; align-items:center; flex-wrap:wrap;"
          >
            <h2 style="margin:0; font-size:18px; font-weight:600;">
              {{ supplier.name }}
            </h2>
            <Badge :tone="statusBadgeTone" dot>
              {{ statusBadgeText }}
            </Badge>
            <span
              v-if="supplier.code"
              class="mono cell-muted"
            >{{ supplier.code }}</span>
          </div>
          <div
            class="cell-muted"
            style="margin-top:4px;font-size:13px;"
          >
            <span v-if="supplier.contact_person">{{ supplier.contact_person }}</span>
            <span v-if="supplier.contact_person && supplier.phone"> · </span>
            <span v-if="supplier.phone">{{ supplier.phone }}</span>
            <span v-if="supplier.email"> · {{ supplier.email }}</span>
          </div>
        </div>
        <div
          class="cell-muted identity-meta"
        >
          <div>
            <span style="color: var(--color-warning, #d97706);">{{ ratingStars(supplier.rating) }}</span>
            <span style="margin-left:6px;">{{ t('rating_out_of_5', { n: supplier.rating ?? '—' }) }}</span>
          </div>
          <div style="margin-top:2px;">
            {{ t('supplier_field_created_at') }}: {{ supplier.created_at ? formatDate(supplier.created_at) : '—' }}
          </div>
        </div>
      </div>
    </Card>

    <!-- KPI strip -->
    <div
      class="grid cols-4 kpi-strip"
      style="margin-bottom: var(--sp-5);"
    >
      <Kpi :data="kpiBalance" />
      <Kpi :data="kpiCreditLimit" />
      <Kpi :data="kpiTotalOrders" />
      <Kpi :data="kpiTotalValue" />
    </div>
    <div
      class="grid cols-4 kpi-strip"
      style="margin-bottom: var(--sp-5);"
    >
      <Kpi :data="kpiAvgOrder" />
      <Kpi :data="kpiItemsCount" />
      <Kpi :data="kpiLeadTime" />
      <Kpi :data="kpiPaymentTerms" />
    </div>

    <!-- Tabs -->
    <div style="margin-bottom: var(--sp-4);">
      <Segmented
        :model-value="tab"
        :options="tabOptions"
        @update:model-value="(v) => tab = v as 'overview' | 'items' | 'ledger'"
      />
    </div>

    <!-- Overview tab -->
    <div
      v-if="tab === 'overview'"
      class="grid cols-2 overview-grid"
      style="gap: var(--sp-5);"
    >
      <Card class-name="card--padded">
        <div style="padding:16px;">
          <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">
            {{ t('supplier_section_contact') }}
          </h3>
          <div class="kv-grid">
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_contact_person') }}
              </div>
              <div class="kv__v">
                {{ supplier?.contact_person || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_email') }}
              </div>
              <div class="kv__v">
                {{ supplier?.email || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_phone') }}
              </div>
              <div class="kv__v">
                {{ supplier?.phone || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_mobile') }}
              </div>
              <div class="kv__v">
                {{ supplier?.mobile || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_address') }}
              </div>
              <div class="kv__v">
                {{ supplier?.address || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_city') }}
              </div>
              <div class="kv__v">
                {{ supplier?.city || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_country') }}
              </div>
              <div class="kv__v">
                {{ supplier?.country || '—' }}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card class-name="card--padded">
        <div style="padding:16px;">
          <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">
            {{ t('supplier_section_legal') }}
          </h3>
          <div class="kv-grid">
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_code') }}
              </div>
              <div class="kv__v mono">
                {{ supplier?.code || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_legal_name') }}
              </div>
              <div class="kv__v">
                {{ supplier?.legal_name || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_tax_id') }}
              </div>
              <div class="kv__v mono">
                {{ supplier?.tax_id || '—' }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_currency') }}
              </div>
              <div class="kv__v">
                {{ supplier?.currency || t('currency_default') }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_payment_terms_days') }}
              </div>
              <div class="kv__v">
                {{ supplier?.payment_terms_days ?? 0 }} {{ t('days_short') }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_lead_time_days') }}
              </div>
              <div class="kv__v">
                {{ supplier?.lead_time_days ?? 0 }} {{ t('days_short') }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_credit_limit') }}
              </div>
              <div class="kv__v num-tabular">
                {{ formatCurrency(supplier?.credit_limit ?? 0) }}
              </div>
            </div>
            <div class="kv">
              <div class="kv__k">
                {{ t('supplier_field_minimum_order_value') }}
              </div>
              <div class="kv__v num-tabular">
                {{ formatCurrency(supplier?.minimum_order_value ?? 0) }}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card
        class-name="card--padded"
        style="grid-column: 1 / -1;"
      >
        <div style="padding:16px;">
          <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;">
            {{ t('supplier_section_notes') }}
          </h3>
          <p
            class="cell-muted"
            style="margin:0;white-space:pre-wrap;font-size:14px;line-height:1.5;"
          >
            {{ supplier?.notes || t('supplier_no_notes') }}
          </p>
        </div>
      </Card>
    </div>

    <!-- Items tab -->
    <Card v-else-if="tab === 'items'">
      <div class="toolbar toolbar-responsive" style="flex-wrap: wrap; gap: 8px;">
        <div
          class="row"
          style="gap:10px; align-items:center; flex-wrap: wrap;"
        >
          <Switch
            v-model="itemPreferredOnly"
          />
          <span style="font-size:14px;font-weight:500;color:var(--text-secondary);">
            {{ t('items_col_is_preferred') }}
          </span>
        </div>
        <div class="toolbar-spacer" />
        <Button
          variant="primary"
          icon="plus"
          @click="openAddItem"
        >
          {{ t('supplier_action_add_item') }}
        </Button>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="itemColumns"
        :rows="filteredItems"
        row-key="id"
        :loading="loading"
        :empty-title="t('items_empty')"
      >
        <template #cell.stock_item_name="{ row }">
          <span class="cell-strong">{{ row.stock_item_name || '—' }}</span>
        </template>
        <template #cell.supplier_sku="{ row }">
          <span class="mono cell-muted">{{ row.supplier_sku || '—' }}</span>
        </template>
        <template #cell.supplier_name="{ row }">
          {{ row.supplier_name || '—' }}
        </template>
        <template #cell.unit_short="{ row }">
          {{ row.unit_short || row.unit_name || '—' }}
        </template>
        <template #cell.price="{ row }">
          <span class="num-tabular">{{ formatCurrency(row.price ?? 0) }}</span>
          <span
            class="cell-muted"
            style="margin-left:4px;font-size:12px;"
          >{{ row.currency || t('currency_default') }}</span>
        </template>
        <template #cell.min_order_qty="{ row }">
          <span class="num-tabular">{{ row.min_order_qty ?? '—' }}</span>
        </template>
        <template #cell.pack_size="{ row }">
          <span class="num-tabular">{{ row.pack_size ?? '—' }}</span>
        </template>
        <template #cell.lead_time_days="{ row }">
          <span class="num-tabular">{{ row.lead_time_days ?? 0 }}</span>
          <span
            class="cell-muted"
            style="margin-left:4px;font-size:12px;"
          >{{ t('days_short') }}</span>
        </template>
        <template #cell.is_preferred="{ row }">
          <Badge :tone="row.is_preferred ? 'success' : 'neutral'" dot>
            {{ row.is_preferred ? t('yes') : t('no') }}
          </Badge>
        </template>
        <template #cell.last_price_update="{ row }">
          <span class="cell-muted">{{ row.last_price_update ? formatDate(row.last_price_update) : '—' }}</span>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            icon="trash"
            tone="danger"
            :title="t('supplier_action_remove_item')"
            @click="askRemoveItem(row)"
          />
        </template>

        <template #empty>
          <div class="statefill">
            <div class="statefill__icon">
              <DesignIcon
                name="box"
                :size="24"
              />
            </div>
            <div class="statefill__title">
              {{ t('items_empty') }}
            </div>
            <div style="margin-top:12px;">
              <Button
                variant="secondary"
                icon="plus"
                @click="openAddItem"
              >
                {{ t('supplier_action_add_item') }}
              </Button>
            </div>
          </div>
        </template>
      </DataTable>
    </Card>

    <!-- Ledger tab -->
    <Card v-else-if="tab === 'ledger'">
      <div class="toolbar toolbar-responsive" style="flex-wrap: wrap; gap: 8px;">
        <div class="ledger-filter">
          <Select
            v-model="ledgerTypeFilter"
            :placeholder="t('all')"
            :options="txnTypeOptions"
          />
        </div>
        <div class="ledger-filter">
          <Select
            v-model="ledgerSourceFilter"
            :placeholder="t('all')"
            :options="sourceOptions"
          />
        </div>
        <div class="toolbar-spacer" />
        <Button
          variant="ghost"
          icon="refresh"
          :disabled="ledgerLoading"
          @click="loadLedger"
        >
          {{ t('supplier_action_refresh') }}
        </Button>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="ledgerColumns"
        :rows="filteredLedger"
        row-key="id"
        :loading="ledgerLoading"
        :pagination="ledgerPagination"
        :empty-title="t('ledger_empty')"
      >
        <template #cell.created_at="{ row }">
          <span class="cell-muted">{{ row.created_at ? formatDate(row.created_at) : '—' }}</span>
        </template>
        <template #cell.type="{ row }">
          <Badge :tone="TXN_TONE[row.type] ?? 'neutral'">
            {{ row.type ? t(`supplier_txn_type_${row.type}`) : '—' }}
          </Badge>
        </template>
        <template #cell.amount="{ row }">
          <span
            class="num-tabular"
            :style="{
              color: SIGN_FROM_TYPE[row.type] === '-' ? 'rgb(var(--v-theme-success-strong))' : 'rgb(var(--v-theme-warning-strong))',
              fontWeight: 500,
            }"
          >
            {{ signedAmount(row) }}
          </span>
        </template>
        <template #cell.balance_after="{ row }">
          <span class="num-tabular">{{ formatCurrency(row.balance_after ?? 0) }}</span>
        </template>
        <template #cell.source_account="{ row }">
          <Badge
            v-if="row.source_account"
            :tone="SRC_TONE[row.source_account] ?? 'neutral'"
          >
            {{ t(`supplier_source_${row.source_account}`) }}
          </Badge>
          <span v-else class="cell-muted">—</span>
        </template>
        <template #cell.fee="{ row }">
          <span
            v-if="Number(row.fee) > 0"
            class="num-tabular"
          >{{ formatCurrency(row.fee) }}</span>
          <span v-else class="cell-muted">—</span>
        </template>
        <template #cell.reference="{ row }">
          <span
            v-if="row.reference_type"
            class="cell-muted"
            style="font-size:12px;"
          >
            {{ t(`supplier_ref_type_${row.reference_type}`, row.reference_type) }} #{{ row.reference_id }}
          </span>
          <span v-else class="cell-muted">—</span>
        </template>
        <template #cell.note="{ row }">
          <span
            class="cell-muted ledger-note"
            :title="row.note || row.description || ''"
          >
            {{ row.note || row.description || '—' }}
          </span>
        </template>

        <template #empty>
          <div class="statefill">
            <div class="statefill__icon">
              <DesignIcon
                name="receipt"
                :size="24"
              />
            </div>
            <div class="statefill__title">
              {{ t('ledger_empty') }}
            </div>
          </div>
        </template>
      </DataTable>
    </Card>

    <!-- ===================== Edit modal ===================== -->
    <Modal
      :open="editOpen"
      :title="t('supplier_action_edit')"
      :subtitle="supplier?.name"
      :width="720"
      @close="editOpen = false"
    >
      <form @submit.prevent="submitEdit">
        <div class="form-grid">
          <Field :label="t('supplier_field_code')">
            <Input v-model="editForm.code" />
          </Field>
          <Field :label="t('supplier_field_name')">
            <Input v-model="editForm.name" />
          </Field>
          <Field
            :label="t('supplier_field_legal_name')"
            class="span-2"
          >
            <Input v-model="editForm.legal_name" />
          </Field>
          <Field :label="t('supplier_field_contact_person')">
            <Input v-model="editForm.contact_person" />
          </Field>
          <Field :label="t('supplier_field_email')">
            <Input
              v-model="editForm.email"
              icon="mail"
              type="email"
            />
          </Field>
          <Field :label="t('supplier_field_phone')">
            <Input
              v-model="editForm.phone"
              type="tel"
            />
          </Field>
          <Field :label="t('supplier_field_mobile')">
            <Input
              v-model="editForm.mobile"
              type="tel"
            />
          </Field>
          <Field
            :label="t('supplier_field_address')"
            class="span-2"
          >
            <Input v-model="editForm.address" />
          </Field>
          <Field :label="t('supplier_field_city')">
            <Input v-model="editForm.city" />
          </Field>
          <Field :label="t('supplier_field_country')">
            <Input v-model="editForm.country" />
          </Field>
          <Field :label="t('supplier_field_tax_id')">
            <Input v-model="editForm.tax_id" />
          </Field>
          <Field :label="t('supplier_field_currency')">
            <Select
              v-model="editForm.currency"
              :options="CURRENCY_OPTS"
            />
          </Field>
          <Field :label="t('supplier_field_payment_terms_days')">
            <Input
              v-model="editForm.payment_terms_days"
              type="number"
              min="0"
            />
          </Field>
          <Field :label="t('supplier_field_lead_time_days')">
            <Input
              v-model="editForm.lead_time_days"
              type="number"
              min="0"
            />
          </Field>
          <Field :label="t('supplier_field_credit_limit')">
            <Input
              v-model="editForm.credit_limit"
              type="number"
              step="0.01"
              min="0"
            />
          </Field>
          <Field :label="t('supplier_field_minimum_order_value')">
            <Input
              v-model="editForm.minimum_order_value"
              type="number"
              step="0.01"
              min="0"
            />
          </Field>
          <Field :label="t('supplier_field_rating')">
            <Input
              v-model="editForm.rating"
              type="number"
              min="1"
              max="5"
            />
          </Field>
          <Field
            :label="t('supplier_field_notes')"
            class="span-2"
          >
            <Input v-model="editForm.notes" />
          </Field>
        </div>
      </form>
      <template #footer>
        <Button
          variant="ghost"
          :disabled="editSaving"
          @click="editOpen = false"
        >
          {{ t('supplier_action_cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="editSaving"
          :disabled="editSaving"
          @click="submitEdit"
        >
          {{ t('supplier_action_save') }}
        </Button>
      </template>
    </Modal>

    <!-- ===================== Pay modal ===================== -->
    <Modal
      :open="payOpen"
      :title="t('pay_title')"
      :subtitle="t('pay_subtitle')"
      :width="520"
      @close="payOpen = false"
    >
      <div
        v-if="supplier"
        style="margin-bottom: 10px;"
        class="cell-muted"
      >
        {{ supplier.name }}
        <span v-if="Number(supplier.current_balance) > 0">
          · <strong class="num-tabular" style="color: rgb(var(--v-theme-warning-strong));">
            {{ formatCurrency(supplier.current_balance) }}
          </strong>
        </span>
      </div>
      <form @submit.prevent="submitPay">
        <div class="form-grid">
          <Field :label="t('pay_field_amount')">
            <Input
              v-model="payForm.amount"
              type="number"
              step="0.01"
              min="0.01"
              icon="wallet"
            />
          </Field>
          <Field
            :label="t('pay_field_source_account')"
            :hint="t('pay_drawer_blocked')"
          >
            <Select
              v-model="payForm.source_account"
              :options="payAccountOptions"
            />
          </Field>
          <Field
            v-if="payForm.source_account === 'BANK'"
            :label="t('pay_field_commission')"
            class="span-2"
          >
            <Input
              v-model="payForm.commission"
              type="number"
              step="0.01"
              min="0"
            />
          </Field>
          <Field
            :label="t('pay_field_note')"
            class="span-2"
          >
            <Input v-model="payForm.note" />
          </Field>
        </div>
      </form>
      <template #footer>
        <Button
          variant="ghost"
          :disabled="paySaving"
          @click="payOpen = false"
        >
          {{ t('supplier_action_cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="paySaving"
          :disabled="paySaving"
          @click="submitPay"
        >
          {{ t('supplier_action_save') }}
        </Button>
      </template>
    </Modal>

    <!-- ===================== Add item modal ===================== -->
    <Modal
      :open="addItemOpen"
      :title="t('add_item_title')"
      :width="640"
      @close="addItemOpen = false"
    >
      <form @submit.prevent="submitAddItem">
        <div class="form-grid">
          <Field
            :label="t('add_item_field_stock_item')"
            class="span-2"
          >
            <Input
              v-model="stockItemQuery"
              icon="search"
              :placeholder="t('items_col_stock_item')"
            />
            <Select
              v-model="addItemForm.stock_item_id"
              :options="stockItemOptions"
              :placeholder="t('items_col_stock_item')"
              style="margin-top:8px;"
            />
          </Field>
          <Field :label="t('add_item_field_unit')">
            <Select
              v-model="addItemForm.unit_id"
              :options="unitOptions"
              :placeholder="t('items_col_unit')"
            />
          </Field>
          <Field :label="t('add_item_field_price')">
            <Input
              v-model="addItemForm.price"
              type="number"
              step="0.0001"
              min="0"
            />
          </Field>
          <Field :label="t('supplier_field_currency')">
            <Select
              v-model="addItemForm.currency"
              :options="CURRENCY_OPTS"
            />
          </Field>
          <Field :label="t('add_item_field_supplier_sku')">
            <Input v-model="addItemForm.supplier_sku" />
          </Field>
          <Field
            :label="t('add_item_field_supplier_name')"
            class="span-2"
          >
            <Input v-model="addItemForm.supplier_name" />
          </Field>
          <Field :label="t('add_item_field_min_order_qty')">
            <Input
              v-model="addItemForm.min_order_qty"
              type="number"
              step="0.0001"
              min="0"
            />
          </Field>
          <Field :label="t('add_item_field_pack_size')">
            <Input
              v-model="addItemForm.pack_size"
              type="number"
              step="0.0001"
              min="0"
            />
          </Field>
          <Field :label="t('add_item_field_lead_time_days')">
            <Input
              v-model="addItemForm.lead_time_days"
              type="number"
              min="0"
            />
          </Field>
          <Field :label="t('add_item_field_is_preferred')">
            <div
              class="row"
              style="gap:10px; align-items:center; height:42px;"
            >
              <Switch v-model="addItemForm.is_preferred" />
              <span style="font-size:14px;color:var(--text-secondary);">
                {{ addItemForm.is_preferred ? t('yes') : t('no') }}
              </span>
            </div>
          </Field>
          <Field
            :label="t('add_item_field_notes')"
            class="span-2"
          >
            <Input v-model="addItemForm.notes" />
          </Field>
        </div>
      </form>
      <template #footer>
        <Button
          variant="ghost"
          :disabled="addItemSaving"
          @click="addItemOpen = false"
        >
          {{ t('supplier_action_cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="plus"
          :loading="addItemSaving"
          :disabled="addItemSaving"
          @click="submitAddItem"
        >
          {{ t('supplier_action_save') }}
        </Button>
      </template>
    </Modal>

    <!-- ===================== Deactivate confirm ===================== -->
    <Modal
      :open="deactivateOpen"
      :title="t('deactivate_confirm_title')"
      :subtitle="supplier?.name"
      :width="440"
      @close="deactivateOpen = false"
    >
      <div
        class="row"
        style="gap:14px; align-items:flex-start;"
      >
        <div
          class="kpi__icon t-error"
          style="width:44px;height:44px;flex:0 0 44px;"
        >
          <DesignIcon
            name="alert"
            :size="22"
          />
        </div>
        <div>
          <p style="margin:0;font-size:14px;line-height:1.5;">
            {{ t('deactivate_confirm_body') }}
          </p>
        </div>
      </div>
      <template #footer>
        <Button
          variant="ghost"
          :disabled="deactivating"
          @click="deactivateOpen = false"
        >
          {{ t('supplier_action_cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          :loading="deactivating"
          :disabled="deactivating"
          @click="submitDeactivate"
        >
          {{ t('supplier_action_deactivate') }}
        </Button>
      </template>
    </Modal>

    <!-- ===================== Remove item confirm ===================== -->
    <Modal
      :open="removeItemOpen"
      :title="t('remove_item_confirm_title')"
      :subtitle="removingItem?.stock_item_name || removingItem?.supplier_name"
      :width="440"
      @close="removeItemOpen = false"
    >
      <div
        class="row"
        style="gap:14px; align-items:flex-start;"
      >
        <div
          class="kpi__icon t-warning"
          style="width:44px;height:44px;flex:0 0 44px;"
        >
          <DesignIcon
            name="alert"
            :size="22"
          />
        </div>
        <div>
          <p style="margin:0;font-size:14px;line-height:1.5;">
            {{ t('supplier_action_remove_item') }}
          </p>
        </div>
      </div>
      <template #footer>
        <Button
          variant="ghost"
          @click="removeItemOpen = false"
        >
          {{ t('supplier_action_cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          @click="submitRemoveItem"
        >
          {{ t('supplier_action_remove_item') }}
        </Button>
      </template>
    </Modal>

    <!-- Toast -->
    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<style scoped>
.kv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 24px;
}
.ledger-filter {
  flex: 1 1 200px;
  min-width: 160px;
  max-width: 240px;
}
.identity-meta {
  text-align: right;
  font-size: 13px;
  min-width: 0;
}
.ledger-note {
  display: inline-block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.toolbar-spacer {
  flex: 1;
}
@media (max-width: 1024px) {
  .kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .overview-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .kv-grid {
    grid-template-columns: 1fr;
  }
  .ledger-filter {
    flex: 1 1 100%;
    max-width: none;
    min-width: 0;
  }
  .identity-meta {
    text-align: left;
    flex: 1 1 100%;
  }
  .ledger-note {
    max-width: 180px;
  }
  .toolbar-responsive .toolbar-spacer {
    display: none;
  }
  .toolbar-responsive > .row,
  .toolbar-responsive > :deep(button) {
    flex: 1 1 100%;
  }
}
@media (max-width: 480px) {
  .kpi-strip {
    grid-template-columns: 1fr;
  }
  .ledger-note {
    max-width: 140px;
  }
}
.kv {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.kv__k {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary, var(--text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.kv__v {
  font-size: 14px;
  color: var(--text);
  word-break: break-word;
}
.avatar.avatar--md {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgb(var(--v-theme-primary-weak));
  color: rgb(var(--v-theme-primary));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 18px;
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

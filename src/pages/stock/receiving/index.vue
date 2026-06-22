<script setup lang="ts">
/* ============================================================
   ALPHA POS — Goods Receiving page
   Design-system primitives (no Vuetify on the page).
   Two-step flow:
     1) List of receivings (filter / search / status / PO / dates).
     2) Drill into a draft receiving → add per-line items → Complete.
   ============================================================ */
import { stockApi } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import StateFill from '@/components/design/StateFill.vue'

const { t } = useI18n({ useScope: 'global' })
const { notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

// ---------- state ----------
const receivings = ref<any[]>([])
const total = ref(0)
const loading = ref(false)

const page = ref(1)
const itemsPerPage = ref(10)

const search = ref('')
const statusFilter = ref<string | undefined>(undefined)
const poFilter = ref<string | undefined>(undefined)
const dateFrom = ref('')
const dateTo = ref('')

// lookups
const poOptions = ref<{ value: string, label: string, raw: any }[]>([])
const locationOptions = ref<{ value: string, label: string }[]>([])

// per-row loading
const actingOnId = ref<number | string | null>(null)

// modals
const createOpen = ref(false)
const viewOpen = ref(false)
const addItemOpen = ref(false)
const confirmCompleteOpen = ref(false)
const saving = ref(false)

// selection (for drill flow)
const activeReceiving = ref<any | null>(null)
const activePO = ref<any | null>(null)

// ---------- enums ----------
const rcvStatuses = [
  { value: 'DRAFT', tone: 'warning' as const },
  { value: 'COMPLETED', tone: 'success' as const },
]
const qualityStatuses = [
  { value: 'PASSED', tone: 'success' as const },
  { value: 'FAILED', tone: 'error' as const },
  { value: 'PENDING', tone: 'warning' as const },
]

const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'> = {
  DRAFT: 'warning',
  COMPLETED: 'success',
  CONFIRMED: 'info',
  PARTIAL: 'warning',
  RECEIVED: 'success',
  PASSED: 'success',
  FAILED: 'error',
  PENDING: 'warning',
}
function tone(v?: string) {
  if (!v)
    return 'neutral'
  return STATUS_TONE[v] ?? 'neutral'
}

// ---------- forms ----------
const today = new Date().toISOString().substring(0, 10)

const createForm = ref({
  purchase_order_id: '' as string,
  location_id: '' as string,
  received_date: today,
  notes: '',
})

const itemForm = ref({
  po_item_id: '' as string,
  quantity_received: '' as string,
  unit_cost: '' as string,
  batch_number: '',
  expiry_date: '',
  quality_status: 'PASSED',
  notes: '',
})

// ---------- load ----------
async function loadReceivings() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value.trim())
      params.search = search.value.trim()
    if (statusFilter.value)
      params.status = statusFilter.value
    if (poFilter.value)
      params.purchase_order_id = poFilter.value
    if (dateFrom.value)
      params.date_from = dateFrom.value
    if (dateTo.value)
      params.date_to = dateTo.value

    const res = await stockApi.get('/receiving/', { params })
    const d = res.data?.data ?? res.data

    receivings.value = d?.receivings ?? d?.items ?? d?.results ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? d?.count ?? receivings.value.length
  }
  catch {
    notify(t('Failed to load receivings'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadLookups() {
  try {
    const [poRes, locRes] = await Promise.all([
      stockApi.get('/purchase-orders/', { params: { status: 'CONFIRMED,PARTIAL', per_page: 200 } }),
      stockApi.get('/locations/', { params: { is_active: true, per_page: 200 } }),
    ])
    const poD = poRes.data?.data ?? poRes.data
    const locD = locRes.data?.data ?? locRes.data

    const poList: any[] = poD?.orders ?? poD?.purchase_orders ?? poD?.results ?? []
    poOptions.value = poList.map(p => ({
      value: String(p.id),
      label: p.order_number ?? `PO-${p.id}`,
      raw: p,
    }))

    const locList: any[] = locD?.locations ?? locD?.results ?? []
    locationOptions.value = locList.map(l => ({
      value: String(l.id),
      label: l.name ?? `#${l.id}`,
    }))
  }
  catch { /* lookups optional */ }
}

onMounted(() => {
  loadReceivings()
  loadLookups()
})

watch([page, itemsPerPage], loadReceivings)
watch([statusFilter, poFilter, dateFrom, dateTo], () => {
  page.value = 1
  loadReceivings()
})

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadReceivings()
}, 400)
watch(search, () => debouncedSearch())

// ---------- create ----------
function openCreate() {
  createForm.value = {
    purchase_order_id: '',
    location_id: '',
    received_date: today,
    notes: '',
  }
  createOpen.value = true
}

// Auto-fill delivery location when PO is picked
watch(() => createForm.value.purchase_order_id, (id) => {
  if (!id) {
    createForm.value.location_id = ''
    return
  }
  const po = poOptions.value.find(o => o.value === id)?.raw
  if (po) {
    const locId = po.delivery_location_id ?? po.delivery_location?.id
    if (locId)
      createForm.value.location_id = String(locId)
  }
})

async function createReceiving() {
  if (!createForm.value.purchase_order_id) {
    notify(t('Select Purchase Order'), 'error')
    return
  }
  saving.value = true
  try {
    const payload: any = {}
    if (createForm.value.location_id)
      payload.location_id = Number(createForm.value.location_id)
    if (createForm.value.received_date)
      payload.received_date = createForm.value.received_date
    if (createForm.value.notes)
      payload.notes = createForm.value.notes

    // PO id is a path param per spec (BE route is singular: /purchase-order/<id>/receiving/)
    const res = await stockApi.post(`/purchase-order/${createForm.value.purchase_order_id}/receiving/`, payload)
    const d = res.data?.data ?? res.data
    notify(t('Receiving created'))
    createOpen.value = false
    await loadReceivings()

    // Open the drill view on the freshly created receiving
    const created = d?.receiving ?? d
    if (created && created.id)
      await openView(created)
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to create receiving'), 'error')
  }
  finally {
    saving.value = false
  }
}

// ---------- view / drill ----------
async function openView(rcv: any) {
  activeReceiving.value = rcv
  viewOpen.value = true
  // fetch fresh details + linked PO (for line items + qty-remaining math)
  try {
    const res = await stockApi.get(`/receiving/${rcv.id}/`)
    const d = res.data?.data ?? res.data
    activeReceiving.value = d?.receiving ?? d ?? rcv
  }
  catch { /* keep row-level data */ }

  const poId = activeReceiving.value?.purchase_order_id ?? activeReceiving.value?.purchase_order?.id
  if (poId) {
    try {
      const r = await stockApi.get(`/purchase-orders/${poId}/`)
      const pd = r.data?.data ?? r.data
      activePO.value = pd?.order ?? pd?.purchase_order ?? pd
    }
    catch { activePO.value = null }
  }
}

function closeView() {
  viewOpen.value = false
  activeReceiving.value = null
  activePO.value = null
}

// PO line items still awaiting receipt (drives Add Item dropdown)
const pendingPOItems = computed<any[]>(() => {
  const po: any = activePO.value
  if (!po)
    return []
  const lines: any[] = po.items ?? po.line_items ?? []
  return lines.filter((li) => {
    const ordered = Number(li.quantity_ordered ?? li.quantity ?? 0)
    const received = Number(li.quantity_received ?? 0)
    return ordered - received > 0
  })
})

// ---------- add item ----------
function openAddItem() {
  itemForm.value = {
    po_item_id: '',
    quantity_received: '',
    unit_cost: '',
    batch_number: '',
    expiry_date: '',
    quality_status: 'PASSED',
    notes: '',
  }
  addItemOpen.value = true
}

// Auto-fill unit_cost from the selected PO line
watch(() => itemForm.value.po_item_id, (id) => {
  if (!id)
    return
  const line = pendingPOItems.value.find(l => String(l.id) === String(id))
  if (line && !itemForm.value.unit_cost) {
    const price = line.unit_price ?? line.price
    if (price != null)
      itemForm.value.unit_cost = String(price)
  }
})

const selectedPOLine = computed(() => {
  const id = itemForm.value.po_item_id
  if (!id)
    return null
  return pendingPOItems.value.find(l => String(l.id) === String(id)) ?? null
})

const maxReceivable = computed(() => {
  const l: any = selectedPOLine.value
  if (!l)
    return undefined
  const ordered = Number(l.quantity_ordered ?? l.quantity ?? 0)
  const received = Number(l.quantity_received ?? 0)
  return ordered - received
})

async function submitAddItem() {
  const rcv = activeReceiving.value
  if (!rcv)
    return
  if (!itemForm.value.po_item_id) {
    notify(t('Select PO Item'), 'error')
    return
  }
  const qty = Number(itemForm.value.quantity_received)
  if (!qty || qty <= 0) {
    notify(t('Quantity Received'), 'error')
    return
  }
  saving.value = true
  try {
    const payload: any = {
      po_item_id: Number(itemForm.value.po_item_id),
      quantity_received: qty,
    }
    if (itemForm.value.unit_cost !== '')
      payload.unit_cost = Number(itemForm.value.unit_cost)
    if (itemForm.value.batch_number)
      payload.batch_number = itemForm.value.batch_number
    if (itemForm.value.expiry_date)
      payload.expiry_date = itemForm.value.expiry_date
    if (itemForm.value.quality_status)
      payload.quality_status = itemForm.value.quality_status
    if (itemForm.value.notes)
      payload.notes = itemForm.value.notes

    await stockApi.post(`/receiving/${rcv.id}/items/`, payload)
    notify(t('Item added'))
    addItemOpen.value = false
    // refresh the drill view + the list (for items_count)
    await openView(rcv)
    await loadReceivings()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to add item'), 'error')
  }
  finally {
    saving.value = false
  }
}

// ---------- complete ----------
function askComplete(rcv: any) {
  activeReceiving.value = rcv
  confirmCompleteOpen.value = true
}

async function doComplete() {
  const rcv = activeReceiving.value
  if (!rcv)
    return
  if (actingOnId.value === rcv.id)
    return
  actingOnId.value = rcv.id
  try {
    await stockApi.post(`/receiving/${rcv.id}/complete/`)
    notify(t('Receiving completed'))
    confirmCompleteOpen.value = false
    if (viewOpen.value)
      await openView(rcv)
    await loadReceivings()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to complete receiving'), 'error')
  }
  finally {
    actingOnId.value = null
  }
}

// ---------- DataTable wiring ----------
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'receiving_number', label: t('Receiving #') },
  { key: 'purchase_order_number', label: t('PO #') },
  { key: 'location_name', label: t('Location') },
  { key: 'received_date', label: t('Received Date') },
  { key: 'items_count', label: t('Receiving Items'), align: 'right' },
  { key: 'status', label: t('Status') },
  { key: 'actions', label: t('Actions'), align: 'right' },
])

const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

function rcvNumber(r: any) {
  return r.receiving_number ?? r.number ?? `R-${r.id}`
}
function poNumber(r: any) {
  return r.purchase_order_number ?? r.purchase_order?.order_number ?? (r.purchase_order_id ? `PO-${r.purchase_order_id}` : '—')
}
function locName(r: any) {
  return r.location_name ?? r.location?.name ?? '—'
}
function itemsCount(r: any) {
  return r.items_count ?? r.items?.length ?? 0
}

const hasFilters = computed(() => !!(search.value || statusFilter.value || poFilter.value || dateFrom.value || dateTo.value))
function clearAll() {
  search.value = ''
  statusFilter.value = undefined
  poFilter.value = undefined
  dateFrom.value = ''
  dateTo.value = ''
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Goods Receiving')"
      :subtitle="t('Receivings')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('New Receiving') }}
        </Button>
      </template>
    </PageHeader>

    <div class="card">
      <!-- Toolbar -->
      <div class="toolbar toolbar--wrap">
        <div class="grow tb-search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search')"
            :aria-label="t('Search')"
          />
        </div>

        <div class="tb-status">
          <Select
            :model-value="statusFilter ?? ''"
            :placeholder="t('Filter by status')"
            :options="rcvStatuses.map(s => ({ value: s.value, label: t(`rcv_status_${s.value}`) }))"
            @update:model-value="(v: string) => statusFilter = v ? v : undefined"
          />
        </div>

        <div class="tb-po">
          <Select
            :model-value="poFilter ?? ''"
            :placeholder="t('Filter by PO')"
            :options="poOptions"
            @update:model-value="(v: string) => poFilter = v ? v : undefined"
          />
        </div>

        <div class="row tb-dates">
          <div class="control control--sm tb-date">
            <input
              v-model="dateFrom"
              type="date"
              :aria-label="t('Date From')"
            >
          </div>
          <span class="tertiary" :aria-label="t('to')">{{ t('range_arrow') }}</span>
          <div class="control control--sm tb-date">
            <input
              v-model="dateTo"
              type="date"
              :aria-label="t('Date To')"
            >
          </div>
        </div>
      </div>

      <!-- Active filter chips -->
      <div v-if="hasFilters" class="toolbar" style="padding-top: 0;">
        <div class="chips">
          <span v-if="search" class="chip">
            <span>{{ t('Search') }}: <b>{{ search }}</b></span>
            <span class="chip__x" @click="search = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>
          <span v-if="statusFilter" class="chip">
            <span>{{ t('Status') }}: <b>{{ t(`rcv_status_${statusFilter}`) }}</b></span>
            <span class="chip__x" @click="statusFilter = undefined">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>
          <span v-if="poFilter" class="chip">
            <span>{{ t('PO #') }}: <b>{{ poOptions.find(o => o.value === poFilter)?.label ?? poFilter }}</b></span>
            <span class="chip__x" @click="poFilter = undefined">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>
          <span v-if="dateFrom" class="chip">
            <span>{{ t('Date From') }}: <b>{{ dateFrom }}</b></span>
            <span class="chip__x" @click="dateFrom = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>
          <span v-if="dateTo" class="chip">
            <span>{{ t('Date To') }}: <b>{{ dateTo }}</b></span>
            <span class="chip__x" @click="dateTo = ''">
              <DesignIcon name="close" :size="13" />
            </span>
          </span>
          <button class="chip--clear" @click="clearAll">
            {{ t('Cancel') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- DataTable -->
      <DataTable
        :columns="columns"
        :rows="receivings"
        row-key="id"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
      >
        <template #cell.receiving_number="{ row }">
          <span class="cell-strong mono">{{ rcvNumber(row) }}</span>
        </template>

        <template #cell.purchase_order_number="{ row }">
          <span class="mono cell-muted">{{ poNumber(row) }}</span>
        </template>

        <template #cell.location_name="{ row }">
          <span class="cell-muted">{{ locName(row) }}</span>
        </template>

        <template #cell.received_date="{ row }">
          <span class="mono cell-muted nowrap">{{ row.received_date ? formatDate(row.received_date) : '—' }}</span>
        </template>

        <template #cell.items_count="{ row }">
          <span class="mono cell-muted">{{ itemsCount(row) }}</span>
        </template>

        <template #cell.status="{ row }">
          <Badge :tone="(tone(row.status) as any)" dot>
            {{ row.status ? t(`rcv_status_${row.status}`) : '—' }}
          </Badge>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            icon="eye"
            :title="t('View')"
            @click="openView(row)"
          />
          <IconAction
            v-if="row.status === 'DRAFT'"
            icon="plus"
            tone="primary"
            :title="t('Add Item')"
            @click="() => { activeReceiving = row; openView(row); openAddItem(); }"
          />
          <IconAction
            v-if="row.status === 'DRAFT' && itemsCount(row) > 0"
            icon="check"
            tone="success"
            :title="t('Complete')"
            :disabled="actingOnId === row.id"
            @click="askComplete(row)"
          />
        </template>

        <template #empty>
          <StateFill
            icon="receipt"
            :title="t('No receivings')"
            :sub="t('Receivings')"
          >
            <div v-if="hasFilters" style="margin-top: 12px;">
              <Button variant="secondary" @click="clearAll">
                {{ t('Cancel') }}
              </Button>
            </div>
          </StateFill>
        </template>
      </DataTable>
    </div>

    <!-- ============== CREATE MODAL ============== -->
    <Modal
      :open="createOpen"
      :width="540"
      class="rcv-modal"
      :title="t('Create Receiving')"
      :subtitle="t('Purchase Order')"
      @close="createOpen = false"
    >
      <div class="grid cols-1" style="gap: var(--sp-3);">
        <Field :label="t('Purchase Order')">
          <Select
            v-model="createForm.purchase_order_id"
            :placeholder="t('Select Purchase Order')"
            :options="poOptions"
          />
        </Field>

        <Field :label="t('Location')">
          <Select
            v-model="createForm.location_id"
            :placeholder="t('Location')"
            :options="locationOptions"
          />
        </Field>

        <Field :label="t('Received Date')">
          <div class="control">
            <input
              v-model="createForm.received_date"
              type="date"
              :aria-label="t('Received Date')"
            >
          </div>
        </Field>

        <Field :label="t('Notes')">
          <div class="control" style="height: auto;">
            <textarea
              v-model="createForm.notes"
              rows="3"
              maxlength="500"
              :placeholder="t('Notes')"
              style="width:100%; background:transparent; border:0; outline:none; color:var(--text); resize:vertical; font: inherit;"
            />
          </div>
        </Field>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="saving"
          @click="createOpen = false"
        >
          {{ t('Close') }}
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          :disabled="saving || !createForm.purchase_order_id"
          @click="createReceiving"
        >
          {{ t('Create Receiving') }}
        </Button>
      </template>
    </Modal>

    <!-- ============== VIEW / DRILL MODAL ============== -->
    <Modal
      :open="viewOpen"
      :width="900"
      class="rcv-modal rcv-modal--lg"
      :title="activeReceiving ? `${t('Receiving #')} ${rcvNumber(activeReceiving)}` : t('Receiving #')"
      :subtitle="activeReceiving ? `${t('PO #')} ${poNumber(activeReceiving)}` : ''"
      @close="closeView"
    >
      <div v-if="activeReceiving">
        <!-- Meta strip -->
        <div class="grid cols-3 rcv-meta" style="gap: var(--sp-3); margin-bottom: var(--sp-4);">
          <div>
            <div class="kpi__label">
              {{ t('Status') }}
            </div>
            <Badge :tone="(tone(activeReceiving.status) as any)" dot>
              {{ activeReceiving.status ? t(`rcv_status_${activeReceiving.status}`) : '—' }}
            </Badge>
          </div>
          <div>
            <div class="kpi__label">
              {{ t('Location') }}
            </div>
            <div class="cell-strong">
              {{ locName(activeReceiving) }}
            </div>
          </div>
          <div>
            <div class="kpi__label">
              {{ t('Received Date') }}
            </div>
            <div class="mono">
              {{ activeReceiving.received_date ? formatDate(activeReceiving.received_date) : '—' }}
            </div>
          </div>
          <div v-if="activeReceiving.received_by_name || activeReceiving.received_by?.name">
            <div class="kpi__label">
              {{ t('Received By') }}
            </div>
            <div>
              {{ activeReceiving.received_by_name ?? activeReceiving.received_by?.name }}
            </div>
          </div>
          <div v-if="activePO">
            <div class="kpi__label">
              {{ t('Purchase Order') }}
            </div>
            <Badge :tone="(tone(activePO.status) as any)">
              {{ activePO.status ? t(`po_status_${activePO.status}`) : '—' }}
            </Badge>
          </div>
          <div v-if="activeReceiving.notes" style="grid-column: span 3;">
            <div class="kpi__label">
              {{ t('Notes') }}
            </div>
            <div class="cell-muted">
              {{ activeReceiving.notes }}
            </div>
          </div>
        </div>

        <!-- Items list -->
        <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div class="kpi__label">
            {{ t('Receiving Items') }}
          </div>
          <Button
            v-if="activeReceiving.status === 'DRAFT'"
            variant="secondary"
            size="sm"
            icon="plus"
            @click="openAddItem"
          >
            {{ t('Add Item') }}
          </Button>
        </div>

        <div class="tablewrap">
          <table
            class="dtable rcv-items-table"
          >
            <thead>
              <tr>
                <th>{{ t('Stock Item') }}</th>
                <th class="num">
                  {{ t('Quantity Received') }}
                </th>
                <th class="num">
                  {{ t('Unit Cost') }}
                </th>
                <th>{{ t('Batch Number') }}</th>
                <th>{{ t('Expiry Date') }}</th>
                <th>{{ t('Quality Status') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(li, i) in ((activeReceiving.items ?? []) as any[])" :key="i">
                <td class="cell-strong">
                  {{ li.stock_item_name ?? li.stock_item?.name ?? li.po_item?.stock_item_name ?? '—' }}
                </td>
                <td class="num mono">
                  {{ li.quantity_received ?? '—' }}
                  <span v-if="li.unit ?? li.unit_name" class="cell-muted">{{ li.unit ?? li.unit_name }}</span>
                </td>
                <td class="num mono cell-muted">
                  {{ li.unit_cost != null ? formatCurrency(li.unit_cost) : '—' }}
                </td>
                <td class="mono cell-muted">
                  {{ li.batch_number || '—' }}
                </td>
                <td class="mono cell-muted nowrap">
                  {{ li.expiry_date ? formatDate(li.expiry_date) : '—' }}
                </td>
                <td>
                  <Badge :tone="(tone(li.quality_status) as any)">
                    {{ li.quality_status ? t(`quality_status_${li.quality_status}`) : '—' }}
                  </Badge>
                </td>
              </tr>
              <tr v-if="!(activeReceiving.items?.length)">
                <td colspan="6" class="center cell-muted">
                  {{ t('No items') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" @click="closeView">
          {{ t('Close') }}
        </Button>
        <Button
          v-if="activeReceiving && activeReceiving.status === 'DRAFT' && (activeReceiving.items?.length ?? 0) > 0"
          variant="primary"
          :loading="actingOnId === activeReceiving.id"
          :disabled="actingOnId === activeReceiving.id"
          @click="askComplete(activeReceiving)"
        >
          {{ t('Complete Receiving') }}
        </Button>
      </template>
    </Modal>

    <!-- ============== ADD ITEM MODAL ============== -->
    <Modal
      :open="addItemOpen"
      :width="560"
      class="rcv-modal"
      :title="t('Add Item')"
      :subtitle="t('PO Item')"
      @close="addItemOpen = false"
    >
      <div class="grid cols-2 rcv-form" style="gap: var(--sp-3);">
        <Field :label="t('PO Item')" style="grid-column: span 2;">
          <Select
            v-model="itemForm.po_item_id"
            :placeholder="t('Select PO Item')"
            :options="pendingPOItems.map(l => ({
              value: String(l.id),
              label: `${l.stock_item_name ?? l.stock_item?.name ?? `#${l.id}`} · ${t('Ordered')}: ${l.quantity_ordered ?? l.quantity ?? 0} / ${t('Received')}: ${l.quantity_received ?? 0}`,
            }))"
          />
        </Field>

        <Field
          :label="t('Quantity Received')"
          :hint="maxReceivable != null ? `${t('Pending Quantity')}: ${maxReceivable}` : undefined"
        >
          <Input
            v-model="itemForm.quantity_received"
            type="number"
            step="0.0001"
            :min="0.0001"
            :max="maxReceivable"
            :placeholder="t('Quantity Received')"
          />
        </Field>

        <Field :label="t('Unit Cost')">
          <Input
            v-model="itemForm.unit_cost"
            type="number"
            step="0.0001"
            :min="0"
            :placeholder="t('Unit Cost')"
          />
        </Field>

        <Field :label="t('Batch Number')">
          <Input
            v-model="itemForm.batch_number"
            maxlength="100"
            :placeholder="t('Batch Number')"
          />
        </Field>

        <Field :label="t('Expiry Date')">
          <div class="control">
            <input
              v-model="itemForm.expiry_date"
              type="date"
              :aria-label="t('Expiry Date')"
            >
          </div>
        </Field>

        <Field :label="t('Quality Status')" style="grid-column: span 2;">
          <Select
            v-model="itemForm.quality_status"
            :options="qualityStatuses.map(q => ({ value: q.value, label: t(`quality_status_${q.value}`) }))"
          />
        </Field>

        <Field :label="t('Notes')" style="grid-column: span 2;">
          <div class="control" style="height: auto;">
            <textarea
              v-model="itemForm.notes"
              rows="2"
              maxlength="500"
              :placeholder="t('Notes')"
              style="width:100%; background:transparent; border:0; outline:none; color:var(--text); resize:vertical; font: inherit;"
            />
          </div>
        </Field>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="saving"
          @click="addItemOpen = false"
        >
          {{ t('Close') }}
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          :disabled="saving || !itemForm.po_item_id || !itemForm.quantity_received"
          @click="submitAddItem"
        >
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- ============== CONFIRM COMPLETE MODAL ============== -->
    <Modal
      :open="confirmCompleteOpen"
      :width="440"
      class="rcv-modal"
      :title="t('Complete Receiving')"
      :subtitle="t('Confirm complete receiving?')"
      @close="confirmCompleteOpen = false"
    >
      <div v-if="activeReceiving" class="row rcv-confirm-row" style="gap: 14px; align-items: flex-start;">
        <div
          class="kpi__icon t-success"
          style="width: 44px; height: 44px; flex: 0 0 44px;"
        >
          <DesignIcon name="check" :size="22" />
        </div>
        <div>
          <p style="margin: 0; font-weight: 600;">
            {{ rcvNumber(activeReceiving) }} · {{ poNumber(activeReceiving) }}
          </p>
          <p class="muted" style="margin: 6px 0 0; font-size: 14px;">
            {{ t('Confirm complete receiving?') }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="actingOnId !== null"
          @click="confirmCompleteOpen = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          :loading="actingOnId !== null"
          :disabled="actingOnId !== null"
          @click="doComplete"
        >
          {{ t('Complete') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
}

/* Toolbar wraps cleanly on narrow viewports */
.toolbar--wrap {
  flex-wrap: wrap;
  gap: 8px;
  row-gap: 10px;
}
.tb-search { max-width: 280px; }
.tb-status { width: 200px; }
.tb-po { width: 220px; }
.tb-dates { gap: 8px; margin-left: auto; }
.tb-date { width: 160px; }

/* Receiving items table — let .tablewrap handle horizontal scroll on phone */
.rcv-items-table {
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border);
}

/* Tablet (<=1024px): collapse inline grids per canonical breakpoint */
@media (max-width: 1024px) {
  .rcv-meta {
    grid-template-columns: 1fr 1fr !important;
  }
  .rcv-form {
    grid-template-columns: 1fr !important;
  }
  .rcv-form > [style*="grid-column"] {
    grid-column: auto !important;
  }
}

/* Phone (<=768px): canonical breakpoint — collapse toolbar, single-col grids,
   modals → near full viewport, table scrolls horizontally via .tablewrap. */
@media (max-width: 768px) {
  .tb-search,
  .tb-status,
  .tb-po,
  .tb-dates,
  .tb-date {
    max-width: none;
    width: 100%;
  }
  .tb-dates {
    margin-left: 0;
    flex-wrap: wrap;
  }
  .tb-date { flex: 1 1 140px; }

  .rcv-meta {
    grid-template-columns: 1fr !important;
  }
  .rcv-meta > [style*="grid-column"] {
    grid-column: auto !important;
  }
  .rcv-form {
    grid-template-columns: 1fr !important;
  }
  .rcv-form > [style*="grid-column"] {
    grid-column: auto !important;
  }

  /* Hard-coded modal widths exceed phone viewport — collapse to sheet. */
  :deep(.rcv-modal) .modal,
  :deep(.rcv-modal) .modal__panel,
  :deep(.rcv-modal) .modal-panel,
  :deep(.rcv-modal) .modal-content,
  :deep(.rcv-modal) [class*="modal__dialog"],
  :deep(.rcv-modal) [class*="modal-dialog"] {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
  }

  /* Confirm modal body row should wrap on tiny widths. */
  .rcv-confirm-row {
    flex-wrap: wrap;
  }
}

/* Small phone (<=420px) — tighter modal margins. */
@media (max-width: 420px) {
  :deep(.rcv-modal) .modal,
  :deep(.rcv-modal) .modal__panel,
  :deep(.rcv-modal) .modal-panel,
  :deep(.rcv-modal) .modal-content,
  :deep(.rcv-modal) [class*="modal__dialog"],
  :deep(.rcv-modal) [class*="modal-dialog"] {
    width: calc(100vw - 12px) !important;
    max-width: calc(100vw - 12px) !important;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

<script setup lang="ts">
/* ============================================================
   ALPHA POS — Stock Transfers (Workflow)
   EXTENDED page:
   - Row actions for state transitions (request/approve/ship/receive/cancel)
   - Toolbar "Quick transfer" → modal → POST /transfers/quick/
   - Receive modal w/ per-item received quantities
   - Cancel modal w/ reason
   - Detail modal w/ items + lifecycle
   Uses design primitives + design-shell.css. No Vuetify on the page.
   ============================================================ */
import { stockApi as axios } from '@/plugins/axios'
import { TRANSFER_STATUS_COLOR as statusColor } from '@/constants/statusColors'
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
const { notify, snackbar, snackbarMsg, snackbarColor } = useNotify()
const { formatDate, formatDateShort } = useFormatters()

// ---------------- state ----------------
const transfers = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)

const statusFilter = ref<string | undefined>(undefined)
const fromLocationFilter = ref<number | undefined>(undefined)
const toLocationFilter = ref<number | undefined>(undefined)
const typeFilter = ref<string | undefined>(undefined)

const locationsList = ref<any[]>([])
const itemsList = ref<any[]>([])
const unitsList = ref<any[]>([])
const batchesList = ref<any[]>([])

const statuses = ['DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELED']
const transferTypes = ['INTERNAL', 'BRANCH_TO_BRANCH']

// Status tone map for design Badge primitive
const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'> = {
  DRAFT: 'neutral',
  REQUESTED: 'info',
  APPROVED: 'primary',
  IN_TRANSIT: 'warning',
  RECEIVED: 'success',
  CANCELED: 'error',
}
const TYPE_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'> = {
  INTERNAL: 'neutral',
  BRANCH_TO_BRANCH: 'info',
}

function statusTone(s: string) {
  return STATUS_TONE[s] ?? (statusColor[s] === 'default' ? 'neutral' : (statusColor[s] as any)) ?? 'neutral'
}

// ---------------- modal state ----------------
const confirmDialog = ref<{ kind: 'request' | 'approve' | 'ship'; row: any } | null>(null)
const receiveDialog = ref<{ row: any; loading: boolean } | null>(null)
const cancelDialog = ref<{ row: any; reason: string; loading: boolean } | null>(null)
const detailDialog = ref<{ row: any; loading: boolean } | null>(null)
const quickDialog = ref(false)

// Per-item received quantities map: item.id -> string (numeric)
const receivedQtys = ref<Record<number, string>>({})

// Quick transfer form
const quickForm = ref({
  from_location_id: '' as string,
  to_location_id: '' as string,
  stock_item_id: '' as string,
  quantity: '' as string,
  unit_id: '' as string,
  batch_id: '' as string,
  notes: '',
})
const quickSaving = ref(false)
const quickErrors = ref<Record<string, string>>({})

const actingId = ref<number | null>(null)

// ---------------- loaders ----------------
async function loadTransfers() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value)
      params.status = statusFilter.value
    if (fromLocationFilter.value)
      params.from_location_id = fromLocationFilter.value
    if (toLocationFilter.value)
      params.to_location_id = toLocationFilter.value
    if (typeFilter.value)
      params.type = typeFilter.value

    const res = await axios.get('/transfers/', { params })
    const d = res.data?.data ?? res.data

    transfers.value = d?.transfers ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? transfers.value.length
  }
  catch {
    notify(t('transfer_ext_empty'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [locRes, itemsRes, unitsRes] = await Promise.all([
      axios.get('/locations/', { params: { per_page: 200 } }),
      axios.get('/items/', { params: { per_page: 300 } }),
      axios.get('/units/', { params: { per_page: 200 } }),
    ])
    locationsList.value = locRes.data?.data?.locations ?? locRes.data?.locations ?? []
    itemsList.value = itemsRes.data?.data?.items ?? itemsRes.data?.items ?? []
    unitsList.value = unitsRes.data?.data?.units ?? unitsRes.data?.units ?? []
  }
  catch { /* ignore */ }
}

async function loadBatchesFor(fromLocationId: string, stockItemId: string) {
  if (!fromLocationId || !stockItemId) {
    batchesList.value = []
    return
  }
  try {
    const res = await axios.get('/batches/', {
      params: {
        location_id: fromLocationId,
        stock_item_id: stockItemId,
        per_page: 100,
      },
    })
    batchesList.value = res.data?.data?.batches ?? res.data?.batches ?? []
  }
  catch {
    batchesList.value = []
  }
}

onMounted(() => {
  loadTransfers()
  loadMeta()
})

watch([page, itemsPerPage], loadTransfers)
watch([statusFilter, fromLocationFilter, toLocationFilter, typeFilter], () => {
  page.value = 1
  loadTransfers()
})

// reload batch list when quick form source/item changes
watch(
  () => [quickForm.value.from_location_id, quickForm.value.stock_item_id],
  ([fl, si]) => {
    quickForm.value.batch_id = ''
    if (fl && si)
      loadBatchesFor(String(fl), String(si))
    else
      batchesList.value = []
  },
)

// ---------------- options for selects ----------------
const locationOptions = computed(() =>
  locationsList.value.map((l: any) => ({ value: String(l.id), label: l.name })),
)
const itemOptions = computed(() =>
  itemsList.value.map((i: any) => ({
    value: String(i.id),
    label: i.sku ? `${i.name} (${i.sku})` : i.name,
  })),
)
const unitOptions = computed(() =>
  unitsList.value.map((u: any) => ({
    value: String(u.id),
    label: u.short_name ? `${u.name} (${u.short_name})` : u.name,
  })),
)
const batchOptions = computed(() =>
  batchesList.value.map((b: any) => ({
    value: String(b.id),
    label: b.batch_number ?? `${t('transfer_batch_label')} #${b.id}`,
  })),
)

// ---------------- row-action visibility ----------------
function canRequest(r: any) { return r.status === 'DRAFT' }
function canApprove(r: any) { return ['DRAFT', 'REQUESTED'].includes(r.status) }
function canShip(r: any) { return r.status === 'APPROVED' }
function canReceive(r: any) { return r.status === 'IN_TRANSIT' }
function canCancel(r: any) { return !['RECEIVED', 'CANCELED'].includes(r.status) }

// ---------------- actions ----------------
async function performAction(row: any, action: 'request' | 'approve' | 'ship') {
  if (actingId.value === row.id) return
  actingId.value = row.id
  try {
    await axios.post(`/transfers/${row.id}/${action}/`, {})
    const okKey
      = action === 'request' ? 'transfer_ext_msg_requested'
        : action === 'approve' ? 'transfer_ext_msg_approved'
          : 'transfer_ext_msg_shipped'
    notify(t(okKey))
    await loadTransfers()
  }
  catch (e: any) {
    const errKey
      = action === 'request' ? 'transfer_ext_err_request'
        : action === 'approve' ? 'transfer_ext_err_approve'
          : 'transfer_ext_err_ship'
    notify(e?.response?.data?.message ?? t(errKey), 'error')
  }
  finally {
    actingId.value = null
    confirmDialog.value = null
  }
}

async function confirmReceive() {
  if (!receiveDialog.value) return
  const row = receiveDialog.value.row
  receiveDialog.value.loading = true
  try {
    const received_quantities: Record<string, string> = {}
    for (const [k, v] of Object.entries(receivedQtys.value))
      received_quantities[String(k)] = String(v ?? '0')

    await axios.post(`/transfers/${row.id}/receive/`, { received_quantities })
    notify(t('transfer_ext_msg_received'))
    receiveDialog.value = null
    await loadTransfers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('transfer_ext_err_receive'), 'error')
    if (receiveDialog.value)
      receiveDialog.value.loading = false
  }
}

async function confirmCancel() {
  if (!cancelDialog.value) return
  const row = cancelDialog.value.row
  cancelDialog.value.loading = true
  try {
    await axios.post(`/transfers/${row.id}/cancel/`, { reason: cancelDialog.value.reason || '' })
    notify(t('transfer_ext_msg_canceled'))
    cancelDialog.value = null
    await loadTransfers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('transfer_ext_err_cancel'), 'error')
    if (cancelDialog.value)
      cancelDialog.value.loading = false
  }
}

// ---------------- openers ----------------
function openConfirm(row: any, kind: 'request' | 'approve' | 'ship') {
  confirmDialog.value = { kind, row }
}

async function openReceive(row: any) {
  // fetch detail to know items
  receiveDialog.value = { row, loading: false }
  receivedQtys.value = {}
  try {
    const res = await axios.get(`/transfers/${row.id}/`)
    const detail = res.data?.data ?? res.data
    receiveDialog.value = { row: detail, loading: false }
    const items = (detail.items ?? []) as any[]
    const map: Record<number, string> = {}
    for (const it of items) {
      const def = it.shipped_qty ?? it.approved_qty ?? it.requested_qty ?? '0'
      map[it.id] = String(def)
    }
    receivedQtys.value = map
  }
  catch {
    notify(t('transfer_ext_err_receive'), 'error')
    receiveDialog.value = null
  }
}

function openCancel(row: any) {
  cancelDialog.value = { row, reason: '', loading: false }
}

async function openDetail(row: any) {
  detailDialog.value = { row, loading: true }
  try {
    const res = await axios.get(`/transfers/${row.id}/`)
    const detail = res.data?.data ?? res.data
    detailDialog.value = { row: detail, loading: false }
  }
  catch {
    if (detailDialog.value)
      detailDialog.value.loading = false
  }
}

function openQuick() {
  quickForm.value = {
    from_location_id: '',
    to_location_id: '',
    stock_item_id: '',
    quantity: '',
    unit_id: '',
    batch_id: '',
    notes: '',
  }
  quickErrors.value = {}
  batchesList.value = []
  quickDialog.value = true
}

function validateQuick(): boolean {
  const errs: Record<string, string> = {}
  if (!quickForm.value.from_location_id)
    errs.from_location_id = t('transfer_ext_validation_required')
  if (!quickForm.value.to_location_id)
    errs.to_location_id = t('transfer_ext_validation_required')
  if (
    quickForm.value.from_location_id
    && quickForm.value.from_location_id === quickForm.value.to_location_id
  )
    errs.to_location_id = t('transfer_ext_validation_same_location')
  if (!quickForm.value.stock_item_id)
    errs.stock_item_id = t('transfer_ext_validation_required')
  const qty = Number(quickForm.value.quantity)
  if (!quickForm.value.quantity || Number.isNaN(qty) || qty <= 0)
    errs.quantity = t('transfer_ext_validation_positive_qty')
  quickErrors.value = errs
  return Object.keys(errs).length === 0
}

async function submitQuick() {
  if (!validateQuick()) return
  quickSaving.value = true
  try {
    const payload: any = {
      from_location_id: Number(quickForm.value.from_location_id),
      to_location_id: Number(quickForm.value.to_location_id),
      stock_item_id: Number(quickForm.value.stock_item_id),
      quantity: Number(quickForm.value.quantity),
    }
    if (quickForm.value.unit_id) payload.unit_id = Number(quickForm.value.unit_id)
    if (quickForm.value.batch_id) payload.batch_id = Number(quickForm.value.batch_id)
    if (quickForm.value.notes) payload.notes = quickForm.value.notes

    await axios.post('/transfers/quick/', payload)
    notify(t('transfer_ext_msg_quick_done'))
    quickDialog.value = false
    await loadTransfers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('transfer_ext_err_quick'), 'error')
  }
  finally {
    quickSaving.value = false
  }
}

// ---------------- helpers ----------------
function locName(loc: any): string {
  if (loc == null) return '—'
  if (typeof loc === 'string') return loc
  return loc?.name ?? '—'
}

function shippedQtyOf(item: any): string {
  return String(item.shipped_qty ?? item.approved_qty ?? item.requested_qty ?? '0')
}

function getReceivedQty(itemId: number): string {
  return receivedQtys.value[itemId] ?? '0'
}
function setReceivedQty(itemId: number, v: string) {
  receivedQtys.value = { ...receivedQtys.value, [itemId]: v }
}
function receivedInvalid(item: any): boolean {
  const v = Number(getReceivedQty(item.id))
  const max = Number(shippedQtyOf(item))
  if (Number.isNaN(v) || v < 0) return true
  if (!Number.isNaN(max) && v > max) return true
  return false
}

// ---------------- DataTable columns ----------------
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'transfer_number', label: t('transfers_col_number') },
  { key: 'from_location', label: t('transfers_col_from') },
  { key: 'to_location', label: t('transfers_col_to') },
  { key: 'transfer_type', label: t('transfers_col_type') },
  { key: 'status', label: t('transfers_col_status') },
  { key: 'requested_at', label: t('transfers_col_requested_at') },
  { key: 'shipped_at', label: t('transfers_col_shipped_at') },
  { key: 'received_at', label: t('transfers_col_received_at') },
  { key: 'created_at', label: t('transfers_col_created_at'), align: 'right' },
])

const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

const confirmText = computed(() => {
  if (!confirmDialog.value) return ''
  const k = confirmDialog.value.kind
  if (k === 'request') return t('transfer_ext_confirm_request')
  if (k === 'approve') return t('transfer_ext_confirm_approve')
  return t('transfer_ext_confirm_ship')
})

const confirmTitle = computed(() => {
  if (!confirmDialog.value) return ''
  const k = confirmDialog.value.kind
  if (k === 'request') return t('transfer_action_request')
  if (k === 'approve') return t('transfer_action_approve')
  return t('transfer_action_ship')
})
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="t('transfers_ext_title')"
      :subtitle="t('transfers_ext_subtitle')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="sparkle"
          @click="openQuick"
        >
          {{ t('transfer_action_quick') }}
        </Button>
      </template>
    </PageHeader>

    <!-- Filter card -->
    <div class="card">
      <div class="toolbar" style="flex-wrap: wrap;">
        <div class="filter-cell">
          <Select
            :model-value="statusFilter ?? ''"
            :placeholder="t('transfers_filter_status')"
            :options="statuses.map(s => ({ value: s, label: t(`transfer_status_${s}`) }))"
            @update:model-value="(v: string) => statusFilter = v || undefined"
          />
        </div>
        <div class="filter-cell">
          <Select
            :model-value="typeFilter ?? ''"
            :placeholder="t('transfers_filter_type')"
            :options="transferTypes.map(v => ({ value: v, label: t(`transfer_type_${v}`) }))"
            @update:model-value="(v: string) => typeFilter = v || undefined"
          />
        </div>
        <div class="filter-cell filter-cell--wide">
          <Select
            :model-value="fromLocationFilter !== undefined ? String(fromLocationFilter) : ''"
            :placeholder="t('transfers_filter_from_location')"
            :options="locationOptions"
            @update:model-value="(v: string) => fromLocationFilter = v ? Number(v) : undefined"
          />
        </div>
        <div class="filter-cell filter-cell--wide">
          <Select
            :model-value="toLocationFilter !== undefined ? String(toLocationFilter) : ''"
            :placeholder="t('transfers_filter_to_location')"
            :options="locationOptions"
            @update:model-value="(v: string) => toLocationFilter = v ? Number(v) : undefined"
          />
        </div>
        <div class="toolbar-spacer">
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            :disabled="!statusFilter && !typeFilter && fromLocationFilter === undefined && toLocationFilter === undefined"
            @click="() => {
              statusFilter = undefined
              typeFilter = undefined
              fromLocationFilter = undefined
              toLocationFilter = undefined
            }"
          >
            {{ t('transfers_filter_all') }}
          </Button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- DataTable -->
      <DataTable
        :columns="columns"
        :rows="transfers"
        row-key="id"
        :loading="loading"
        expandable
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
        :empty-title="t('transfer_ext_empty')"
        empty-icon="box"
      >
        <template #cell.transfer_number="{ row: r }">
          <span class="cell-strong mono">{{ r.transfer_number }}</span>
        </template>

        <template #cell.from_location="{ row: r }">
          <span class="cell-muted">{{ locName(r.from_location) }}</span>
        </template>

        <template #cell.to_location="{ row: r }">
          <span class="cell-muted">{{ locName(r.to_location) }}</span>
        </template>

        <template #cell.transfer_type="{ row: r }">
          <Badge :tone="TYPE_TONE[r.transfer_type] ?? 'neutral'">
            {{ r.transfer_type ? t(`transfer_type_${r.transfer_type}`) : '—' }}
          </Badge>
        </template>

        <template #cell.status="{ row: r }">
          <Badge :tone="statusTone(r.status)" dot>
            {{ r.status ? t(`transfer_status_${r.status}`) : '—' }}
          </Badge>
        </template>

        <template #cell.requested_at="{ row: r }">
          <span class="mono cell-muted nowrap">{{ r.requested_at ? formatDateShort(r.requested_at) : '—' }}</span>
        </template>

        <template #cell.shipped_at="{ row: r }">
          <span class="mono cell-muted nowrap">{{ r.shipped_at ? formatDateShort(r.shipped_at) : '—' }}</span>
        </template>

        <template #cell.received_at="{ row: r }">
          <span class="mono cell-muted nowrap">{{ r.received_at ? formatDateShort(r.received_at) : '—' }}</span>
        </template>

        <template #cell.created_at="{ row: r }">
          <span class="mono cell-muted nowrap">{{ formatDateShort(r.created_at) }}</span>
        </template>

        <!-- Inline row actions -->
        <template #row-actions="{ row: r }">
          <IconAction
            icon="info"
            :title="t('transfer_ext_view_detail')"
            @click="openDetail(r)"
          />
          <IconAction
            v-if="canRequest(r)"
            icon="send"
            tone="primary"
            :title="t('transfer_action_request')"
            :disabled="actingId === r.id"
            @click="openConfirm(r, 'request')"
          />
          <IconAction
            v-if="canApprove(r)"
            icon="check"
            tone="success"
            :title="t('transfer_action_approve')"
            :disabled="actingId === r.id"
            @click="openConfirm(r, 'approve')"
          />
          <IconAction
            v-if="canShip(r)"
            icon="package"
            tone="primary"
            :title="t('transfer_action_ship')"
            :disabled="actingId === r.id"
            @click="openConfirm(r, 'ship')"
          />
          <IconAction
            v-if="canReceive(r)"
            icon="checkcircle"
            tone="success"
            :title="t('transfer_action_receive')"
            :disabled="actingId === r.id"
            @click="openReceive(r)"
          />
          <IconAction
            v-if="canCancel(r)"
            icon="close"
            tone="danger"
            :title="t('transfer_action_cancel')"
            :disabled="actingId === r.id"
            @click="openCancel(r)"
          />
        </template>

        <!-- Expanded row -->
        <template #expanded="{ row: r }">
          <div class="kpi__label" style="margin-bottom: 10px;">
            {{ t('transfer_ext_items_header') }}
          </div>
          <div class="tablewrap">
            <table
              class="dtable"
              style="background: var(--surface); border-radius: 10px; border: 1px solid var(--border); overflow: hidden;"
            >
              <thead>
                <tr>
                  <th>{{ t('transfer_field_stock_item') }}</th>
                  <th class="num">{{ t('transfer_field_requested_qty') }}</th>
                  <th class="num">{{ t('transfer_field_shipped_qty') }}</th>
                  <th class="num">{{ t('transfer_field_received_qty') }}</th>
                  <th>{{ t('transfer_field_unit') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(li, idx) in ((r.items ?? []) as any[])" :key="idx">
                  <td class="cell-strong">
                    {{ li.stock_item?.name ?? li.item?.name ?? '—' }}
                  </td>
                  <td class="num mono">{{ li.requested_qty ?? '—' }}</td>
                  <td class="num mono">{{ li.shipped_qty ?? '—' }}</td>
                  <td class="num mono">{{ li.received_qty ?? '—' }}</td>
                  <td class="cell-muted">{{ li.unit_short ?? li.unit?.short_name ?? '—' }}</td>
                </tr>
                <tr v-if="!(r.items?.length)">
                  <td colspan="5" class="center cell-muted">
                    {{ t('transfer_ext_no_items') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template #empty>
          <StateFill
            icon="box"
            :title="t('transfer_ext_empty')"
          />
        </template>
      </DataTable>
    </div>

    <!-- ============ CONFIRM modal (request/approve/ship) ============ -->
    <Modal
      :open="!!confirmDialog"
      :title="confirmTitle"
      :width="440"
      @close="confirmDialog = null"
    >
      <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
        {{ confirmText }}
      </p>
      <div v-if="confirmDialog?.row" style="margin-top: 12px; font-size: 13px;">
        <b class="mono">{{ confirmDialog.row.transfer_number }}</b>
      </div>

      <template #footer>
        <Button variant="ghost" @click="confirmDialog = null">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          :loading="actingId === confirmDialog?.row?.id"
          @click="confirmDialog && performAction(confirmDialog.row, confirmDialog.kind)"
        >
          {{ t('Confirm') }}
        </Button>
      </template>
    </Modal>

    <!-- ============ RECEIVE modal ============ -->
    <Modal
      :open="!!receiveDialog"
      :title="t('transfer_action_receive')"
      :subtitle="t('transfer_ext_confirm_receive')"
      :width="640"
      @close="receiveDialog = null"
    >
      <div v-if="receiveDialog?.row?.items?.length">
        <div
          v-for="it in (receiveDialog.row.items as any[])"
          :key="it.id"
          class="row receive-row"
          style="gap: 12px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;"
        >
          <div style="flex: 1; min-width: 0;">
            <div class="cell-strong">{{ it.stock_item?.name ?? '—' }}</div>
            <div class="cell-muted" style="font-size: 12px;">
              {{ t('transfer_field_shipped_qty') }}:
              <b class="mono">{{ shippedQtyOf(it) }}</b>
              <span v-if="it.unit_short" class="mono"> {{ it.unit_short }}</span>
            </div>
          </div>
          <div class="receive-qty-cell">
            <Field :error="receivedInvalid(it) ? t('transfer_ext_received_lt_shipped') : ''">
              <Input
                :model-value="getReceivedQty(it.id)"
                type="number"
                step="0.0001"
                min="0"
                :max="shippedQtyOf(it)"
                @update:model-value="(v: string) => setReceivedQty(it.id, v)"
              />
            </Field>
          </div>
        </div>
      </div>
      <div v-else class="cell-muted">
        {{ t('transfer_ext_no_items') }}
      </div>

      <template #footer>
        <Button variant="ghost" @click="receiveDialog = null">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          :loading="receiveDialog?.loading"
          :disabled="!receiveDialog?.row?.items?.length || (receiveDialog?.row?.items ?? []).some((it: any) => receivedInvalid(it))"
          @click="confirmReceive"
        >
          {{ t('transfer_action_receive') }}
        </Button>
      </template>
    </Modal>

    <!-- ============ CANCEL modal ============ -->
    <Modal
      :open="!!cancelDialog"
      :title="t('transfer_action_cancel')"
      :subtitle="t('transfer_ext_confirm_cancel')"
      :width="480"
      @close="cancelDialog = null"
    >
      <Field :label="t('transfer_field_reason')">
        <textarea
          v-if="cancelDialog"
          v-model="cancelDialog.reason"
          class="control"
          rows="3"
          style="padding: 8px 12px; resize: vertical; min-height: 80px;"
        />
      </Field>

      <template #footer>
        <Button variant="ghost" @click="cancelDialog = null">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          :loading="cancelDialog?.loading"
          @click="confirmCancel"
        >
          {{ t('transfer_action_cancel') }}
        </Button>
      </template>
    </Modal>

    <!-- ============ DETAIL modal ============ -->
    <Modal
      :open="!!detailDialog"
      :title="detailDialog?.row?.transfer_number ?? t('transfer_ext_view_detail')"
      :width="720"
      @close="detailDialog = null"
    >
      <div v-if="detailDialog?.row" style="display: grid; gap: 14px;">
        <!-- Top meta -->
        <div class="grid cols-2" style="gap: 12px;">
          <div>
            <div class="kpi__label">{{ t('transfers_col_from') }}</div>
            <div class="cell-strong">{{ locName(detailDialog.row.from_location) }}</div>
          </div>
          <div>
            <div class="kpi__label">{{ t('transfers_col_to') }}</div>
            <div class="cell-strong">{{ locName(detailDialog.row.to_location) }}</div>
          </div>
          <div>
            <div class="kpi__label">{{ t('transfers_col_type') }}</div>
            <Badge :tone="TYPE_TONE[detailDialog.row.transfer_type] ?? 'neutral'">
              {{ detailDialog.row.transfer_type ? t(`transfer_type_${detailDialog.row.transfer_type}`) : '—' }}
            </Badge>
          </div>
          <div>
            <div class="kpi__label">{{ t('transfers_col_status') }}</div>
            <Badge :tone="statusTone(detailDialog.row.status)" dot>
              {{ detailDialog.row.status ? t(`transfer_status_${detailDialog.row.status}`) : '—' }}
            </Badge>
          </div>
        </div>

        <!-- Lifecycle timeline -->
        <div>
          <div class="kpi__label" style="margin-bottom: 8px;">{{ t('transfers_col_created_at') }}</div>
          <div class="row" style="gap: 18px; flex-wrap: wrap; font-size: 13px;">
            <div>
              <div class="cell-muted">{{ t('transfers_col_requested_at') }}</div>
              <div class="mono">{{ detailDialog.row.requested_at ? formatDate(detailDialog.row.requested_at) : '—' }}</div>
            </div>
            <div>
              <div class="cell-muted">{{ t('transfers_col_approved_at') }}</div>
              <div class="mono">{{ detailDialog.row.approved_at ? formatDate(detailDialog.row.approved_at) : '—' }}</div>
            </div>
            <div>
              <div class="cell-muted">{{ t('transfers_col_shipped_at') }}</div>
              <div class="mono">{{ detailDialog.row.shipped_at ? formatDate(detailDialog.row.shipped_at) : '—' }}</div>
            </div>
            <div>
              <div class="cell-muted">{{ t('transfers_col_received_at') }}</div>
              <div class="mono">{{ detailDialog.row.received_at ? formatDate(detailDialog.row.received_at) : '—' }}</div>
            </div>
          </div>
        </div>

        <!-- Items -->
        <div>
          <div class="kpi__label" style="margin-bottom: 8px;">{{ t('transfer_ext_items_header') }}</div>
          <div class="tablewrap">
            <table class="dtable" style="background: var(--surface); border-radius: 10px; border: 1px solid var(--border); overflow: hidden;">
              <thead>
                <tr>
                  <th>{{ t('transfer_field_stock_item') }}</th>
                  <th class="num">{{ t('transfer_field_requested_qty') }}</th>
                  <th class="num">{{ t('transfer_field_approved_qty') }}</th>
                  <th class="num">{{ t('transfer_field_shipped_qty') }}</th>
                  <th class="num">{{ t('transfer_field_received_qty') }}</th>
                  <th>{{ t('transfer_field_unit') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(li, idx) in ((detailDialog.row.items ?? []) as any[])" :key="idx">
                  <td class="cell-strong">{{ li.stock_item?.name ?? '—' }}</td>
                  <td class="num mono">{{ li.requested_qty ?? '—' }}</td>
                  <td class="num mono">{{ li.approved_qty ?? '—' }}</td>
                  <td class="num mono">{{ li.shipped_qty ?? '—' }}</td>
                  <td class="num mono">{{ li.received_qty ?? '—' }}</td>
                  <td class="cell-muted">{{ li.unit_short ?? '—' }}</td>
                </tr>
                <tr v-if="!(detailDialog.row.items?.length)">
                  <td colspan="6" class="center cell-muted">
                    {{ t('transfer_ext_no_items') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="detailDialog.row.notes" style="font-size: 13px;">
          <div class="kpi__label">{{ t('transfer_field_notes') }}</div>
          <div>{{ detailDialog.row.notes }}</div>
        </div>
      </div>
      <div v-else-if="detailDialog?.loading" class="cell-muted">
        {{ t('Loading') }}…
      </div>

      <template #footer>
        <Button variant="ghost" @click="detailDialog = null">
          {{ t('Close') }}
        </Button>
      </template>
    </Modal>

    <!-- ============ QUICK TRANSFER modal ============ -->
    <Modal
      :open="quickDialog"
      :title="t('transfer_quick_title')"
      :subtitle="t('transfer_quick_subtitle')"
      :width="640"
      @close="quickDialog = false"
    >
      <div
        style="background: var(--surface-inset); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 14px; color: var(--text-secondary);"
      >
        <DesignIcon name="info" :size="16" style="vertical-align: -3px; margin-right: 6px;" />
        {{ t('transfer_ext_quick_help') }}
      </div>

      <div class="grid cols-2" style="gap: 12px;">
        <Field
          :label="t('transfer_field_from_location')"
          :error="quickErrors.from_location_id"
        >
          <Select
            :model-value="quickForm.from_location_id"
            :placeholder="t('transfer_ext_select_location')"
            :options="locationOptions"
            @update:model-value="(v: string) => quickForm.from_location_id = v"
          />
        </Field>

        <Field
          :label="t('transfer_field_to_location')"
          :error="quickErrors.to_location_id"
        >
          <Select
            :model-value="quickForm.to_location_id"
            :placeholder="t('transfer_ext_select_location')"
            :options="locationOptions"
            @update:model-value="(v: string) => quickForm.to_location_id = v"
          />
        </Field>

        <Field
          :label="t('transfer_field_stock_item')"
          :error="quickErrors.stock_item_id"
          style="grid-column: 1 / -1;"
        >
          <Select
            :model-value="quickForm.stock_item_id"
            :placeholder="t('transfer_ext_select_item')"
            :options="itemOptions"
            @update:model-value="(v: string) => quickForm.stock_item_id = v"
          />
        </Field>

        <Field
          :label="t('transfer_field_quantity')"
          :error="quickErrors.quantity"
        >
          <Input
            :model-value="quickForm.quantity"
            type="number"
            step="0.0001"
            min="0"
            @update:model-value="(v: string) => quickForm.quantity = v"
          />
        </Field>

        <Field :label="t('transfer_field_unit')">
          <Select
            :model-value="quickForm.unit_id"
            :placeholder="t('transfer_ext_select_unit')"
            :options="unitOptions"
            @update:model-value="(v: string) => quickForm.unit_id = v"
          />
        </Field>

        <Field :label="t('transfer_field_batch')" style="grid-column: 1 / -1;">
          <Select
            :model-value="quickForm.batch_id"
            :placeholder="t('transfer_ext_select_batch_optional')"
            :options="batchOptions"
            :disabled="!quickForm.from_location_id || !quickForm.stock_item_id"
            @update:model-value="(v: string) => quickForm.batch_id = v"
          />
        </Field>

        <Field :label="t('transfer_field_notes')" style="grid-column: 1 / -1;">
          <textarea
            v-model="quickForm.notes"
            class="control"
            rows="3"
            style="padding: 8px 12px; resize: vertical; min-height: 80px;"
          />
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" @click="quickDialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="sparkle"
          :loading="quickSaving"
          @click="submitQuick"
        >
          {{ t('transfer_action_quick') }}
        </Button>
      </template>
    </Modal>

    <!-- Lightweight inline toast (kept for compatibility with useNotify) -->
    <div
      v-if="snackbar"
      :class="['notify-snackbar', `tone-${snackbarColor}`]"
    >
      {{ snackbarMsg }}
    </div>
  </div>
</template>

<style scoped>
.cell-strong { color: var(--text); font-weight: 600; }
.cell-muted { color: var(--text-secondary); }
.mono { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
.nowrap { white-space: nowrap; }
.center { text-align: center; }
.num { text-align: right; }
.row { display: flex; align-items: center; }
.grid { display: grid; }
.cols-2 { grid-template-columns: 1fr 1fr; }

/* Toolbar filter cells: stay generous on desktop, drop to full width on mobile */
.filter-cell { width: 200px; min-width: 0; }
.filter-cell--wide { width: 220px; }
.toolbar-spacer { margin-left: auto; }
.receive-qty-cell { width: 160px; }
.tablewrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

/* Snackbar pinned bottom-right; clears bottom tabbar on phone */
.notify-snackbar {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 18px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  z-index: 9999;
  max-width: calc(100vw - 32px);
}

@media (max-width: 900px) {
  .filter-cell,
  .filter-cell--wide { width: 100%; flex: 1 1 100%; }
  .toolbar-spacer { margin-left: 0; width: 100%; }
  .cols-2 { grid-template-columns: 1fr; }
  .receive-qty-cell { width: 100%; }
}

@media (max-width: 768px) {
  /* Snackbar clears the bottom tabbar */
  .notify-snackbar {
    left: 16px;
    right: 16px;
    bottom: calc(var(--tabbar-h, 64px) + 16px);
    max-width: none;
  }
  /* Receive row stacks fully */
  .receive-row { gap: 8px; }
}
</style>

<style>
/* Global override: force modal sheet conversion on phones (overrides inline
   width style set by Modal primitive). Non-scoped because Modal teleports
   its content to <body>. */
@media (max-width: 768px) {
  .overlay > .modal {
    max-width: 100% !important;
  }
}
</style>

<route lang="yaml">
name: stock-transfers
meta:
  action: manage
  subject: all
</route>

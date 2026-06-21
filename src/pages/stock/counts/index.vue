<script setup lang="ts">
/* ============================================================
   ALPHA POS — Stock Counts (Workflow)
   Refactored to design primitives + design-shell.css.
   - Toolbar filters wrap on mobile (.filter-cell drops to 100%)
   - DataTable with row-action IconAction buttons
   - Modal-based create, action confirm, and per-item record flow
   - Inline counted/qty/notes inputs preserved (axios + computeds kept)
   ============================================================ */
import { stockApi as axios } from '@/plugins/axios'
import { useStateAction } from '@/composables/useStateAction'
import { COUNT_STATUS_COLOR as statusColor } from '@/constants/statusColors'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'

const { t } = useI18n({ useScope: 'global' })

const counts = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const statusFilter = ref<string | undefined>(undefined)
const locationFilter = ref<number | undefined>(undefined)
const typeFilter = ref<string | undefined>(undefined)

const locationsList = ref<any[]>([])

const createDialog = ref(false)
const saving = ref(false)

const form = ref({
  location_id: null as number | null,
  count_type: 'FULL',
  notes: '',
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDateShort } = useFormatters()

const statuses = ['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'CANCELED']
const countTypes = ['FULL', 'PARTIAL', 'CYCLE', 'SPOT']

// Status tone for design Badge
const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'> = {
  DRAFT: 'neutral',
  IN_PROGRESS: 'info',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  CANCELED: 'error',
}
function statusTone(s: string) {
  return STATUS_TONE[s] ?? (statusColor[s] === 'default' ? 'neutral' : (statusColor[s] as any)) ?? 'neutral'
}

async function loadCounts() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value)
      params.status = statusFilter.value
    if (locationFilter.value)
      params.location_id = locationFilter.value
    if (typeFilter.value)
      params.type = typeFilter.value

    const res = await axios.get('/counts/', { params })
    const d = res.data?.data ?? res.data

    counts.value = d?.counts ?? []
    total.value = d.pagination?.total_items ?? d.pagination?.total ?? counts.value.length
  }
  catch {
    notify(t('Failed to load stock counts'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadLocations() {
  try {
    const res = await axios.get('/locations/', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data

    locationsList.value = d?.locations ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadCounts(); loadLocations() })
watch([page, itemsPerPage], loadCounts)
watch([statusFilter, locationFilter, typeFilter], () => { page.value = 1; loadCounts() })

const locationOptions = computed(() =>
  locationsList.value.map(l => ({ value: String(l.id), label: l.name })),
)

async function createCount() {
  saving.value = true
  try {
    const payload: any = { ...form.value }
    if (!payload.notes)
      delete payload.notes
    await axios.post('/counts/', payload)
    notify(t('Stock count created'))
    createDialog.value = false
    await loadCounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error creating count'), 'error')
  }
  finally {
    saving.value = false
  }
}

const actionLabels: Record<string, string> = {
  start: 'Start Count',
  complete: 'Complete Count',
  approve: 'Approve Count',
  cancel: 'Cancel Count',
}

const { actionDialog, actionItem, actionType, actioning, openAction, doAction } = useStateAction('/counts/', loadCounts, notify, t, axios)

function canStart(item: any) { return item.status === 'DRAFT' }
function canComplete(item: any) { return item.status === 'IN_PROGRESS' }
function canApprove(item: any) { return item.status === 'PENDING_APPROVAL' }
function canCancel(item: any) { return !['APPROVED', 'CANCELED'].includes(item.status) }

// -------- Count detail + record_count UI --------
const detailDialog = ref(false)
const detailCount = ref<any>(null)
const detailLoading = ref(false)
const detailItems = ref<any[]>([])
const detailSummary = ref<any>(null)
const varianceCodes = ref<any[]>([])
const itemFilter = ref<'all' | 'pending' | 'counted' | 'variance'>('all')
const recordingItemId = ref<number | null>(null)

async function openDetail(count: any) {
  detailCount.value = count
  detailItems.value = []
  detailSummary.value = null
  itemFilter.value = 'all'
  detailDialog.value = true
  detailLoading.value = true
  try {
    const [dRes, vRes] = await Promise.all([
      axios.get(`/counts/${count.id}/`),
      axios.get('/variance-codes/'),
    ])
    const dd = dRes.data?.data ?? dRes.data
    const vd = vRes.data?.data ?? vRes.data

    detailCount.value = dd?.count ?? dd
    detailItems.value = (dd?.count?.items ?? dd?.items ?? []).map((i: any) => ({
      ...i,
      _input: i.counted_quantity ?? null,
      _reason_code_id: i.reason_code?.id ?? null,
      _notes: i.notes ?? '',
    }))
    detailSummary.value = dd?.count?.summary ?? dd?.summary ?? null
    varianceCodes.value = vd?.codes ?? vd?.items ?? []
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load count'), 'error')
  }
  finally {
    detailLoading.value = false
  }
}

const filteredItems = computed(() => {
  if (itemFilter.value === 'pending')
    return detailItems.value.filter((i: any) => i.counted_quantity == null)
  if (itemFilter.value === 'counted')
    return detailItems.value.filter((i: any) => i.counted_quantity != null)
  if (itemFilter.value === 'variance')
    return detailItems.value.filter((i: any) => i.counted_quantity != null && Number(i.variance ?? 0) !== 0)

  return detailItems.value
})

const isCountEditable = computed(
  () => detailCount.value?.status === 'DRAFT' || detailCount.value?.status === 'IN_PROGRESS',
)

async function recordItem(item: any) {
  if (!detailCount.value)
    return
  if (item._input == null || item._input === '') {
    notify(t('Enter a counted quantity'), 'error')

    return
  }
  recordingItemId.value = item.id
  try {
    const payload: any = {
      item_id: item.id,
      counted_quantity: item._input,
    }
    if (item._reason_code_id)
      payload.reason_code_id = item._reason_code_id
    if (item._notes)
      payload.notes = item._notes
    const res = await axios.post(`/counts/${detailCount.value.id}/record/`, payload)
    const d = res.data?.data ?? res.data
    const updated = d?.item ?? d

    if (updated) {
      const idx = detailItems.value.findIndex((i: any) => i.id === item.id)
      if (idx !== -1) {
        detailItems.value[idx] = {
          ...updated,
          _input: updated.counted_quantity,
          _reason_code_id: updated.reason_code?.id ?? null,
          _notes: updated.notes ?? '',
        }
      }
    }
    notify(t('Count recorded'))
    // refresh top-level list to update items_counted
    await loadCounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    recordingItemId.value = null
  }
}

function varianceTone(v: number): 'success' | 'warning' | 'error' {
  if (v === 0) return 'success'
  if (v < 0) return 'error'
  return 'warning'
}

// ---------------- DataTable columns ----------------
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'count_number', label: t('Count #') },
  { key: 'location_name', label: t('Location') },
  { key: 'count_type', label: t('Type') },
  { key: 'status', label: t('Status') },
  { key: 'items_counted', label: t('Items Counted'), align: 'right' },
  { key: 'created_at', label: t('Date'), align: 'right' },
])

const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

const itemFilterOptions = computed(() => [
  { value: 'all', label: t('All') },
  { value: 'pending', label: t('Pending') },
  { value: 'counted', label: t('Counted') },
  { value: 'variance', label: t('Variance') },
])
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="t('Stock Counts')"
      :subtitle="t('stock_counts_subtitle')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="createDialog = true"
        >
          {{ t('New Count') }}
        </Button>
      </template>
    </PageHeader>

    <!-- Filter card -->
    <div class="card">
      <div class="toolbar">
        <div class="filter-cell">
          <Select
            :model-value="statusFilter ?? ''"
            :placeholder="t('All Statuses')"
            :options="statuses.map(s => ({ value: s, label: t(`count_status_${s}`) }))"
            @update:model-value="(v: string) => statusFilter = v || undefined"
          />
        </div>
        <div class="filter-cell">
          <Select
            :model-value="locationFilter !== undefined ? String(locationFilter) : ''"
            :placeholder="t('All Locations')"
            :options="locationOptions"
            @update:model-value="(v: string) => locationFilter = v ? Number(v) : undefined"
          />
        </div>
        <div class="filter-cell">
          <Select
            :model-value="typeFilter ?? ''"
            :placeholder="t('All Types')"
            :options="countTypes.map(v => ({ value: v, label: t(`count_type_${v}`) }))"
            @update:model-value="(v: string) => typeFilter = v || undefined"
          />
        </div>
        <div class="toolbar-spacer">
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            :disabled="!statusFilter && !typeFilter && locationFilter === undefined"
            @click="() => {
              statusFilter = undefined
              typeFilter = undefined
              locationFilter = undefined
            }"
          >
            {{ t('Clear filters') }}
          </Button>
        </div>
      </div>

      <div class="card__divider" />

      <!-- DataTable -->
      <DataTable
        :columns="columns"
        :rows="counts"
        row-key="id"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
        :empty-title="t('stock_counts_empty_title')"
        :empty-sub="t('stock_counts_empty_sub')"
        empty-icon="inbox"
      >
        <template #cell.count_number="{ row: r }">
          <span class="cell-strong mono">{{ r.count_number }}</span>
        </template>

        <template #cell.location_name="{ row: r }">
          <span class="cell-muted">{{ r.location_name ?? r.location?.name ?? '—' }}</span>
        </template>

        <template #cell.count_type="{ row: r }">
          <Badge tone="info">
            {{ r.count_type ? t(`count_type_${r.count_type}`) : '—' }}
          </Badge>
        </template>

        <template #cell.status="{ row: r }">
          <Badge :tone="statusTone(r.status)" dot>
            {{ r.status ? t(`count_status_${r.status}`) : '—' }}
          </Badge>
        </template>

        <template #cell.items_counted="{ row: r }">
          <span class="mono num">{{ r.items_counted ?? r.count_items?.length ?? '—' }}</span>
        </template>

        <template #cell.created_at="{ row: r }">
          <span class="mono cell-muted nowrap">{{ formatDateShort(r.created_at) }}</span>
        </template>

        <!-- Inline row actions -->
        <template #row-actions="{ row: r }">
          <IconAction
            icon="menu"
            :title="t('Open / record')"
            @click="openDetail(r)"
          />
          <IconAction
            v-if="canStart(r)"
            icon="play"
            tone="warning"
            :title="t('Start')"
            @click="openAction(r, 'start')"
          />
          <IconAction
            v-if="canComplete(r)"
            icon="check"
            tone="primary"
            :title="t('Complete')"
            @click="openAction(r, 'complete')"
          />
          <IconAction
            v-if="canApprove(r)"
            icon="checkcircle"
            tone="success"
            :title="t('Approve')"
            @click="openAction(r, 'approve')"
          />
          <IconAction
            v-if="canCancel(r)"
            icon="close"
            tone="danger"
            :title="t('Cancel')"
            @click="openAction(r, 'cancel')"
          />
        </template>
      </DataTable>
    </div>

    <!-- ============ CREATE modal ============ -->
    <Modal
      :open="createDialog"
      :title="t('New Stock Count')"
      :subtitle="t('stock_counts_create_subtitle')"
      :width="440"
      @close="createDialog = false"
    >
      <div class="form-grid">
        <Field :label="t('Location')">
          <Select
            :model-value="form.location_id !== null ? String(form.location_id) : ''"
            :placeholder="t('Select location')"
            :options="locationOptions"
            @update:model-value="(v: string) => form.location_id = v ? Number(v) : null"
          />
        </Field>

        <Field :label="t('Count Type')">
          <Select
            :model-value="form.count_type"
            :options="countTypes.map(c => ({ value: c, label: t(`count_type_${c}`) }))"
            @update:model-value="(v: string) => form.count_type = v"
          />
        </Field>

        <Field :label="t('Notes')">
          <Input
            :model-value="form.notes"
            @update:model-value="(v: string) => form.notes = v"
          />
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" @click="createDialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          @click="createCount"
        >
          {{ t('Create') }}
        </Button>
      </template>
    </Modal>

    <!-- ============ ACTION CONFIRM modal ============ -->
    <Modal
      :open="actionDialog"
      :title="t(actionLabels[actionType] ?? actionType)"
      :width="440"
      @close="actionDialog = false"
    >
      <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">
        {{ t('Confirm action for count') }}
        <strong class="mono">{{ actionItem?.count_number }}</strong>?
      </p>

      <template #footer>
        <Button variant="ghost" @click="actionDialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          :variant="actionType === 'cancel' ? 'danger' : 'primary'"
          :loading="actioning"
          @click="doAction"
        >
          {{ t('Confirm') }}
        </Button>
      </template>
    </Modal>

    <!-- ============ DETAIL + RECORD modal ============ -->
    <Modal
      :open="detailDialog"
      :title="detailCount?.count_number ?? t('Count')"
      :subtitle="detailCount ? `${detailCount.location?.name ?? detailCount.location_name ?? ''} · ${detailCount.count_type ? t(`count_type_${detailCount.count_type}`) : ''}` : ''"
      :width="1100"
      @close="detailDialog = false"
    >
      <!-- status pill -->
      <div v-if="detailCount?.status" style="margin-bottom: 14px;">
        <Badge :tone="statusTone(detailCount.status)" dot>
          {{ t(`count_status_${detailCount.status}`) }}
        </Badge>
      </div>

      <!-- summary strip -->
      <div
        v-if="detailSummary"
        class="grid summary-grid"
        style="margin-bottom: 16px;"
      >
        <div class="summary-cell">
          <div class="kpi__label">{{ t('Total items') }}</div>
          <div class="summary-val mono">{{ detailSummary.total_items }}</div>
        </div>
        <div class="summary-cell">
          <div class="kpi__label" style="color: rgb(var(--v-theme-success-strong));">{{ t('Counted') }}</div>
          <div class="summary-val mono">{{ detailSummary.counted_items }}</div>
        </div>
        <div class="summary-cell">
          <div class="kpi__label" style="color: rgb(var(--v-theme-warning-strong));">{{ t('Pending') }}</div>
          <div class="summary-val mono">{{ detailSummary.pending_items }}</div>
        </div>
        <div class="summary-cell">
          <div class="kpi__label" style="color: rgb(var(--v-theme-error-strong));">{{ t('With variance') }}</div>
          <div class="summary-val mono">{{ detailSummary.items_with_variance }}</div>
        </div>
      </div>

      <!-- filter -->
      <div style="margin-bottom: 12px; max-width: 240px;">
        <Select
          :model-value="itemFilter"
          :options="itemFilterOptions"
          @update:model-value="(v: string) => itemFilter = v as any"
        />
      </div>

      <div v-if="detailLoading" class="cell-muted" style="margin-bottom: 8px;">
        {{ t('Loading') }}…
      </div>

      <!-- items table -->
      <div class="tablewrap">
        <table class="dtable" style="background: var(--surface); border-radius: 10px; border: 1px solid var(--border); overflow: hidden;">
          <thead>
            <tr>
              <th>{{ t('Item') }}</th>
              <th class="num">{{ t('System qty') }}</th>
              <th class="num" style="min-width: 160px;">{{ t('Counted qty') }}</th>
              <th class="num">{{ t('Variance') }}</th>
              <th style="min-width: 180px;">{{ t('Reason') }}</th>
              <th>{{ t('Notes') }}</th>
              <th class="num" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in filteredItems" :key="i.id">
              <td class="cell-strong">{{ i.stock_item?.name ?? i.item?.name ?? '—' }}</td>
              <td class="num mono">{{ i.system_quantity }} {{ i.stock_item?.unit?.short_name ?? '' }}</td>
              <td class="num">
                <Input
                  :model-value="i._input ?? ''"
                  type="number"
                  step="0.01"
                  :disabled="!isCountEditable"
                  @update:model-value="(v: string) => i._input = v === '' ? null : Number(v)"
                />
              </td>
              <td class="num">
                <Badge
                  v-if="i.counted_quantity != null"
                  :tone="varianceTone(Number(i.variance ?? 0))"
                >
                  <span class="mono">{{ i.variance ?? 0 }} ({{ i.variance_percentage ?? 0 }}%)</span>
                </Badge>
                <span v-else class="cell-muted">—</span>
              </td>
              <td>
                <Select
                  :model-value="i._reason_code_id !== null ? String(i._reason_code_id) : ''"
                  :placeholder="t('Reason')"
                  :options="varianceCodes.map((c: any) => ({ value: String(c.id), label: `${c.code} — ${c.name}` }))"
                  :disabled="!isCountEditable"
                  @update:model-value="(v: string) => i._reason_code_id = v ? Number(v) : null"
                />
              </td>
              <td>
                <Input
                  :model-value="i._notes"
                  :disabled="!isCountEditable"
                  @update:model-value="(v: string) => i._notes = v"
                />
              </td>
              <td class="num">
                <IconAction
                  icon="checkcircle"
                  tone="primary"
                  :title="t('Record')"
                  :disabled="!isCountEditable || recordingItemId === i.id"
                  @click="recordItem(i)"
                />
              </td>
            </tr>
            <tr v-if="!filteredItems.length && !detailLoading">
              <td colspan="7" class="center cell-muted" style="padding: 24px 12px;">
                {{ t('No items') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <Button variant="ghost" @click="detailDialog = false">
          {{ t('Close') }}
        </Button>
      </template>
    </Modal>

    <!-- Lightweight inline toast (kept for compatibility with useNotify) -->
    <div
      v-if="snackbar"
      :class="['notify-snackbar', `tone-${snackbarColor}`]"
      style="position: fixed; bottom: 24px; right: 24px; padding: 12px 18px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-md); z-index: 9999;"
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
.grid { display: grid; gap: 12px; }

/* Toolbar filter cells: stay generous on desktop, drop to full width on mobile */
.filter-cell { width: 220px; min-width: 0; }
.toolbar-spacer { margin-left: auto; }

/* Summary strip: 4 cols on desktop, 2 on tablet, 1 on phone */
.summary-grid { grid-template-columns: repeat(4, 1fr); }
.summary-cell { padding: 4px 0; }
.summary-val { font-size: 22px; font-weight: 700; color: var(--text); }

/* Create/detail modal form grid */
.form-grid { display: grid; gap: 12px; grid-template-columns: 1fr; }

/* Detail items table horizontal-scrolls below 900px so 7 cols don't break layout */
.tablewrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

@media (max-width: 900px) {
  .filter-cell { width: 100%; flex: 1 1 100%; }
  .toolbar-spacer { margin-left: 0; width: 100%; }
  .summary-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .summary-grid { grid-template-columns: 1fr; }
  .summary-val { font-size: 18px; }
}
</style>

<route lang="yaml">
name: stock-counts
meta:
  action: manage
  subject: all
</route>

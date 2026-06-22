<script setup lang="ts">
/* ============================================================
   Stock Adjustments — design primitive port
   Form-first: pick stock item + location + movement type + qty,
   optional batch / unit / unit cost / reference / notes, submit.
   Below: variance codes table with create / edit / seed defaults.
   All strings go through t(). Status / movement values render
   via t(`prefix_${VALUE}`).
   ============================================================ */
import { stockApi } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import StateFill from '@/components/design/StateFill.vue'
import Switch from '@/components/design/Switch.vue'
import { fmtDateTime } from '@/components/design/utils/format'

const { t } = useI18n({ useScope: 'global' })
const { notify } = useNotify()

/* ---------------- lookups ---------------- */
const stockItems = ref<{ value: string, label: string }[]>([])
const locations = ref<{ value: string, label: string }[]>([])
const units = ref<{ value: string, label: string }[]>([])
const batches = ref<{ value: string, label: string }[]>([])

async function loadLookup<T = any>(
  url: string,
  collectionKeys: string[],
  valueField: string,
  labelField: string,
): Promise<{ value: string, label: string }[]> {
  try {
    const res = await stockApi.get(url, { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data
    let list: T[] = []
    for (const k of collectionKeys) {
      if (Array.isArray(d?.[k])) { list = d[k]; break }
    }
    if (!list.length && Array.isArray(d)) list = d as T[]
    return list.map((x: any) => ({
      value: String(x[valueField]),
      label: String(x[labelField] ?? x[valueField] ?? ''),
    }))
  }
  catch {
    return []
  }
}

async function loadLookups() {
  const [si, locs, us, bs] = await Promise.all([
    loadLookup('/items/', ['items', 'stock_items'], 'id', 'name'),
    loadLookup('/locations/', ['locations'], 'id', 'name'),
    loadLookup('/units/', ['units'], 'id', 'short_name'),
    loadLookup('/batches/', ['batches'], 'id', 'batch_number'),
  ])
  stockItems.value = si
  locations.value = locs
  units.value = us
  batches.value = bs
}

/* ---------------- adjustment form ---------------- */
const MOVEMENT_TYPES_ADJUSTABLE = [
  { value: 'ADJUSTMENT_PLUS', direction: 'in' },
  { value: 'ADJUSTMENT_MINUS', direction: 'out' },
  { value: 'WASTE', direction: 'out' },
  { value: 'SPOILAGE', direction: 'out' },
  { value: 'RETURN_FROM_CUSTOMER', direction: 'in' },
  { value: 'RETURN_TO_SUPPLIER', direction: 'out' },
  { value: 'COUNT_ADJUSTMENT', direction: 'signed' },
  { value: 'OPENING_BALANCE', direction: 'in' },
]

const movementOptions = computed(() =>
  MOVEMENT_TYPES_ADJUSTABLE.map(m => ({
    value: m.value,
    label: t(`movement_${m.value}`),
  })),
)

interface AdjustForm {
  stock_item_id: string
  location_id: string
  movement_type: string
  quantity: string
  unit_id: string
  unit_cost: string
  batch_id: string
  reference_type: string
  reference_id: string
  notes: string
}

function emptyAdjust(): AdjustForm {
  return {
    stock_item_id: '',
    location_id: '',
    movement_type: 'ADJUSTMENT_PLUS',
    quantity: '',
    unit_id: '',
    unit_cost: '',
    batch_id: '',
    reference_type: '',
    reference_id: '',
    notes: '',
  }
}

const adjust = ref<AdjustForm>(emptyAdjust())
const submitting = ref(false)
const adjustErrors = ref<Record<string, string>>({})

function validateAdjust(): boolean {
  const e: Record<string, string> = {}
  if (!adjust.value.stock_item_id) e.stock_item_id = t('required_field')
  if (!adjust.value.location_id) e.location_id = t('required_field')
  if (!adjust.value.movement_type) e.movement_type = t('required_field')
  if (!adjust.value.quantity || Number.isNaN(Number(adjust.value.quantity)))
    e.quantity = t('required_field')
  adjustErrors.value = e
  return Object.keys(e).length === 0
}

async function submitAdjustment() {
  if (submitting.value) return
  if (!validateAdjust()) return
  submitting.value = true
  try {
    const payload: Record<string, any> = {
      stock_item_id: Number(adjust.value.stock_item_id),
      location_id: Number(adjust.value.location_id),
      movement_type: adjust.value.movement_type,
      quantity: Number(adjust.value.quantity),
    }
    if (adjust.value.unit_id) payload.unit_id = Number(adjust.value.unit_id)
    if (adjust.value.unit_cost) payload.unit_cost = Number(adjust.value.unit_cost)
    if (adjust.value.batch_id) payload.batch_id = Number(adjust.value.batch_id)
    if (adjust.value.reference_type) payload.reference_type = adjust.value.reference_type
    if (adjust.value.reference_id) payload.reference_id = Number(adjust.value.reference_id)
    if (adjust.value.notes) payload.notes = adjust.value.notes

    await stockApi.post('/adjust/', payload)
    notify(t('adjustment_success'))
    adjust.value = emptyAdjust()
    await loadHistory()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('adjustment_failed'), 'error')
  }
  finally {
    submitting.value = false
  }
}

/* ---------------- past adjustments history ---------------- */
const history = ref<any[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyPage = ref(1)
const historyPerPage = ref(10)

const MOVEMENT_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'> = {
  ADJUSTMENT_PLUS: 'success',
  ADJUSTMENT_MINUS: 'error',
  WASTE: 'error',
  SPOILAGE: 'error',
  RETURN_FROM_CUSTOMER: 'info',
  RETURN_TO_SUPPLIER: 'warning',
  COUNT_ADJUSTMENT: 'neutral',
  OPENING_BALANCE: 'info',
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const params: any = {
      page: historyPage.value,
      per_page: historyPerPage.value,
    }
    const res = await stockApi.get('/transactions/', { params })
    const d = res.data?.data ?? res.data
    const all = d?.transactions ?? d?.items ?? []
    // BE only accepts a single `type` value, not a list — filter adjustable types client-side
    const allowed = new Set(MOVEMENT_TYPES_ADJUSTABLE.map(m => m.value))
    history.value = all.filter((r: any) => allowed.has(r.movement_type))
    historyTotal.value = d?.pagination?.total ?? d?.count ?? history.value.length
  }
  catch {
    history.value = []
    historyTotal.value = 0
  }
  finally {
    historyLoading.value = false
  }
}

const historyColumns = computed<DataTableColumn<any>[]>(() => [
  { key: 'created_at', label: t('date_time_col'), sortable: false },
  { key: 'movement_type', label: t('movement_type') },
  { key: 'item', label: t('stock_item') },
  { key: 'location', label: t('location') },
  { key: 'quantity', label: t('quantity'), align: 'right' },
  { key: 'notes', label: t('notes') },
])

const historyPagination = computed(() => ({
  page: historyPage.value,
  perPage: historyPerPage.value,
  total: historyTotal.value,
  onPage: (p: number) => { historyPage.value = p },
  onPerPage: (n: number) => { historyPerPage.value = n; historyPage.value = 1 },
}))

function fmtDate(iso: string | undefined) {
  if (!iso) return '—'
  return fmtDateTime(iso)
}

function fmtQty(v: any) {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '')
}

/* ---------------- variance codes ---------------- */
const codes = ref<any[]>([])
const codesLoading = ref(false)
const codesActive = ref<string>('true')
const codesSearch = ref('')
const seeding = ref(false)

const codeModal = ref(false)
const codeMode = ref<'create' | 'edit'>('create')
const codeSaving = ref(false)
const codeSelected = ref<any>(null)
const codeForm = ref({
  code: '',
  name: '',
  description: '',
  requires_approval: false,
  is_active: true,
})
const codeErrors = ref<Record<string, string>>({})

const confirmSeed = ref(false)

async function loadCodes() {
  codesLoading.value = true
  try {
    const params: any = {}
    if (codesActive.value === 'true') params.active = true
    else if (codesActive.value === 'false') params.active = false
    const res = await stockApi.get('/variance-codes/', { params })
    const d = res.data?.data ?? res.data
    codes.value = d?.codes ?? d?.variance_codes ?? []
  }
  catch {
    codes.value = []
  }
  finally {
    codesLoading.value = false
  }
}

const filteredCodes = computed(() => {
  const q = codesSearch.value.trim().toLowerCase()
  if (!q) return codes.value
  return codes.value.filter((c: any) =>
    [c.code, c.name, c.description]
      .filter(Boolean)
      .some((s: string) => String(s).toLowerCase().includes(q)),
  )
})

function openCodeCreate() {
  codeMode.value = 'create'
  codeSelected.value = null
  codeForm.value = {
    code: '',
    name: '',
    description: '',
    requires_approval: false,
    is_active: true,
  }
  codeErrors.value = {}
  codeModal.value = true
}

function openCodeEdit(item: any) {
  codeMode.value = 'edit'
  codeSelected.value = item
  codeForm.value = {
    code: item.code ?? '',
    name: item.name ?? '',
    description: item.description ?? '',
    requires_approval: !!item.requires_approval,
    is_active: !!item.is_active,
  }
  codeErrors.value = {}
  codeModal.value = true
}

function validateCode(): boolean {
  const e: Record<string, string> = {}
  if (codeMode.value === 'create' && !codeForm.value.code.trim()) e.code = t('required_field')
  if (!codeForm.value.name.trim()) e.name = t('required_field')
  codeErrors.value = e
  return Object.keys(e).length === 0
}

async function saveCode() {
  if (codeSaving.value) return
  if (!validateCode()) return
  codeSaving.value = true
  try {
    if (codeMode.value === 'create') {
      await stockApi.post('/variance-codes/', {
        code: codeForm.value.code.trim().toUpperCase().slice(0, 20),
        name: codeForm.value.name.trim().slice(0, 100),
        description: codeForm.value.description,
        requires_approval: codeForm.value.requires_approval,
      })
      notify(t('variance_code_created'))
    }
    else {
      // BE does not currently expose PUT /variance-codes/<id>/ — edit is unavailable.
      // VarianceReasonCodeService.update exists but no URL is wired in stock/urls.py.
      notify(t('variance_code_edit_unavailable'), 'error')
      codeSaving.value = false
      return
    }
    codeModal.value = false
    await loadCodes()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('adjustment_failed'), 'error')
  }
  finally {
    codeSaving.value = false
  }
}

async function seedDefaults() {
  if (seeding.value) return
  seeding.value = true
  confirmSeed.value = false
  try {
    await stockApi.post('/variance-codes/seed/')
    notify(t('seed_success'))
    await loadCodes()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('adjustment_failed'), 'error')
  }
  finally {
    seeding.value = false
  }
}

const codeColumns = computed<DataTableColumn<any>[]>(() => [
  { key: 'code', label: t('code'), sortable: false },
  { key: 'name', label: t('name'), sortable: false },
  { key: 'description', label: t('description'), sortable: false },
  { key: 'requires_approval', label: t('requires_approval'), sortable: false },
  { key: 'is_active', label: t('status'), sortable: false },
  { key: 'actions', label: t('actions'), sortable: false, align: 'right' },
])

watch(codesActive, () => loadCodes())

onMounted(() => {
  loadLookups()
  loadHistory()
  loadCodes()
})

watch([historyPage, historyPerPage], () => loadHistory())
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="t('stock_adjust_title')"
      :subtitle="t('stock_adjust_subtitle')"
    />

    <!-- ============ ADJUSTMENT FORM CARD ============ -->
    <div class="card" style="margin-bottom: var(--sp-5);">
      <div class="toolbar wrap" style="border-bottom: 1px solid var(--border);">
        <div>
          <div class="kpi__label" style="font-weight: var(--fw-semibold); color: var(--text);">
            {{ t('new_adjustment') }}
          </div>
        </div>
      </div>

      <form
        class="adjust-form"
        @submit.prevent="submitAdjustment"
      >
        <!-- Stock item -->
        <div style="grid-column: span 6;">
          <Field :label="t('stock_item')" :error="adjustErrors.stock_item_id">
            <Select
              v-model="adjust.stock_item_id"
              :options="stockItems"
              :placeholder="t('select_stock_item')"
              :error="!!adjustErrors.stock_item_id"
            />
          </Field>
        </div>

        <!-- Location -->
        <div style="grid-column: span 6;">
          <Field :label="t('location')" :error="adjustErrors.location_id">
            <Select
              v-model="adjust.location_id"
              :options="locations"
              :placeholder="t('select_location')"
              :error="!!adjustErrors.location_id"
            />
          </Field>
        </div>

        <!-- Movement type -->
        <div style="grid-column: span 6;">
          <Field :label="t('movement_type')" :error="adjustErrors.movement_type">
            <Select
              v-model="adjust.movement_type"
              :options="movementOptions"
              :placeholder="t('select_movement_type')"
              :error="!!adjustErrors.movement_type"
            />
          </Field>
        </div>

        <!-- Quantity + Unit -->
        <div style="grid-column: span 3;">
          <Field :label="t('quantity')" :error="adjustErrors.quantity">
            <Input
              v-model="adjust.quantity"
              type="number"
              step="0.0001"
              min="0"
              :placeholder="'0'"
              :error="!!adjustErrors.quantity"
            />
          </Field>
        </div>
        <div style="grid-column: span 3;">
          <Field :label="t('unit')">
            <Select
              v-model="adjust.unit_id"
              :options="units"
              :placeholder="t('unit')"
            />
          </Field>
        </div>

        <!-- Unit cost + batch -->
        <div style="grid-column: span 4;">
          <Field :label="t('unit_cost')">
            <Input
              v-model="adjust.unit_cost"
              type="number"
              step="0.0001"
              min="0"
              :placeholder="'0.0000'"
            />
          </Field>
        </div>
        <div style="grid-column: span 4;">
          <Field :label="t('batch')">
            <Select
              v-model="adjust.batch_id"
              :options="batches"
              :placeholder="t('batch')"
            />
          </Field>
        </div>

        <!-- Reference type / id -->
        <div style="grid-column: span 4;">
          <Field :label="t('reference_type')">
            <Input
              v-model="adjust.reference_type"
              :placeholder="t('reference_type')"
              maxlength="50"
            />
          </Field>
        </div>
        <div style="grid-column: span 6;">
          <Field :label="t('reference_id')">
            <Input
              v-model="adjust.reference_id"
              type="number"
              min="0"
              step="1"
              :placeholder="'0'"
            />
          </Field>
        </div>

        <!-- Notes (full width) -->
        <div style="grid-column: span 12;">
          <Field :label="t('notes')">
            <div class="control" style="align-items: flex-start;">
              <textarea
                v-model="adjust.notes"
                rows="3"
                :placeholder="t('notes')"
                style="width: 100%; resize: vertical; background: transparent; border: 0; outline: none; color: var(--text); font: inherit;"
              />
            </div>
          </Field>
        </div>

        <!-- Submit -->
        <div class="adjust-form__submit" style="grid-column: span 12;">
          <Button
            type="button"
            variant="ghost"
            @click="adjust = emptyAdjust(); adjustErrors = {}"
          >
            {{ t('cancel') }}
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon="check"
            :loading="submitting"
            :disabled="submitting"
          >
            {{ t('submit_adjustment') }}
          </Button>
        </div>
      </form>
    </div>

    <!-- ============ HISTORY CARD ============ -->
    <div class="card" style="margin-bottom: var(--sp-5);">
      <div class="toolbar wrap">
        <div class="kpi__label" style="color: var(--text); font-weight: var(--fw-semibold);">
          {{ t('recent_adjustments') }}
        </div>
      </div>
      <div class="card__divider" />

      <DataTable
        :columns="historyColumns"
        :rows="history"
        row-key="id"
        :loading="historyLoading"
        :pagination="historyPagination"
        :per-page-options="[10, 25, 50]"
      >
        <template #cell.created_at="{ row }">
          <span class="mono cell-muted nowrap">{{ fmtDate(row.created_at) }}</span>
        </template>

        <template #cell.movement_type="{ row }">
          <Badge :tone="(MOVEMENT_TONE[row.movement_type] ?? 'neutral') as any" dot>
            {{ row.movement_type ? t(`movement_${row.movement_type}`) : '—' }}
          </Badge>
        </template>

        <template #cell.item="{ row }">
          <span class="cell-strong">{{ row.stock_item_name ?? '—' }}</span>
        </template>

        <template #cell.location="{ row }">
          <span class="cell-muted">{{ row.location_name ?? '—' }}</span>
        </template>

        <template #cell.quantity="{ row }">
          <span class="mono cell-strong">{{ fmtQty(row.quantity) }}</span>
        </template>

        <template #cell.notes="{ row }">
          <span class="cell-muted">{{ row.notes || '—' }}</span>
        </template>

        <template #empty>
          <StateFill
            icon="inbox"
            :title="t('no_data')"
          />
        </template>
      </DataTable>
    </div>

    <!-- ============ VARIANCE CODES CARD ============ -->
    <div class="card">
      <div class="toolbar wrap">
        <div style="flex: 1 1 220px; min-width: 0;">
          <div class="kpi__label" style="color: var(--text); font-weight: var(--fw-semibold);">
            {{ t('variance_codes_title') }}
          </div>
          <div class="page__subtitle" style="margin-top: 2px;">
            {{ t('variance_codes_subtitle') }}
          </div>
        </div>

        <div class="tool-search">
          <Input
            v-model="codesSearch"
            icon="search"
            :placeholder="t('search_placeholder')"
          />
        </div>

        <div class="tool-select">
          <Select
            v-model="codesActive"
            :options="[
              { value: '', label: t('filter_all') },
              { value: 'true', label: t('filter_active_only') },
              { value: 'false', label: t('inactive_status') },
            ]"
            :placeholder="t('status')"
          />
        </div>

        <Button
          variant="secondary"
          icon="download"
          :loading="seeding"
          @click="confirmSeed = true"
        >
          {{ t('seed_defaults') }}
        </Button>
        <Button
          variant="primary"
          icon="plus"
          @click="openCodeCreate"
        >
          {{ t('new_variance_code') }}
        </Button>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="codeColumns"
        :rows="filteredCodes"
        row-key="id"
        :loading="codesLoading"
      >
        <template #cell.code="{ row }">
          <span class="mono cell-strong">{{ row.code }}</span>
        </template>

        <template #cell.name="{ row }">
          <span class="cell-strong">{{ row.name }}</span>
        </template>

        <template #cell.description="{ row }">
          <span class="cell-muted">{{ row.description || '—' }}</span>
        </template>

        <template #cell.requires_approval="{ row }">
          <Badge :tone="row.requires_approval ? 'warning' : 'neutral'">
            {{ row.requires_approval ? t('yes') : t('no') }}
          </Badge>
        </template>

        <template #cell.is_active="{ row }">
          <Badge :tone="row.is_active ? 'success' : 'neutral'" dot>
            {{ t(row.is_active ? 'status_active' : 'status_inactive') }}
          </Badge>
        </template>

        <template #cell.actions>
          <div class="row" style="gap: 4px; justify-content: flex-end;">
            <!-- Edit disabled: BE has no PUT /variance-codes/<id>/ endpoint wired -->
            <span class="cell-muted">—</span>
          </div>
        </template>

        <template #empty>
          <StateFill
            icon="inbox"
            :title="t('no_data')"
          />
        </template>
      </DataTable>
    </div>

    <!-- ============ CREATE / EDIT VARIANCE CODE MODAL ============ -->
    <Modal
      :open="codeModal"
      :width="520"
      :title="codeMode === 'create' ? t('new_variance_code') : t('edit')"
      @close="codeModal = false"
    >
      <div style="display: grid; gap: var(--sp-3);">
        <Field :label="t('code')" :error="codeErrors.code">
          <Input
            v-model="codeForm.code"
            maxlength="20"
            :disabled="codeMode === 'edit'"
            :error="!!codeErrors.code"
            @update:model-value="(v) => codeForm.code = String(v).toUpperCase()"
          />
        </Field>

        <Field :label="t('name')" :error="codeErrors.name">
          <Input
            v-model="codeForm.name"
            maxlength="100"
            :error="!!codeErrors.name"
          />
        </Field>

        <Field :label="t('description')">
          <div class="control" style="align-items: flex-start;">
            <textarea
              v-model="codeForm.description"
              rows="3"
              style="width: 100%; resize: vertical; background: transparent; border: 0; outline: none; color: var(--text); font: inherit;"
            />
          </div>
        </Field>

        <label class="row" style="gap: 10px; cursor: pointer; padding: 4px 0;">
          <Switch v-model="codeForm.requires_approval" />
          <span style="font-size: 14px;">{{ t('requires_approval') }}</span>
        </label>

        <label v-if="codeMode === 'edit'" class="row" style="gap: 10px; cursor: pointer; padding: 4px 0;">
          <Switch v-model="codeForm.is_active" />
          <span style="font-size: 14px;">{{ t('active_status') }}</span>
        </label>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="codeSaving" @click="codeModal = false">
          {{ t('cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="codeSaving"
          :disabled="codeSaving"
          @click="saveCode"
        >
          {{ t('save') }}
        </Button>
      </template>
    </Modal>

    <!-- ============ SEED CONFIRM MODAL ============ -->
    <Modal
      :open="confirmSeed"
      :width="440"
      :title="t('seed_defaults')"
      @close="confirmSeed = false"
    >
      <div class="row" style="gap: 14px; align-items: flex-start;">
        <div class="kpi__icon t-info" style="width: 44px; height: 44px; flex: 0 0 44px;">
          <DesignIcon name="info" :size="22" />
        </div>
        <p style="margin: 0;">
          {{ t('seed_defaults_confirm') }}
        </p>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="seeding" @click="confirmSeed = false">
          {{ t('cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="download"
          :loading="seeding"
          :disabled="seeding"
          @click="seedDefaults"
        >
          {{ t('yes') }}
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

.toolbar.wrap {
  flex-wrap: wrap;
  gap: 12px;
}

.tool-search {
  width: 220px;
  max-width: 100%;
}

.tool-select {
  width: 180px;
  max-width: 100%;
}

.adjust-form {
  padding: var(--sp-5);
  display: grid;
  gap: var(--sp-4);
  grid-template-columns: repeat(12, 1fr);
}

.adjust-form__submit {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 1024px) {
  .adjust-form {
    grid-template-columns: 1fr;
  }

  .adjust-form > div[style*="grid-column"] {
    grid-column: span 1 !important;
  }
}

@media (max-width: 768px) {
  .tool-search,
  .tool-select {
    width: 100%;
    flex: 1 1 100%;
  }

  .adjust-form__submit {
    justify-content: stretch;
  }

  .adjust-form__submit > * {
    flex: 1 1 auto;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

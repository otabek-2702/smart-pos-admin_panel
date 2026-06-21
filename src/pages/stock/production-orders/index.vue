<script setup lang="ts">
/* ============================================================
   STOCK — PRODUCTION ORDERS
   Plain HTML + design primitives. No Vuetify on this surface.
   ============================================================ */
import type { DataTableColumn } from '@/components/design/DataTable.vue'
import { stockApi as axios } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable from '@/components/design/DataTable.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import { useStateAction } from '@/composables/useStateAction'
import { getStoredUserData } from '@/utils/storage'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDateShort } = useFormatters()

// ============================================================
// State
// ============================================================
const orders = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)

const statusFilter = ref<string>('')
const priorityFilter = ref<string>('')
const recipeFilter = ref<string>('')
const locationFilter = ref<string>('')

const recipesList = ref<any[]>([])
const locationsList = ref<any[]>([])

const createDialog = ref(false)
const saving = ref(false)
const expandedRow = ref<any>(null)

const form = ref({
  recipe_id: '' as string,
  batch_multiplier: 1,
  source_location_id: '' as string,
  output_location_id: '' as string,
  priority: 'NORMAL',
  planned_start_date: '',
  notes: '',
})

const STATUSES = ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'ON_HOLD'] as const
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const

const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'> = {
  DRAFT: 'neutral',
  PLANNED: 'info',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  CANCELED: 'error',
  ON_HOLD: 'warning',
}

const PRIORITY_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'error',
}

// ============================================================
// Filter options
// ============================================================
const statusFilterOptions = computed(() => [
  { value: '', label: t('All Statuses') },
  ...STATUSES.map(v => ({ value: v, label: t(`production_status_${v}`) })),
])
const priorityFilterOptions = computed(() => [
  { value: '', label: t('All Priorities') },
  ...PRIORITIES.map(v => ({ value: v, label: t(`priority_${v}`) })),
])
const recipeFilterOptions = computed(() => [
  { value: '', label: t('All Recipes') },
  ...recipesList.value.map(r => ({ value: String(r.id), label: r.name })),
])
const locationFilterOptions = computed(() => [
  { value: '', label: t('All Locations') },
  ...locationsList.value.map(l => ({ value: String(l.id), label: l.name })),
])

const recipeFormOptions = computed(() =>
  recipesList.value.map(r => ({ value: String(r.id), label: r.name })),
)
const locationFormOptions = computed(() =>
  locationsList.value.map(l => ({ value: String(l.id), label: l.name })),
)
const priorityFormOptions = computed(() =>
  PRIORITIES.map(v => ({ value: v, label: t(`priority_${v}`) })),
)

// ============================================================
// API
// ============================================================
async function loadOrders() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value)
      params.status = statusFilter.value
    if (priorityFilter.value)
      params.priority = priorityFilter.value
    if (recipeFilter.value)
      params.recipe_id = recipeFilter.value
    if (locationFilter.value)
      params.location_id = locationFilter.value

    const res = await axios.get('/production-orders/', { params })
    const d = res.data?.data ?? res.data

    orders.value = d?.orders ?? []
    total.value = d.pagination?.total_items ?? d.pagination?.total ?? orders.value.length
  }
  catch {
    notify(t('Failed to load production orders'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [recRes, locRes] = await Promise.all([
      axios.get('/recipes/', { params: { per_page: 300, is_active: true } }),
      axios.get('/locations/', { params: { per_page: 200 } }),
    ])

    const recD = recRes.data?.data ?? recRes.data
    const locD = locRes.data?.data ?? locRes.data

    recipesList.value = recD?.recipes ?? []
    locationsList.value = locD?.locations ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadOrders(); loadMeta() })
watch([page, itemsPerPage], loadOrders)
watch([statusFilter, priorityFilter, recipeFilter, locationFilter], () => { page.value = 1; loadOrders() })

// ============================================================
// Create
// ============================================================
function openCreate() {
  form.value = {
    recipe_id: '',
    batch_multiplier: 1,
    source_location_id: '',
    output_location_id: '',
    priority: 'NORMAL',
    planned_start_date: '',
    notes: '',
  }
  createDialog.value = true
}

function closeCreate() {
  if (saving.value)
    return
  createDialog.value = false
}

async function createOrder() {
  if (!form.value.source_location_id || !form.value.output_location_id) {
    notify(t('Source and output locations are required'), 'error')

    return
  }
  saving.value = true
  try {
    const userData = getStoredUserData()
    const payload: any = {
      recipe_id: form.value.recipe_id ? Number(form.value.recipe_id) : null,
      batch_multiplier: form.value.batch_multiplier,
      source_location_id: Number(form.value.source_location_id),
      output_location_id: Number(form.value.output_location_id),
      priority: form.value.priority,
      created_by_id: userData.id,
    }
    if (form.value.planned_start_date)
      payload.planned_start_date = form.value.planned_start_date
    if (form.value.notes)
      payload.notes = form.value.notes
    await axios.post('/production-orders/', payload)
    notify(t('Production order created'))
    createDialog.value = false
    await loadOrders()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error creating order'), 'error')
  }
  finally {
    saving.value = false
  }
}

// ============================================================
// Status transitions
// ============================================================
const actionTitleKey: Record<string, string> = {
  plan: 'Plan Order',
  start: 'Start Production',
  complete: 'Complete Production',
  cancel: 'Cancel Order',
  hold: 'Put on Hold',
  resume: 'Resume Order',
}

const { actionDialog, actionItem, actionType, actioning, openAction, doAction } = useStateAction('/production-orders/', loadOrders, notify, t, axios)

function canPlan(item: any) { return item.status === 'DRAFT' }
function canStart(item: any) { return item.status === 'PLANNED' }
function canComplete(item: any) { return item.status === 'IN_PROGRESS' }
function canHold(item: any) { return item.status === 'IN_PROGRESS' }
function canResume(item: any) { return item.status === 'ON_HOLD' }
function canCancel(item: any) { return !['COMPLETED', 'CANCELED'].includes(item.status) }

// ============================================================
// Columns
// ============================================================
const columns: DataTableColumn<any>[] = [
  { key: 'order_number', label: t('Order #'), sortable: false },
  { key: 'recipe_name', label: t('Recipe'), sortable: false },
  { key: 'status', label: t('Status'), sortable: false, width: 130 },
  { key: 'priority', label: t('Priority'), sortable: false, width: 110 },
  { key: 'output', label: t('Output'), sortable: false, align: 'right', width: 140 },
  { key: 'planned_start', label: t('Planned Start'), sortable: false, width: 140 },
  { key: 'expand', label: '', sortable: false, width: 44 },
]

const tablePagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (n: number) => { page.value = n },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

// ============================================================
// Helpers
// ============================================================
function recipeName(row: any): string {
  return row.recipe_name ?? row.recipe?.name ?? '—'
}
function outputUnit(row: any): string {
  return typeof row.output_unit === 'string' ? row.output_unit : row.output_unit?.short_name ?? ''
}
function locationName(loc: any): string {
  return typeof loc === 'string' ? loc : (loc?.name ?? '—')
}

function toggleExpand(row: any) {
  expandedRow.value = expandedRow.value?.id === row.id ? null : row
}

// ============================================================
// ESC handler
// ============================================================
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape')
    return
  if (actionDialog.value) { actionDialog.value = false; e.preventDefault(); return }
  if (createDialog.value) { closeCreate(); e.preventDefault() }
}

onMounted(() => { window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Production Orders')"
      :subtitle="t('production_orders_subtitle')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('New Order') }}
        </Button>
      </template>
    </PageHeader>

    <Card>
      <!-- Toolbar -->
      <div class="toolbar toolbar--wrap">
        <div class="tb-filter tb-filter--wide">
          <Select
            v-model="recipeFilter"
            icon="filter"
            :placeholder="t('All Recipes')"
            :options="recipeFilterOptions"
          />
        </div>
        <div class="tb-filter">
          <Select
            v-model="locationFilter"
            icon="filter"
            :placeholder="t('All Locations')"
            :options="locationFilterOptions"
          />
        </div>
        <div class="tb-filter">
          <Select
            v-model="statusFilter"
            icon="filter"
            :placeholder="t('All Statuses')"
            :options="statusFilterOptions"
          />
        </div>
        <div class="tb-filter">
          <Select
            v-model="priorityFilter"
            icon="filter"
            :placeholder="t('All Priorities')"
            :options="priorityFilterOptions"
          />
        </div>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="columns"
        :rows="orders"
        row-key="id"
        :loading="loading"
        :pagination="tablePagination"
        :empty-title="t('production_orders_empty_title')"
        :empty-sub="t('production_orders_empty_hint')"
      >
        <template #cell.order_number="{ row }">
          <span class="cell-strong">{{ row.order_number }}</span>
        </template>

        <template #cell.recipe_name="{ row }">
          {{ recipeName(row) }}
        </template>

        <template #cell.status="{ row }">
          <Badge :tone="STATUS_TONE[row.status] ?? 'neutral'">
            {{ t(`production_status_${row.status}`) }}
          </Badge>
        </template>

        <template #cell.priority="{ row }">
          <Badge :tone="PRIORITY_TONE[row.priority] ?? 'neutral'">
            {{ t(`priority_${row.priority}`) }}
          </Badge>
        </template>

        <template #cell.output="{ row }">
          <span class="mono">{{ row.expected_output_qty ?? '—' }}</span>
          <span
            v-if="outputUnit(row)"
            class="cell-muted"
          > {{ outputUnit(row) }}</span>
        </template>

        <template #cell.planned_start="{ row }">
          {{ formatDateShort(row.planned_start ?? row.planned_start_date) }}
        </template>

        <template #cell.expand="{ row }">
          <IconAction
            :icon="expandedRow?.id === row.id ? 'chevup' : 'chevdown'"
            :title="t('Details')"
            @click="toggleExpand(row)"
          />
        </template>

        <template #row-actions="{ row }">
          <IconAction
            v-if="canPlan(row)"
            icon="calendar"
            tone="primary"
            :title="t('Plan')"
            @click="openAction(row, 'plan')"
          />
          <IconAction
            v-if="canStart(row)"
            icon="play"
            tone="success"
            :title="t('Start')"
            @click="openAction(row, 'start')"
          />
          <IconAction
            v-if="canComplete(row)"
            icon="check"
            tone="primary"
            :title="t('Complete')"
            @click="openAction(row, 'complete')"
          />
          <IconAction
            v-if="canHold(row)"
            icon="pause"
            tone="warning"
            :title="t('Hold')"
            @click="openAction(row, 'hold')"
          />
          <IconAction
            v-if="canResume(row)"
            icon="play"
            tone="success"
            :title="t('Resume')"
            @click="openAction(row, 'resume')"
          />
          <IconAction
            v-if="canCancel(row)"
            icon="close"
            tone="danger"
            :title="t('Cancel')"
            @click="openAction(row, 'cancel')"
          />
        </template>
      </DataTable>

      <!-- Expanded detail panel -->
      <div
        v-if="expandedRow"
        class="expand-panel"
      >
        <div class="expand-row">
          <span><span class="cell-muted">{{ t('Recipe') }}: </span>{{ recipeName(expandedRow) }}</span>
          <span><span class="cell-muted">{{ t('Multiplier') }}: </span>×{{ expandedRow.batch_multiplier ?? 1 }}</span>
          <span v-if="expandedRow.source_location"><span class="cell-muted">{{ t('Source') }}: </span>{{ locationName(expandedRow.source_location) }}</span>
          <span v-if="expandedRow.output_location"><span class="cell-muted">{{ t('Output') }}: </span>{{ locationName(expandedRow.output_location) }}</span>
        </div>
        <div
          v-if="expandedRow.notes"
          class="expand-notes"
        >
          {{ expandedRow.notes }}
        </div>
      </div>
    </Card>

    <!-- Create Modal -->
    <Modal
      :open="createDialog"
      :title="t('New Production Order')"
      :subtitle="t('production_orders_subtitle')"
      @close="closeCreate"
    >
      <form @submit.prevent="createOrder">
        <div class="form-grid">
          <Field
            :label="t('Recipe')"
            class="span-2"
          >
            <Select
              v-model="form.recipe_id"
              :options="recipeFormOptions"
              :placeholder="t('production_orders_pick_recipe')"
            />
          </Field>

          <Field :label="t('Batch Multiplier')">
            <Input
              v-model.number="form.batch_multiplier"
              type="number"
            />
          </Field>

          <Field :label="t('Priority')">
            <Select
              v-model="form.priority"
              :options="priorityFormOptions"
            />
          </Field>

          <Field :label="t('Source Location *')">
            <Select
              v-model="form.source_location_id"
              :options="locationFormOptions"
              :placeholder="t('production_orders_pick_source')"
            />
          </Field>

          <Field :label="t('Output Location *')">
            <Select
              v-model="form.output_location_id"
              :options="locationFormOptions"
              :placeholder="t('production_orders_pick_output')"
            />
          </Field>

          <Field :label="t('Planned Start')">
            <Input
              v-model="form.planned_start_date"
              type="date"
            />
          </Field>

          <Field
            :label="t('Notes')"
            class="span-2"
          >
            <Input
              v-model="form.notes"
              :placeholder="t('production_orders_notes_placeholder')"
            />
          </Field>
        </div>
      </form>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="saving"
          @click="closeCreate"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="saving"
          :disabled="saving"
          @click="createOrder"
        >
          {{ t('Create') }}
        </Button>
      </template>
    </Modal>

    <!-- Action Confirm Modal -->
    <Modal
      :open="actionDialog"
      :title="t(actionTitleKey[actionType] ?? actionType)"
      :subtitle="actionItem?.order_number ?? ''"
      @close="actionDialog = false"
    >
      <div style="padding:4px 2px 8px;color:rgb(var(--v-theme-text-secondary));">
        {{ t('Confirm action for order') }} <strong>{{ actionItem?.order_number }}</strong>?
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="actioning"
          @click="actionDialog = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          :variant="actionType === 'cancel' ? 'danger' : 'primary'"
          icon="check"
          :loading="actioning"
          :disabled="actioning"
          @click="doAction"
        >
          {{ t('Confirm') }}
        </Button>
      </template>
    </Modal>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
name: stock-production-orders
meta:
  action: manage
  subject: all
</route>

<style scoped>
/* ============================================================
   Toolbar — wraps onto multiple rows, filters collapse on mobile
   ============================================================ */
.toolbar--wrap {
  flex-wrap: wrap;
}

.tb-filter {
  width: 180px;
  min-width: 0;
}

.tb-filter--wide {
  width: 220px;
}

/* ============================================================
   Create form grid
   ============================================================ */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-grid .span-2 {
  grid-column: span 2;
}

/* ============================================================
   Expanded detail panel (replaces VDataTable expanded-row)
   ============================================================ */
.expand-panel {
  padding: 14px 18px;
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.06);
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.expand-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 13px;
  line-height: 1.5;
}

.expand-notes {
  margin-block-start: 8px;
  font-size: 13px;
  color: rgb(var(--v-theme-text-secondary));
}

/* ============================================================
   Mobile collapse
   ============================================================ */
@media (max-width: 900px) {
  .tb-filter,
  .tb-filter--wide {
    width: 100%;
    flex: 1 1 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-grid .span-2 {
    grid-column: span 1;
  }

  .expand-row {
    gap: 8px 16px;
  }
}
</style>

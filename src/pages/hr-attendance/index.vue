<script setup lang="ts">
/* ============================================================
   HR ATTENDANCE — daily check-in / check-out log
   Plain HTML + design primitives (PageHeader / Card / DataTable /
   Input / Select / Badge / DesignIcon). No Vuetify on this surface.
   ============================================================ */
import type { DataTableColumn } from '@/components/design/DataTable.vue'
import { hrApi as axios } from '@/plugins/axios'
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
import Select from '@/components/design/Select.vue'

const { t, te } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

// ============================================================
// State
// ============================================================
const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(20)
const dateFilter = ref('')
const statusFilter = ref<string>('')
const employeeFilter = ref<string>('')
const employees = ref<any[]>([])

// Daily summary (from /attendance/daily-report/) — scoped to a single
// day so a manager can glance at "who's on the floor today" independent
// of the table filters below.
const summary = ref<any>(null)

const TODAY = new Date().toISOString().slice(0, 10)

// ============================================================
// Options
// ============================================================
const STATUS_VALUES = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'] as const

const statusOptions = computed(() => STATUS_VALUES.map(v => ({
  value: v,
  label: te(`attendance_status_${v}`) ? t(`attendance_status_${v}`) : v,
})))

const employeeOptions = computed(() => employees.value.map((e: any) => ({
  value: String(e.value ?? e.id),
  label: (e.title ?? (`${e.user?.first_name ?? ''} ${e.user?.last_name ?? ''}`.trim() || e.user?.email)) || String(e.id ?? ''),
})))

function formatTime(val: string | null | undefined): string {
  if (!val)
    return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime()))
    return String(val)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// ============================================================
// Tone map
// ============================================================
const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'error',
  HALF_DAY: 'info',
  ON_LEAVE: 'neutral',
}

// ============================================================
// Daily summary — the KPI strip follows the date filter (or today)
// ============================================================
const summaryDate = computed(() => dateFilter.value || TODAY)
const summaryDateLabel = computed(() => formatDate(summaryDate.value))
const isToday = computed(() => summaryDate.value === TODAY)

// ============================================================
// API
// ============================================================
async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (dateFilter.value)
      params.date = dateFilter.value
    if (statusFilter.value)
      params.status = statusFilter.value
    if (employeeFilter.value)
      params.employee_id = employeeFilter.value
    const res = await axios.get('/attendance/', { params })
    const d = res.data?.data ?? res.data

    items.value = d?.attendances ?? d?.attendance ?? d?.records ?? d?.items ?? []
    total.value = d?.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadSummary() {
  try {
    const res = await axios.get('/attendance/daily-report/', { params: { date: summaryDate.value } })
    const d = res.data?.data ?? res.data

    summary.value = d?.stats ?? null
  }
  catch { /* summary is best-effort — never block the table */ }
}

async function loadEmployees() {
  try {
    const res = await axios.get('/employees/', { params: { per_page: 500 } })
    const d = res.data?.data ?? res.data
    employees.value = (d?.employees ?? d?.items ?? d?.results ?? []).map((e: any) => ({
      title: `${e.user?.first_name ?? ''} ${e.user?.last_name ?? ''}`.trim() || e.user?.email || e.id,
      value: e.id,
    }))
  }
  catch {}
}

onMounted(() => { load(); loadSummary(); loadEmployees() })
watch([page, itemsPerPage], load)
watch([dateFilter, statusFilter, employeeFilter], () => { page.value = 1; load() })
watch(summaryDate, loadSummary)

// ============================================================
// Columns
// ============================================================
const columns: DataTableColumn<any>[] = [
  { key: 'date', label: t('Date'), sortable: false, width: 130 },
  { key: 'employee', label: t('Employee'), sortable: false },
  { key: 'check_in', label: t('Check In'), sortable: false, width: 120 },
  { key: 'check_out', label: t('Check Out'), sortable: false, width: 120 },
  { key: 'status', label: t('Status'), sortable: false, width: 120 },
  { key: 'work_hours', label: t('Hours'), sortable: false, align: 'right', width: 100 },
  { key: 'overtime_hours', label: t('Overtime'), sortable: false, align: 'right', width: 110 },
  { key: 'source', label: t('Source'), sortable: false, width: 130 },
]

const tablePagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (n: number) => { page.value = n },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

// ============================================================
// Filter chips
// ============================================================
const activeFilters = computed(() => {
  const out: { k: string; label: string; val: string; clear: () => void }[] = []
  if (dateFilter.value) {
    out.push({
      k: 'don',
      label: t('On date'),
      val: dateFilter.value,
      clear: () => { dateFilter.value = '' },
    })
  }
  if (statusFilter.value) {
    out.push({
      k: 'st',
      label: t('Status'),
      val: te(`attendance_status_${statusFilter.value}`) ? t(`attendance_status_${statusFilter.value}`) : statusFilter.value,
      clear: () => { statusFilter.value = '' },
    })
  }
  if (employeeFilter.value) {
    const emp = employees.value.find((e: any) => String(e.value) === employeeFilter.value)
    out.push({
      k: 'emp',
      label: t('Employee'),
      val: emp?.title ?? employeeFilter.value,
      clear: () => { employeeFilter.value = '' },
    })
  }
  return out
})

function clearAllFilters() {
  dateFilter.value = ''
  statusFilter.value = ''
  employeeFilter.value = ''
}

// ============================================================
// Manual record (check-in / check-out) — POST /attendance/check-in/
// and /attendance/check-out/ with { employee_id, notes }.
// ============================================================
const recordOpen = ref(false)
const recordSaving = ref(false)
const recordEmployeeId = ref<string>('')
const recordAction = ref<'check_in' | 'check_out'>('check_in')
const recordNotes = ref('')

const actionOptions = computed(() => [
  { value: 'check_in', label: t('hr_attendance_action_check_in') },
  { value: 'check_out', label: t('hr_attendance_action_check_out') },
])

function openRecord() {
  recordEmployeeId.value = ''
  recordAction.value = 'check_in'
  recordNotes.value = ''
  recordOpen.value = true
}

function closeRecord() {
  if (recordSaving.value)
    return
  recordOpen.value = false
}

async function submitRecord() {
  if (!recordEmployeeId.value) {
    notify(t('hr_attendance_no_employee'), 'error')
    return
  }
  recordSaving.value = true
  try {
    const url = recordAction.value === 'check_in' ? '/attendance/check-in/' : '/attendance/check-out/'
    await axios.post(url, {
      employee_id: Number(recordEmployeeId.value),
      notes: recordNotes.value || undefined,
    })
    notify(recordAction.value === 'check_in' ? t('hr_attendance_checked_in') : t('hr_attendance_checked_out'))
    recordOpen.value = false
    await Promise.all([load(), loadSummary()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    recordSaving.value = false
  }
}

// ============================================================
// Quick per-row check-out — for today's still-open sessions
// ============================================================
const rowBusyId = ref<number | null>(null)

function canCheckOut(row: any): boolean {
  return row?.date === TODAY && !!row?.check_in && !row?.check_out
}

async function rowCheckOut(row: any) {
  const empId = row?.employee?.id
  if (!empId || rowBusyId.value !== null)
    return
  rowBusyId.value = row.id
  try {
    await axios.post('/attendance/check-out/', { employee_id: empId })
    notify(t('hr_attendance_checked_out'))
    await Promise.all([load(), loadSummary()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    rowBusyId.value = null
  }
}

// ============================================================
// ESC handler
// ============================================================
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape')
    return
  if (recordOpen.value) { closeRecord(); e.preventDefault() }
}

onMounted(() => { window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Attendance')"
      :subtitle="t('hr_attendance_subtitle')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="clock"
          @click="openRecord"
        >
          {{ t('hr_attendance_record_title') }}
        </Button>
      </template>
    </PageHeader>

    <!-- Daily summary KPI strip -->
    <div class="kpi-head">
      <span class="kpi-head__label">
        {{ isToday ? t('Today') : summaryDateLabel }}
      </span>
      <span
        v-if="summary"
        class="kpi-head__total"
      >{{ t('Total') }}: <b>{{ summary.total ?? 0 }}</b></span>
    </div>
    <div class="kpi-grid">
      <Kpi
        :data="{
          label: t('attendance_status_PRESENT'),
          value: summary ? (summary.present ?? 0) : null,
          icon: 'check',
          tone: 'success',
        }"
      />
      <Kpi
        :data="{
          label: t('attendance_status_LATE'),
          value: summary ? (summary.late ?? 0) : null,
          icon: 'clock',
          tone: 'warning',
        }"
      />
      <Kpi
        :data="{
          label: t('attendance_status_ABSENT'),
          value: summary ? (summary.absent ?? 0) : null,
          icon: 'close',
          tone: 'error',
        }"
      />
      <Kpi
        :data="{
          label: t('attendance_status_ON_LEAVE'),
          value: summary ? (summary.on_leave ?? 0) : null,
          icon: 'calendar',
          tone: 'info',
        }"
      />
    </div>

    <Card>
      <!-- Toolbar with filters -->
      <div class="toolbar hr-att__toolbar">
        <div class="hr-att__filter">
          <Input
            v-model="dateFilter"
            type="date"
            icon="calendar"
            :placeholder="t('On date')"
          />
        </div>
        <div class="hr-att__filter">
          <Select
            v-model="statusFilter"
            icon="filter"
            :placeholder="t('Status')"
            :options="statusOptions"
          />
        </div>
        <div class="hr-att__filter hr-att__filter--wide">
          <Select
            v-model="employeeFilter"
            icon="user"
            :placeholder="t('Employee')"
            :options="employeeOptions"
          />
        </div>
      </div>

      <!-- Active filter chips -->
      <div
        v-if="activeFilters.length > 0"
        class="toolbar"
        style="padding-top:0;"
      >
        <div class="chips">
          <span
            class="tertiary"
            style="font-size:13px;margin-right:2px;"
          >{{ t('Filters') }}:</span>
          <span
            v-for="f in activeFilters"
            :key="f.k"
            class="chip"
          >
            <span>{{ f.label }}: <b>{{ f.val }}</b></span>
            <span
              class="chip__x"
              @click="f.clear()"
            >
              <DesignIcon
                name="close"
                :size="13"
              />
            </span>
          </span>
          <button
            class="chip--clear"
            @click="clearAllFilters"
          >
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="columns"
        :rows="items"
        row-key="id"
        :loading="loading"
        :pagination="tablePagination"
        :empty-title="t('hr_attendance_empty_title')"
        :empty-sub="t('hr_attendance_empty_sub')"
        empty-icon="calendar"
      >
        <template #cell.date="{ row }">
          <span class="cell-strong">{{ row.date ? formatDate(row.date) : '—' }}</span>
        </template>

        <template #cell.employee="{ row }">
          <div class="cell-strong">
            {{ `${row.employee?.user?.first_name ?? ''} ${row.employee?.user?.last_name ?? ''}`.trim() || '—' }}
          </div>
        </template>

        <template #cell.check_in="{ row }">
          <span class="mono cell-muted">{{ formatTime(row.check_in) }}</span>
        </template>

        <template #cell.check_out="{ row }">
          <span class="mono cell-muted">{{ formatTime(row.check_out) }}</span>
        </template>

        <template #cell.status="{ row }">
          <Badge :tone="STATUS_TONE[row.status] || 'neutral'">
            {{ row.status ? (te(`attendance_status_${row.status}`) ? t(`attendance_status_${row.status}`) : row.status) : '—' }}
          </Badge>
        </template>

        <template #cell.work_hours="{ row }">
          <span class="mono">{{ row.work_hours ?? '—' }}</span>
        </template>

        <template #cell.overtime_hours="{ row }">
          <span
            class="mono"
            :class="{ 'ot-pos': Number(row.overtime_hours) > 0 }"
          >{{ row.overtime_hours ?? '—' }}</span>
        </template>

        <template #cell.source="{ row }">
          <span
            class="cell-muted"
            :title="row.notes || undefined"
          >
            {{ row.source ? (te(`attendance_source_${row.source}`) ? t(`attendance_source_${row.source}`) : row.source) : '—' }}
          </span>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            v-if="canCheckOut(row)"
            icon="clock"
            tone="primary"
            :title="t('hr_attendance_row_checkout')"
            :disabled="rowBusyId === row.id"
            @click="rowCheckOut(row)"
          />
          <span
            v-else
            class="cell-muted"
            style="font-size:13px;"
          >—</span>
        </template>
      </DataTable>
    </Card>

    <!-- Manual record modal -->
    <Modal
      :open="recordOpen"
      :title="t('hr_attendance_record_title')"
      :subtitle="t('hr_attendance_record_subtitle')"
      :width="480"
      @close="closeRecord"
    >
      <div class="rec-grid">
        <Field :label="t('Employee')">
          <Select
            v-model="recordEmployeeId"
            icon="user"
            :placeholder="t('hr_attendance_pick_employee')"
            :options="employeeOptions"
          />
        </Field>

        <Field :label="t('hr_attendance_action')">
          <Select
            v-model="recordAction"
            icon="clock"
            :options="actionOptions"
          />
        </Field>

        <Field :label="t('Notes')">
          <Input
            v-model="recordNotes"
            :placeholder="t('hr_attendance_notes_placeholder')"
          />
        </Field>
      </div>

      <div class="rec-hint">
        {{ t('hr_attendance_record_hint') }}
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="recordSaving"
          @click="closeRecord"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="recordSaving"
          :disabled="recordSaving"
          @click="submitRecord"
        >
          {{ t('Save') }}
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
.kpi-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-block-end: 8px;
}

.kpi-head__label {
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--v-theme-text-secondary));
}

.kpi-head__total {
  font-size: 13px;
  color: rgb(var(--v-theme-text-secondary));
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-block-end: 16px;
}

.hr-att__toolbar {
  flex-wrap: wrap;
  gap: 12px;
}

.hr-att__filter {
  flex: 0 1 170px;
  min-width: 150px;
}

.hr-att__filter--wide {
  flex: 0 1 220px;
  min-width: 180px;
}

.ot-pos {
  color: rgb(var(--v-theme-warning));
  font-weight: 600;
}

.rec-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.rec-hint {
  margin-block-start: 12px;
  font-size: 12px;
  color: rgb(var(--v-theme-text-secondary));
}

@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .hr-att__filter,
  .hr-att__filter--wide {
    flex: 1 1 100%;
    max-width: none;
    min-width: 0;
  }
}

@media (max-width: 480px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

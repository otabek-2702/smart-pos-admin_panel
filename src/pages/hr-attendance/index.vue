<script setup lang="ts">
/* ============================================================
   HR ATTENDANCE — daily check-in / check-out log
   Plain HTML + design primitives (PageHeader / Card / DataTable /
   Input / Select / Badge / DesignIcon). No Vuetify on this surface.
   ============================================================ */
import type { DataTableColumn } from '@/components/design/DataTable.vue'
import { hrApi as axios } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Card from '@/components/design/Card.vue'
import DataTable from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Input from '@/components/design/Input.vue'
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
const dateFrom = ref('')
const dateTo = ref('')
const dateFilter = ref('')
const statusFilter = ref<string>('')
const employeeFilter = ref<string>('')
const employees = ref<any[]>([])

// ============================================================
// Options
// ============================================================
const STATUS_VALUES = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'] as const

const statusOptions = computed(() => STATUS_VALUES.map(v => ({
  value: v,
  label: te(`attendance_status_${v}`) ? t(`attendance_status_${v}`) : v,
})))

const employeeOptions = computed(() => employees.value.map((e: any) => ({
  value: String(e.value ?? e.id ?? e.uuid),
  label: (e.title ?? (`${e.user?.first_name ?? ''} ${e.user?.last_name ?? ''}`.trim() || e.user?.email)) || String(e.id ?? ''),
})))

// ============================================================
// Tone map
// ============================================================
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  HALF_DAY: 'info',
  ON_LEAVE: 'neutral',
}

// ============================================================
// API
// ============================================================
async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (dateFrom.value)
      params.date_from = dateFrom.value
    if (dateTo.value)
      params.date_to = dateTo.value
    if (dateFilter.value)
      params.date = dateFilter.value
    if (statusFilter.value)
      params.status = statusFilter.value
    if (employeeFilter.value)
      params.employee_id = employeeFilter.value
    const res = await axios.get('/attendance/', { params })
    const d = res.data?.data ?? res.data

    items.value = d?.attendances ?? d?.attendance ?? d?.records ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadEmployees() {
  try {
    const res = await axios.get('/employees/', { params: { per_page: 500 } })
    const d = res.data?.data ?? res.data
    employees.value = (d?.employees ?? d?.items ?? d?.results ?? []).map((e: any) => ({
      title: `${e.user?.first_name ?? ''} ${e.user?.last_name ?? ''}`.trim() || e.user?.email || e.id,
      value: e.id ?? e.uuid,
    }))
  }
  catch {}
}

onMounted(() => { load(); loadEmployees() })
watch([page, itemsPerPage], load)
watch([dateFrom, dateTo, dateFilter, statusFilter, employeeFilter], () => { page.value = 1; load() })

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
  if (dateFrom.value) {
    out.push({
      k: 'df',
      label: t('From'),
      val: dateFrom.value,
      clear: () => { dateFrom.value = '' },
    })
  }
  if (dateTo.value) {
    out.push({
      k: 'dt',
      label: t('To'),
      val: dateTo.value,
      clear: () => { dateTo.value = '' },
    })
  }
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
  dateFrom.value = ''
  dateTo.value = ''
  dateFilter.value = ''
  statusFilter.value = ''
  employeeFilter.value = ''
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Attendance')"
      :subtitle="t('hr_attendance_subtitle')"
    />

    <Card>
      <!-- Toolbar with filters -->
      <div class="toolbar hr-att__toolbar">
        <div class="hr-att__filter">
          <Input
            v-model="dateFrom"
            type="date"
            icon="calendar"
            :placeholder="t('From')"
          />
        </div>
        <div class="hr-att__filter">
          <Input
            v-model="dateTo"
            type="date"
            icon="calendar"
            :placeholder="t('To')"
          />
        </div>
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
          <div
            v-if="row.employee?.user?.email"
            class="cell-muted"
            style="font-size:12px;"
          >
            {{ row.employee.user.email }}
          </div>
        </template>

        <template #cell.check_in="{ row }">
          <span class="mono cell-muted">{{ row.check_in_time ?? row.check_in ?? '—' }}</span>
        </template>

        <template #cell.check_out="{ row }">
          <span class="mono cell-muted">{{ row.check_out_time ?? row.check_out ?? '—' }}</span>
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
          <span class="mono">{{ row.overtime_hours ?? '—' }}</span>
        </template>

        <template #cell.source="{ row }">
          <span
            v-if="row.notes"
            class="cell-muted"
            :title="row.notes"
          >
            {{ row.source ? (te(`attendance_source_${row.source}`) ? t(`attendance_source_${row.source}`) : row.source) : '—' }}
          </span>
          <span
            v-else
            class="cell-muted"
          >
            {{ row.source ? (te(`attendance_source_${row.source}`) ? t(`attendance_source_${row.source}`) : row.source) : '—' }}
          </span>
        </template>
      </DataTable>
    </Card>

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

@media (max-width: 768px) {
  .hr-att__filter,
  .hr-att__filter--wide {
    flex: 1 1 100%;
    max-width: none;
    min-width: 0;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

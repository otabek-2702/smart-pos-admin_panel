<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t, te } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(20)
const dateFrom = ref('')
const dateTo = ref('')
const dateFilter = ref('')
const statusFilter = ref<string | undefined>(undefined)
const employeeFilter = ref<string | undefined>(undefined)
const employees = ref<any[]>([])

const statusOptions = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE'].map(v => ({
  title: te(`attendance_status_${v}`) ? t(`attendance_status_${v}`) : v,
  value: v,
}))

const headers = [
  { title: t('Date'), key: 'date', sortable: false },
  { title: t('Employee'), key: 'employee', sortable: false },
  { title: t('Check In'), key: 'check_in', sortable: false },
  { title: t('Check Out'), key: 'check_out', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Hours'), key: 'work_hours', sortable: false },
  { title: t('Overtime'), key: 'overtime_hours', sortable: false },
  { title: t('Source'), key: 'source', sortable: false },
]

const statusColor: Record<string, string> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'error',
  HALF_DAY: 'info',
}

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
watch([page, itemsPerPage, dateFrom, dateTo, dateFilter, statusFilter, employeeFilter], load)
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">
          {{ t('Attendance') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Daily check-in / check-out log') }}
        </div>
      </div>
      <div class="page-head__actions">
        <VTextField
          v-model="dateFrom"
          type="date"
          :label="t('From')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
          clearable
        />
        <VTextField
          v-model="dateTo"
          type="date"
          :label="t('To')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
          clearable
        />
        <VTextField
          v-model="dateFilter"
          type="date"
          :label="t('On date')"
          density="compact"
          hide-details
          style="max-inline-size:170px;"
          clearable
        />
        <VSelect
          v-model="statusFilter"
          :items="statusOptions"
          :label="t('Status')"
          density="compact"
          hide-details
          style="max-inline-size:180px;"
          clearable
        />
        <VSelect
          v-model="employeeFilter"
          :items="employees"
          :label="t('Employee')"
          density="compact"
          hide-details
          style="max-inline-size:220px;"
          clearable
        />
      </div>
    </div>

    <VCard>

      <VDataTableServer
        :headers="headers"
        :items="items"
        :items-length="total"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="total"
          />
        </template>
        <template #item.date="{ item }">
          {{ formatDate(item.raw.date) }}
        </template>
        <template #item.employee="{ item }">
          {{ item.raw.employee?.user?.first_name }} {{ item.raw.employee?.user?.last_name }}
        </template>
        <template #item.check_in="{ item }">
          {{ item.raw.check_in_time ?? item.raw.check_in ?? '—' }}
        </template>
        <template #item.check_out="{ item }">
          {{ item.raw.check_out_time ?? item.raw.check_out ?? '—' }}
        </template>
        <template #item.status="{ item }">
          <VChip
            size="small"
            class="status-pill"
            :color="statusColor[item.raw.status] ?? 'default'"
            variant="tonal"
          >
            {{ te(`attendance_status_${item.raw.status}`) ? t(`attendance_status_${item.raw.status}`) : item.raw.status }}
          </VChip>
        </template>
        <template #item.work_hours="{ item }">
          <span class="num-tabular">{{ item.raw.work_hours ?? '—' }}</span>
        </template>
        <template #item.overtime_hours="{ item }">
          <span class="num-tabular">{{ item.raw.overtime_hours ?? '—' }}</span>
        </template>
        <template #item.source="{ item }">
          <span v-if="item.raw.notes">
            <VTooltip activator="parent" location="top">{{ item.raw.notes }}</VTooltip>
            {{ item.raw.source ? (te(`attendance_source_${item.raw.source}`) ? t(`attendance_source_${item.raw.source}`) : item.raw.source) : '—' }}
          </span>
          <span v-else>
            {{ item.raw.source ? (te(`attendance_source_${item.raw.source}`) ? t(`attendance_source_${item.raw.source}`) : item.raw.source) : '—' }}
          </span>
        </template>
      </VDataTableServer>
    </VCard>

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
meta:
  action: manage
  subject: all
</route>

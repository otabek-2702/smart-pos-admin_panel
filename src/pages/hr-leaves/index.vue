<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatDate } = useFormatters()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(20)
const statusFilter = ref<string | undefined>(undefined)
const employeeFilter = ref<string | number | undefined>(undefined)
const leaveTypeFilter = ref<string | number | undefined>(undefined)
// Note: BE leave_requests view does not currently filter on date_from/date_to;
// these are exposed as client-side filters only.
const dateFrom = ref<string | undefined>(undefined)
const dateTo = ref<string | undefined>(undefined)
const employees = ref<any[]>([])
const leaveTypes = ref<any[]>([])

const statusOptions = computed(() => ['PENDING', 'APPROVED', 'REJECTED', 'CANCELED'].map(v => ({
  title: t(`leave_status_${v}`),
  value: v,
})))

const employeeOptions = computed(() => employees.value.map(e => ({
  title: `${e.user?.first_name ?? ''} ${e.user?.last_name ?? ''}`.trim() || e.user?.email || `#${e.id}`,
  value: e.id,
})))

const leaveTypeOptions = computed(() => leaveTypes.value.map(lt => ({
  title: lt.name,
  value: lt.id,
})))

const headers = [
  { title: t('Employee'), key: 'employee', sortable: false },
  { title: t('Leave Type'), key: 'leave_type', sortable: false },
  { title: t('From'), key: 'start_date', sortable: false },
  { title: t('To'), key: 'end_date', sortable: false },
  { title: t('Days'), key: 'days', sortable: false },
  { title: t('Reason'), key: 'reason', sortable: false },
  { title: t('Approved by'), key: 'approved_by', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELED: 'default',
}

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value)
      params.status = statusFilter.value
    if (employeeFilter.value)
      params.employee_id = employeeFilter.value
    if (leaveTypeFilter.value)
      params.leave_type_id = leaveTypeFilter.value
    const res = await axios.get('/leaves/', { params })
    const d = res.data?.data ?? res.data

    let rows = d?.leave_requests ?? d?.leaves ?? d?.items ?? []
    // Client-side date filtering (BE does not yet support date_from/date_to on this endpoint)
    if (dateFrom.value)
      rows = rows.filter((r: any) => (r.start_date ?? '') >= dateFrom.value!)
    if (dateTo.value)
      rows = rows.filter((r: any) => (r.end_date ?? '') <= dateTo.value!)
    items.value = rows
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
    const res = await axios.get('/employees/', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data
    employees.value = d?.employees ?? d?.items ?? []
  }
  catch {}
}

async function loadLeaveTypes() {
  try {
    const res = await axios.get('/leave-types/', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data
    leaveTypes.value = d?.leave_types ?? d?.items ?? []
  }
  catch {}
}

onMounted(() => {
  load()
  loadEmployees()
  loadLeaveTypes()
})
watch([page, itemsPerPage, statusFilter, employeeFilter, leaveTypeFilter, dateFrom, dateTo], load)

async function approve(l: any) {
  try {
    await axios.post(`/leaves/${l.id}/approve/`)
    notify(t('Approved'))
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function reject(l: any) {
  const reason = prompt(t('Rejection reason') as string)
  if (!reason)
    return
  try {
    await axios.post(`/leaves/${l.id}/reject/`, { notes: reason })
    notify(t('Rejected'))
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function cancelLeave(l: any) {
  if (!confirm(t('Cancel this leave request?') as string))
    return
  try {
    await axios.post(`/leaves/${l.id}/cancel/`)
    notify(t('Canceled'))
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

const newDialog = ref(false)
const newSubmitting = ref(false)
const newForm = ref<{ employee_id: string | number | null, leave_type_id: string | number | null, start_date: string, end_date: string, reason: string }>({
  employee_id: null,
  leave_type_id: null,
  start_date: '',
  end_date: '',
  reason: '',
})

function openNewDialog() {
  newForm.value = { employee_id: null, leave_type_id: null, start_date: '', end_date: '', reason: '' }
  newDialog.value = true
}

async function submitNew() {
  if (!newForm.value.employee_id || !newForm.value.leave_type_id || !newForm.value.start_date || !newForm.value.end_date) {
    notify(t('Please fill all required fields'), 'error')
    return
  }
  newSubmitting.value = true
  try {
    await axios.post('/leaves/', { ...newForm.value })
    notify(t('Leave request created'))
    newDialog.value = false
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    newSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">
          {{ t('Leave Requests') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Approve or reject time-off requests') }}
        </div>
      </div>
      <div class="page-head__actions">
        <VSelect
          v-model="employeeFilter"
          :items="employeeOptions"
          :placeholder="t('Employee')"
          density="compact"
          style="min-inline-size:180px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="leaveTypeFilter"
          :items="leaveTypeOptions"
          :placeholder="t('Leave Type')"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
        <VTextField
          v-model="dateFrom"
          type="date"
          :placeholder="t('Date from')"
          density="compact"
          style="min-inline-size:150px;"
          hide-details
          clearable
        />
        <VTextField
          v-model="dateTo"
          type="date"
          :placeholder="t('Date to')"
          density="compact"
          style="min-inline-size:150px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="statusFilter"
          :items="statusOptions"
          :placeholder="t('Status')"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
        <VBtn
          color="primary"
          prepend-icon="bx-plus"
          @click="openNewDialog"
        >
          {{ t('New Leave Request') }}
        </VBtn>
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
        <template #item.employee="{ item }">
          {{ item.raw.employee?.user?.first_name }} {{ item.raw.employee?.user?.last_name }}
        </template>
        <template #item.leave_type="{ item }">
          {{ item.raw.leave_type?.name ?? '—' }}
        </template>
        <template #item.start_date="{ item }">
          {{ formatDate(item.raw.start_date) }}
        </template>
        <template #item.end_date="{ item }">
          {{ formatDate(item.raw.end_date) }}
        </template>
        <template #item.days="{ item }">
          <span class="num-tabular">{{ item.raw.days_count ?? item.raw.duration ?? '—' }}</span>
        </template>
        <template #item.reason="{ item }">
          <span
            v-if="item.raw.reason"
            class="truncate"
            style="display:inline-block;max-inline-size:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;"
          >
            {{ item.raw.reason }}
            <VTooltip activator="parent" location="top">{{ item.raw.reason }}</VTooltip>
          </span>
          <span v-else>—</span>
        </template>
        <template #item.approved_by="{ item }">
          <template v-if="item.raw.approved_by">
            {{ item.raw.approved_by?.first_name ?? '' }} {{ item.raw.approved_by?.last_name ?? '' }}
          </template>
          <template v-else>
            —
          </template>
        </template>
        <template #item.status="{ item }">
          <VChip
            size="small"
            class="status-pill"
            :color="statusColor[item.raw.status] ?? 'default'"
            variant="tonal"
          >
            {{ t(`leave_status_${item.raw.status}`) }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div
            class="d-flex justify-end"
            style="gap:2px;"
          >
            <VBtn
              v-if="item.raw.status === 'PENDING'"
              icon
              variant="text"
              size="small"
              color="success"
              @click="approve(item.raw)"
            >
              <VIcon
                icon="bx-check"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Approve') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status === 'PENDING'"
              icon
              variant="text"
              size="small"
              color="error"
              @click="reject(item.raw)"
            >
              <VIcon
                icon="bx-x"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Reject') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status === 'PENDING' || item.raw.status === 'APPROVED'"
              icon
              variant="text"
              size="small"
              color="warning"
              @click="cancelLeave(item.raw)"
            >
              <VIcon
                icon="bx-block"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Cancel') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <VDialog
      v-model="newDialog"
      max-width="560"
    >
      <VCard>
        <VCardTitle>{{ t('New Leave Request') }}</VCardTitle>
        <VCardText>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <VSelect
              v-model="newForm.employee_id"
              :items="employeeOptions"
              :label="t('Employee')"
              density="comfortable"
            />
            <VSelect
              v-model="newForm.leave_type_id"
              :items="leaveTypeOptions"
              :label="t('Leave Type')"
              density="comfortable"
            />
            <VTextField
              v-model="newForm.start_date"
              type="date"
              :label="t('Start date')"
              density="comfortable"
            />
            <VTextField
              v-model="newForm.end_date"
              type="date"
              :label="t('End date')"
              density="comfortable"
            />
            <VTextarea
              v-model="newForm.reason"
              :label="t('Reason')"
              rows="3"
              density="comfortable"
            />
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="newDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="newSubmitting"
            @click="submitNew"
          >
            {{ t('Create') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

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

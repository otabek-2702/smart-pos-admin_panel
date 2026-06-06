<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(20)

const employees = ref<any[]>([])

const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)

const deleteDialog = ref(false)
const deleting = ref<any>(null)

const terminateDialog = ref(false)
const terminating = ref<any>(null)
const terminateReason = ref('')
const terminateDate = ref('')

const renewDialog = ref(false)
const renewing = ref<any>(null)
const renewForm = ref({ new_start_date: '', new_end_date: '', new_salary: 0 })

const contractTypes = ['INITIAL', 'RENEWAL', 'AMENDMENT']

const form = ref({
  employee_id: null as number | null,
  contract_type: 'INITIAL',
  start_date: '',
  end_date: '',
  probation_end_date: '',
  salary_amount: 0,
  position_title: '',
  terms: '',
})

const headers = [
  { title: t('Employee'), key: 'employee', sortable: false },
  { title: t('Contract Type'), key: 'contract_type', sortable: false },
  { title: t('Start'), key: 'start_date', sortable: false },
  { title: t('End'), key: 'end_date', sortable: false },
  { title: t('Salary'), key: 'salary', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  EXPIRED: 'warning',
  TERMINATED: 'error',
  RENEWED: 'info',
}

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/contracts/', { params: { page: page.value, per_page: itemsPerPage.value } })
    const d = res.data?.data ?? res.data

    items.value = d?.contracts ?? d?.items ?? []
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
    const res = await axios.get('/employees/', { params: { per_page: 300 } })
    const d = res.data?.data ?? res.data

    employees.value = d?.employees ?? d?.items ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { load(); loadEmployees() })
watch([page, itemsPerPage], load)

const employeeOptions = computed(() =>
  employees.value.map((e: any) => ({
    title: `${e.user?.first_name ?? ''} ${e.user?.last_name ?? ''}${e.position ? ` — ${e.position}` : ''}`.trim() || `#${e.id}`,
    value: e.id,
  })),
)

function openCreate() {
  editing.value = null
  form.value = {
    employee_id: null,
    contract_type: 'INITIAL',
    start_date: '',
    end_date: '',
    probation_end_date: '',
    salary_amount: 0,
    position_title: '',
    terms: '',
  }
  dialog.value = true
}

function openEdit(c: any) {
  editing.value = c
  form.value = {
    employee_id: c.employee?.id ?? c.employee_id ?? null,
    contract_type: c.contract_type ?? 'INITIAL',
    start_date: c.start_date ?? '',
    end_date: c.end_date ?? '',
    probation_end_date: c.probation_end_date ?? '',
    salary_amount: Number(c.salary_amount ?? c.salary ?? c.base_salary ?? 0),
    position_title: c.position_title ?? '',
    terms: c.terms ?? '',
  }
  dialog.value = true
}

async function save() {
  if (!form.value.employee_id || !form.value.start_date) {
    notify(t('Employee and start date are required'), 'error')

    return
  }
  saving.value = true
  try {
    const payload: any = {
      employee_id: form.value.employee_id,
      contract_type: form.value.contract_type,
      start_date: form.value.start_date,
      salary_amount: form.value.salary_amount,
      position_title: form.value.position_title,
      terms: form.value.terms,
    }

    if (form.value.end_date)
      payload.end_date = form.value.end_date
    if (form.value.probation_end_date)
      payload.probation_end_date = form.value.probation_end_date

    if (editing.value)
      await axios.put(`/contracts/${editing.value.id}/`, payload)
    else
      await axios.post('/contracts/', payload)
    notify(editing.value ? t('Contract updated') : t('Contract created'))
    dialog.value = false
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(c: any) {
  deleting.value = c
  deleteDialog.value = true
}

async function doDelete() {
  if (!deleting.value)
    return
  try {
    await axios.delete(`/contracts/${deleting.value.id}/`)
    notify(t('Contract deleted'))
    deleteDialog.value = false
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function activate(c: any) {
  try {
    await axios.post(`/contracts/${c.id}/activate/`)
    notify(t('Activated'))
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

function openTerminate(c: any) {
  terminating.value = c
  terminateReason.value = ''
  terminateDate.value = ''
  terminateDialog.value = true
}

async function doTerminate() {
  if (!terminating.value)
    return
  try {
    const payload: any = {}
    if (terminateDate.value)
      payload.termination_date = terminateDate.value
    if (terminateReason.value)
      payload.termination_reason = terminateReason.value
    await axios.post(`/contracts/${terminating.value.id}/terminate/`, payload)
    notify(t('Terminated'))
    terminateDialog.value = false
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

function openRenew(c: any) {
  renewing.value = c
  renewForm.value = {
    new_start_date: '',
    new_end_date: '',
    new_salary: Number(c.salary_amount ?? c.salary ?? 0),
  }
  renewDialog.value = true
}

async function doRenew() {
  if (!renewing.value || !renewForm.value.new_start_date) {
    notify(t('New start date is required'), 'error')

    return
  }
  try {
    const payload: any = { new_start_date: renewForm.value.new_start_date }
    if (renewForm.value.new_end_date)
      payload.new_end_date = renewForm.value.new_end_date
    if (renewForm.value.new_salary)
      payload.new_salary = renewForm.value.new_salary
    await axios.post(`/contracts/${renewing.value.id}/renew/`, payload)
    notify(t('Contract renewed'))
    renewDialog.value = false
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <VCard>
      <VCardText class="d-flex align-center justify-space-between py-3">
        <span class="text-h6">{{ t('Contracts') }}</span>
        <VBtn
          color="primary"
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('New Contract') }}
        </VBtn>
      </VCardText>

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

        <template
          v-if="loading && items.length === 0"
          #body
        >
          <tr
            v-for="n in itemsPerPage"
            :key="n"
            class="sk-row"
          >
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:140px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:22px;border-radius:12px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:80px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:70px;height:22px;border-radius:12px;"
              />
            </td>
            <td
              class="sk-cell"
              style="text-align:end;"
            >
              <div class="d-flex justify-end gap-1">
                <div
                  class="sk-box"
                  style="width:32px;height:32px;border-radius:6px;"
                />
                <div
                  class="sk-box"
                  style="width:32px;height:32px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>

        <template #item.employee="{ item }">
          {{ item.raw.employee?.user?.first_name }} {{ item.raw.employee?.user?.last_name }}
        </template>
        <template #item.contract_type="{ item }">
          <VChip
            size="small"
            color="info"
            variant="tonal"
          >
            {{ item.raw.contract_type }}
          </VChip>
        </template>
        <template #item.start_date="{ item }">
          {{ formatDate(item.raw.start_date) }}
        </template>
        <template #item.end_date="{ item }">
          {{ item.raw.end_date ? formatDate(item.raw.end_date) : '—' }}
        </template>
        <template #item.salary="{ item }">
          {{ formatCurrency(item.raw.salary_amount ?? item.raw.salary ?? item.raw.base_salary ?? 0) }}
        </template>
        <template #item.status="{ item }">
          <VChip
            size="small"
            :color="statusColor[item.raw.status] ?? 'default'"
            variant="tonal"
          >
            {{ item.raw.status }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div
            class="d-flex justify-end"
            style="gap:2px;"
          >
            <VBtn
              v-if="item.raw.status === 'DRAFT'"
              icon
              variant="text"
              size="small"
              color="success"
              @click="activate(item.raw)"
            >
              <VIcon
                icon="bx-play"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Activate') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status === 'ACTIVE'"
              icon
              variant="text"
              size="small"
              color="warning"
              @click="openTerminate(item.raw)"
            >
              <VIcon
                icon="bx-stop"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Terminate') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="['ACTIVE','EXPIRED','TERMINATED'].includes(item.raw.status)"
              icon
              variant="text"
              size="small"
              color="info"
              @click="openRenew(item.raw)"
            >
              <VIcon
                icon="bx-refresh"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Renew') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status === 'DRAFT'"
              icon
              variant="text"
              size="small"
              @click="openEdit(item.raw)"
            >
              <VIcon
                icon="bx-edit-alt"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Edit') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              variant="text"
              size="small"
              color="error"
              @click="confirmDelete(item.raw)"
            >
              <VIcon
                icon="bx-trash"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Delete') }}
              </VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Create / Edit dialog -->
    <VDialog
      v-model="dialog"
      max-width="640"
      persistent
      scrollable
    >
      <VCard :title="editing ? t('Edit Contract') : t('New Contract')">
        <VCardText style="max-height:70vh;overflow-y:auto;">
          <VRow>
            <VCol cols="12">
              <VSelect
                v-model="form.employee_id"
                :items="employeeOptions"
                :label="t('Employee')"
                :disabled="!!editing"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.contract_type"
                :items="contractTypes"
                :label="t('Contract Type')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="form.salary_amount"
                :label="t('Salary')"
                type="number"
                step="1"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.start_date"
                :label="t('Start Date')"
                type="date"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.end_date"
                :label="t('End Date')"
                type="date"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.probation_end_date"
                :label="t('Probation End')"
                type="date"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.position_title"
                :label="t('Position')"
              />
            </VCol>
            <VCol cols="12">
              <VTextarea
                v-model="form.terms"
                :label="t('Terms')"
                rows="3"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            @click="dialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="saving"
            @click="save"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Delete confirm -->
    <VDialog
      v-model="deleteDialog"
      max-width="420"
    >
      <VCard :title="t('Delete Contract')">
        <VCardText>{{ t('Are you sure?') }}</VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="deleteDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="error"
            @click="doDelete"
          >
            {{ t('Delete') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Terminate dialog -->
    <VDialog
      v-model="terminateDialog"
      max-width="520"
    >
      <VCard :title="t('Terminate Contract')">
        <VCardText>
          <VTextField
            v-model="terminateDate"
            :label="t('Termination Date')"
            type="date"
            class="mb-3"
          />
          <VTextarea
            v-model="terminateReason"
            :label="t('Reason')"
            rows="3"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="terminateDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="warning"
            @click="doTerminate"
          >
            {{ t('Terminate') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Renew dialog -->
    <VDialog
      v-model="renewDialog"
      max-width="520"
    >
      <VCard :title="t('Renew Contract')">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="renewForm.new_start_date"
                :label="t('New Start Date')"
                type="date"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="renewForm.new_end_date"
                :label="t('New End Date')"
                type="date"
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model.number="renewForm.new_salary"
                :label="t('New Salary')"
                type="number"
                step="1"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="renewDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="info"
            @click="doRenew"
          >
            {{ t('Renew') }}
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

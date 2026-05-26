<script setup lang="ts">
import UserStatsRow from './UserStatsRow.vue'
import { ROLE_COLOR as roleColors } from '@/constants/statusColors'
import { hrApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

const employees = ref<any[]>([])
const totalEmployees = ref(0)
const loading = ref(false)
const stats = ref<any>(null)
const departments = ref<any[]>([])

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const departmentFilter = ref<number | undefined>(undefined)
const contractTypeFilter = ref<string | undefined>(undefined)

const dialogOpen = ref(false)
const editing = ref<any>(null)
const dialogLoading = ref(false)

const deleteDialog = ref(false)
const deleting = ref<any>(null)

const form = ref({
  user_id: null as number | null,
  position: '',
  department_id: null as number | null,
  hire_date: new Date().toISOString().slice(0, 10),
  contract_type: 'FULL_TIME',
  base_salary: 0,
  payment_frequency: 'MONTHLY',
  phone: '',
  address: '',
  notes: '',
})

const contractTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY']
const paymentFrequencies = ['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'DAILY', 'HOURLY']

const headers = computed(() => [
  { title: t('ID'), key: 'id', sortable: false, width: '60px' },
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Position'), key: 'position', sortable: false },
  { title: t('Department'), key: 'department', sortable: false },
  { title: t('Contract'), key: 'contract_type', sortable: false },
  { title: t('Salary'), key: 'base_salary', sortable: false },
  { title: t('Hire Date'), key: 'hire_date', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' },
])

async function loadEmployees() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (departmentFilter.value)
      params.department_id = departmentFilter.value
    if (contractTypeFilter.value)
      params.contract_type = contractTypeFilter.value
    const res = await axios.get('/employees/', { params })
    const d = res.data?.data ?? res.data

    employees.value = d?.employees ?? []
    totalEmployees.value = d?.pagination?.total_items ?? d?.pagination?.total ?? employees.value.length
  }
  catch {
    notify(t('Failed to load employees'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await axios.get('/employees/stats/')
    const d = res.data?.data ?? res.data

    stats.value = d?.stats ?? d
  }
  catch { /* ignore */ }
}

async function loadDepartments() {
  try {
    const res = await axios.get('/departments/', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data

    departments.value = d?.departments ?? d?.items ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => {
  loadEmployees()
  loadStats()
  loadDepartments()
})

watch([page, itemsPerPage], loadEmployees)

const debouncedSearch = useDebounceFn(() => { page.value = 1; loadEmployees() }, 400)

watch(search, debouncedSearch)
watch([departmentFilter, contractTypeFilter], () => { page.value = 1; loadEmployees() })

function openCreate() {
  editing.value = null
  form.value = {
    user_id: null,
    position: '',
    department_id: null,
    hire_date: new Date().toISOString().slice(0, 10),
    contract_type: 'FULL_TIME',
    base_salary: 0,
    payment_frequency: 'MONTHLY',
    phone: '',
    address: '',
    notes: '',
  }
  dialogOpen.value = true
}

function openEdit(emp: any) {
  editing.value = emp
  form.value = {
    user_id: emp.user_id ?? emp.user?.id ?? null,
    position: emp.position ?? '',
    department_id: emp.department?.id ?? emp.department_id ?? null,
    hire_date: emp.hire_date ?? new Date().toISOString().slice(0, 10),
    contract_type: emp.contract_type ?? 'FULL_TIME',
    base_salary: Number(emp.base_salary ?? 0),
    payment_frequency: emp.payment_frequency ?? 'MONTHLY',
    phone: emp.phone ?? '',
    address: emp.address ?? '',
    notes: emp.notes ?? '',
  }
  dialogOpen.value = true
}

async function save() {
  dialogLoading.value = true
  try {
    if (editing.value)
      await axios.put(`/employees/${editing.value.id}/`, form.value)
    else
      await axios.post('/employees/', form.value)
    notify(t(editing.value ? 'Employee updated' : 'Employee created'))
    dialogOpen.value = false
    loadEmployees()
    loadStats()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    dialogLoading.value = false
  }
}

function confirmDelete(emp: any) {
  deleting.value = emp
  deleteDialog.value = true
}

async function doDelete() {
  if (!deleting.value)
    return
  try {
    await axios.delete(`/employees/${deleting.value.id}/`)
    notify(t('Employee deleted'))
    deleteDialog.value = false
    loadEmployees()
    loadStats()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <UserStatsRow :stats="stats" />

    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <VTextField
          v-model="search"
          :placeholder="t('Search employees...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size:200px;max-inline-size:280px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="departmentFilter"
          :items="departments.map((d: any) => ({ title: d.name, value: d.id }))"
          :placeholder="t('Department')"
          density="compact"
          style="min-inline-size:180px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="contractTypeFilter"
          :items="contractTypes"
          :placeholder="t('Contract Type')"
          density="compact"
          style="min-inline-size:180px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn
          color="primary"
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('New Employee') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="employees"
        :items-length="totalEmployees"
        :loading="loading"
        :items-per-page="itemsPerPage"
        :page="page"
      >
        <template #bottom>
          <DataTableFooter
            v-model:page="page"
            v-model:items-per-page="itemsPerPage"
            :total-items="totalEmployees"
          />
        </template>

        <template
          v-if="loading && employees.length === 0"
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
                style="width:30px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:140px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:100px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:90px;height:13px;border-radius:4px;"
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
                style="width:90px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:22px;border-radius:12px;"
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

        <template #item.name="{ item }">
          <div class="d-flex align-center gap-2">
            <VAvatar
              size="32"
              :color="roleColors[item.raw.user?.role] ?? 'primary'"
              variant="tonal"
            >
              <span class="text-caption">{{ (item.raw.user?.first_name ?? '?')[0] }}</span>
            </VAvatar>
            <div>
              <div class="text-body-2 font-weight-medium">
                {{ item.raw.user?.first_name }} {{ item.raw.user?.last_name }}
              </div>
              <div class="text-caption text-disabled">
                {{ item.raw.user?.email }}
              </div>
            </div>
          </div>
        </template>
        <template #item.department="{ item }">
          {{ item.raw.department?.name ?? '—' }}
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
        <template #item.base_salary="{ item }">
          {{ formatCurrency(item.raw.base_salary ?? 0) }}
        </template>
        <template #item.hire_date="{ item }">
          {{ formatDate(item.raw.hire_date) }}
        </template>
        <template #item.is_active="{ item }">
          <VChip
            size="small"
            :color="item.raw.is_active ? 'success' : 'default'"
            variant="tonal"
          >
            {{ item.raw.is_active ? t('Active') : t('Inactive') }}
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div
            class="d-flex justify-end"
            style="gap:2px;"
          >
            <VBtn
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

    <VDialog
      v-model="dialogOpen"
      max-width="640"
      persistent
    >
      <VCard :title="editing ? t('Edit Employee') : t('New Employee')">
        <VCardText>
          <VRow>
            <VCol
              v-if="!editing"
              cols="12"
            >
              <VTextField
                v-model.number="form.user_id"
                :label="t('User ID')"
                type="number"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.position"
                :label="t('Position')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.department_id"
                :items="departments.map((d: any) => ({ title: d.name, value: d.id }))"
                :label="t('Department')"
                clearable
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.hire_date"
                type="date"
                :label="t('Hire Date')"
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
                v-model.number="form.base_salary"
                :label="t('Base Salary')"
                type="number"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.payment_frequency"
                :items="paymentFrequencies"
                :label="t('Payment Frequency')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.phone"
                :label="t('Phone')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.address"
                :label="t('Address')"
              />
            </VCol>
            <VCol cols="12">
              <VTextarea
                v-model="form.notes"
                :label="t('Notes')"
                rows="2"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="dialogOpen = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="dialogLoading"
            @click="save"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="deleteDialog"
      max-width="420"
    >
      <VCard :title="t('Delete Employee')">
        <VCardText>
          {{ t('Are you sure you want to delete this employee?') }}
        </VCardText>
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

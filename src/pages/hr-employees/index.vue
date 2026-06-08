<script setup lang="ts">
import { hrApi as axios } from '@/plugins/axios'
import defaultAxios from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

const employees = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const stats = ref<any>(null)
const page = ref(1)
const itemsPerPage = ref(20)
const search = ref('')
const departmentFilter = ref<number | null>(null)
const contractTypeFilter = ref<string | undefined>(undefined)
const activeFilter = ref<boolean | null>(null)

const departments = ref<any[]>([])
const users = ref<any[]>([])

const contractTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT']
const paymentFreqs = ['MONTHLY', 'WEEKLY', 'BI_WEEKLY']

const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const deleteDialog = ref(false)
const deleting = ref<any>(null)

const form = ref({
  user_id: null as number | null,
  department_id: null as number | null,
  position: '',
  hire_date: new Date().toISOString().slice(0, 10),
  contract_type: 'FULL_TIME',
  base_salary: 0,
  payment_frequency: 'MONTHLY',
  phone: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  bank_account: '',
  bank_name: '',
  notes: '',
  is_active: true,
})

const headers = [
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Position'), key: 'position', sortable: false },
  { title: t('Department'), key: 'department', sortable: false },
  { title: t('Contract'), key: 'contract_type', sortable: false },
  { title: t('Base salary'), key: 'base_salary', sortable: false },
  { title: t('Hire date'), key: 'hire_date', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function load() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (departmentFilter.value)
      params.department_id = departmentFilter.value
    if (contractTypeFilter.value)
      params.contract_type = contractTypeFilter.value
    if (activeFilter.value !== null)
      params.is_active = activeFilter.value
    const res = await axios.get('/employees/', { params })
    const d = res.data?.data ?? res.data

    employees.value = d?.employees ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? employees.value.length
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await axios.get('/employees/stats/')

    stats.value = res.data?.data ?? res.data
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

async function loadUsers() {
  try {
    const res = await defaultAxios.get('/users', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data

    users.value = d?.users ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { load(); loadStats(); loadDepartments(); loadUsers() })
watch([page, itemsPerPage], load)
const debounced = useDebounceFn(() => { page.value = 1; load() }, 400)
watch(search, debounced)
watch([departmentFilter, contractTypeFilter, activeFilter], () => { page.value = 1; load() })

function resetForm() {
  form.value = {
    user_id: null,
    department_id: null,
    position: '',
    hire_date: new Date().toISOString().slice(0, 10),
    contract_type: 'FULL_TIME',
    base_salary: 0,
    payment_frequency: 'MONTHLY',
    phone: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bank_account: '',
    bank_name: '',
    notes: '',
    is_active: true,
  }
}

function openCreate() {
  editing.value = null
  resetForm()
  dialog.value = true
}

function openEdit(e: any) {
  editing.value = e
  form.value = {
    user_id: e.user?.id ?? null,
    department_id: e.department?.id ?? null,
    position: e.position ?? '',
    hire_date: e.hire_date ?? new Date().toISOString().slice(0, 10),
    contract_type: e.contract_type ?? 'FULL_TIME',
    base_salary: Number(e.base_salary ?? 0),
    payment_frequency: e.payment_frequency ?? 'MONTHLY',
    phone: e.phone ?? '',
    address: e.address ?? '',
    emergency_contact_name: e.emergency_contact_name ?? '',
    emergency_contact_phone: e.emergency_contact_phone ?? '',
    bank_account: e.bank_account ?? '',
    bank_name: e.bank_name ?? '',
    notes: e.notes ?? '',
    is_active: e.is_active ?? true,
  }
  dialog.value = true
}

async function save() {
  if (!form.value.user_id || !form.value.position || !form.value.hire_date) {
    notify(t('User, position and hire date are required'), 'error')

    return
  }
  saving.value = true
  try {
    if (editing.value) {
      const { user_id, ...payload } = form.value
      await axios.put(`/employees/${editing.value.id}/`, payload)
      notify(t('Employee updated'))
    }
    else {
      await axios.post('/employees/', form.value)
      notify(t('Employee created'))
    }
    dialog.value = false
    await Promise.all([load(), loadStats()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(e: any) {
  deleting.value = e
  deleteDialog.value = true
}

async function doDelete() {
  if (!deleting.value)
    return
  try {
    await axios.delete(`/employees/${deleting.value.id}/`)
    notify(t('Deleted'))
    deleteDialog.value = false
    await Promise.all([load(), loadStats()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <VRow class="mb-4">
      <VCol cols="6" sm="3">
        <VCard>
          <VCardText>
            <div class="text-caption text-disabled">{{ t('Total') }}</div>
            <div class="text-h5 font-weight-bold">
              {{ stats?.total ?? '—' }}
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="3">
        <VCard>
          <VCardText>
            <div class="text-caption text-success">{{ t('Active') }}</div>
            <div class="text-h5 font-weight-bold">{{ stats?.active ?? '—' }}</div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="3">
        <VCard>
          <VCardText>
            <div class="text-caption text-disabled">{{ t('Departments') }}</div>
            <div class="text-h5 font-weight-bold">{{ stats?.departments ?? departments.length }}</div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="6" sm="3">
        <VCard>
          <VCardText>
            <div class="text-caption text-disabled">{{ t('Avg salary') }}</div>
            <div class="text-h6 font-weight-bold">{{ formatCurrency(stats?.avg_salary ?? 0) }}</div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <VTextField
          v-model="search"
          :placeholder="t('Search employees…')"
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
          hide-details
          clearable
          style="min-inline-size:180px;"
        />
        <VSelect
          v-model="contractTypeFilter"
          :items="contractTypes"
          :placeholder="t('Contract')"
          density="compact"
          hide-details
          clearable
          style="min-inline-size:160px;"
        />
        <VSelect
          v-model="activeFilter"
          :items="[{ title: t('Active'), value: true }, { title: t('Inactive'), value: false }]"
          :placeholder="t('Status')"
          density="compact"
          hide-details
          clearable
          style="min-inline-size:140px;"
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
        <template #item.name="{ item }">
          <div class="font-weight-medium">
            {{ item.raw.user?.first_name }} {{ item.raw.user?.last_name }}
          </div>
          <div class="text-caption text-disabled">
            {{ item.raw.user?.email }}
          </div>
        </template>
        <template #item.position="{ item }">
          {{ item.raw.position }}
        </template>
        <template #item.department="{ item }">
          {{ item.raw.department?.name ?? '—' }}
        </template>
        <template #item.contract_type="{ item }">
          <VChip size="x-small" variant="tonal">
            {{ item.raw.contract_type }}
          </VChip>
        </template>
        <template #item.base_salary="{ item }">
          {{ formatCurrency(item.raw.base_salary) }}
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
          <div class="d-flex justify-end" style="gap:2px;">
            <VBtn icon variant="text" size="small" @click="openEdit(item.raw)">
              <VIcon icon="bx-edit-alt" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Edit') }}</VTooltip>
            </VBtn>
            <VBtn icon variant="text" size="small" color="error" @click="confirmDelete(item.raw)">
              <VIcon icon="bx-trash" size="18" />
              <VTooltip activator="parent" location="top">{{ t('Delete') }}</VTooltip>
            </VBtn>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Dialog -->
    <VDialog v-model="dialog" max-width="760" persistent scrollable>
      <VCard :title="editing ? t('Edit Employee') : t('New Employee')">
        <VCardText style="max-height:70vh;overflow-y:auto;">
          <VRow>
            <VCol cols="12" sm="6">
              <VSelect
                v-model="form.user_id"
                :items="users.map((u: any) => ({ title: `${u.first_name} ${u.last_name} (${u.email})`, value: u.id }))"
                :label="t('User')"
                :disabled="!!editing"
                required
              />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect
                v-model="form.department_id"
                :items="departments.map((d: any) => ({ title: d.name, value: d.id }))"
                :label="t('Department')"
                clearable
              />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.position" :label="t('Position')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.hire_date" type="date" :label="t('Hire date')" required />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.contract_type" :items="contractTypes" :label="t('Contract type')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VSelect v-model="form.payment_frequency" :items="paymentFreqs" :label="t('Payment frequency')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model.number="form.base_salary" :label="t('Base salary')" type="number" min="0" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.phone" :label="t('Phone')" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.address" :label="t('Address')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.emergency_contact_name" :label="t('Emergency contact')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.emergency_contact_phone" :label="t('Emergency phone')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.bank_account" :label="t('Bank account')" />
            </VCol>
            <VCol cols="12" sm="6">
              <VTextField v-model="form.bank_name" :label="t('Bank name')" />
            </VCol>
            <VCol cols="12">
              <VTextarea v-model="form.notes" :label="t('Notes')" rows="2" />
            </VCol>
            <VCol v-if="editing" cols="12">
              <VSwitch v-model="form.is_active" :label="t('Active')" color="success" density="compact" />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="dialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn color="primary" :loading="saving" @click="save">{{ t('Save') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="deleteDialog" max-width="420">
      <VCard :title="t('Delete employee?')">
        <VCardText>
          {{ t('This removes the employee profile (the underlying User stays).') }}
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="deleteDialog = false">{{ t('Cancel') }}</VBtn>
          <VBtn color="error" @click="doDelete">{{ t('Delete') }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

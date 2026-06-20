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
const stats = ref<any>(null)

const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)

const form = ref({
  category_id: null as number | null,
  amount: 0,
  description: '',
  expense_date: new Date().toISOString().slice(0, 10),
  receipt_number: '',
  payment_method: 'CASH' as 'CASH' | 'UZCARD' | 'HUMO' | 'PAYME' | 'BANK_TRANSFER',
  notes: '',
})

const categories = ref<any[]>([])

const statusFilter = ref<string | undefined>(undefined)
const categoryFilter = ref<number | undefined>(undefined)
const dateFrom = ref<string>('')
const dateTo = ref<string>('')

const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const
const PAYMENT_METHODS = ['CASH', 'UZCARD', 'HUMO', 'PAYME', 'BANK_TRANSFER'] as const
const paymentMethodOptions = computed(() => PAYMENT_METHODS.map(v => ({ title: t(`payment_method_${v}`), value: v })))
const statusFilterOptions = computed(() => EXPENSE_STATUSES.map(v => ({ title: t(`expense_status_${v}`), value: v })))

const headers = [
  { title: t('Date'), key: 'expense_date', sortable: false },
  { title: t('Category'), key: 'category', sortable: false },
  { title: t('Description'), key: 'description', sortable: false },
  { title: t('Amount'), key: 'amount', sortable: false },
  { title: t('Payment method'), key: 'payment_method', sortable: false },
  { title: t('Receipt #'), key: 'receipt_number', sortable: false },
  { title: t('Filed by'), key: 'created_by', sortable: false },
  { title: t('Status'), key: 'status', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

const statusColor: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'error',
  PAID: 'success',
}

async function load() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, per_page: itemsPerPage.value }
    if (statusFilter.value) params.status = statusFilter.value
    if (categoryFilter.value) params.category_id = categoryFilter.value
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    const res = await axios.get('/expenses/', { params })
    const d = res.data?.data ?? res.data

    items.value = d?.expenses ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await axios.get('/expenses/stats/')

    stats.value = res.data?.data ?? res.data
  }
  catch { /* ignore */ }
}

async function loadCategories() {
  try {
    const res = await axios.get('/expense-categories/', { params: { per_page: 100 } })
    const d = res.data?.data ?? res.data

    categories.value = d?.expense_categories ?? d?.categories ?? d?.items ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { load(); loadStats(); loadCategories() })
watch([page, itemsPerPage], load)
watch([statusFilter, categoryFilter, dateFrom, dateTo], () => {
  page.value = 1
  load()
})

function openCreate() {
  editing.value = null
  form.value = {
    category_id: categories.value[0]?.id ?? null,
    amount: 0,
    description: '',
    expense_date: new Date().toISOString().slice(0, 10),
    receipt_number: '',
    payment_method: 'CASH',
    notes: '',
  }
  dialog.value = true
}

function openEdit(e: any) {
  editing.value = e
  form.value = {
    category_id: e.category?.id ?? e.category_id ?? null,
    amount: Number(e.amount ?? 0),
    description: e.description ?? '',
    expense_date: (e.expense_date ?? new Date().toISOString()).slice(0, 10),
    receipt_number: e.receipt_number ?? '',
    payment_method: (e.payment_method ?? 'CASH') as any,
    notes: e.notes ?? '',
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) {
      await axios.put(`/expenses/${editing.value.id}/`, form.value)
      notify(t('Expense updated'))
    }
    else {
      await axios.post('/expenses/', form.value)
      notify(t('Expense created'))
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

async function removeExpense(e: any) {
  if (!confirm(t('Delete this expense?') as string))
    return
  try {
    await axios.delete(`/expenses/${e.id}/`)
    notify(t('Deleted'))
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function approve(e: any) {
  try {
    await axios.post(`/expenses/${e.id}/approve/`)
    notify(t('Approved'))
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
}

async function reject(e: any) {
  const reason = prompt(t('Rejection reason') as string)
  if (!reason)
    return
  try {
    await axios.post(`/expenses/${e.id}/reject/`, { notes: reason })
    notify(t('Rejected'))
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
}

const payDialog = ref(false)
const paying = ref<any>(null)
const payMethod = ref<'CASH' | 'UZCARD' | 'HUMO' | 'PAYME' | 'BANK_TRANSFER'>('CASH')

function openPay(e: any) {
  paying.value = e
  payMethod.value = 'CASH'
  payDialog.value = true
}

async function pay() {
  if (!paying.value)
    return
  try {
    await axios.post(`/expenses/${paying.value.id}/pay/`, { payment_method: payMethod.value })
    notify(t('Paid'))
    payDialog.value = false
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
}

// ---------- Category manager ----------
const catDialog = ref(false)
const catSaving = ref(false)
const catEditing = ref<any>(null)
const catForm = ref({ name: '', description: '' })

function openCatManager() {
  catEditing.value = null
  catForm.value = { name: '', description: '' }
  catDialog.value = true
}

function pickCat(c: any) {
  catEditing.value = c
  catForm.value = { name: c.name ?? '', description: c.description ?? '' }
}

async function saveCat() {
  if (!catForm.value.name.trim()) {
    notify(t('Name is required'), 'error')

    return
  }
  catSaving.value = true
  try {
    if (catEditing.value)
      await axios.put(`/expense-categories/${catEditing.value.id}/`, catForm.value)
    else
      await axios.post('/expense-categories/', catForm.value)
    notify(catEditing.value ? t('Category updated') : t('Category created'))
    catEditing.value = null
    catForm.value = { name: '', description: '' }
    await loadCategories()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    catSaving.value = false
  }
}

async function deleteCat(c: any) {
  if (!confirm(t('Delete this category?')))
    return
  try {
    await axios.delete(`/expense-categories/${c.id}/`)
    notify(t('Deleted'))
    if (catEditing.value?.id === c.id) {
      catEditing.value = null
      catForm.value = { name: '', description: '' }
    }
    await loadCategories()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">
          {{ t('Expenses') }}
        </h1>
        <div class="page-head__subtitle">
          {{ t('Operational spend — approve, reject and settle') }}
        </div>
      </div>
      <div class="page-head__actions">
        <VBtn
          variant="tonal"
          prepend-icon="bx-folder"
          @click="openCatManager"
        >
          {{ t('Categories') }}
        </VBtn>
        <VBtn
          color="primary"
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('New Expense') }}
        </VBtn>
      </div>
    </div>

    <VRow class="mb-4">
      <VCol
        cols="6"
        sm="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-warning">
              <VIcon icon="bx-time" size="20" />
            </div>
            <div class="kpi-card__label">
              {{ t('Pending') }}
            </div>
          </div>
          <div class="kpi-card__value">
            <template v-if="stats">
              {{ stats.pending_count ?? 0 }}
            </template>
            <span
              v-else
              class="sk-box d-inline-block"
              style="width:36px;height:1em;border-radius:4px;"
            />
          </div>
        </div>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-primary">
              <VIcon icon="bx-wallet" size="20" />
            </div>
            <div class="kpi-card__label">
              {{ t('Total') }}
            </div>
          </div>
          <div class="kpi-card__value">
            <template v-if="stats">
              {{ formatCurrency(stats.total_amount ?? 0) }}<span class="kpi-card__unit">UZS</span>
            </template>
            <span
              v-else
              class="sk-box d-inline-block"
              style="width:80px;height:1em;border-radius:4px;"
            />
          </div>
        </div>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-info">
              <VIcon icon="bx-calendar" size="20" />
            </div>
            <div class="kpi-card__label">
              {{ t('This Month') }}
            </div>
          </div>
          <div class="kpi-card__value">
            <template v-if="stats">
              {{ formatCurrency(stats.this_month ?? 0) }}<span class="kpi-card__unit">UZS</span>
            </template>
            <span
              v-else
              class="sk-box d-inline-block"
              style="width:80px;height:1em;border-radius:4px;"
            />
          </div>
        </div>
      </VCol>
      <VCol
        cols="6"
        sm="3"
      >
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-success">
              <VIcon icon="bx-check-circle" size="20" />
            </div>
            <div class="kpi-card__label">
              {{ t('Paid') }}
            </div>
          </div>
          <div class="kpi-card__value">
            <template v-if="stats">
              {{ formatCurrency(stats.paid_amount ?? 0) }}<span class="kpi-card__unit">UZS</span>
            </template>
            <span
              v-else
              class="sk-box d-inline-block"
              style="width:80px;height:1em;border-radius:4px;"
            />
          </div>
        </div>
      </VCol>
    </VRow>

    <VCard>
      <div class="toolbar pa-3 d-flex flex-wrap" style="gap:8px;">
        <div class="control control--select" style="min-width:160px;">
          <VSelect
            v-model="statusFilter"
            :items="statusFilterOptions"
            :label="t('Status')"
            density="compact"
            clearable
            hide-details
          />
        </div>
        <div class="control control--select" style="min-width:180px;">
          <VSelect
            v-model="categoryFilter"
            :items="categories.map((c: any) => ({ title: c.name, value: c.id }))"
            :label="t('Category')"
            density="compact"
            clearable
            hide-details
          />
        </div>
        <div class="control" style="min-width:150px;">
          <VTextField
            v-model="dateFrom"
            type="date"
            :label="t('From')"
            density="compact"
            clearable
            hide-details
          />
        </div>
        <div class="control" style="min-width:150px;">
          <VTextField
            v-model="dateTo"
            type="date"
            :label="t('To')"
            density="compact"
            clearable
            hide-details
          />
        </div>
      </div>

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
        <template #item.expense_date="{ item }">
          {{ formatDate(item.raw.expense_date) }}
        </template>
        <template #item.category="{ item }">
          {{ item.raw.category?.name ?? '—' }}
        </template>
        <template #item.amount="{ item }">
          <span class="font-weight-medium num-tabular">{{ formatCurrency(item.raw.amount ?? 0) }}</span>
        </template>
        <template #item.payment_method="{ item }">
          <template v-if="item.raw.payment_method">
            {{ t(`payment_method_${item.raw.payment_method}`) }}
          </template>
          <span v-else class="text-disabled">—</span>
        </template>
        <template #item.receipt_number="{ item }">
          {{ item.raw.receipt_number || '—' }}
        </template>
        <template #item.created_by="{ item }">
          <template v-if="item.raw.created_by">
            {{ item.raw.created_by.first_name }} {{ item.raw.created_by.last_name }}
          </template>
          <span v-else class="text-disabled">—</span>
        </template>
        <template #item.status="{ item }">
          <VChip
            size="small"
            class="status-pill"
            :color="statusColor[item.raw.status] ?? 'default'"
            variant="tonal"
          >
            {{ t(`expense_status_${item.raw.status}`) }}
            <VTooltip
              v-if="item.raw.approved_by || item.raw.paid_by"
              activator="parent"
              location="top"
            >
              <div v-if="item.raw.approved_by">
                {{ t('Approved by') }}: {{ item.raw.approved_by.first_name }} {{ item.raw.approved_by.last_name }}
              </div>
              <div v-if="item.raw.paid_by">
                {{ t('Paid by') }}: {{ item.raw.paid_by.first_name }} {{ item.raw.paid_by.last_name }}
              </div>
            </VTooltip>
          </VChip>
        </template>
        <template #item.actions="{ item }">
          <div
            class="d-flex justify-end"
            style="gap:2px;"
          >
            <template v-if="item.raw.status === 'PENDING'">
              <VBtn
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
            </template>
            <VBtn
              v-if="item.raw.status === 'APPROVED'"
              icon
              variant="text"
              size="small"
              color="success"
              @click="openPay(item.raw)"
            >
              <VIcon
                icon="bx-dollar"
                size="18"
              />
              <VTooltip
                activator="parent"
                location="top"
              >
                {{ t('Pay') }}
              </VTooltip>
            </VBtn>
            <VBtn
              v-if="item.raw.status !== 'PAID'"
              icon
              variant="text"
              size="small"
              @click="openEdit(item.raw)"
            >
              <VIcon
                icon="bx-pencil"
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
              v-if="item.raw.status !== 'PAID'"
              icon
              variant="text"
              size="small"
              color="error"
              @click="removeExpense(item.raw)"
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
      v-model="dialog"
      max-width="520"
      persistent
    >
      <VCard :title="editing ? t('Edit Expense') : t('New Expense')">
        <VCardText>
          <VRow>
            <VCol cols="12">
              <VSelect
                v-model="form.category_id"
                :items="categories.map((c: any) => ({ title: c.name, value: c.id }))"
                :label="t('Category')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="form.amount"
                :label="t('Amount')"
                type="number"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.expense_date"
                type="date"
                :label="t('Date')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.payment_method"
                :items="paymentMethodOptions"
                :label="t('Payment method')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.receipt_number"
                :label="t('Receipt #')"
              />
            </VCol>
            <VCol cols="12">
              <VTextarea
                v-model="form.description"
                :label="t('Description')"
                rows="2"
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

    <VDialog
      v-model="payDialog"
      max-width="420"
      persistent
    >
      <VCard :title="t('Pay Expense')">
        <VCardText>
          <div class="text-body-2 mb-3">
            {{ t('Amount') }}: <strong>{{ formatCurrency(paying?.amount ?? 0) }}</strong>
          </div>
          <VSelect
            v-model="payMethod"
            :items="paymentMethodOptions"
            :label="t('Payment method')"
            autofocus
          />
          <div class="text-caption text-disabled mt-2">
            {{ t('CASH debits the drawer; cards settle externally') }}
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="payDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="success"
            @click="pay"
          >
            {{ t('Pay') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="catDialog"
      max-width="720"
      scrollable
    >
      <VCard :title="t('Expense Categories')">
        <VCardText style="max-height:70vh;overflow-y:auto;">
          <VRow>
            <VCol
              cols="12"
              md="5"
            >
              <div class="text-subtitle-2 mb-2">
                {{ catEditing ? t('Edit Category') : t('New Category') }}
              </div>
              <VTextField
                v-model="catForm.name"
                :label="t('Name')"
                class="mb-2"
                density="compact"
              />
              <VTextarea
                v-model="catForm.description"
                :label="t('Description')"
                rows="3"
                density="compact"
                class="mb-2"
              />
              <div class="d-flex gap-2">
                <VBtn
                  color="primary"
                  size="small"
                  :loading="catSaving"
                  @click="saveCat"
                >
                  {{ catEditing ? t('Save') : t('Add') }}
                </VBtn>
                <VBtn
                  v-if="catEditing"
                  variant="tonal"
                  size="small"
                  @click="catEditing = null; catForm = { name: '', description: '' }"
                >
                  {{ t('Cancel') }}
                </VBtn>
              </div>
            </VCol>
            <VCol
              cols="12"
              md="7"
            >
              <div class="text-subtitle-2 mb-2">
                {{ t('Existing') }} ({{ categories.length }})
              </div>
              <VList
                density="compact"
                class="pa-0"
                style="border:1px solid rgba(var(--v-theme-on-surface),0.08);border-radius:6px;max-height:340px;overflow-y:auto;"
              >
                <VListItem
                  v-for="c in categories"
                  :key="c.id"
                  :active="catEditing?.id === c.id"
                  @click="pickCat(c)"
                >
                  <VListItemTitle>{{ c.name }}</VListItemTitle>
                  <VListItemSubtitle v-if="c.description">
                    {{ c.description }}
                  </VListItemSubtitle>
                  <template #append>
                    <VBtn
                      icon
                      variant="text"
                      size="x-small"
                      color="error"
                      @click.stop="deleteCat(c)"
                    >
                      <VIcon
                        icon="bx-trash"
                        size="16"
                      />
                    </VBtn>
                  </template>
                </VListItem>
                <VListItem v-if="!categories.length">
                  <VListItemTitle class="text-disabled">
                    {{ t('No categories yet') }}
                  </VListItemTitle>
                </VListItem>
              </VList>
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="catDialog = false"
          >
            {{ t('Close') }}
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

<script setup lang="ts">
/* ============================================================
   HR EXPENSES — operational spend, approve / reject / pay
   Plain HTML + design primitives. No Vuetify on this surface.
   ============================================================ */
import type { DataTableColumn } from '@/components/design/DataTable.vue'
import { hrApi as axios } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import ChartCard from '@/components/design/ChartCard.vue'
import DataTable from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import HBarChart from '@/components/design/HBarChart.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

// ============================================================
// State
// ============================================================
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
  receipt_image_url: '',
  payment_method: 'CASH' as 'CASH' | 'UZCARD' | 'HUMO' | 'PAYME' | 'BANK_TRANSFER',
  notes: '',
})

const categories = ref<any[]>([])

const statusFilter = ref<string>('')
const categoryFilter = ref<string>('')
const dateFrom = ref<string>('')
const dateTo = ref<string>('')

const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const
const PAYMENT_METHODS = ['CASH', 'UZCARD', 'HUMO', 'PAYME', 'BANK_TRANSFER'] as const

const paymentMethodOptions = computed(() =>
  PAYMENT_METHODS.map(v => ({ value: v, label: t(`payment_method_${v}`) })),
)
const statusFilterOptions = computed(() => [
  { value: '', label: t('expense_status_filter_all') },
  ...EXPENSE_STATUSES.map(v => ({ value: v, label: t(`expense_status_${v}`) })),
])
const categoryFilterOptions = computed(() => [
  { value: '', label: t('expense_filter_all_categories') },
  ...categories.value.map((c: any) => ({ value: String(c.id), label: c.name })),
])
const categoryFormOptions = computed(() =>
  categories.value.map((c: any) => ({ value: String(c.id), label: c.name })),
)

// Where the money actually goes — derived from the stats endpoint's
// by_category totals (already returned by /expenses/stats/, previously unused).
const categoryBreakdown = computed(() => {
  const bc = stats.value?.by_category
  if (!bc)
    return []
  return Object.entries(bc)
    .map(([name, v]) => ({
      name: (!name || name === 'null' || name === 'None')
        ? t('expense_uncategorized')
        : name,
      value: Number(v) || 0,
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
})

const expenseCount = computed<number | null>(() => {
  const c = stats.value?.count
  return c == null ? null : Number(c)
})

// Backend rejects amount <= 0; guard the Save button so we fail fast in the UI.
const amountValid = computed(() => Number(form.value.amount) > 0)

// ============================================================
// API
// ============================================================
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
    total.value = d?.pagination?.total ?? items.value.length
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
    const d = res.data?.data ?? res.data

    stats.value = d?.stats ?? d
  }
  catch { /* ignore */ }
}

async function loadCategories() {
  try {
    const res = await axios.get('/expense-categories/', { params: { per_page: 100 } })
    const d = res.data?.data ?? res.data

    categories.value = d?.categories ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { load(); loadStats(); loadCategories() })
watch([page, itemsPerPage], load)
watch([statusFilter, categoryFilter, dateFrom, dateTo], () => {
  page.value = 1
  load()
})

// ============================================================
// Columns
// ============================================================
const columns: DataTableColumn<any>[] = [
  { key: 'expense_date', label: t('Date'), sortable: false, width: 120 },
  { key: 'category', label: t('Category'), sortable: false },
  { key: 'description', label: t('Description'), sortable: false },
  { key: 'amount', label: t('Amount'), sortable: false, align: 'right', width: 140 },
  { key: 'payment_method', label: t('Payment method'), sortable: false, width: 140 },
  { key: 'receipt_number', label: t('Receipt #'), sortable: false, width: 130 },
  { key: 'created_by', label: t('Filed by'), sortable: false },
  { key: 'status', label: t('Status'), sortable: false, width: 130 },
]

const tablePagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (n: number) => { page.value = n },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'> = {
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'error',
  PAID: 'success',
}

// ============================================================
// Form bindings (Select expects string values)
// ============================================================
const categoryIdStr = computed({
  get: () => form.value.category_id == null ? '' : String(form.value.category_id),
  set: (v: string) => { form.value.category_id = v ? Number(v) : null },
})

// ============================================================
// Create / Edit
// ============================================================
function openCreate() {
  editing.value = null
  form.value = {
    category_id: categories.value[0]?.id ?? null,
    amount: 0,
    description: '',
    expense_date: new Date().toISOString().slice(0, 10),
    receipt_number: '',
    receipt_image_url: '',
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
    receipt_image_url: e.receipt_image_url ?? '',
    payment_method: (e.payment_method ?? 'CASH') as any,
    notes: e.notes ?? '',
  }
  dialog.value = true
}

function closeForm() {
  if (saving.value)
    return
  dialog.value = false
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

// ============================================================
// Delete confirm
// ============================================================
const deleteOpen = ref(false)
const deleteRow = ref<any>(null)
const deletingFlag = ref(false)

function askDelete(e: any) {
  deleteRow.value = e
  deleteOpen.value = true
}

function closeDelete() {
  if (deletingFlag.value)
    return
  deleteOpen.value = false
  deleteRow.value = null
}

async function doDelete() {
  if (!deleteRow.value)
    return
  deletingFlag.value = true
  try {
    await axios.delete(`/expenses/${deleteRow.value.id}/`)
    notify(t('Deleted'))
    deleteOpen.value = false
    deleteRow.value = null
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    deletingFlag.value = false
  }
}

// ============================================================
// Approve / Reject
// ============================================================
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

const rejectOpen = ref(false)
const rejectRow = ref<any>(null)
const rejectReason = ref('')
const rejectingFlag = ref(false)

function openReject(e: any) {
  rejectRow.value = e
  rejectReason.value = ''
  rejectOpen.value = true
}

function closeReject() {
  if (rejectingFlag.value)
    return
  rejectOpen.value = false
  rejectRow.value = null
}

async function doReject() {
  if (!rejectRow.value)
    return
  if (!rejectReason.value.trim()) {
    notify(t('Rejection reason is required'), 'error')

    return
  }
  rejectingFlag.value = true
  try {
    await axios.post(`/expenses/${rejectRow.value.id}/reject/`, { notes: rejectReason.value })
    notify(t('Rejected'))
    rejectOpen.value = false
    rejectRow.value = null
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    rejectingFlag.value = false
  }
}

// ============================================================
// Pay
// ============================================================
const payDialog = ref(false)
const paying = ref<any>(null)
const payMethod = ref<'CASH' | 'UZCARD' | 'HUMO' | 'PAYME' | 'BANK_TRANSFER'>('CASH')
const payingFlag = ref(false)

function openPay(e: any) {
  paying.value = e
  payMethod.value = 'CASH'
  payDialog.value = true
}

function closePay() {
  if (payingFlag.value)
    return
  payDialog.value = false
  paying.value = null
}

async function pay() {
  if (!paying.value)
    return
  payingFlag.value = true
  try {
    await axios.post(`/expenses/${paying.value.id}/pay/`, { payment_method: payMethod.value })
    notify(t('Paid'))
    payDialog.value = false
    await Promise.all([load(), loadStats()])
  }
  catch (err: any) {
    notify(err?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    payingFlag.value = false
  }
}

// ============================================================
// Category manager
// ============================================================
const catDialog = ref(false)
const catSaving = ref(false)
const catEditing = ref<any>(null)
const catForm = ref({ name: '', description: '' })

function openCatManager() {
  catEditing.value = null
  catForm.value = { name: '', description: '' }
  catDialog.value = true
}

function closeCatManager() {
  if (catSaving.value)
    return
  catDialog.value = false
}

function pickCat(c: any) {
  catEditing.value = c
  catForm.value = { name: c.name ?? '', description: c.description ?? '' }
}

function cancelCatEdit() {
  catEditing.value = null
  catForm.value = { name: '', description: '' }
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

const catDeleteOpen = ref(false)
const catDeleteRow = ref<any>(null)

function askDeleteCat(c: any) {
  catDeleteRow.value = c
  catDeleteOpen.value = true
}

function closeDeleteCat() {
  catDeleteOpen.value = false
  catDeleteRow.value = null
}

async function doDeleteCat() {
  if (!catDeleteRow.value)
    return
  try {
    const c = catDeleteRow.value
    await axios.delete(`/expense-categories/${c.id}/`)
    notify(t('Deleted'))
    if (catEditing.value?.id === c.id) {
      catEditing.value = null
      catForm.value = { name: '', description: '' }
    }
    catDeleteOpen.value = false
    catDeleteRow.value = null
    await loadCategories()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

// ============================================================
// ESC handler
// ============================================================
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape')
    return
  if (deleteOpen.value) { closeDelete(); e.preventDefault(); return }
  if (rejectOpen.value) { closeReject(); e.preventDefault(); return }
  if (payDialog.value) { closePay(); e.preventDefault(); return }
  if (catDeleteOpen.value) { closeDeleteCat(); e.preventDefault(); return }
  if (catDialog.value) { closeCatManager(); e.preventDefault(); return }
  if (dialog.value) { closeForm(); e.preventDefault() }
}

onMounted(() => { window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown) })

// ============================================================
// Helpers
// ============================================================
function categoryName(row: any): string {
  return row?.category?.name ?? '—'
}

function openReceipt(row: any) {
  const url = row?.receipt_image_url
  if (url)
    window.open(url, '_blank', 'noopener,noreferrer')
}

function fullName(u: any): string {
  if (!u)
    return '—'
  return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—'
}

function statusTooltip(row: any): string {
  const parts: string[] = []
  if (row.approved_by)
    parts.push(`${t('Approved by')}: ${fullName(row.approved_by)}`)
  if (row.paid_by)
    parts.push(`${t('Paid by')}: ${fullName(row.paid_by)}`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Expenses')"
      :subtitle="t('expense_subtitle')"
    >
      <template #actions>
        <Button
          variant="ghost"
          icon="folder"
          @click="openCatManager"
        >
          {{ t('Categories') }}
        </Button>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('New Expense') }}
        </Button>
      </template>
    </PageHeader>

    <!-- KPI cards -->
    <div class="kpi-grid">
      <Kpi
        :data="{
          label: t('Pending'),
          value: stats?.by_status?.PENDING ?? null,
          icon: 'time',
          tone: 'warning',
          money: true,
        }"
      />
      <Kpi
        :data="{
          label: t('Total'),
          value: stats?.total ?? null,
          icon: 'wallet',
          tone: 'primary',
          money: true,
          sub: expenseCount !== null ? `${expenseCount} ${t('expense_count_suffix')}` : undefined,
        }"
      />
      <Kpi
        :data="{
          label: t('Approved'),
          value: stats?.by_status?.APPROVED ?? null,
          icon: 'calendar',
          tone: 'info',
          money: true,
        }"
      />
      <Kpi
        :data="{
          label: t('Paid'),
          value: stats?.by_status?.PAID ?? null,
          icon: 'check',
          tone: 'success',
          money: true,
        }"
      />
    </div>

    <!-- Spend-by-category breakdown -->
    <ChartCard
      v-if="stats === null || categoryBreakdown.length"
      :title="t('expense_by_category_title')"
      :sub="t('expense_by_category_sub')"
      class-name="breakdown-card"
    >
      <HBarChart
        :data="categoryBreakdown"
        :value-format="formatCurrency"
        :loading="stats === null"
      />
    </ChartCard>

    <!-- Toolbar + table -->
    <Card>
      <div class="toolbar toolbar--wrap">
        <div class="tb-filter">
          <Select
            v-model="statusFilter"
            icon="filter"
            :placeholder="t('Status')"
            :options="statusFilterOptions"
          />
        </div>
        <div class="tb-filter tb-filter--wide">
          <Select
            v-model="categoryFilter"
            icon="folder"
            :placeholder="t('Category')"
            :options="categoryFilterOptions"
          />
        </div>
        <div class="tb-date">
          <Field :label="t('expense_date_from')">
            <Input
              v-model="dateFrom"
              type="date"
            />
          </Field>
        </div>
        <div class="tb-date">
          <Field :label="t('expense_date_to')">
            <Input
              v-model="dateTo"
              type="date"
            />
          </Field>
        </div>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="columns"
        :rows="items"
        row-key="id"
        :loading="loading"
        :pagination="tablePagination"
        :empty-title="t('expense_empty_title')"
        :empty-sub="t('expense_empty_hint')"
      >
        <template #cell.expense_date="{ row }">
          {{ formatDate(row.expense_date) }}
        </template>

        <template #cell.category="{ row }">
          <span>{{ categoryName(row) }}</span>
        </template>

        <template #cell.description="{ row }">
          <span class="cell-muted">{{ row.description || '—' }}</span>
        </template>

        <template #cell.amount="{ row }">
          <span class="mono">{{ formatCurrency(row.amount ?? 0) }}</span>
        </template>

        <template #cell.payment_method="{ row }">
          <template v-if="row.payment_method">
            {{ t(`payment_method_${row.payment_method}`) }}
          </template>
          <span
            v-else
            class="cell-muted"
          >—</span>
        </template>

        <template #cell.receipt_number="{ row }">
          {{ row.receipt_number || '—' }}
        </template>

        <template #cell.created_by="{ row }">
          {{ fullName(row.created_by) }}
        </template>

        <template #cell.status="{ row }">
          <Badge
            :tone="STATUS_TONE[row.status] ?? 'neutral'"
            :title="statusTooltip(row)"
          >
            {{ t(`expense_status_${row.status}`) }}
          </Badge>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            v-if="row.receipt_image_url"
            icon="receipt"
            :title="t('expense_view_receipt')"
            @click="openReceipt(row)"
          />
          <IconAction
            v-if="row.status === 'PENDING'"
            icon="check"
            tone="success"
            :title="t('Approve')"
            @click="approve(row)"
          />
          <IconAction
            v-if="row.status === 'PENDING'"
            icon="close"
            tone="danger"
            :title="t('Reject')"
            @click="openReject(row)"
          />
          <IconAction
            v-if="row.status === 'APPROVED'"
            icon="dollar"
            tone="success"
            :title="t('Pay')"
            @click="openPay(row)"
          />
          <IconAction
            v-if="row.status !== 'PAID'"
            icon="pencil"
            :title="t('Edit')"
            @click="openEdit(row)"
          />
          <IconAction
            v-if="row.status !== 'PAID'"
            icon="trash"
            tone="danger"
            :title="t('Delete')"
            @click="askDelete(row)"
          />
        </template>

        <template #empty>
          <div class="statefill">
            <div class="statefill__icon">
              <DesignIcon
                name="wallet"
                :size="24"
              />
            </div>
            <div class="statefill__title">
              {{ t('expense_empty_title') }}
            </div>
            <div class="statefill__sub">
              {{ t('expense_empty_hint') }}
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;">
              <Button
                variant="primary"
                icon="plus"
                @click="openCreate"
              >
                {{ t('New Expense') }}
              </Button>
            </div>
          </div>
        </template>
      </DataTable>
    </Card>

    <!-- Create / Edit modal -->
    <Modal
      :open="dialog"
      :title="editing ? t('Edit Expense') : t('New Expense')"
      :subtitle="t('expense_subtitle')"
      :width="560"
      @close="closeForm"
    >
      <form @submit.prevent="save">
        <div class="form-grid">
          <Field
            :label="t('Category')"
            class="span-2"
          >
            <Select
              v-model="categoryIdStr"
              :options="categoryFormOptions"
              :placeholder="t('expense_pick_category')"
            />
          </Field>

          <Field :label="t('Amount')">
            <Input
              v-model.number="form.amount"
              type="number"
              :placeholder="t('expense_amount_placeholder')"
            />
          </Field>

          <Field :label="t('Date')">
            <Input
              v-model="form.expense_date"
              type="date"
            />
          </Field>

          <Field :label="t('Payment method')">
            <Select
              v-model="form.payment_method"
              :options="paymentMethodOptions"
            />
          </Field>

          <Field :label="t('Receipt #')">
            <Input
              v-model="form.receipt_number"
              :placeholder="t('expense_receipt_placeholder')"
            />
          </Field>

          <Field
            :label="t('expense_receipt_image')"
            :hint="t('expense_receipt_image_hint')"
            class="span-2"
          >
            <Input
              v-model="form.receipt_image_url"
              type="url"
              :placeholder="t('expense_receipt_image_placeholder')"
            />
          </Field>

          <Field
            :label="t('Description')"
            class="span-2"
          >
            <Input
              v-model="form.description"
              :placeholder="t('expense_description_placeholder')"
            />
          </Field>

          <Field
            :label="t('Notes')"
            class="span-2"
          >
            <Input
              v-model="form.notes"
              :placeholder="t('expense_notes_placeholder')"
            />
          </Field>
        </div>
      </form>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="saving"
          @click="closeForm"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="saving"
          :disabled="saving || !amountValid"
          @click="save"
        >
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Delete confirm modal -->
    <Modal
      :open="deleteOpen"
      :title="t('expense_delete_title')"
      :subtitle="deleteRow ? (deleteRow.description || '') : ''"
      :width="440"
      @close="closeDelete"
    >
      <div style="padding:4px 2px 8px;color:rgb(var(--v-theme-text-secondary));">
        {{ t('expense_confirm_delete') }}
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="deletingFlag"
          @click="closeDelete"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          :loading="deletingFlag"
          :disabled="deletingFlag"
          @click="doDelete"
        >
          {{ t('Delete') }}
        </Button>
      </template>
    </Modal>

    <!-- Reject modal -->
    <Modal
      :open="rejectOpen"
      :title="t('expense_reject_title')"
      :subtitle="rejectRow ? (rejectRow.description || '') : ''"
      :width="480"
      @close="closeReject"
    >
      <Field
        :label="t('Rejection reason')"
        :hint="t('expense_reject_hint')"
      >
        <Input
          v-model="rejectReason"
          :placeholder="t('expense_reject_placeholder')"
        />
      </Field>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="rejectingFlag"
          @click="closeReject"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="close"
          :loading="rejectingFlag"
          :disabled="rejectingFlag"
          @click="doReject"
        >
          {{ t('Reject') }}
        </Button>
      </template>
    </Modal>

    <!-- Pay modal -->
    <Modal
      :open="payDialog"
      :title="t('Pay Expense')"
      :subtitle="paying ? formatCurrency(paying.amount ?? 0) : ''"
      :width="420"
      @close="closePay"
    >
      <div class="pay-amount">
        <span class="pay-amount__label">{{ t('Amount') }}:</span>
        <strong class="pay-amount__value">{{ formatCurrency(paying?.amount ?? 0) }}</strong>
      </div>
      <Field :label="t('Payment method')">
        <Select
          v-model="payMethod"
          :options="paymentMethodOptions"
        />
      </Field>
      <div class="pay-hint">
        {{ t('expense_pay_hint') }}
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="payingFlag"
          @click="closePay"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="dollar"
          :loading="payingFlag"
          :disabled="payingFlag"
          @click="pay"
        >
          {{ t('Pay') }}
        </Button>
      </template>
    </Modal>

    <!-- Category manager modal -->
    <Modal
      :open="catDialog"
      :title="t('Expense Categories')"
      :subtitle="t('expense_cats_subtitle')"
      :width="720"
      @close="closeCatManager"
    >
      <div class="cat-grid">
        <div class="cat-form">
          <div class="cat-form__title">
            {{ catEditing ? t('Edit Category') : t('New Category') }}
          </div>
          <Field :label="t('Name')">
            <Input
              v-model="catForm.name"
              :placeholder="t('expense_cat_name_placeholder')"
            />
          </Field>
          <Field :label="t('Description')">
            <Input
              v-model="catForm.description"
              :placeholder="t('expense_cat_desc_placeholder')"
            />
          </Field>
          <div class="cat-form__actions">
            <Button
              variant="primary"
              :loading="catSaving"
              :disabled="catSaving"
              @click="saveCat"
            >
              {{ catEditing ? t('Save') : t('Add') }}
            </Button>
            <Button
              v-if="catEditing"
              variant="ghost"
              :disabled="catSaving"
              @click="cancelCatEdit"
            >
              {{ t('Cancel') }}
            </Button>
          </div>
        </div>

        <div class="cat-list">
          <div class="cat-list__title">
            {{ t('expense_cats_existing') }} ({{ categories.length }})
          </div>
          <div class="cat-list__wrap">
            <div
              v-for="c in categories"
              :key="c.id"
              class="cat-list__item"
              :class="{ 'is-active': catEditing?.id === c.id }"
              @click="pickCat(c)"
            >
              <div class="cat-list__main">
                <div class="cat-list__name">
                  {{ c.name }}
                </div>
                <div
                  v-if="c.description"
                  class="cat-list__sub"
                >
                  {{ c.description }}
                </div>
              </div>
              <IconAction
                icon="trash"
                tone="danger"
                :title="t('Delete')"
                @click.stop="askDeleteCat(c)"
              />
            </div>
            <div
              v-if="!categories.length"
              class="cat-list__empty"
            >
              {{ t('No categories yet') }}
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          @click="closeCatManager"
        >
          {{ t('Close') }}
        </Button>
      </template>
    </Modal>

    <!-- Category delete confirm -->
    <Modal
      :open="catDeleteOpen"
      :title="t('expense_cat_delete_title')"
      :subtitle="catDeleteRow ? (catDeleteRow.name || '') : ''"
      :width="420"
      @close="closeDeleteCat"
    >
      <div style="padding:4px 2px 8px;color:rgb(var(--v-theme-text-secondary));">
        {{ t('expense_cat_confirm_delete') }}
      </div>

      <template #footer>
        <Button
          variant="ghost"
          @click="closeDeleteCat"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          @click="doDeleteCat"
        >
          {{ t('Delete') }}
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

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

<style scoped>
/* ============================================================
   Layout — KPI grid, toolbar, modals
   Mobile-first responsive collapse for KPI grid + form grids
   ============================================================ */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-block-end: 16px;
}

.breakdown-card {
  margin-block-end: 16px;
}

.toolbar--wrap {
  flex-wrap: wrap;
}

.tb-filter {
  width: 200px;
}

.tb-filter--wide {
  width: 240px;
}

.tb-date {
  width: 170px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-grid .span-2 {
  grid-column: span 2;
}

.cat-grid {
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: 20px;
}

.cat-form__title,
.cat-list__title {
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--v-theme-text-secondary));
  margin-block-end: 8px;
}

.cat-form__actions {
  display: flex;
  gap: 8px;
  margin-block-start: 8px;
}

.cat-list__wrap {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 6px;
  max-height: 340px;
  overflow-y: auto;
}

.cat-list__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.cat-list__item:last-child {
  border-block-end: 0;
}

.cat-list__item:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.cat-list__item.is-active {
  background: rgba(var(--v-theme-primary), 0.08);
}

.cat-list__main {
  flex: 1;
  min-width: 0;
}

.cat-list__name {
  font-size: 14px;
  font-weight: 500;
}

.cat-list__sub {
  font-size: 12px;
  color: rgb(var(--v-theme-text-secondary));
  margin-block-start: 2px;
}

.cat-list__empty {
  padding: 14px;
  font-size: 13px;
  color: rgb(var(--v-theme-text-secondary));
  text-align: center;
}

.pay-amount {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin-block-end: 12px;
  font-size: 14px;
}

.pay-amount__value {
  font-size: 18px;
}

.pay-hint {
  margin-block-start: 8px;
  font-size: 12px;
  color: rgb(var(--v-theme-text-secondary));
}

/* Tablet collapse */
@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Phone collapse — KPI cols-4 stays 2-up at 768px per canonical rules */
@media (max-width: 768px) {
  .tb-filter,
  .tb-filter--wide,
  .tb-date {
    width: 100%;
    flex: 1 1 100%;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-grid .span-2 {
    grid-column: span 1;
  }

  .cat-grid {
    grid-template-columns: 1fr;
  }

  .cat-list__wrap {
    max-height: 280px;
  }
}

/* Small phone — KPI collapses to single column */
@media (max-width: 480px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>

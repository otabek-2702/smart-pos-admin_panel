<script setup lang="ts">
import axios from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import { buildCsv } from '@/utils/csv'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

const TXN_TYPES = [
  'INKASSA', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE', 'EXPENSE', 'ADJUSTMENT',
  'SUPPLIER_PAYMENT', 'SALARY_PAYMENT', 'SHIFT_DEPOSIT',
]
const txnTypeItems = computed(() => TXN_TYPES.map(v => ({ value: v, label: t(`treasury_txn_${v}`) })))

const accountOptions = computed(() => [
  { value: 'SAFE', label: t('treasury_account_SAFE') },
  { value: 'BANK', label: t('treasury_account_BANK') },
])

const txnTypeTone: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'error' | 'primary'> = {
  INKASSA: 'success',
  TRANSFER_IN: 'info',
  TRANSFER_OUT: 'warning',
  FEE: 'neutral',
  EXPENSE: 'error',
  ADJUSTMENT: 'neutral',
  SUPPLIER_PAYMENT: 'warning',
  SALARY_PAYMENT: 'warning',
  SHIFT_DEPOSIT: 'success',
}

// -------- accounts --------
const accounts = ref<Record<string, any>>({})
const accountsLoading = ref(false)

async function loadAccounts() {
  accountsLoading.value = true
  try {
    const res = await axios.get('/treasury/accounts')
    const d = res.data?.data ?? res.data

    accounts.value = d?.accounts ?? {}
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load accounts'), 'error')
  }
  finally {
    accountsLoading.value = false
  }
}

// Combined money on hand across both accounts — the single figure an operator
// checks first ("how much cash does the business currently control?").
const accountsReady = computed(() => !!(accounts.value?.SAFE || accounts.value?.BANK))
const totalBalance = computed(() =>
  Number(accounts.value?.SAFE?.balance ?? 0) + Number(accounts.value?.BANK?.balance ?? 0),
)

// -------- history --------
const txns = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(20)
const accountFilter = ref<string | undefined>(undefined)
const typeFilter = ref<string | undefined>(undefined)
// NOTE: BE /treasury/history does not yet accept date_from/date_to/search params,
// so these filters are applied client-side over the current page until BE support lands.
const dateFrom = ref<string>('')
const dateTo = ref<string>('')
const search = ref<string>('')

const filteredTxns = computed(() => {
  const q = search.value.trim().toLowerCase()
  const from = dateFrom.value ? new Date(dateFrom.value).getTime() : null
  const to = dateTo.value ? new Date(dateTo.value).getTime() + 86_400_000 : null

  return txns.value.filter((tx: any) => {
    if (from || to) {
      const ts = tx.created_at ? new Date(tx.created_at).getTime() : 0
      if (from && ts < from)
        return false
      if (to && ts >= to)
        return false
    }
    if (q) {
      const hay = `${tx.description ?? ''} ${tx.category ?? ''}`.toLowerCase()
      if (!hay.includes(q))
        return false
    }

    return true
  })
})

// Client-side filters (search + date range) narrow only the rows already on the
// current page — expose whether any are active so we can offer a quick reset and
// an honest "showing X of Y on this page" count.
const hasClientFilters = computed(() =>
  !!(search.value.trim() || dateFrom.value || dateTo.value),
)

function clearClientFilters() {
  search.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}

// Export the currently visible (filtered) ledger rows to CSV — the standard
// hand-off accountants expect. Uses the same UTF-8 BOM + quoting convention as
// the Orders export so Excel opens Cyrillic correctly.
function exportCsv() {
  const rows = filteredTxns.value
  if (!rows.length) {
    notify(t('Nothing to export yet'), 'warning')

    return
  }

  const cols: Array<[string, (r: any) => any]> = [
    [t('Date'), r => r.created_at],
    [t('Account'), r => t(`treasury_account_${r.account}`)],
    [t('Type'), r => t(`treasury_txn_${r.type}`)],
    [t('Amount'), r => r.delta],
    [t('Fee'), r => r.fee ?? 0],
    [t('Balance after'), r => r.balance_after],
    [t('Category'), r => r.category ?? ''],
    [t('Description'), r => r.description ?? ''],
    [t('Reference'), r => (r.reference_type && r.reference_id ? `${r.reference_type} #${r.reference_id}` : '')],
    [t('By'), r => r.performed_by ?? ''],
  ]

  const csv = buildCsv([
    cols.map(c => c[0]),
    ...rows.map(r => cols.map(c => c[1](r))),
  ], { alwaysQuote: true })

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)

  a.href = url
  a.download = `treasury-${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  notify(t('Exported {n} transactions', { n: rows.length }), 'success')
}

const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'created_at', label: t('Date'), width: 160 },
  { key: 'account', label: t('Account'), width: 100 },
  { key: 'type', label: t('Type'), width: 150 },
  { key: 'delta', label: t('Amount'), align: 'right' },
  { key: 'balance_after', label: t('Balance after'), align: 'right' },
  { key: 'category', label: t('Category') },
  { key: 'description', label: t('Description') },
  { key: 'reference', label: t('Reference'), width: 160 },
  { key: 'performed_by', label: t('By') },
])

const router = useRouter()

function gotoReference(refType: string | undefined | null, refId: string | number | undefined | null) {
  if (!refType || !refId)
    return
  const kind = String(refType).toLowerCase()
  if (kind.includes('inkassa'))
    router.push(`/inkassa/${refId}`)
  else if (kind.includes('shift'))
    router.push(`/shifts/${refId}`)
}

function referenceLabel(refType: string) {
  const key = `treasury_ref_${String(refType).toUpperCase()}`
  const tr = t(key)
  // fallback to the raw enum if no translation found
  return tr === key ? String(refType) : tr
}

async function loadHistory() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (accountFilter.value)
      params.account = accountFilter.value
    if (typeFilter.value)
      params.type = typeFilter.value
    const res = await axios.get('/treasury/history', { params })
    const d = res.data?.data ?? res.data

    txns.value = d?.transactions ?? []
    total.value = d?.pagination?.total ?? txns.value.length
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load history'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(() => { loadAccounts(); loadHistory() })
watch([page, itemsPerPage], loadHistory)
watch([accountFilter, typeFilter], () => { page.value = 1; loadHistory() })

const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

// -------- transfer dialog --------
const transferDialog = ref(false)
const transferSaving = ref(false)
const transferForm = ref({ from: 'BANK', to: 'SAFE', amount: 0, fee: 0, description: '' })

function openTransfer() {
  transferForm.value = { from: 'BANK', to: 'SAFE', amount: 0, fee: 0, description: '' }
  transferDialog.value = true
}

function swapTransferAccounts() {
  const { from, to } = transferForm.value
  transferForm.value.from = to
  transferForm.value.to = from
}

const transferCredited = computed(() =>
  Math.max(0, Number(transferForm.value.amount || 0) - Number(transferForm.value.fee || 0)),
)

const transferSourceBalance = computed(() => {
  const src = accounts.value?.[transferForm.value.from]

  return Number(src?.balance ?? 0)
})

const transferInsufficient = computed(() => {
  const amt = Number(transferForm.value.amount || 0)

  return amt > 0 && amt > transferSourceBalance.value
})

async function doTransfer() {
  if (transferForm.value.from === transferForm.value.to) {
    notify(t('From and To must differ'), 'error')

    return
  }
  if (!transferForm.value.amount || transferForm.value.amount <= 0) {
    notify(t('Amount must be greater than 0'), 'error')

    return
  }
  if (transferInsufficient.value) {
    notify(t('Insufficient balance: available {bal}', { bal: formatCurrency(transferSourceBalance.value) }), 'error')

    return
  }
  transferSaving.value = true
  try {
    await axios.post('/treasury/transfer', transferForm.value)
    notify(t('Transfer completed'))
    transferDialog.value = false
    await Promise.all([loadAccounts(), loadHistory()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    transferSaving.value = false
  }
}

// -------- expense dialog --------
const expenseDialog = ref(false)
const expenseSaving = ref(false)
const expenseForm = ref({ account: 'SAFE', amount: 0, fee: 0, category: '', description: '' })

function openExpense() {
  expenseForm.value = { account: 'SAFE', amount: 0, fee: 0, category: '', description: '' }
  expenseDialog.value = true
}

// The backend debits amount + fee from the chosen account, so preview the true
// outflow and guard against overspending before the request is sent — mirrors
// the transfer dialog's insufficient-balance check.
const expenseAccountBalance = computed(() =>
  Number(accounts.value?.[expenseForm.value.account]?.balance ?? 0),
)
const expenseTotalOut = computed(() =>
  Math.max(0, Number(expenseForm.value.amount || 0) + Number(expenseForm.value.fee || 0)),
)
const expenseInsufficient = computed(() =>
  expenseTotalOut.value > 0 && expenseTotalOut.value > expenseAccountBalance.value,
)
const expenseRemaining = computed(() =>
  expenseAccountBalance.value - expenseTotalOut.value,
)

async function doExpense() {
  if (!expenseForm.value.amount || expenseForm.value.amount <= 0) {
    notify(t('Amount must be greater than 0'), 'error')

    return
  }
  if (expenseInsufficient.value) {
    notify(t('Insufficient balance: available {bal}', { bal: formatCurrency(expenseAccountBalance.value) }), 'error')

    return
  }
  expenseSaving.value = true
  try {
    await axios.post('/treasury/expense', expenseForm.value)
    notify(t('Expense recorded'))
    expenseDialog.value = false
    await Promise.all([loadAccounts(), loadHistory()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    expenseSaving.value = false
  }
}

// -------- delta display --------
function deltaDisplay(t_: any) {
  const v = Number(t_.delta ?? 0)
  const sign = v >= 0 ? '+' : '−'
  const colorClass = v >= 0 ? 'text-success-strong' : 'text-error-strong'

  return { text: `${sign}${formatCurrency(Math.abs(v))}`, colorClass }
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Treasury')"
      :subtitle="t('Ledger')"
    />

    <!-- Account cards -->
    <div class="grid cols-3 treasury-kpis">
      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-success">
            <DesignIcon name="lock" :size="20" />
          </div>
          <div class="kpi-card__label">{{ t('Safe (cash)') }}</div>
        </div>
        <div v-if="accounts.SAFE" class="kpi-card__value num-tabular">
          {{ formatCurrency(accounts.SAFE.balance ?? 0) }}<span class="kpi-card__unit">{{ t('currency_short') }}</span>
        </div>
        <Skeleton v-else :h="28" w="140px" :r="4" style="margin: 4px 0;" />
        <div v-if="accounts.SAFE?.last_updated" class="kpi-card__sub">
          {{ t('Updated') }}: {{ formatDate(accounts.SAFE.last_updated) }}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-primary">
            <DesignIcon name="wallet" :size="20" />
          </div>
          <div class="kpi-card__label">{{ t('Bank (cards)') }}</div>
        </div>
        <div v-if="accounts.BANK" class="kpi-card__value num-tabular">
          {{ formatCurrency(accounts.BANK.balance ?? 0) }}<span class="kpi-card__unit">{{ t('currency_short') }}</span>
        </div>
        <Skeleton v-else :h="28" w="140px" :r="4" style="margin: 4px 0;" />
        <div v-if="accounts.BANK?.last_updated" class="kpi-card__sub">
          {{ t('Updated') }}: {{ formatDate(accounts.BANK.last_updated) }}
        </div>
      </div>

      <div class="kpi-card treasury-total">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-info">
            <DesignIcon name="wallet" :size="20" />
          </div>
          <div class="kpi-card__label">{{ t('Total treasury') }}</div>
        </div>
        <div v-if="accountsReady" class="kpi-card__value num-tabular">
          {{ formatCurrency(totalBalance) }}<span class="kpi-card__unit">{{ t('currency_short') }}</span>
        </div>
        <Skeleton v-else :h="28" w="140px" :r="4" style="margin: 4px 0;" />
        <div class="kpi-card__sub">
          {{ t('Safe + Bank combined') }}
        </div>
      </div>
    </div>

    <!-- History card -->
    <div class="card">
      <div class="toolbar treasury-toolbar">
        <div class="treasury-search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search description or category')"
          />
        </div>
        <div class="treasury-date">
          <Input
            v-model="dateFrom"
            type="date"
            :placeholder="t('Date from')"
            :aria-label="t('Date from')"
          />
        </div>
        <div class="treasury-date">
          <Input
            v-model="dateTo"
            type="date"
            :placeholder="t('Date to')"
            :aria-label="t('Date to')"
          />
        </div>

        <div class="treasury-select">
          <Select
            :model-value="accountFilter ?? ''"
            :placeholder="t('All accounts')"
            :options="accountOptions"
            @update:model-value="(v: string) => accountFilter = v ? v : undefined"
          />
        </div>
        <div class="treasury-select">
          <Select
            :model-value="typeFilter ?? ''"
            :placeholder="t('All types')"
            :options="txnTypeItems"
            @update:model-value="(v: string) => typeFilter = v ? v : undefined"
          />
        </div>

        <div class="treasury-actions">
          <Button
            v-if="hasClientFilters"
            variant="ghost"
            icon="close"
            @click="clearClientFilters"
          >
            {{ t('Clear filters') }}
          </Button>
          <Button
            variant="secondary"
            icon="download"
            :disabled="!filteredTxns.length"
            @click="exportCsv"
          >
            {{ t('Export CSV') }}
          </Button>
          <Button
            variant="secondary"
            icon="refresh"
            @click="openTransfer"
          >
            {{ t('Transfer') }}
          </Button>
          <Button
            variant="danger"
            icon="dollar"
            @click="openExpense"
          >
            {{ t('Record Expense') }}
          </Button>
        </div>
      </div>

      <div
        v-if="hasClientFilters && !loading"
        class="treasury-filternote cell-muted"
      >
        {{ t('Showing {n} of {total} on this page', { n: filteredTxns.length, total: txns.length }) }}
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="columns"
        :rows="filteredTxns"
        row-key="id"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 20, 50, 100]"
        :empty-title="t('No transactions')"
        :empty-sub="t('No treasury activity yet for the current filters')"
        empty-icon="inbox"
      >
        <template #cell.created_at="{ row }">
          <span class="mono nowrap">{{ formatDate(row.created_at) }}</span>
        </template>

        <template #cell.account="{ row }">
          <Badge :tone="row.account === 'SAFE' ? 'success' : 'primary'">
            {{ t(`treasury_account_${row.account}`) }}
          </Badge>
        </template>

        <template #cell.type="{ row }">
          <Badge :tone="txnTypeTone[row.type] ?? 'neutral'">
            {{ t(`treasury_txn_${row.type}`) }}
          </Badge>
        </template>

        <template #cell.delta="{ row }">
          <div>
            <span
              class="num-tabular cell-strong"
              :class="deltaDisplay(row).colorClass"
            >{{ deltaDisplay(row).text }}</span>
            <div
              v-if="Number(row.fee ?? 0) > 0"
              class="cell-muted num-tabular"
              style="font-size: var(--fs-label);"
            >
              {{ t('Fee') }}: {{ formatCurrency(row.fee) }}
            </div>
          </div>
        </template>

        <template #cell.balance_after="{ row }">
          <div>
            <span class="num-tabular">{{ formatCurrency(row.balance_after) }}</span>
            <div
              v-if="row.balance_before != null"
              class="cell-muted num-tabular"
              style="font-size: var(--fs-label);"
            >
              {{ t('Before') }}: {{ formatCurrency(row.balance_before) }}
            </div>
          </div>
        </template>

        <template #cell.category="{ row }">
          <span :class="row.category ? '' : 'cell-muted'">{{ row.category || t('em_dash') }}</span>
        </template>

        <template #cell.description="{ row }">
          <div>
            <span :class="row.description ? '' : 'cell-muted'">{{ row.description || t('em_dash') }}</span>
            <div
              v-if="row.counterparty"
              class="cell-muted"
              style="font-size: var(--fs-label);"
            >
              <DesignIcon name="refresh" :size="12" />
              {{ t(`treasury_account_${row.counterparty}`) }}
            </div>
          </div>
        </template>

        <template #cell.reference="{ row }">
          <a
            v-if="row.reference_type && row.reference_id"
            href="#"
            class="treasury-ref-link"
            @click.prevent="gotoReference(row.reference_type, row.reference_id)"
          >
            {{ referenceLabel(row.reference_type) }} #{{ row.reference_id }}
          </a>
          <span v-else class="cell-muted">{{ t('em_dash') }}</span>
        </template>

        <template #cell.performed_by="{ row }">
          <span :class="row.performed_by ? '' : 'cell-muted'">{{ row.performed_by || t('em_dash') }}</span>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            v-if="row.reference_type && row.reference_id"
            icon="chevright"
            tone="primary"
            :title="t('Open reference')"
            @click.stop="gotoReference(row.reference_type, row.reference_id)"
          />
        </template>
      </DataTable>
    </div>

    <!-- Transfer modal -->
    <Modal
      :open="transferDialog"
      width="min(560px, 100%)"
      :title="t('Transfer between accounts')"
      :subtitle="t('Move funds between Safe and Bank')"
      @close="transferDialog = false"
    >
      <div class="grid cols-2 treasury-form-grid">
        <Field :label="t('From')">
          <Select
            v-model="transferForm.from"
            :options="accountOptions"
          />
        </Field>
        <Field :label="t('To')">
          <Select
            v-model="transferForm.to"
            :options="accountOptions"
          />
        </Field>
        <div class="treasury-swap-row">
          <button
            type="button"
            class="treasury-swap-btn"
            @click="swapTransferAccounts"
          >
            <DesignIcon name="sort" :size="14" />
            {{ t('Swap direction') }}
          </button>
        </div>
        <Field
          :label="t('Amount')"
          :error="transferInsufficient ? t('Insufficient balance: available {bal}', { bal: formatCurrency(transferSourceBalance) }) : ''"
        >
          <Input
            v-model="transferForm.amount"
            type="number"
            min="0"
            :error="transferInsufficient"
            autofocus
          />
        </Field>
        <Field
          :label="t('Fee')"
          :hint="t('Bank fee hint')"
        >
          <Input
            v-model="transferForm.fee"
            type="number"
            min="0"
          />
        </Field>
        <div style="grid-column: span 2;">
          <Field :label="t('Description')">
            <Input v-model="transferForm.description" />
          </Field>
        </div>
        <div
          style="grid-column: span 2; display: flex; justify-content: space-between; align-items: center; padding: 0 4px;"
        >
          <span class="cell-muted">{{ t('Destination will receive') }}</span>
          <span class="num-tabular cell-strong">{{ formatCurrency(transferCredited) }}</span>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="transferSaving"
          @click="transferDialog = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="exchange"
          :loading="transferSaving"
          :disabled="transferSaving || transferInsufficient || transferForm.from === transferForm.to"
          @click="doTransfer"
        >
          {{ t('Transfer') }}
        </Button>
      </template>
    </Modal>

    <!-- Expense modal -->
    <Modal
      :open="expenseDialog"
      width="min(520px, 100%)"
      :title="t('Record Treasury Expense')"
      :subtitle="t('Record an outgoing payment from Safe or Bank')"
      @close="expenseDialog = false"
    >
      <div class="grid cols-2 treasury-form-grid">
        <Field :label="t('Account')">
          <Select
            v-model="expenseForm.account"
            :options="accountOptions"
          />
        </Field>
        <Field
          :label="t('Amount')"
          :error="expenseInsufficient ? t('Insufficient balance: available {bal}', { bal: formatCurrency(expenseAccountBalance) }) : ''"
        >
          <Input
            v-model="expenseForm.amount"
            type="number"
            min="0"
            :error="expenseInsufficient"
            autofocus
          />
        </Field>
        <div style="grid-column: span 2;">
          <Field
            :label="t('Fee / commission (optional)')"
            :hint="t('Expense fee hint')"
          >
            <Input
              v-model="expenseForm.fee"
              type="number"
              min="0"
            />
          </Field>
        </div>
        <div style="grid-column: span 2;">
          <Field :label="t('Category')">
            <Input
              v-model="expenseForm.category"
              :placeholder="t('Expense category placeholder')"
            />
          </Field>
        </div>
        <div style="grid-column: span 2;">
          <Field :label="t('Description')">
            <Input v-model="expenseForm.description" />
          </Field>
        </div>
        <div
          v-if="expenseTotalOut > 0"
          class="treasury-expense-preview"
        >
          <div class="treasury-preview-row">
            <span class="cell-muted">{{ t('Total debited') }}</span>
            <span class="num-tabular cell-strong">{{ formatCurrency(expenseTotalOut) }}</span>
          </div>
          <div class="treasury-preview-row">
            <span class="cell-muted">{{ t('Balance after this expense') }}</span>
            <span
              class="num-tabular cell-strong"
              :class="expenseInsufficient ? 'text-error-strong' : ''"
            >{{ formatCurrency(expenseRemaining) }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="expenseSaving"
          @click="expenseDialog = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="minus"
          :loading="expenseSaving"
          :disabled="expenseSaving || expenseInsufficient"
          @click="doExpense"
        >
          {{ t('Record Expense') }}
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

<style scoped>
.treasury-kpis {
  margin-bottom: var(--sp-5);
}

.treasury-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
}

.treasury-search {
  flex: 1 1 240px;
  min-width: 220px;
  max-width: 320px;
}

.treasury-date {
  flex: 0 1 170px;
  min-width: 160px;
}

.treasury-select {
  flex: 0 1 180px;
  min-width: 160px;
}

.treasury-actions {
  display: flex;
  gap: var(--sp-2);
  margin-left: auto;
  flex-wrap: wrap;
}

.treasury-ref-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.treasury-ref-link:hover { text-decoration: underline; }

.text-success-strong { color: rgb(var(--v-theme-success-strong)); }
.text-error-strong { color: rgb(var(--v-theme-error-strong)); }

.treasury-total .kpi-card__value { color: rgb(var(--v-theme-info-strong, var(--v-theme-primary))); }

.treasury-filternote {
  padding: var(--sp-2) var(--sp-4) 0;
  font-size: var(--fs-label);
}

.treasury-form-grid {
  gap: var(--sp-4);
}

.treasury-swap-row {
  grid-column: span 2;
  display: flex;
  justify-content: center;
  margin-top: calc(-1 * var(--sp-2));
}

.treasury-swap-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: var(--fs-label);
  color: rgb(var(--v-theme-primary));
  background: transparent;
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.treasury-swap-btn:hover { background: rgba(var(--v-theme-primary), 0.08); }

.treasury-expense-preview {
  grid-column: span 2;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  background: rgba(var(--v-theme-on-surface), 0.03);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 8px;
}

.treasury-preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 768px) {
  .treasury-search,
  .treasury-date,
  .treasury-select { flex: 1 1 100%; min-width: 0; max-width: none; }
  .treasury-actions { margin-left: 0; width: 100%; }
  .treasury-actions > * { flex: 1 1 auto; }
  .treasury-form-grid { grid-template-columns: 1fr; }
  .treasury-form-grid > div[style*="span 2"] { grid-column: span 1 !important; }
  .treasury-swap-row,
  .treasury-expense-preview { grid-column: span 1; }
}

@media (max-width: 480px) {
  .treasury-kpis { grid-template-columns: 1fr; }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

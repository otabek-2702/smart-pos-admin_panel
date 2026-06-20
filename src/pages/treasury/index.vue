<script setup lang="ts">
import axios from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

const TXN_TYPES = [
  'INKASSA', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE', 'EXPENSE', 'ADJUSTMENT',
  'SUPPLIER_PAYMENT', 'SALARY_PAYMENT', 'SHIFT_DEPOSIT',
]
const txnTypeItems = computed(() => TXN_TYPES.map(v => ({ title: t(`treasury_txn_${v}`), value: v })))

const txnTypeColor: Record<string, string> = {
  INKASSA: 'success',
  TRANSFER_IN: 'info',
  TRANSFER_OUT: 'warning',
  FEE: 'secondary',
  EXPENSE: 'error',
  ADJUSTMENT: 'default',
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

const headers = [
  { title: t('Date'), key: 'created_at', sortable: false, width: '160px' },
  { title: t('Account'), key: 'account', sortable: false, width: '90px' },
  { title: t('Type'), key: 'type', sortable: false, width: '140px' },
  { title: t('Amount'), key: 'delta', sortable: false, align: 'end' as const },
  { title: t('Balance after'), key: 'balance_after', sortable: false, align: 'end' as const },
  { title: t('Category'), key: 'category', sortable: false },
  { title: t('Description'), key: 'description', sortable: false },
  { title: t('Reference'), key: 'reference', sortable: false, width: '140px' },
  { title: t('By'), key: 'performed_by', sortable: false },
]

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

// -------- transfer dialog --------
const transferDialog = ref(false)
const transferSaving = ref(false)
const transferForm = ref({ from: 'BANK', to: 'SAFE', amount: 0, fee: 0, description: '' })

function openTransfer() {
  transferForm.value = { from: 'BANK', to: 'SAFE', amount: 0, fee: 0, description: '' }
  transferDialog.value = true
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

async function doExpense() {
  if (!expenseForm.value.amount || expenseForm.value.amount <= 0) {
    notify(t('Amount must be greater than 0'), 'error')

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
function deltaDisplay(t: any) {
  const v = Number(t.delta ?? 0)
  const sign = v >= 0 ? '+' : '−'
  const color = v >= 0 ? 'text-success' : 'text-error'

  return { text: `${sign}${formatCurrency(Math.abs(v))}`, color }
}
</script>

<template>
  <div>
    <div class="page-head">
      <div style="min-width:0;">
        <h1 class="page-head__title">{{ t('Treasury') }}</h1>
        <div class="page-head__subtitle">{{ t('Ledger') }}</div>
      </div>
    </div>

    <!-- Account cards -->
    <VRow class="mb-4">
      <VCol cols="12" sm="6">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-success"><VIcon icon="bx-shield" size="20" /></div>
            <div class="kpi-card__label">{{ t('Safe (cash)') }}</div>
          </div>
          <div v-if="accounts.SAFE" class="kpi-card__value num-tabular">
            {{ formatCurrency(accounts.SAFE.balance ?? 0) }}<span class="kpi-card__unit">UZS</span>
          </div>
          <div v-else class="sk-box my-1" style="width:140px;height:28px;border-radius:4px;" />
          <div v-if="accounts.SAFE?.last_updated" class="kpi-card__sub">
            {{ t('Updated') }}: {{ formatDate(accounts.SAFE.last_updated) }}
          </div>
        </div>
      </VCol>

      <VCol cols="12" sm="6">
        <div class="kpi-card">
          <div class="kpi-card__top">
            <div class="kpi-card__icon t-primary"><VIcon icon="bx-credit-card" size="20" /></div>
            <div class="kpi-card__label">{{ t('Bank (cards)') }}</div>
          </div>
          <div v-if="accounts.BANK" class="kpi-card__value num-tabular">
            {{ formatCurrency(accounts.BANK.balance ?? 0) }}<span class="kpi-card__unit">UZS</span>
          </div>
          <div v-else class="sk-box my-1" style="width:140px;height:28px;border-radius:4px;" />
          <div v-if="accounts.BANK?.last_updated" class="kpi-card__sub">
            {{ t('Updated') }}: {{ formatDate(accounts.BANK.last_updated) }}
          </div>
        </div>
      </VCol>
    </VRow>

    <!-- History card -->
    <VCard>
      <VCardText class="d-flex align-center gap-3 py-3 flex-wrap">
        <VTextField
          v-model="search"
          :placeholder="t('Search description or category')"
          density="compact"
          style="min-inline-size:220px;max-inline-size:280px;"
          hide-details
          clearable
          prepend-inner-icon="bx-search"
        />
        <VTextField
          v-model="dateFrom"
          :placeholder="t('Date from')"
          type="date"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
        <VTextField
          v-model="dateTo"
          :placeholder="t('Date to')"
          type="date"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VSelect
          v-model="accountFilter"
          :items="[{ title: t('Safe (cash)'), value: 'SAFE' }, { title: t('Bank (cards)'), value: 'BANK' }]"
          :placeholder="t('Account')"
          density="compact"
          style="min-inline-size:160px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="typeFilter"
          :items="txnTypeItems"
          :placeholder="t('Type')"
          density="compact"
          style="min-inline-size:180px;"
          hide-details
          clearable
        />
        <VBtn
          variant="tonal"
          prepend-icon="bx-transfer"
          @click="openTransfer"
        >
          {{ t('Transfer') }}
        </VBtn>
        <VBtn
          color="error"
          prepend-icon="bx-minus-circle"
          @click="openExpense"
        >
          {{ t('Record Expense') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="filteredTxns"
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
          v-if="loading && txns.length === 0"
          #body
        >
          <tr
            v-for="n in itemsPerPage"
            :key="n"
            class="sk-row"
          >
            <td
              v-for="c in 9"
              :key="c"
              class="sk-cell"
            >
              <div
                class="sk-box"
                style="width:100%;height:13px;border-radius:4px;"
              />
            </td>
          </tr>
        </template>

        <template #item.created_at="{ item }">
          {{ formatDate(item.raw.created_at) }}
        </template>
        <template #item.account="{ item }">
          <VChip
            class="status-pill"
            size="x-small"
            :color="item.raw.account === 'SAFE' ? 'success' : 'primary'"
            variant="tonal"
          >
            {{ t(`treasury_account_${item.raw.account}`) }}
          </VChip>
        </template>
        <template #item.type="{ item }">
          <VChip
            class="status-pill"
            size="small"
            :color="txnTypeColor[item.raw.type] ?? 'default'"
            variant="tonal"
          >
            {{ t(`treasury_txn_${item.raw.type}`) }}
          </VChip>
        </template>
        <template #item.delta="{ item }">
          <span
            class="font-weight-medium num-tabular"
            :class="deltaDisplay(item.raw).color"
          >{{ deltaDisplay(item.raw).text }}</span>
          <div
            v-if="Number(item.raw.fee ?? 0) > 0"
            class="text-caption text-disabled num-tabular"
          >
            {{ t('Fee') }}: {{ formatCurrency(item.raw.fee) }}
          </div>
        </template>
        <template #item.balance_after="{ item }">
          <span class="num-tabular">{{ formatCurrency(item.raw.balance_after) }}</span>
          <div
            v-if="item.raw.balance_before != null"
            class="text-caption text-disabled num-tabular"
          >
            {{ t('Before') }}: {{ formatCurrency(item.raw.balance_before) }}
          </div>
        </template>
        <template #item.category="{ item }">
          {{ item.raw.category || '—' }}
        </template>
        <template #item.description="{ item }">
          <span class="text-body-2">{{ item.raw.description || '—' }}</span>
          <div
            v-if="item.raw.counterparty"
            class="text-caption text-disabled"
          >
            ↔ {{ t(`treasury_account_${item.raw.counterparty}`) }}
          </div>
        </template>
        <template #item.reference="{ item }">
          <a
            v-if="item.raw.reference_type && item.raw.reference_id"
            href="#"
            class="text-primary text-decoration-none"
            @click.prevent="gotoReference(item.raw.reference_type, item.raw.reference_id)"
          >
            {{ item.raw.reference_type }} #{{ item.raw.reference_id }}
          </a>
          <span
            v-else
            class="text-disabled"
          >—</span>
        </template>
        <template #item.performed_by="{ item }">
          {{ item.raw.performed_by || '—' }}
        </template>
      </VDataTableServer>
    </VCard>

    <!-- Transfer dialog -->
    <VDialog
      v-model="transferDialog"
      max-width="560"
      persistent
    >
      <VCard :title="t('Transfer between accounts')">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="transferForm.from"
                :items="[{ title: t('Safe (cash)'), value: 'SAFE' }, { title: t('Bank (cards)'), value: 'BANK' }]"
                :label="t('From')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="transferForm.to"
                :items="[{ title: t('Safe (cash)'), value: 'SAFE' }, { title: t('Bank (cards)'), value: 'BANK' }]"
                :label="t('To')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="transferForm.amount"
                :label="t('Amount')"
                type="number"
                min="0"
                autofocus
                :error="transferInsufficient"
                :error-messages="transferInsufficient
                  ? [t('Insufficient balance: available {bal}', { bal: formatCurrency(transferSourceBalance) })]
                  : []"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="transferForm.fee"
                :label="t('Fee')"
                type="number"
                min="0"
                :hint="t('Bank / processor charge — destination credited amount − fee')"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="transferForm.description"
                :label="t('Description')"
              />
            </VCol>
            <VCol cols="12">
              <div class="d-flex justify-space-between text-body-2 px-2">
                <span class="text-disabled">{{ t('Destination will receive') }}</span>
                <span class="font-weight-bold num-tabular">{{ formatCurrency(transferCredited) }}</span>
              </div>
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="transferDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="primary"
            :loading="transferSaving"
            @click="doTransfer"
          >
            {{ t('Transfer') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Expense dialog -->
    <VDialog
      v-model="expenseDialog"
      max-width="520"
      persistent
    >
      <VCard :title="t('Record Treasury Expense')">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="expenseForm.account"
                :items="[{ title: t('Safe (cash)'), value: 'SAFE' }, { title: t('Bank (cards)'), value: 'BANK' }]"
                :label="t('Account')"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="expenseForm.amount"
                :label="t('Amount')"
                type="number"
                min="0"
                autofocus
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model.number="expenseForm.fee"
                :label="t('Fee / commission (optional)')"
                type="number"
                min="0"
                :hint="t('Bank/processor charge — debits the same account')"
                persistent-hint
              />
            </VCol>
            <VCol cols="12">
              <VTextField
                v-model="expenseForm.category"
                :label="t('Category')"
                :placeholder="t('Rent, utilities, supplies …')"
              />
            </VCol>
            <VCol cols="12">
              <VTextarea
                v-model="expenseForm.description"
                :label="t('Description')"
                rows="2"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            @click="expenseDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="error"
            :loading="expenseSaving"
            @click="doExpense"
          >
            {{ t('Record Expense') }}
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

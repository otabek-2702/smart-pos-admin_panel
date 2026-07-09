<script setup lang="ts">
import axios from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable, { type DataTableColumn, type DataTablePagination } from '@/components/design/DataTable.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency, formatDate } = useFormatters()
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const balance = ref<any>(null)
const stats = ref<any>(null)
const loading = ref(true)

const historyItems = ref<any[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyPage = ref(1)
const historyPerPage = ref(10)

// Client-side filters (BE only accepts page + per_page — type/date filtering deferred to BE)
const typeFilter = ref<string>('')
const dateFrom = ref<string>('')
const dateTo = ref<string>('')
const inkassTypeOptions = ['CASH', 'UZCARD', 'HUMO', 'PAYME']

const typeFilterOptions = computed(() =>
  inkassTypeOptions.map(v => ({ value: v, label: t(`inkass_type_${v}`) })),
)

const filteredHistoryItems = computed(() => {
  return historyItems.value.filter((row: any) => {
    if (typeFilter.value && row?.inkass_type !== typeFilter.value)
      return false
    if (dateFrom.value) {
      const created = row?.created_at ? new Date(row.created_at) : null
      if (!created || created < new Date(dateFrom.value))
        return false
    }
    if (dateTo.value) {
      const created = row?.created_at ? new Date(row.created_at) : null
      const to = new Date(dateTo.value)
      to.setHours(23, 59, 59, 999)
      if (!created || created > to)
        return false
    }
    return true
  })
})

const performDialog = ref(false)
const performLoading = ref(false)
const performAmounts = ref({ cash: 0, uzcard: 0, humo: 0, payme: 0 })
const performNotes = ref('')

const totalRemoved = computed(() =>
  Object.values(performAmounts.value).reduce((acc, v) => acc + (Number(v) || 0), 0),
)

// The register drawer holds ONLY physical cash. Card collections (UZCARD /
// HUMO / PAYME) settle to the bank and never sat in the drawer, so the cash
// portion is the only thing bounded by — and subtracted from — the balance.
// Mirror the backend split so the operator sees exactly what will happen.
const availableCash = computed(() => Number(balance.value?.balance ?? 0))
const cashAmount = computed(() => Number(performAmounts.value.cash) || 0)
const cardTotal = computed(() =>
  (Number(performAmounts.value.uzcard) || 0)
  + (Number(performAmounts.value.humo) || 0)
  + (Number(performAmounts.value.payme) || 0),
)
const cashExceeds = computed(() => cashAmount.value > availableCash.value)
const canConfirmPerform = computed(() => totalRemoved.value > 0 && !cashExceeds.value)

function collectAllCash() {
  performAmounts.value.cash = availableCash.value
}

// Row detail — the history payload already carries every field (including the
// collection period), so open the drawer straight from the row: no extra fetch.
const detailDialog = ref(false)
const detailRow = ref<any>(null)

function openDetail(row: any) {
  detailRow.value = row
  detailDialog.value = true
}

const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'created_at', label: t('Date'), sortable: false, align: 'left' },
  { key: 'cashier', label: t('Cashier'), sortable: false, align: 'left' },
  { key: 'inkass_type', label: t('Type'), sortable: false, align: 'left' },
  { key: 'amount', label: t('Amount'), sortable: false, align: 'right' },
  { key: 'balance_after', label: t('Balance After'), sortable: false, align: 'right' },
  { key: 'total_orders', label: t('Total Orders'), sortable: false, align: 'right' },
  { key: 'total_revenue', label: t('Total Revenue'), sortable: false, align: 'right' },
  { key: 'notes', label: t('Notes'), sortable: false, align: 'left' },
])

async function loadBalance() {
  loading.value = true
  try {
    const [bal, st] = await Promise.allSettled([
      axios.get('/inkassa/balance'),
      axios.get('/inkassa/stats'),
    ])

    if (bal.status === 'fulfilled')
      balance.value = bal.value.data?.data ?? bal.value.data
    if (st.status === 'fulfilled')
      stats.value = (st.value.data?.data ?? st.value.data)?.stats ?? null
  }
  finally {
    loading.value = false
  }
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await axios.get('/inkassa/history', { params: { page: historyPage.value, per_page: historyPerPage.value } })
    const d = res.data?.data ?? res.data

    historyItems.value = d?.inkassas ?? []
    historyTotal.value = d?.pagination?.total_inkassas ?? d?.pagination?.total ?? historyItems.value.length
  }
  catch {
    notify(t('Failed to load history'), 'error')
  }
  finally {
    historyLoading.value = false
  }
}

function openPerform() {
  performAmounts.value = { cash: 0, uzcard: 0, humo: 0, payme: 0 }
  performNotes.value = ''
  performDialog.value = true
}

async function performInkassa() {
  if (totalRemoved.value <= 0) {
    notify(t('Amount is required'), 'error')

    return
  }
  if (cashExceeds.value) {
    notify(t('Cash exceeds register balance'), 'error')

    return
  }
  performLoading.value = true
  try {
    // BE reads body directly as amounts dict + a `notes` key — NOT nested.
    await axios.post('/inkassa/perform', {
      cash: performAmounts.value.cash,
      uzcard: performAmounts.value.uzcard,
      humo: performAmounts.value.humo,
      payme: performAmounts.value.payme,
      notes: performNotes.value,
    })
    notify(t('Inkassa performed successfully'))
    performDialog.value = false
    await Promise.all([loadBalance(), loadHistory()])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    performLoading.value = false
  }
}

onMounted(() => { loadBalance(); loadHistory() })
watch([historyPage, historyPerPage], loadHistory)

const pagination = computed<DataTablePagination>(() => ({
  page: historyPage.value,
  perPage: historyPerPage.value,
  total: historyTotal.value,
  onPage: (p: number) => { historyPage.value = p },
  onPerPage: (n: number) => { historyPerPage.value = n; historyPage.value = 1 },
}))
</script>

<template>
  <div class="page inkassa-page">
    <PageHeader
      :title="t('Inkassa')"
      :subtitle="t('Inkassa subtitle')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="openPerform"
        >
          {{ t('Perform Inkassa') }}
        </Button>
        <Button
          variant="secondary"
          icon="refresh"
          @click="loadHistory"
        >
          {{ t('Refresh') }}
        </Button>
      </template>
    </PageHeader>

    <!-- KPI cards -->
    <div class="grid cols-3 inkassa-kpis">
      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-success"><VIcon icon="bx-wallet" size="20" /></div>
          <div class="kpi-card__label">{{ t('Cash Balance') }}</div>
        </div>
        <div v-if="balance" class="kpi-card__value num-tabular">
          {{ formatCurrency(balance.balance ?? 0) }}<span class="kpi-card__unit">{{ t('currency_UZS') }}</span>
        </div>
        <div v-else class="sk-box mb-1" style="width:120px;height:24px;border-radius:4px;" />
        <div
          v-if="balance?.last_updated"
          class="kpi-card__meta"
        >
          {{ t('Updated') }} {{ formatDate(balance.last_updated) }}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-primary"><VIcon icon="bx-trending-up" size="20" /></div>
          <div class="kpi-card__label">{{ t("Today's Revenue") }}</div>
        </div>
        <div v-if="stats" class="kpi-card__value num-tabular">
          {{ formatCurrency(stats.today?.total_revenue ?? 0) }}<span class="kpi-card__unit">{{ t('currency_UZS') }}</span>
        </div>
        <div v-else class="sk-box mb-1" style="width:120px;height:24px;border-radius:4px;" />
      </div>

      <div class="kpi-card">
        <div class="kpi-card__top">
          <div class="kpi-card__icon t-info"><VIcon icon="bx-receipt" size="20" /></div>
          <div class="kpi-card__label">{{ t("Today's Orders") }}</div>
        </div>
        <div v-if="stats" class="kpi-card__value num-tabular">{{ stats.today?.order_count ?? 0 }}</div>
        <div v-else class="sk-box mb-1" style="width:60px;height:24px;border-radius:4px;" />
      </div>
    </div>

    <!-- Performance lists -->
    <div
      v-if="stats?.cashier_performance?.length || stats?.top_products?.length"
      class="grid cols-2 perf-grid"
    >
      <Card v-if="stats?.cashier_performance?.length">
        <div class="card__head">
          <h3 class="card__title">{{ t('Cashier Performance (today)') }}</h3>
        </div>
        <div class="perf-list">
          <div
            v-for="c in stats.cashier_performance"
            :key="c.cashier_id"
            class="perf-row"
          >
            <div class="perf-row__left">
              <div class="perf-avatar">{{ (c.cashier_name ?? '?')[0] }}</div>
              <div>
                <div class="perf-name">{{ c.cashier_name }}</div>
                <div class="perf-sub">{{ c.order_count }} {{ t('Orders').toLowerCase() }}</div>
              </div>
            </div>
            <span class="perf-amount num-tabular">{{ formatCurrency(c.total_revenue) }}</span>
          </div>
        </div>
      </Card>

      <Card v-if="stats?.top_products?.length">
        <div class="card__head">
          <h3 class="card__title">{{ t(`Today's top products`) }}</h3>
        </div>
        <div class="perf-list">
          <div
            v-for="p in stats.top_products"
            :key="p.product_id ?? p.id"
            class="perf-row"
          >
            <div class="perf-row__left">
              <div>
                <div class="perf-name">{{ p.product_name ?? p.name }}</div>
                <div class="perf-sub">{{ p.total_quantity }} {{ t('sold').toLowerCase() }}</div>
              </div>
            </div>
            <span class="perf-amount num-tabular">{{ formatCurrency(p.total_revenue) }}</span>
          </div>
        </div>
      </Card>
    </div>

    <!-- History card -->
    <Card>
      <div class="toolbar inkassa-toolbar">
        <h3 class="toolbar__title">{{ t('Inkassa History') }}</h3>
        <div class="toolbar__grow" />
        <div class="filter-input filter-input--select">
          <Select
            v-model="typeFilter"
            icon="filter"
            :placeholder="t('Filter by Type')"
            :options="typeFilterOptions"
          />
        </div>
        <div class="filter-input">
          <Field :label="t('Date From')">
            <Input
              v-model="dateFrom"
              type="date"
            />
          </Field>
        </div>
        <div class="filter-input">
          <Field :label="t('Date To')">
            <Input
              v-model="dateTo"
              type="date"
            />
          </Field>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :rows="filteredHistoryItems"
        :loading="historyLoading"
        :pagination="pagination"
        :empty-title="t('No inkassa records')"
        :empty-sub="t('No inkassa records sub')"
        empty-icon="inbox"
      >
        <template #cell.created_at="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
        <template #cell.cashier="{ row }">
          {{ row.cashier?.name || '—' }}
        </template>
        <template #cell.inkass_type="{ row }">
          <Badge
            v-if="row.inkass_type"
            tone="primary"
          >
            {{ t(`inkass_type_${row.inkass_type}`) }}
          </Badge>
          <span v-else>—</span>
        </template>
        <template #cell.amount="{ row }">
          <span class="num-tabular fw-medium">{{ formatCurrency(row.amount) }}</span>
        </template>
        <template #cell.balance_after="{ row }">
          <span class="num-tabular">{{ row.balance_after != null ? formatCurrency(row.balance_after) : '—' }}</span>
        </template>
        <template #cell.total_orders="{ row }">
          <span class="num-tabular">{{ row.total_orders ?? '—' }}</span>
        </template>
        <template #cell.total_revenue="{ row }">
          <span class="num-tabular">{{ row.total_revenue != null ? formatCurrency(row.total_revenue) : '—' }}</span>
        </template>
        <template #cell.notes="{ row }">
          <span class="text-muted">{{ row.notes || '—' }}</span>
        </template>
        <template #row-actions="{ row }">
          <IconAction
            icon="receipt"
            tone="primary"
            :title="t('Details')"
            @click="openDetail(row)"
          />
        </template>
      </DataTable>
    </Card>

    <!-- Perform Inkassa Modal -->
    <Modal
      :open="performDialog"
      :title="t('Perform Inkassa')"
      :subtitle="t('Perform Inkassa subtitle')"
      :width="520"
      :close-on-backdrop="false"
      @close="performDialog = false"
    >
      <div class="form-grid form-grid--amounts">
        <Field
          class="span-2"
          :error="cashExceeds ? t('Cash exceeds register balance') : ''"
        >
          <div class="field-labelrow">
            <span class="field__label">{{ t('inkass_type_CASH') }}</span>
            <button
              type="button"
              class="linkbtn"
              @click="collectAllCash"
            >
              {{ t('Collect all') }} · {{ formatCurrency(availableCash) }}
            </button>
          </div>
          <Input
            v-model="performAmounts.cash"
            type="number"
            min="0"
            :error="cashExceeds"
            autofocus
          />
        </Field>
        <Field :label="t('inkass_type_UZCARD')">
          <Input
            v-model="performAmounts.uzcard"
            type="number"
            min="0"
          />
        </Field>
        <Field :label="t('inkass_type_HUMO')">
          <Input
            v-model="performAmounts.humo"
            type="number"
            min="0"
          />
        </Field>
        <Field :label="t('inkass_type_PAYME')">
          <Input
            v-model="performAmounts.payme"
            type="number"
            min="0"
          />
        </Field>
        <Field
          :label="t('Notes')"
          class="span-2"
        >
          <Input
            v-model="performNotes"
            :placeholder="t('Notes placeholder')"
          />
        </Field>
      </div>

      <div class="perform-summary">
        <div class="perform-summary__row">
          <span class="perform-summary__label">
            <VIcon icon="bx-wallet" size="15" class="me-1" />{{ t('Cash to safe') }}
          </span>
          <span class="num-tabular">{{ formatCurrency(cashAmount) }}</span>
        </div>
        <div class="perform-summary__row">
          <span class="perform-summary__label">
            <VIcon icon="bx-bank" size="15" class="me-1" />{{ t('Cards to bank') }}
          </span>
          <span class="num-tabular">{{ formatCurrency(cardTotal) }}</span>
        </div>
        <div class="perform-summary__row perform-summary__row--total">
          <span class="perform-total__label">{{ t('Total collected') }}</span>
          <span class="perform-total__value num-tabular">{{ formatCurrency(totalRemoved) }}</span>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="performLoading"
          @click="performDialog = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="performLoading"
          :disabled="performLoading || !canConfirmPerform"
          @click="performInkassa"
        >
          {{ t('Confirm') }}
        </Button>
      </template>
    </Modal>

    <!-- Inkassa Detail Modal -->
    <Modal
      :open="detailDialog"
      :title="t('Inkassa details')"
      :width="480"
      @close="detailDialog = false"
    >
      <div
        v-if="detailRow"
        class="detail-list"
      >
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Type') }}</span>
          <Badge
            v-if="detailRow.inkass_type"
            tone="primary"
          >
            {{ t(`inkass_type_${detailRow.inkass_type}`) }}
          </Badge>
          <span v-else>—</span>
        </div>
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Amount') }}</span>
          <span class="num-tabular fw-medium">{{ formatCurrency(detailRow.amount) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Cashier') }}</span>
          <span>{{ detailRow.cashier?.name || '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Date') }}</span>
          <span class="num-tabular">{{ formatDate(detailRow.created_at) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Period covered') }}</span>
          <span class="num-tabular detail-row__period">
            {{ detailRow.period_start ? formatDate(detailRow.period_start) : '—' }}
            <VIcon icon="bx-right-arrow-alt" size="14" />
            {{ detailRow.period_end ? formatDate(detailRow.period_end) : '—' }}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Balance Before') }}</span>
          <span class="num-tabular">{{ detailRow.balance_before != null ? formatCurrency(detailRow.balance_before) : '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Balance After') }}</span>
          <span class="num-tabular">{{ detailRow.balance_after != null ? formatCurrency(detailRow.balance_after) : '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Total Orders') }}</span>
          <span class="num-tabular">{{ detailRow.total_orders ?? '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-row__label">{{ t('Total Revenue') }}</span>
          <span class="num-tabular">{{ detailRow.total_revenue != null ? formatCurrency(detailRow.total_revenue) : '—' }}</span>
        </div>
        <div
          v-if="detailRow.notes"
          class="detail-row detail-row--notes"
        >
          <span class="detail-row__label">{{ t('Notes') }}</span>
          <span class="text-muted">{{ detailRow.notes }}</span>
        </div>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          @click="detailDialog = false"
        >
          {{ t('Close') }}
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
.inkassa-kpis,
.perf-grid {
  margin-block-end: var(--sp-5);
}

/* Card head */
.card__head {
  padding: var(--sp-4) var(--sp-4) 0;
}
.card__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

/* Perf list rows */
.perf-list {
  padding: var(--sp-3) var(--sp-4) var(--sp-4);
}
.perf-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.perf-row:last-child {
  border-block-end: none;
}
.perf-row__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.perf-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary-weak));
  color: rgb(var(--v-theme-primary));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex: 0 0 auto;
}
.perf-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.perf-sub {
  font-size: 12px;
  color: var(--text-secondary);
}
.perf-amount {
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--v-theme-success-strong));
}

/* Toolbar */
.inkassa-toolbar {
  align-items: flex-end;
}
.toolbar__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  align-self: center;
}
.toolbar__grow {
  flex: 1;
}
.filter-input {
  min-width: 170px;
}
.filter-input--select {
  min-width: 200px;
}

/* Amounts grid */
.form-grid--amounts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}
.form-grid--amounts .span-2 {
  grid-column: 1 / -1;
}

/* KPI meta caption (balance last-updated) */
.kpi-card__meta {
  margin-block-start: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

/* Cash field label row with "collect all" affordance */
.field-labelrow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
  margin-block-end: 6px;
}
.linkbtn {
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  white-space: nowrap;
}
.linkbtn:hover {
  text-decoration: underline;
}

/* Perform summary breakdown */
.perform-summary {
  margin-block-start: var(--sp-3);
  padding-block-start: var(--sp-3);
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.perform-summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-block: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
.perform-summary__label {
  display: inline-flex;
  align-items: center;
}
.perform-summary__row--total {
  margin-block-start: 6px;
  padding-block-start: 8px;
  border-block-start: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.perform-total__label {
  font-size: 13px;
  color: var(--text-secondary);
}
.perform-total__value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

/* Detail modal list */
.detail-list {
  display: flex;
  flex-direction: column;
}
.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding-block: 10px;
  border-block-end: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: 13px;
  color: var(--text);
}
.detail-row:last-child {
  border-block-end: none;
}
.detail-row__label {
  color: var(--text-secondary);
  flex: 0 0 auto;
}
.detail-row__period {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-align: end;
}
.detail-row--notes {
  align-items: flex-start;
}

.fw-medium {
  font-weight: 500;
}
.text-muted {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Responsive */
/* Tablet: KPI strip collapses from 3-up to 2-up, perf grid to 1-col */
@media (max-width: 1024px) {
  .inkassa-kpis {
    grid-template-columns: repeat(2, 1fr);
  }
}
/* Phone (canonical 768px): perf grid stacks, toolbar wraps & filters go full-width.
   KPI strip stays 2-up at this breakpoint per design spec. */
@media (max-width: 768px) {
  .perf-grid {
    grid-template-columns: 1fr;
  }
  .inkassa-toolbar {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .toolbar__grow {
    display: none;
  }
  .filter-input,
  .filter-input--select {
    flex: 1 1 100%;
    min-width: 0;
    width: 100%;
  }
  /* Modal: collapse hard-coded width to viewport on phone */
  :deep(.modal-card) {
    width: 100% !important;
    max-width: 100% !important;
  }
}
@media (max-width: 560px) {
  .form-grid--amounts {
    grid-template-columns: 1fr;
  }
  .form-grid--amounts .span-2 {
    grid-column: auto;
  }
}
/* Small phone: KPI strip finally collapses to single column */
@media (max-width: 480px) {
  .inkassa-kpis {
    grid-template-columns: 1fr;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

<script setup lang="ts">
/* ============================================================
   ALPHA POS - Stock Suppliers
   - Design-system primitives only (no Vuetify on the page itself)
   - List / search / filter active
   - Create / Edit / Delete / Pay / Ledger modals
   ============================================================ */
import { stockApi as axios } from '@/plugins/axios'
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
import StateFill from '@/components/design/StateFill.vue'

const { t } = useI18n({ useScope: 'global' })
const { notify } = useNotify()
const { formatCurrency, formatDate } = useFormatters()

// List only returns: id, uuid, code(null), name, city, rating, is_active
const suppliers = ref<any[]>([])
const total = ref(0)
const loading = ref(false)

const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const activeFilter = ref<string | undefined>(undefined)

// detail dialog (view)
const detailDialog = ref(false)
const detailItem = ref<any>(null)
const detailLoading = ref(false)

// create/edit dialog
const dialog = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const deleteDialog = ref(false)
const deleting = ref(false)
const selectedItem = ref<any>(null)

const form = ref({
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  rating: 3,
  payment_terms_days: 30,
  lead_time_days: 7,
})

async function loadSuppliers() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    // BE accepts `active_only` (default true). Map our 3-state select:
    //   undefined → omit (BE will hide inactive by default)
    //   'true'    → active_only=true
    //   'false'   → active_only=false (show all incl. inactive)
    if (activeFilter.value !== undefined)
      params.active_only = activeFilter.value === 'true' ? 'true' : 'false'

    const res = await axios.get('/suppliers/', { params })
    const d = res.data?.data ?? res.data

    suppliers.value = d?.suppliers ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? d?.pagination?.total_suppliers ?? suppliers.value.length
  }
  catch {
    notify(t('Failed to load suppliers'), 'error')
  }
  finally {
    loading.value = false
  }
}

const debouncedSearch = useDebounceFn(() => {
  page.value = 1
  loadSuppliers()
}, 350)

onMounted(loadSuppliers)
watch([page, itemsPerPage], loadSuppliers)
watch(activeFilter, () => { page.value = 1; loadSuppliers() })
watch(search, () => debouncedSearch())

async function openDetail(item: any) {
  detailItem.value = item
  detailDialog.value = true
  detailLoading.value = true
  try {
    const res = await axios.get(`/suppliers/${item.id}/`)

    detailItem.value = res.data?.supplier ?? res.data?.data ?? item
  }
  catch { /* keep basic data */ }
  finally {
    detailLoading.value = false
  }
}

function openCreate() {
  dialogMode.value = 'create'
  form.value = { name: '', contact_person: '', email: '', phone: '', city: '', address: '', rating: 3, payment_terms_days: 30, lead_time_days: 7 }
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item

  // Load detail first to get all fields
  axios.get(`/suppliers/${item.id}/`).then(res => {
    const d = res.data?.data ?? res.data?.supplier ?? res.data?.data ?? item

    form.value = {
      name: d.name ?? '',
      contact_person: d.contact_person ?? '',
      email: d.email ?? '',
      phone: d.phone ?? '',
      city: d.city ?? '',
      address: d.address ?? '',
      rating: d.rating ?? 3,
      payment_terms_days: d.payment_terms_days ?? 30,
      lead_time_days: d.lead_time_days ?? 7,
    }
  }).catch(() => {
    form.value = { name: item.name ?? '', contact_person: '', email: '', phone: '', city: item.city ?? '', address: '', rating: item.rating ?? 3, payment_terms_days: 30, lead_time_days: 7 }
  })
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    if (dialogMode.value === 'create')
      await axios.post('/suppliers/', form.value)
    else
      await axios.patch(`/suppliers/${selectedItem.value.id}/`, form.value)
    notify(dialogMode.value === 'create' ? t('Supplier created') : t('Supplier updated'))
    dialog.value = false
    await loadSuppliers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving supplier'), 'error')
  }
  finally {
    saving.value = false
  }
}

function confirmDelete(item: any) {
  selectedItem.value = item
  deleteDialog.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await axios.delete(`/suppliers/${selectedItem.value.id}/`)
    notify(t('Supplier deleted'))
    deleteDialog.value = false
    await loadSuppliers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting supplier'), 'error')
  }
  finally {
    deleting.value = false
  }
}

// -------- pay supplier --------
const payDialog = ref(false)
const paying = ref<any>(null)
const paySaving = ref(false)
const payForm = ref({ amount: 0, source_account: 'BANK', commission: 0, note: '' })

function openPay(s: any) {
  paying.value = s
  payForm.value = { amount: 0, source_account: 'BANK', commission: 0, note: '' }
  payDialog.value = true
}

async function doPay() {
  if (!paying.value || payForm.value.amount <= 0) {
    notify(t('Amount must be greater than 0'), 'error')

    return
  }
  paySaving.value = true
  try {
    await axios.post(`/suppliers/${paying.value.id}/pay/`, payForm.value)
    notify(t('Payment recorded'))
    payDialog.value = false
    await loadSuppliers()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    paySaving.value = false
  }
}

// -------- ledger drawer --------
const ledgerDialog = ref(false)
const ledgerSupplier = ref<any>(null)
const ledgerLoading = ref(false)
const ledgerRows = ref<any[]>([])
const ledgerPage = ref(1)
const ledgerPerPage = ref(20)
const ledgerTotal = ref(0)
const ledgerBalance = ref<string | null>(null)

async function openLedger(s: any) {
  ledgerSupplier.value = s
  ledgerPage.value = 1
  ledgerRows.value = []
  ledgerBalance.value = null
  ledgerDialog.value = true
  await loadLedger()
}

async function loadLedger() {
  if (!ledgerSupplier.value)
    return
  ledgerLoading.value = true
  try {
    const res = await axios.get(`/suppliers/${ledgerSupplier.value.id}/ledger/`, {
      params: { page: ledgerPage.value, per_page: ledgerPerPage.value },
    })
    const d = res.data?.data ?? res.data

    ledgerRows.value = d?.transactions ?? d?.entries ?? d?.items ?? []
    ledgerTotal.value = d?.pagination?.total ?? ledgerRows.value.length
    ledgerBalance.value = d?.current_balance ?? d?.balance ?? null
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    ledgerLoading.value = false
  }
}

watch(ledgerPage, loadLedger)

const ledgerTypeTone: Record<string, 'warning' | 'success' | 'info' | 'neutral'> = {
  PURCHASE: 'warning',
  PAYMENT: 'success',
  RETURN: 'info',
  ADJUSTMENT: 'neutral',
}

// ---- DataTable columns ----
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'name', label: t('supplier_col_name') },
  { key: 'phone', label: t('supplier_col_phone') },
  { key: 'contact_person', label: t('supplier_col_contact_person') },
  { key: 'city', label: t('supplier_col_city') },
  { key: 'rating', label: t('supplier_col_rating') },
  { key: 'current_balance', label: t('supplier_col_outstanding'), align: 'right' },
  { key: 'is_active', label: t('supplier_col_status') },
])

const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

const statusOptions = computed(() => [
  { value: 'true', label: t('supplier_status_active') },
  { value: 'false', label: t('supplier_status_inactive') },
])

const sourceOptions = computed(() => [
  { value: 'BANK', label: t('pay_source_BANK') },
  { value: 'SAFE', label: t('pay_source_SAFE') },
])
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <PageHeader
      :title="t('Suppliers')"
      :subtitle="t('suppliers_subtitle')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('Add Supplier') }}
        </Button>
      </template>
    </PageHeader>

    <!-- Main table card -->
    <div class="card">
      <!-- Toolbar -->
      <div class="toolbar toolbar--wrap">
        <div class="grow toolbar__search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search suppliers...')"
            :aria-label="t('Search suppliers...')"
          />
        </div>

        <div class="toolbar__status">
          <Select
            :model-value="activeFilter ?? ''"
            :placeholder="t('All')"
            :options="statusOptions"
            @update:model-value="(v: string) => activeFilter = v ? v : undefined"
          />
        </div>
      </div>

      <div class="card__divider" />

      <!-- DataTable -->
      <DataTable
        :columns="columns"
        :rows="suppliers"
        row-key="id"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 25, 50, 100]"
      >
        <!-- Name -->
        <template #cell.name="{ row }">
          <span class="cell-strong">{{ row.name }}</span>
        </template>

        <!-- Phone -->
        <template #cell.phone="{ row }">
          <span class="cell-muted">{{ row.phone || '—' }}</span>
        </template>

        <!-- Contact -->
        <template #cell.contact_person="{ row }">
          <span class="cell-muted">{{ row.contact_person || '—' }}</span>
        </template>

        <!-- City -->
        <template #cell.city="{ row }">
          <span class="cell-muted">{{ row.city || '—' }}</span>
        </template>

        <!-- Rating -->
        <template #cell.rating="{ row }">
          <div class="row" style="gap: 4px;">
            <DesignIcon
              name="star"
              :size="14"
              style="color: rgb(var(--v-theme-warning-strong));"
            />
            <span>{{ row.rating ?? '—' }}</span>
          </div>
        </template>

        <!-- Outstanding balance -->
        <template #cell.current_balance="{ row }">
          <span
            class="mono"
            :style="{ color: Number(row.current_balance) > 0 ? 'rgb(var(--v-theme-warning-strong))' : 'var(--text-tertiary)' }"
          >
            {{ formatCurrency(row.current_balance ?? 0) }}
          </span>
        </template>

        <!-- Status -->
        <template #cell.is_active="{ row }">
          <Badge :tone="row.is_active ? 'success' : 'neutral'" dot>
            {{ row.is_active ? t('supplier_status_active') : t('supplier_status_inactive') }}
          </Badge>
        </template>

        <!-- Inline row actions -->
        <template #row-actions="{ row }">
          <IconAction
            icon="dollar"
            tone="success"
            :title="t('Pay supplier')"
            @click.stop="openPay(row)"
          />
          <IconAction
            icon="receipt"
            :title="t('Ledger')"
            @click.stop="openLedger(row)"
          />
          <IconAction
            icon="eye"
            :title="t('View')"
            @click.stop="openDetail(row)"
          />
          <IconAction
            icon="edit"
            :title="t('Edit')"
            @click.stop="openEdit(row)"
          />
          <IconAction
            icon="trash"
            tone="danger"
            :title="t('Delete')"
            @click.stop="confirmDelete(row)"
          />
        </template>

        <!-- Empty state -->
        <template #empty>
          <StateFill
            icon="package"
            :title="t('suppliers_empty_title')"
            :sub="t('suppliers_empty_sub')"
          />
        </template>
      </DataTable>
    </div>

    <!-- Detail Modal -->
    <Modal
      :open="detailDialog"
      :width="560"
      :title="detailItem?.name ?? ''"
      @close="detailDialog = false"
    >
      <div v-if="detailLoading" class="row" style="justify-content: center; padding: 16px 0;">
        <DesignIcon name="refresh" :size="20" />
        <span style="margin-left: 8px;" class="cell-muted">{{ t('Loading') }}</span>
      </div>

      <div v-if="detailItem" class="grid cols-2 detail-grid" style="gap: var(--sp-4);">
        <div>
          <div class="field__label">
            {{ t('Contact') }}
          </div>
          <div>{{ detailItem.contact_person || '—' }}</div>
        </div>
        <div>
          <div class="field__label">
            {{ t('Phone') }}
          </div>
          <div>{{ detailItem.phone || '—' }}</div>
        </div>
        <div>
          <div class="field__label">
            {{ t('Email') }}
          </div>
          <div>{{ detailItem.email || '—' }}</div>
        </div>
        <div>
          <div class="field__label">
            {{ t('City') }}
          </div>
          <div>{{ detailItem.city || '—' }}</div>
        </div>
        <div>
          <div class="field__label">
            {{ t('Payment Terms') }}
          </div>
          <div>{{ detailItem.payment_terms_days ? `${detailItem.payment_terms_days} ${t('days')}` : '—' }}</div>
        </div>
        <div>
          <div class="field__label">
            {{ t('Lead Time') }}
          </div>
          <div>{{ detailItem.lead_time_days ? `${detailItem.lead_time_days} ${t('days')}` : '—' }}</div>
        </div>
        <div>
          <div class="field__label">
            {{ t('Balance') }}
          </div>
          <div>{{ detailItem.current_balance ?? '—' }}</div>
        </div>
        <div>
          <div class="field__label">
            {{ t('Rating') }}
          </div>
          <div class="row" style="gap: 4px;">
            <DesignIcon
              name="star"
              :size="14"
              style="color: rgb(var(--v-theme-warning-strong));"
            />
            {{ detailItem.rating ?? '—' }}
          </div>
        </div>
        <div v-if="detailItem.items?.length" class="detail-grid__full" style="grid-column: span 2;">
          <div class="field__label" style="margin-bottom: 6px;">
            {{ t('Supplied Items') }} ({{ detailItem.item_count }})
          </div>
          <div class="tablewrap">
            <table class="dtable" style="background: var(--surface); border-radius: 10px; border: 1px solid var(--border); overflow: hidden;">
              <thead>
                <tr>
                  <th>{{ t('Item') }}</th>
                  <th class="num">
                    {{ t('Price') }}
                  </th>
                  <th>{{ t('Unit') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="si in (detailItem.items as any[])" :key="si.id">
                  <td>{{ si.stock_item_name }}</td>
                  <td class="num mono">
                    {{ si.price }}
                  </td>
                  <td>{{ si.unit_short }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" @click="detailDialog = false">
          {{ t('Close') }}
        </Button>
      </template>
    </Modal>

    <!-- Create / Edit Modal -->
    <Modal
      :open="dialog"
      :width="560"
      :title="dialogMode === 'create' ? t('Add Supplier') : t('Edit Supplier')"
      :close-on-backdrop="false"
      @close="dialog = false"
    >
      <div class="grid cols-2 form-grid" style="gap: var(--sp-4);">
        <div class="form-grid__full" style="grid-column: span 2;">
          <Field :label="t('Name')">
            <Input v-model="form.name" />
          </Field>
        </div>

        <Field :label="t('Contact Person')">
          <Input v-model="form.contact_person" />
        </Field>

        <Field :label="t('Phone')">
          <Input v-model="form.phone" />
        </Field>

        <Field :label="t('Email')">
          <Input v-model="form.email" type="email" />
        </Field>

        <Field :label="t('City')">
          <Input v-model="form.city" />
        </Field>

        <div class="form-grid__full" style="grid-column: span 2;">
          <Field :label="t('Address')">
            <Input v-model="form.address" />
          </Field>
        </div>

        <Field :label="t('Rating (1-5)')">
          <Input
            v-model="form.rating"
            type="number"
            min="1"
            max="5"
          />
        </Field>

        <Field :label="t('Payment Terms (days)')">
          <Input
            v-model="form.payment_terms_days"
            type="number"
            min="0"
          />
        </Field>

        <Field :label="t('Lead Time (days)')">
          <Input
            v-model="form.lead_time_days"
            type="number"
            min="0"
          />
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="saving" @click="dialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          :loading="saving"
          :disabled="!form.name || saving"
          @click="save"
        >
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Delete Confirm Modal -->
    <Modal
      :open="deleteDialog"
      :width="440"
      :title="t('Delete Supplier')"
      :subtitle="t('supplier_delete_confirm')"
      @close="deleteDialog = false"
    >
      <div class="row" style="gap: 14px; align-items: flex-start;">
        <div
          class="kpi__icon t-error"
          style="width: 44px; height: 44px; flex: 0 0 44px;"
        >
          <DesignIcon name="alert" :size="22" />
        </div>
        <div>
          <p style="margin: 0; font-weight: 600;">
            {{ selectedItem?.name }}
          </p>
          <p class="muted" style="margin: 6px 0 0; font-size: 14px;">
            {{ t('supplier_delete_warning') }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="deleting" @click="deleteDialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          :loading="deleting"
          :disabled="deleting"
          @click="doDelete"
        >
          {{ t('Delete') }}
        </Button>
      </template>
    </Modal>

    <!-- Pay Modal -->
    <Modal
      :open="payDialog"
      :width="520"
      :title="t('Pay supplier')"
      :close-on-backdrop="false"
      @close="payDialog = false"
    >
      <div v-if="paying" class="cell-muted" style="margin-bottom: var(--sp-3); font-size: 13px;">
        <strong style="color: var(--text);">{{ paying.name }}</strong>
        <span v-if="paying.current_balance">
          · {{ t('Owed') }}:
          <strong class="mono" style="color: rgb(var(--v-theme-warning-strong));">{{ formatCurrency(paying.current_balance) }}</strong>
        </span>
      </div>

      <div class="grid cols-2 form-grid" style="gap: var(--sp-4);">
        <Field :label="t('Amount')">
          <Input
            v-model="payForm.amount"
            type="number"
            min="0"
            autofocus
          />
        </Field>

        <Field :label="t('Source account')">
          <Select
            v-model="payForm.source_account"
            :options="sourceOptions"
          />
        </Field>

        <div class="form-grid__full" style="grid-column: span 2;">
          <Field
            :label="t('Commission / fee (optional)')"
            :hint="t('pay_commission_hint')"
          >
            <Input
              v-model="payForm.commission"
              type="number"
              min="0"
            />
          </Field>
        </div>

        <div class="form-grid__full" style="grid-column: span 2;">
          <Field :label="t('Note')">
            <Input v-model="payForm.note" />
          </Field>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="paySaving" @click="payDialog = false">
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="dollar"
          :loading="paySaving"
          :disabled="paySaving"
          @click="doPay"
        >
          {{ t('Pay') }}
        </Button>
      </template>
    </Modal>

    <!-- Ledger Modal -->
    <Modal
      :open="ledgerDialog"
      :width="860"
      :title="`${ledgerSupplier?.name ?? ''} · ${t('Ledger')}`"
      :subtitle="ledgerBalance !== null ? t('Current balance') + ': ' + formatCurrency(ledgerBalance) : undefined"
      @close="ledgerDialog = false"
    >
      <div class="row" style="justify-content: flex-end; margin-bottom: var(--sp-3);">
        <Button variant="ghost" size="sm" icon="refresh" @click="loadLedger">
          {{ t('supplier_action_refresh') }}
        </Button>
      </div>

      <div v-if="ledgerLoading" class="row" style="justify-content: center; padding: 16px 0;">
        <DesignIcon name="refresh" :size="20" />
        <span style="margin-left: 8px;" class="cell-muted">{{ t('Loading') }}</span>
      </div>

      <div v-else-if="ledgerRows.length === 0">
        <StateFill
          icon="receipt"
          :title="t('No ledger entries')"
        />
      </div>

      <div v-else class="tablewrap">
        <table class="dtable" style="background: var(--surface); border-radius: 10px; border: 1px solid var(--border); overflow: hidden;">
          <thead>
            <tr>
              <th>{{ t('Date') }}</th>
              <th>{{ t('Type') }}</th>
              <th class="num">
                {{ t('Amount') }}
              </th>
              <th class="num">
                {{ t('Balance after') }}
              </th>
              <th>{{ t('Reference') }}</th>
              <th>{{ t('Note') }}</th>
              <th>{{ t('By') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in ledgerRows" :key="r.id">
              <td class="mono nowrap">
                {{ formatDate(r.created_at) }}
              </td>
              <td>
                <Badge :tone="ledgerTypeTone[r.type] ?? 'neutral'">
                  {{ r.type ? t(`supplier_tx_${r.type}`) : '—' }}
                </Badge>
              </td>
              <td
                class="num mono"
                :style="{ color: Number(r.amount ?? r.delta) > 0 ? 'rgb(var(--v-theme-warning-strong))' : 'rgb(var(--v-theme-success-strong))', fontWeight: 600 }"
              >
                {{ formatCurrency(r.amount ?? r.delta ?? 0) }}
              </td>
              <td class="num mono">
                {{ formatCurrency(r.balance_after ?? 0) }}
              </td>
              <td>
                <span v-if="r.reference_type" class="cell-muted" style="font-size: 12px;">
                  {{ t(`ref_${r.reference_type}`) }} #{{ r.reference_id }}
                </span>
                <span v-else class="cell-muted">—</span>
              </td>
              <td class="cell-muted">
                {{ r.note || r.description || '—' }}
              </td>
              <td class="cell-muted">
                {{ r.performed_by || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <Button variant="ghost" @click="ledgerDialog = false">
          {{ t('Close') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
}

.toolbar--wrap {
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar__search {
  max-inline-size: 320px;
  min-inline-size: 180px;
  flex: 1 1 200px;
}

.toolbar__status {
  inline-size: 180px;
}

.tablewrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.field__label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 2px;
}

@media (max-width: 768px) {
  .toolbar__search,
  .toolbar__status {
    inline-size: 100%;
    max-inline-size: none;
    min-inline-size: 0;
    flex: 1 1 100%;
  }
  .form-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .form-grid__full,
  .detail-grid__full {
    grid-column: span 1 !important;
  }
}
</style>

<route lang="yaml">
name: stock-suppliers
meta:
  action: manage
  subject: all
</route>

<script setup lang="ts">
import { discountsApi as axios } from '@/plugins/axios'
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
import Switch from '@/components/design/Switch.vue'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()
const { formatCurrency } = useFormatters()

// ---- state ----
const discounts = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const isActiveFilter = ref<string>('')

const types = ref<any[]>([])

const dialog = ref(false)
const editing = ref<any>(null)
const saving = ref(false)

const deleteDialog = ref(false)
const deletingDiscount = ref<any>(null)

const form = ref({
  name: '',
  code: '',
  discount_type_id: null as number | null,
  value: 0,
  min_order_amount: 0,
  is_active: true,
  start_date: '',
  end_date: '',
  secret_word: '',
})

// ---- table columns ----
const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'name', label: t('Name'), sortable: false, align: 'left' },
  { key: 'code', label: t('Code'), sortable: false, align: 'left' },
  { key: 'discount_type', label: t('Type'), sortable: false, align: 'left' },
  { key: 'value', label: t('Value'), sortable: false, align: 'right' },
  { key: 'is_active', label: t('Status'), sortable: false, align: 'left' },
])

// ---- helpers ----
function methodTone(method?: string): 'success' | 'info' | 'neutral' {
  if (method === 'PERCENTAGE')
    return 'success'
  if (method === 'FIXED_AMOUNT')
    return 'info'
  return 'neutral'
}

function formatValue(row: any): string {
  const method = row.discount_type?.discount_method
  const value = row.value ?? 0
  if (method === 'PERCENTAGE')
    return `${value}%`
  if (method === 'FIXED_AMOUNT')
    return formatCurrency(value)
  return formatCurrency(value)
}

// ---- load ----
async function loadDiscounts() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (isActiveFilter.value !== '')
      params.is_active = isActiveFilter.value === 'true'
    const res = await axios.get('/discounts/', { params })
    const d = res.data?.data ?? res.data

    discounts.value = d?.discounts ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? discounts.value.length
  }
  catch {
    notify(t('Failed to load discounts'), 'error')
  }
  finally {
    loading.value = false
  }
}

async function loadTypes() {
  try {
    const res = await axios.get('/types/', { params: { per_page: 100 } })
    const d = res.data?.data ?? res.data

    types.value = d?.discount_types ?? d?.types ?? d?.items ?? []
  }
  catch { /* ignore */ }
}

onMounted(() => { loadDiscounts(); loadTypes() })
watch([page, itemsPerPage], loadDiscounts)

const debouncedSearch = useDebounceFn(() => { page.value = 1; loadDiscounts() }, 400)

watch(search, debouncedSearch)
watch(isActiveFilter, () => { page.value = 1; loadDiscounts() })

// ---- options ----
const statusOptions = computed(() => [
  { value: 'true', label: t('discount_status_ACTIVE') },
  { value: 'false', label: t('discount_status_INACTIVE') },
])

const typeOptions = computed(() =>
  types.value.map((tp: any) => ({ value: String(tp.id), label: tp.name })),
)

// ---- CRUD ----
function openCreate() {
  editing.value = null
  form.value = {
    name: '',
    code: '',
    discount_type_id: types.value[0]?.id ?? null,
    value: 0,
    min_order_amount: 0,
    is_active: true,
    start_date: '',
    end_date: '',
    secret_word: '',
  }
  dialog.value = true
}

function openEdit(d: any) {
  editing.value = d
  form.value = {
    name: d.name ?? '',
    code: d.code ?? '',
    discount_type_id: d.discount_type?.id ?? d.discount_type_id ?? null,
    value: Number(d.value ?? 0),
    min_order_amount: Number(d.min_order_amount ?? 0),
    is_active: d.is_active ?? true,
    start_date: d.start_date ?? '',
    end_date: d.end_date ?? '',
    // BE never returns secret_word (only has_secret_word: bool). Leave blank;
    // payload omits the field on PUT unless user types a new value.
    secret_word: '',
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    // Build payload — when editing, omit secret_word if blank so we don't
    // overwrite the stored secret (BE never returns it, so it can't be repopulated).
    const payload: any = { ...form.value }
    if (editing.value && !payload.secret_word)
      delete payload.secret_word
    if (editing.value)
      await axios.put(`/discounts/${editing.value.id}/`, payload)
    else
      await axios.post('/discounts/', payload)
    notify(t(editing.value ? 'Discount updated' : 'Discount created'))
    dialog.value = false
    await loadDiscounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

async function toggleActive(d: any) {
  try {
    await axios.post(`/discounts/${d.id}/toggle/`)
    notify(t('Status updated'))
    await loadDiscounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

function confirmDelete(d: any) {
  deletingDiscount.value = d
  deleteDialog.value = true
}

async function remove() {
  if (!deletingDiscount.value)
    return
  try {
    await axios.delete(`/discounts/${deletingDiscount.value.id}/`)
    notify(t('Discount deleted'))
    deleteDialog.value = false
    await loadDiscounts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
}

// ---- pagination control object for DataTable ----
const pagination = computed<DataTablePagination>(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

function clearAllFilters() {
  search.value = ''
  isActiveFilter.value = ''
}
</script>

<template>
  <div class="page discounts-page">
    <PageHeader
      :title="t('Discounts')"
      :subtitle="t('Promo codes subtitle')"
    >
      <template #actions>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('New Discount') }}
        </Button>
      </template>
    </PageHeader>

    <Card>
      <div class="toolbar">
        <div class="toolbar__search">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('Search discounts...')"
          />
        </div>
        <div class="toolbar__filter">
          <Select
            v-model="isActiveFilter"
            icon="filter"
            :placeholder="t('All Discount Statuses')"
            :options="statusOptions"
          />
        </div>
        <div
          v-if="search || isActiveFilter"
          class="toolbar__clear"
        >
          <Button
            variant="ghost"
            @click="clearAllFilters"
          >
            {{ t('Clear filters') }}
          </Button>
        </div>
      </div>

      <DataTable
        :columns="columns"
        :rows="discounts"
        :loading="loading"
        :pagination="pagination"
        :empty-title="t('No discounts found')"
        :empty-sub="t('Create a new discount to get started')"
        empty-icon="tag"
      >
        <template #cell.discount_type="{ row }">
          <div class="cell-type">
            <span>{{ row.discount_type?.name ?? '—' }}</span>
            <Badge
              v-if="row.discount_type?.discount_method"
              :tone="methodTone(row.discount_type.discount_method)"
            >
              {{ t(`discount_method_${row.discount_type.discount_method}`) }}
            </Badge>
          </div>
        </template>

        <template #cell.value="{ row }">
          <span class="mono">{{ formatValue(row) }}</span>
        </template>

        <template #cell.is_active="{ row }">
          <Badge
            :tone="row.is_active ? 'success' : 'neutral'"
            dot
          >
            {{ row.is_active ? t('discount_status_ACTIVE') : t('discount_status_INACTIVE') }}
          </Badge>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            :icon="row.is_active ? 'pause' : 'play'"
            :tone="row.is_active ? 'warning' : 'success'"
            :title="row.is_active ? t('Deactivate') : t('Activate')"
            @click="toggleActive(row)"
          />
          <IconAction
            icon="edit"
            :title="t('Edit')"
            @click="openEdit(row)"
          />
          <IconAction
            icon="trash"
            tone="danger"
            :title="t('Delete')"
            @click="confirmDelete(row)"
          />
        </template>
      </DataTable>
    </Card>

    <!-- Create / Edit Modal -->
    <Modal
      :open="dialog"
      :title="editing ? t('Edit Discount') : t('New Discount')"
      :width="640"
      :close-on-backdrop="false"
      @close="dialog = false"
    >
      <div class="form-grid">
        <Field :label="t('Name')">
          <Input
            v-model="form.name"
            :placeholder="t('Name')"
          />
        </Field>
        <Field :label="t('Code')">
          <Input
            v-model="form.code"
            :placeholder="t('Code')"
          />
        </Field>
        <Field :label="t('Type')">
          <Select
            :model-value="form.discount_type_id !== null ? String(form.discount_type_id) : ''"
            :options="typeOptions"
            :placeholder="t('Select discount type')"
            @update:model-value="(v: string) => form.discount_type_id = v ? Number(v) : null"
          />
        </Field>
        <Field :label="t('Value')">
          <Input
            v-model="form.value"
            type="number"
            :placeholder="t('Value')"
          />
        </Field>
        <Field :label="t('Min Order Amount')">
          <Input
            v-model="form.min_order_amount"
            type="number"
            :placeholder="t('Min Order Amount')"
          />
        </Field>
        <Field :label="t('Starts At')">
          <Input
            v-model="form.start_date"
            type="datetime-local"
          />
        </Field>
        <Field :label="t('Ends At')">
          <Input
            v-model="form.end_date"
            type="datetime-local"
          />
        </Field>
        <Field
          :label="t('Secret Word (optional)')"
          class="span-2"
        >
          <Input
            v-model="form.secret_word"
            :placeholder="editing && editing.has_secret_word ? t('Leave blank to keep existing') : t('Secret Word (optional)')"
          />
        </Field>
        <Field
          :label="t('Active')"
          class="span-2"
        >
          <div class="row-switch">
            <Switch v-model="form.is_active" />
            <span class="row-switch__label">
              {{ form.is_active ? t('discount_status_ACTIVE') : t('discount_status_INACTIVE') }}
            </span>
          </div>
        </Field>
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="saving"
          @click="dialog = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="saving"
          :disabled="saving"
          @click="save"
        >
          {{ t('Save') }}
        </Button>
      </template>
    </Modal>

    <!-- Delete confirm -->
    <Modal
      :open="deleteDialog"
      :title="t('Delete Discount')"
      :subtitle="t('This action cannot be undone')"
      :width="440"
      @close="deleteDialog = false"
    >
      <p class="delete-msg">
        {{ t('Delete this discount?') }}
        <strong v-if="deletingDiscount">{{ deletingDiscount.name }}</strong>
      </p>

      <template #footer>
        <Button
          variant="ghost"
          @click="deleteDialog = false"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          @click="remove"
        >
          {{ t('Delete') }}
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
/* ── Toolbar ── */
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-4);
  flex-wrap: wrap;
}

.toolbar__search {
  flex: 1;
  min-width: 220px;
  max-width: 320px;
}

.toolbar__filter {
  width: 200px;
  min-width: 160px;
}

.toolbar__clear {
  margin-left: auto;
}

/* ── Cells ── */
.cell-type {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── Form grid (modal) ── */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--sp-3, 12px);
}
.form-grid .span-2 {
  grid-column: span 2;
}

/* ── Form switch row ── */
.row-switch {
  display: flex;
  align-items: center;
  gap: 10px;
}
.row-switch__label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* ── Delete message ── */
.delete-msg {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.delete-msg strong {
  color: var(--text);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .toolbar__search,
  .toolbar__filter {
    flex: 1 1 100%;
    max-width: 100%;
    min-width: 0;
    width: 100%;
  }
  .toolbar__clear {
    margin-left: 0;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-grid .span-2 {
    grid-column: span 1;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

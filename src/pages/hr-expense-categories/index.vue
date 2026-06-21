<script setup lang="ts">
/* ============================================================
   HR EXPENSE CATEGORIES — taxonomy + monthly budget limits
   Plain HTML + design primitives (PageHeader / Card / DataTable /
   Modal / Field / Input / Select / Switch / Badge / IconAction /
   StateFill / DesignIcon). No Vuetify on this surface.
   ============================================================ */
import type { DataTableColumn } from '@/components/design/DataTable.vue'
import { hrApi as axios } from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DataTable from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import Switch from '@/components/design/Switch.vue'

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
const itemsPerPage = ref(10)

// Filters per spec
const search = ref<string>('')
const isActiveFilter = ref<string>('') // '' | 'true' | 'false'

// ============================================================
// Tone maps
// ============================================================
const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary'> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
}

// ============================================================
// API
// ============================================================
async function load() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, per_page: itemsPerPage.value }
    if (search.value)
      params.search = search.value
    if (isActiveFilter.value)
      params.is_active = isActiveFilter.value
    const res = await axios.get('/expense-categories/', { params })
    const d = res.data?.data ?? res.data
    items.value = d?.expense_categories ?? d?.categories ?? d?.items ?? []
    total.value = d?.pagination?.total_items ?? d?.pagination?.total ?? items.value.length
  }
  catch {
    notify(t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(() => { load() })
watch([page, itemsPerPage], load)
watch(isActiveFilter, () => { page.value = 1; load() })

const debouncedSearch = useDebounceFn(() => { page.value = 1; load() }, 350)
watch(search, debouncedSearch)

// ============================================================
// Filter chips
// ============================================================
const activeFilters = computed(() => {
  const out: { k: string; label: string; val: string; clear: () => void }[] = []
  if (isActiveFilter.value) {
    const v = isActiveFilter.value === 'true' ? 'ACTIVE' : 'INACTIVE'
    out.push({
      k: 'a',
      label: t('expcat_filter_status'),
      val: t(`expcat_status_${v}`),
      clear: () => { isActiveFilter.value = '' },
    })
  }
  if (search.value) {
    out.push({
      k: 'q',
      label: t('Search'),
      val: search.value,
      clear: () => { search.value = '' },
    })
  }
  return out
})

function clearAllFilters() {
  isActiveFilter.value = ''
  search.value = ''
}

// ============================================================
// Filter options
// ============================================================
const isActiveOptions = computed(() => [
  { value: '', label: t('expcat_status_all') },
  { value: 'true', label: t('expcat_status_active') },
  { value: 'false', label: t('expcat_status_inactive') },
])

// ============================================================
// Columns
// ============================================================
const columns: DataTableColumn<any>[] = [
  { key: 'name', label: t('expcat_col_name'), sortable: true },
  { key: 'description', label: t('expcat_col_description'), sortable: false },
  { key: 'budget_limit', label: t('expcat_col_budget_limit'), sortable: true, align: 'right', width: 180 },
  { key: 'expense_count', label: t('expcat_col_expense_count'), sortable: true, align: 'right', width: 120 },
  { key: 'is_active', label: t('expcat_col_status'), sortable: true, width: 130 },
  { key: 'created_at', label: t('expcat_col_created_at'), sortable: true, width: 160 },
]

const tablePagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: total.value,
  onPage: (n: number) => { page.value = n },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

// ============================================================
// Create / Edit modal
// ============================================================
type FormShape = {
  name: string
  description: string
  budget_limit: string // keep as string so blank => no limit
  is_active: boolean
}

const blankForm = (): FormShape => ({
  name: '',
  description: '',
  budget_limit: '',
  is_active: true,
})

const formOpen = ref(false)
const editing = ref<any>(null)
const saving = ref(false)
const form = ref<FormShape>(blankForm())
const errors = ref<Record<string, string>>({})

function openCreate() {
  editing.value = null
  form.value = blankForm()
  errors.value = {}
  formOpen.value = true
}

function openEdit(row: any) {
  editing.value = row
  form.value = {
    name: row.name ?? '',
    description: row.description ?? '',
    budget_limit: row.budget_limit === null || row.budget_limit === undefined || row.budget_limit === ''
      ? ''
      : String(row.budget_limit),
    is_active: row.is_active ?? true,
  }
  errors.value = {}
  formOpen.value = true
}

function closeForm() {
  if (saving.value)
    return
  formOpen.value = false
  editing.value = null
}

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!form.value.name.trim())
    e.name = t('expcat_error_name_required')
  if (form.value.name.length > 100)
    e.name = t('Too long')
  if (form.value.budget_limit !== '' && Number(form.value.budget_limit) < 0)
    e.budget_limit = t('Required')
  errors.value = e
  return Object.keys(e).length === 0
}

async function submit() {
  if (!validate())
    return
  saving.value = true
  try {
    const payload: any = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      budget_limit: form.value.budget_limit === '' ? null : Number(form.value.budget_limit),
    }
    if (editing.value) {
      payload.is_active = !!form.value.is_active
      await axios.put(`/expense-categories/${editing.value.id}/`, payload)
      notify(t('expcat_toast_updated'))
    }
    else {
      payload.is_active = !!form.value.is_active
      await axios.post('/expense-categories/', payload)
      notify(t('expcat_toast_created'))
    }
    formOpen.value = false
    editing.value = null
    await load()
  }
  catch (e: any) {
    const msg = e?.response?.data?.message ?? e?.response?.data?.detail
    if (msg && /exists|duplicate|unique/i.test(String(msg)))
      errors.value = { name: t('expcat_error_name_duplicate') }
    else
      notify(msg ?? t('Error'), 'error')
  }
  finally {
    saving.value = false
  }
}

// ============================================================
// Deactivate (soft-delete) confirm modal
// ============================================================
const confirmOpen = ref(false)
const confirmRow = ref<any>(null)
const deleting = ref(false)

function askDeactivate(row: any) {
  confirmRow.value = row
  confirmOpen.value = true
}

function closeConfirm() {
  if (deleting.value)
    return
  confirmOpen.value = false
  confirmRow.value = null
}

async function doDeactivate() {
  if (!confirmRow.value)
    return
  deleting.value = true
  try {
    await axios.delete(`/expense-categories/${confirmRow.value.id}/`)
    notify(t('expcat_toast_deleted'))
    confirmOpen.value = false
    confirmRow.value = null
    await load()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    deleting.value = false
  }
}

// ============================================================
// ESC handler — close topmost open modal
// ============================================================
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape')
    return
  if (confirmOpen.value) { closeConfirm(); e.preventDefault(); return }
  if (formOpen.value) { closeForm(); e.preventDefault() }
}

onMounted(() => { window.addEventListener('keydown', onKeydown) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown) })

// ============================================================
// Helpers
// ============================================================
function fmtMoney(n: any): string {
  if (n === null || n === undefined || n === '')
    return '—'
  const v = Number(n)
  if (Number.isNaN(v))
    return '—'
  return `${formatCurrency(v)} UZS`
}

function fmtInt(n: any): string {
  if (n === null || n === undefined || n === '')
    return '0'
  const v = Number(n)
  if (Number.isNaN(v))
    return '0'
  return String(Math.round(v))
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('expcat_page_title')"
      :subtitle="t('expcat_page_subtitle')"
    >
      <template #actions>
        <Button
          variant="ghost"
          icon="refresh"
          :disabled="loading"
          @click="load"
        >
          {{ t('expcat_action_refresh') }}
        </Button>
        <Button
          variant="primary"
          icon="plus"
          @click="openCreate"
        >
          {{ t('expcat_action_create') }}
        </Button>
      </template>
    </PageHeader>

    <!-- Toolbar + table -->
    <Card>
      <div class="toolbar">
        <div style="flex:1;max-width:320px;">
          <Input
            v-model="search"
            icon="search"
            :placeholder="t('expcat_search_ph')"
          />
        </div>
        <div style="width:220px;">
          <Select
            v-model="isActiveFilter"
            icon="filter"
            :placeholder="t('expcat_filter_status')"
            :options="isActiveOptions"
          />
        </div>
      </div>

      <!-- Filter chips -->
      <div
        v-if="activeFilters.length > 0"
        class="toolbar"
        style="padding-top:0;"
      >
        <div class="chips">
          <span
            class="tertiary"
            style="font-size:13px;margin-right:2px;"
          >{{ t('Filters') }}:</span>
          <span
            v-for="f in activeFilters"
            :key="f.k"
            class="chip"
          >
            <span>{{ f.label }}: <b>{{ f.val }}</b></span>
            <span
              class="chip__x"
              @click="f.clear()"
            >
              <DesignIcon
                name="close"
                :size="13"
              />
            </span>
          </span>
          <button
            class="chip--clear"
            @click="clearAllFilters"
          >
            {{ t('Clear all') }}
          </button>
        </div>
      </div>

      <div class="card__divider" />

      <DataTable
        :columns="columns"
        :rows="items"
        row-key="id"
        :loading="loading"
        :pagination="tablePagination"
        :initial-sort="{ key: 'created_at', dir: 'desc' }"
      >
        <template #cell.name="{ row }">
          <span class="cell-strong">{{ row.name || '—' }}</span>
        </template>

        <template #cell.description="{ row }">
          <span class="cell-muted">{{ row.description || '—' }}</span>
        </template>

        <template #cell.budget_limit="{ row }">
          <span
            v-if="row.budget_limit === null || row.budget_limit === undefined || row.budget_limit === ''"
            class="mono cell-muted"
          >{{ t('expcat_budget_unlimited') }}</span>
          <span
            v-else
            class="mono"
          >{{ fmtMoney(row.budget_limit) }}</span>
        </template>

        <template #cell.expense_count="{ row }">
          <span class="mono">{{ fmtInt(row.expense_count) }}</span>
        </template>

        <template #cell.is_active="{ row }">
          <Badge :tone="STATUS_TONE[row.is_active ? 'ACTIVE' : 'INACTIVE']">
            {{ t(`expcat_status_${row.is_active ? 'ACTIVE' : 'INACTIVE'}`) }}
          </Badge>
        </template>

        <template #cell.created_at="{ row }">
          <span class="cell-muted">{{ row.created_at ? formatDate(row.created_at) : '—' }}</span>
        </template>

        <template #row-actions="{ row }">
          <IconAction
            icon="pencil"
            :title="t('expcat_action_edit')"
            @click="openEdit(row)"
          />
          <IconAction
            icon="trash"
            tone="danger"
            :title="t('expcat_action_delete')"
            :disabled="!row.is_active"
            @click="askDeactivate(row)"
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
              {{ t('expcat_empty_title') }}
            </div>
            <div class="statefill__sub">
              {{ t('expcat_empty_subtitle') }}
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;">
              <Button
                v-if="activeFilters.length > 0"
                variant="secondary"
                @click="clearAllFilters"
              >
                {{ t('Clear all') }}
              </Button>
              <Button
                variant="primary"
                icon="plus"
                @click="openCreate"
              >
                {{ t('expcat_action_create') }}
              </Button>
            </div>
          </div>
        </template>
      </DataTable>
    </Card>

    <!-- Create / Edit modal -->
    <Modal
      :open="formOpen"
      :title="editing ? t('expcat_modal_edit_title') : t('expcat_modal_create_title')"
      :subtitle="editing ? (editing.name || '') : t('expcat_page_subtitle')"
      :width="640"
      @close="closeForm"
    >
      <form @submit.prevent="submit">
        <div class="form-grid">
          <Field
            :label="t('expcat_field_name')"
            class="span-2"
            :error="errors.name"
          >
            <Input
              v-model="form.name"
              :error="!!errors.name"
              :placeholder="t('expcat_field_name')"
              :maxlength="100"
            />
          </Field>

          <Field
            :label="t('expcat_field_description')"
            class="span-2"
          >
            <textarea
              v-model="form.description"
              class="input"
              rows="3"
              :placeholder="t('expcat_field_description')"
              style="min-height:80px;resize:vertical;font-family:inherit;"
            />
          </Field>

          <Field
            :label="t('expcat_field_budget_limit')"
            class="span-2"
            :error="errors.budget_limit"
            :hint="t('expcat_field_budget_hint')"
          >
            <Input
              v-model="form.budget_limit"
              type="number"
              icon="dollar"
              :error="!!errors.budget_limit"
              placeholder="0.00"
              inputmode="decimal"
              min="0"
              step="0.01"
            />
          </Field>

          <Field
            :label="t('expcat_field_is_active')"
            class="span-2"
          >
            <Switch v-model="form.is_active" />
          </Field>
        </div>
      </form>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="saving"
          @click="closeForm"
        >
          {{ t('expcat_cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="saving"
          :disabled="saving"
          @click="submit"
        >
          {{ t('expcat_save') }}
        </Button>
      </template>
    </Modal>

    <!-- Deactivate confirm modal -->
    <Modal
      :open="confirmOpen"
      :title="t('expcat_action_delete')"
      :subtitle="confirmRow ? (confirmRow.name || '') : ''"
      :width="460"
      @close="closeConfirm"
    >
      <div style="padding:4px 2px 8px;color:rgb(var(--v-theme-text-secondary));">
        {{ t('expcat_confirm_delete') }}
      </div>
      <div
        class="cell-muted"
        style="font-size:12px;padding:0 2px 4px;"
      >
        {{ t('expcat_delete_note') }}
      </div>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="deleting"
          @click="closeConfirm"
        >
          {{ t('expcat_cancel') }}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          :loading="deleting"
          :disabled="deleting"
          @click="doDeactivate"
        >
          {{ t('expcat_action_delete') }}
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

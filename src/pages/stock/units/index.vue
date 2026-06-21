<script setup lang="ts">
import { stockApi as axios } from '@/plugins/axios'
import DataTableFooter from '@core/components/DataTableFooter.vue'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import IconAction from '@/components/design/IconAction.vue'
import Input from '@/components/design/Input.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import StateFill from '@/components/design/StateFill.vue'

const { t } = useI18n({ useScope: 'global' })

const units = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const itemsPerPage = ref(10)
const search = ref('')
const typeFilter = ref<string | undefined>(undefined)

const dialog = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const saving = ref(false)
const deleteDialog = ref(false)
const deleting = ref(false)
const selectedItem = ref<any>(null)

const unitTypes = ['WEIGHT', 'VOLUME', 'COUNT', 'LENGTH', 'TIME']
const unitTypeItems = computed(() => unitTypes.map(v => ({ title: t(`unit_type_${v}`), value: v })))
const filteredUnits = computed(() => {
  const q = (search.value ?? '').trim().toLowerCase()
  if (!q)
    return units.value
  return units.value.filter((u: any) => (u.name ?? '').toLowerCase().includes(q) || (u.short_name ?? '').toLowerCase().includes(q))
})

const typeColor: Record<string, string> = {
  WEIGHT: 'primary',
  VOLUME: 'info',
  COUNT: 'success',
  LENGTH: 'warning',
  TIME: 'secondary',
}

const form = ref({
  name: '',
  short_name: '',
  unit_type: 'COUNT',
  is_base_unit: false,
  base_unit_id: null as number | null,
  conversion_factor: 1,
  decimal_places: 2,
  is_active: true,
})

const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

const headers = [
  { title: t('Name'), key: 'name', sortable: false },
  { title: t('Short'), key: 'short_name', sortable: false },
  { title: t('Type'), key: 'unit_type', sortable: false },
  { title: t('Base Unit'), key: 'is_base_unit', sortable: false },
  { title: t('Conversion'), key: 'conversion_factor', sortable: false },
  { title: t('Decimals'), key: 'decimal_places', sortable: false },
  { title: t('Status'), key: 'is_active', sortable: false },
  { title: t('Actions'), key: 'actions', sortable: false, align: 'end' as const },
]

async function loadUnits() {
  loading.value = true
  try {
    const params: any = { page: page.value, per_page: itemsPerPage.value }
    if (typeFilter.value)
      params.type = typeFilter.value

    const res = await axios.get('/units/', { params })
    const d = res.data?.data ?? res.data

    units.value = d?.units ?? []
    total.value = d?.count ?? units.value.length
  }
  catch {
    notify(t('Failed to load units'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadUnits()
  loadAllUnits()
})
watch([page, itemsPerPage], loadUnits)
watch(typeFilter, () => { page.value = 1; loadUnits() })

function openCreate() {
  dialogMode.value = 'create'
  form.value = { name: '', short_name: '', unit_type: 'COUNT', is_base_unit: false, base_unit_id: null, conversion_factor: 1, decimal_places: 2, is_active: true }
  dialog.value = true
}

function openEdit(item: any) {
  dialogMode.value = 'edit'
  selectedItem.value = item
  form.value = {
    name: item.name ?? '',
    short_name: item.short_name ?? '',
    unit_type: item.unit_type ?? 'COUNT',
    is_base_unit: item.is_base_unit ?? false,
    base_unit_id: item.base_unit_id ?? null,
    conversion_factor: item.conversion_factor ?? 1,
    decimal_places: item.decimal_places ?? 2,
    is_active: item.is_active ?? true,
  }
  dialog.value = true
}

async function save() {
  saving.value = true
  try {
    const payload: any = { ...form.value }
    if (payload.is_base_unit)
      delete payload.base_unit_id
    if (!payload.base_unit_id)
      delete payload.base_unit_id
    if (dialogMode.value === 'create')
      await axios.post('/units/', payload)
    else
      await axios.patch(`/units/${selectedItem.value.id}/`, payload)
    notify(dialogMode.value === 'create' ? t('Unit created') : t('Unit updated'))
    dialog.value = false
    await loadUnits()
    await loadAllUnits()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error saving unit'), 'error')
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
    await axios.delete(`/units/${selectedItem.value.id}/`)
    notify(t('Unit deleted'))
    deleteDialog.value = false
    await loadUnits()
    await loadAllUnits()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error deleting unit'), 'error')
  }
  finally {
    deleting.value = false
  }
}

// base unit options for same type
const baseUnitOptions = computed(() =>
  units.value
    .filter(u => u.is_base_unit && u.unit_type === form.value.unit_type && (selectedItem.value ? u.id !== selectedItem.value.id : true))
    .map(u => ({ title: `${u.name} (${u.short_name})`, value: u.id })),
)

// ============================================================
// CONVERSION CALCULATOR
// ============================================================
const allUnits = ref<any[]>([])

async function loadAllUnits() {
  try {
    const res = await axios.get('/units/', { params: { per_page: 500 } })
    const d = res.data?.data ?? res.data
    allUnits.value = d?.units ?? []
  }
  catch {
    allUnits.value = []
  }
}

const convForm = ref({
  quantity: '' as string,
  unit_type: '' as string,
  from_unit_id: '' as string,
  to_unit_id: '' as string,
})
const convErrors = ref<Record<string, string>>({})
const converting = ref(false)
const convResult = ref<{
  result: string
  details: {
    from_quantity: string
    from_unit: string
    to_quantity: string
    to_unit: string
    base_quantity: string
  }
} | null>(null)

interface HistoryEntry {
  id: number
  timestamp: string
  from_quantity: string
  from_unit: string
  to_quantity: string
  to_unit: string
  base_quantity: string
}
const history = ref<HistoryEntry[]>([])
let historySeq = 0

// derive from_unit's type if convForm.unit_type is blank
const effectiveTypeFilter = computed(() => {
  if (convForm.value.unit_type)
    return convForm.value.unit_type
  const from = allUnits.value.find(u => String(u.id) === String(convForm.value.from_unit_id))
  return from?.unit_type ?? ''
})

const convTypeOptions = computed(() => [
  { value: '', label: t('units_ext_all_types') },
  ...unitTypes.map(v => ({ value: v, label: t(`unit_type_${v}`) })),
])

const convFromUnitOptions = computed(() => {
  const type = convForm.value.unit_type
  const list = type
    ? allUnits.value.filter(u => u.unit_type === type)
    : allUnits.value
  return list.map(u => ({
    value: String(u.id),
    label: `${u.name} (${u.short_name})`,
  }))
})

const convToUnitOptions = computed(() => {
  const type = effectiveTypeFilter.value
  const list = type
    ? allUnits.value.filter(u => u.unit_type === type)
    : allUnits.value
  return list.map(u => ({
    value: String(u.id),
    label: `${u.name} (${u.short_name})`,
  }))
})

const fromUnitObj = computed(() => allUnits.value.find(u => String(u.id) === String(convForm.value.from_unit_id)) ?? null)
const toUnitObj = computed(() => allUnits.value.find(u => String(u.id) === String(convForm.value.to_unit_id)) ?? null)

// clear to_unit if it no longer fits the from_unit type
watch(() => convForm.value.from_unit_id, (newId) => {
  if (!newId) {
    convForm.value.to_unit_id = ''
    return
  }
  if (!convForm.value.to_unit_id)
    return
  const from = allUnits.value.find(u => String(u.id) === String(newId))
  const to = allUnits.value.find(u => String(u.id) === String(convForm.value.to_unit_id))
  if (from && to && from.unit_type !== to.unit_type)
    convForm.value.to_unit_id = ''
})

// when unit_type filter changes, drop selections that don't match
watch(() => convForm.value.unit_type, (newType) => {
  if (!newType)
    return
  const from = allUnits.value.find(u => String(u.id) === String(convForm.value.from_unit_id))
  if (from && from.unit_type !== newType)
    convForm.value.from_unit_id = ''
  const to = allUnits.value.find(u => String(u.id) === String(convForm.value.to_unit_id))
  if (to && to.unit_type !== newType)
    convForm.value.to_unit_id = ''
})

function validateConvert(): boolean {
  const e: Record<string, string> = {}
  const qty = Number(convForm.value.quantity)
  if (convForm.value.quantity === '' || Number.isNaN(qty) || qty <= 0)
    e.quantity = t('units_ext_invalid_quantity')
  if (!convForm.value.from_unit_id)
    e.from_unit_id = t('units_ext_required')
  if (!convForm.value.to_unit_id)
    e.to_unit_id = t('units_ext_required')
  if (convForm.value.from_unit_id
    && convForm.value.to_unit_id
    && convForm.value.from_unit_id === convForm.value.to_unit_id)
    e.to_unit_id = t('units_ext_same_unit')
  if (fromUnitObj.value && toUnitObj.value
    && fromUnitObj.value.unit_type !== toUnitObj.value.unit_type)
    e.to_unit_id = t('units_ext_type_mismatch')
  convErrors.value = e
  return Object.keys(e).length === 0
}

async function doConvert() {
  if (converting.value)
    return
  if (!validateConvert())
    return
  converting.value = true
  try {
    const payload = {
      quantity: Number(convForm.value.quantity),
      from_unit_id: Number(convForm.value.from_unit_id),
      to_unit_id: Number(convForm.value.to_unit_id),
    }
    const res = await axios.post('/units/convert/', payload)
    const d = res.data?.data ?? res.data
    const result = String(d?.result ?? '')
    const details = d?.details ?? {}
    convResult.value = {
      result,
      details: {
        from_quantity: String(details.from_quantity ?? convForm.value.quantity),
        from_unit: String(details.from_unit ?? fromUnitObj.value?.short_name ?? ''),
        to_quantity: String(details.to_quantity ?? result),
        to_unit: String(details.to_unit ?? toUnitObj.value?.short_name ?? ''),
        base_quantity: String(details.base_quantity ?? ''),
      },
    }
    history.value.unshift({
      id: ++historySeq,
      timestamp: new Date().toISOString(),
      ...convResult.value.details,
    })
    if (history.value.length > 20)
      history.value.length = 20
    notify(t('units_ext_success'))
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('units_ext_error'), 'error')
  }
  finally {
    converting.value = false
  }
}

function swapUnits() {
  const tmp = convForm.value.from_unit_id
  convForm.value.from_unit_id = convForm.value.to_unit_id
  convForm.value.to_unit_id = tmp
}

function resetConvert() {
  convForm.value = { quantity: '', unit_type: '', from_unit_id: '', to_unit_id: '' }
  convErrors.value = {}
  convResult.value = null
}

async function copyResult() {
  if (!convResult.value)
    return
  try {
    await navigator.clipboard.writeText(convResult.value.result)
    notify(t('units_ext_copied'))
  }
  catch {
    notify(t('units_ext_error'), 'error')
  }
}

function clearHistory() {
  history.value = []
}

function fmtTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  }
  catch {
    return iso
  }
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('units_ext_title')"
      :subtitle="t('units_ext_subtitle')"
    />

    <!-- ============ CONVERSION CALCULATOR ============ -->
    <div
      class="card"
      style="margin-bottom: var(--sp-5);"
    >
      <div
        class="toolbar"
        style="border-bottom: 1px solid var(--border);"
      >
        <div style="flex: 1; min-width: 0;">
          <div
            class="kpi__label"
            style="font-weight: var(--fw-semibold); color: var(--text);"
          >
            {{ t('units_ext_title') }}
          </div>
          <div
            class="page__subtitle"
            style="margin-top: 2px;"
          >
            {{ t('units_ext_subtitle') }}
          </div>
        </div>
      </div>

      <form
        style="padding: var(--sp-5); display: grid; gap: var(--sp-4); grid-template-columns: repeat(12, 1fr);"
        @submit.prevent="doConvert"
      >
        <!-- Unit type filter -->
        <div style="grid-column: span 3;">
          <Field :label="t('units_ext_unit_type')">
            <Select
              v-model="convForm.unit_type"
              :options="convTypeOptions"
              :placeholder="t('units_ext_all_types')"
            />
          </Field>
        </div>

        <!-- Quantity -->
        <div style="grid-column: span 3;">
          <Field
            :label="t('units_ext_quantity')"
            :error="convErrors.quantity"
          >
            <Input
              v-model="convForm.quantity"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              :error="!!convErrors.quantity"
            />
          </Field>
        </div>

        <!-- From unit -->
        <div style="grid-column: span 3;">
          <Field
            :label="t('units_ext_from_unit')"
            :error="convErrors.from_unit_id"
          >
            <Select
              v-model="convForm.from_unit_id"
              :options="convFromUnitOptions"
              :placeholder="t('units_ext_from_unit')"
              :error="!!convErrors.from_unit_id"
            />
          </Field>
        </div>

        <!-- To unit -->
        <div style="grid-column: span 3;">
          <Field
            :label="t('units_ext_to_unit')"
            :error="convErrors.to_unit_id"
          >
            <Select
              v-model="convForm.to_unit_id"
              :options="convToUnitOptions"
              :placeholder="t('units_ext_to_unit')"
              :error="!!convErrors.to_unit_id"
            />
          </Field>
        </div>

        <!-- Action buttons -->
        <div style="grid-column: span 12; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
          <Button
            type="button"
            variant="ghost"
            icon="close"
            @click="resetConvert"
          >
            {{ t('units_ext_reset') }}
          </Button>
          <Button
            type="button"
            variant="ghost"
            icon="refresh"
            :disabled="!convForm.from_unit_id || !convForm.to_unit_id"
            @click="swapUnits"
          >
            {{ t('units_ext_swap') }}
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon-right="chevright"
            :loading="converting"
            :disabled="converting"
          >
            {{ t('units_ext_convert') }}
          </Button>
        </div>

        <!-- Result panel -->
        <div style="grid-column: span 12;">
          <div
            v-if="convResult"
            style="border: 1px solid var(--border); border-radius: var(--r-md); padding: var(--sp-4); background: rgb(var(--v-theme-surface-inset));"
          >
            <div
              style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-3); gap: var(--sp-2);"
            >
              <div
                class="kpi__label"
                style="color: var(--text); font-weight: var(--fw-semibold);"
              >
                {{ t('units_ext_result') }}
              </div>
              <IconAction
                icon="copy"
                tone="primary"
                :title="t('units_ext_copy')"
                @click="copyResult"
              />
            </div>

            <div
              style="display: grid; gap: var(--sp-3); grid-template-columns: repeat(12, 1fr); align-items: center;"
            >
              <!-- from -->
              <div
                style="grid-column: span 4; display: flex; flex-direction: column; gap: 4px;"
              >
                <div
                  class="page__subtitle"
                  style="font-size: var(--fs-sm);"
                >
                  {{ t('units_ext_from_quantity') }}
                </div>
                <div
                  style="display: flex; align-items: baseline; gap: 6px;"
                >
                  <span
                    class="mono"
                    style="font-size: 22px; font-weight: var(--fw-semibold);"
                  >{{ convResult.details.from_quantity }}</span>
                  <Badge tone="neutral">
                    {{ convResult.details.from_unit }}
                  </Badge>
                </div>
              </div>

              <!-- arrow -->
              <div
                style="grid-column: span 1; display: flex; align-items: center; justify-content: center; color: var(--text-tertiary);"
              >
                <DesignIcon
                  name="chevright"
                  :size="22"
                />
              </div>

              <!-- to -->
              <div
                style="grid-column: span 4; display: flex; flex-direction: column; gap: 4px;"
              >
                <div
                  class="page__subtitle"
                  style="font-size: var(--fs-sm);"
                >
                  {{ t('units_ext_to_quantity') }}
                </div>
                <div
                  style="display: flex; align-items: baseline; gap: 6px;"
                >
                  <span
                    class="mono"
                    style="font-size: 26px; font-weight: var(--fw-semibold); color: rgb(var(--v-theme-primary));"
                  >{{ convResult.details.to_quantity }}</span>
                  <Badge tone="primary">
                    {{ convResult.details.to_unit }}
                  </Badge>
                </div>
              </div>

              <!-- base -->
              <div
                style="grid-column: span 3; display: flex; flex-direction: column; gap: 4px;"
              >
                <div
                  class="page__subtitle"
                  style="font-size: var(--fs-sm);"
                >
                  {{ t('units_ext_base_quantity') }}
                </div>
                <div
                  style="display: flex; align-items: baseline; gap: 6px;"
                >
                  <span
                    class="mono"
                    style="font-size: 16px; color: var(--text-secondary);"
                  >{{ convResult.details.base_quantity || '—' }}</span>
                  <Badge tone="neutral">
                    {{ t('units_ext_base_unit_badge') }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <StateFill
            v-else
            icon="sliders"
            :title="t('units_ext_no_result')"
          />
        </div>
      </form>
    </div>

    <!-- ============ RECENT CONVERSIONS HISTORY ============ -->
    <div
      class="card"
      style="margin-bottom: var(--sp-5);"
    >
      <div class="toolbar">
        <div style="flex: 1; min-width: 0;">
          <div
            class="kpi__label"
            style="color: var(--text); font-weight: var(--fw-semibold);"
          >
            {{ t('units_ext_history') }}
          </div>
        </div>
        <Button
          v-if="history.length"
          variant="ghost"
          icon="trash"
          @click="clearHistory"
        >
          {{ t('units_ext_history_clear') }}
        </Button>
      </div>
      <div class="card__divider" />

      <div
        v-if="history.length === 0"
        style="padding: var(--sp-2) 0;"
      >
        <StateFill
          icon="inbox"
          :title="t('units_ext_history_empty')"
        />
      </div>
      <div
        v-else
        style="padding: 0 var(--sp-5) var(--sp-4); display: flex; flex-direction: column;"
      >
        <div
          style="display: grid; grid-template-columns: 160px 1fr 1fr 1fr 1fr 1fr; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--border); font-size: var(--fs-label); color: var(--text-tertiary); font-weight: var(--fw-semibold); letter-spacing: 0.02em; text-transform: uppercase;"
        >
          <span>{{ t('units_ext_time') }}</span>
          <span style="text-align: right;">{{ t('units_ext_from_quantity') }}</span>
          <span>{{ t('units_ext_from_unit') }}</span>
          <span style="text-align: right;">{{ t('units_ext_to_quantity') }}</span>
          <span>{{ t('units_ext_to_unit') }}</span>
          <span style="text-align: right;">{{ t('units_ext_base_quantity') }}</span>
        </div>
        <div
          v-for="row in history"
          :key="row.id"
          style="display: grid; grid-template-columns: 160px 1fr 1fr 1fr 1fr 1fr; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--border); align-items: center;"
        >
          <span
            class="mono"
            style="color: var(--text-secondary); font-size: var(--fs-sm);"
          >{{ fmtTime(row.timestamp) }}</span>
          <span
            class="mono"
            style="text-align: right;"
          >{{ row.from_quantity }}</span>
          <span>
            <Badge tone="neutral">{{ row.from_unit }}</Badge>
          </span>
          <span
            class="mono"
            style="text-align: right; font-weight: var(--fw-semibold); color: rgb(var(--v-theme-primary));"
          >{{ row.to_quantity }}</span>
          <span>
            <Badge tone="primary">{{ row.to_unit }}</Badge>
          </span>
          <span
            class="mono"
            style="text-align: right; color: var(--text-tertiary);"
          >{{ row.base_quantity || '—' }}</span>
        </div>
      </div>
    </div>

    <!-- ============ UNITS CRUD (existing) ============ -->
    <VCard>
      <VCardText class="d-flex flex-wrap gap-3 align-center">
        <VTextField
          v-model="search"
          :placeholder="t('Search units...')"
          prepend-inner-icon="bx-search"
          density="compact"
          style="min-inline-size: 220px;"
          hide-details
          clearable
        />
        <VSelect
          v-model="typeFilter"
          :items="unitTypeItems"
          :placeholder="t('All Types')"
          density="compact"
          style="min-inline-size: 160px;"
          hide-details
          clearable
        />
        <VSpacer />
        <VBtn
          prepend-icon="bx-plus"
          @click="openCreate"
        >
          {{ t('Add Unit') }}
        </VBtn>
      </VCardText>

      <VDataTableServer
        :headers="headers"
        :items="filteredUnits"
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
          v-if="loading && units.length === 0"
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
                style="width:100px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:40px;height:13px;border-radius:4px;"
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
                style="width:50px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:60px;height:13px;border-radius:4px;"
              />
            </td>
            <td class="sk-cell">
              <div
                class="sk-box"
                style="width:30px;height:13px;border-radius:4px;"
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
                  style="width:28px;height:28px;border-radius:6px;"
                /><div
                  class="sk-box"
                  style="width:28px;height:28px;border-radius:6px;"
                />
              </div>
            </td>
          </tr>
        </template>

        <template #item.unit_type="{ item }">
          <VChip
            class="status-pill"
            :color="typeColor[item.raw.unit_type] ?? 'default'"
            size="small"
            variant="tonal"
          >
            {{ t(`unit_type_${item.raw.unit_type}`) }}
          </VChip>
        </template>
        <template #item.is_base_unit="{ item }">
          <VChip
            v-if="item.raw.is_base_unit"
            class="status-pill"
            color="primary"
            size="small"
            variant="tonal"
          >
            {{ t('units_ext_base_unit_badge') }}
          </VChip>
          <span
            v-else
            class="text-disabled text-body-2"
          >{{ item.raw.base_unit?.short_name ?? '—' }}</span>
        </template>
        <template #item.conversion_factor="{ item }">
          <span class="num-tabular">{{ item.raw.is_base_unit ? '1' : item.raw.conversion_factor }}</span>
        </template>
        <template #item.is_active="{ item }">
          <VChip
            class="status-pill"
            :color="item.raw.is_active ? 'success' : 'default'"
            size="small"
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
                size="18"
                icon="bx-edit"
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
                size="18"
                icon="bx-trash"
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
      max-width="480"
      persistent
    >
      <VCard :title="dialogMode === 'create' ? t('Add Unit') : t('Edit Unit')">
        <VCardText>
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.name"
                :label="t('Name')"
                required
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model="form.short_name"
                :label="t('Short Name')"
                required
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VSelect
                v-model="form.unit_type"
                :items="unitTypeItems"
                :label="t('Type')"
                required
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <VTextField
                v-model.number="form.decimal_places"
                :label="t('Decimal Places')"
                type="number"
                :min="0"
                :max="6"
              />
            </VCol>
            <VCol cols="12">
              <VSwitch
                v-model="form.is_base_unit"
                :label="t('This is the base unit for its type')"
                color="primary"
              />
            </VCol>
            <template v-if="!form.is_base_unit">
              <VCol
                cols="12"
                sm="6"
              >
                <VSelect
                  v-model="form.base_unit_id"
                  :items="baseUnitOptions"
                  :label="t('Base Unit')"
                  :placeholder="t('Select base unit')"
                  clearable
                />
              </VCol>
              <VCol
                cols="12"
                sm="6"
              >
                <VTextField
                  v-model.number="form.conversion_factor"
                  :label="t('Conversion Factor')"
                  type="number"
                  step="0.001"
                />
              </VCol>
            </template>
            <VCol
              v-if="dialogMode === 'edit'"
              cols="12"
            >
              <VSwitch
                v-model="form.is_active"
                :label="t('Active')"
                color="success"
              />
            </VCol>
          </VRow>
        </VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            color="default"
            @click="dialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            :loading="saving"
            @click="save"
          >
            {{ t('Save') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog
      v-model="deleteDialog"
      max-width="400"
    >
      <VCard :title="t('Delete Unit')">
        <VCardText>{{ t('Are you sure you want to delete') }} <strong>{{ selectedItem?.name }}</strong>?</VCardText>
        <VCardActions class="justify-end gap-2 pa-4 pt-0">
          <VBtn
            variant="tonal"
            color="default"
            @click="deleteDialog = false"
          >
            {{ t('Cancel') }}
          </VBtn>
          <VBtn
            color="error"
            :loading="deleting"
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
name: stock-units
meta:
  action: manage
  subject: all
</route>

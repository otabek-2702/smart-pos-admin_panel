<script setup lang="ts">
/* ============================================================
   ALPHA POS — Menu Engineering (analytics)
   Refactor: design primitives only (no Vuetify).
   - Toolbar: flex-wrap, inputs collapse to 100% on mobile
   - KPI strip: .grid .cols-4 with click-to-filter behavior
   - DataTable replaces VDataTable; columns array + #cell.* slots
   - Every visible string goes through t('Key')
   ============================================================ */
import axios from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import DataTable, { type DataTableColumn } from '@/components/design/DataTable.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import PageHeader from '@/components/design/PageHeader.vue'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()
const { notify } = useNotify()

function isoDay(offset = 0) {
  const d = new Date()

  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const dateFrom = ref(isoDay(-30))
const dateTo = ref(isoDay(0))
const cogsFraction = ref(0.35)
const loading = ref(false)
const data = ref<any>(null)

const page = ref(1)
const itemsPerPage = ref(20)
const classFilter = ref<string | undefined>(undefined)
const searchQuery = ref('')

const cogsFractionValid = computed(() => cogsFraction.value >= 0.05 && cogsFraction.value <= 0.95)

// Bridge for the design <Input> primitive: it emits strings while
// cogsFraction is numeric.
const cogsFractionStr = computed<string>({
  get: () => String(cogsFraction.value),
  set: (v: string) => {
    const n = Number(v)
    if (!Number.isNaN(n))
      cogsFraction.value = n
  },
})

function applyPreset(days: number) {
  dateFrom.value = isoDay(-days)
  dateTo.value = isoDay(0)
  load()
}

// Map menu-engineering class → tone (Kpi + Badge use the same Tone union)
const classTone: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  Star: 'success',
  Plowhorse: 'info',
  Puzzle: 'warning',
  Dog: 'error',
}
const classIcon: Record<string, string> = {
  Star: 'star',
  Plowhorse: 'trend',
  Puzzle: 'info',
  Dog: 'arrowdown',
}

async function load() {
  if (!cogsFractionValid.value) {
    notify(t('COGS fraction must be between 0.05 and 0.95'), 'error')
    return
  }
  loading.value = true
  try {
    const res = await axios.get('/analytics/menu-engineering', {
      params: { from: dateFrom.value, to: dateTo.value, cogs_fraction: cogsFraction.value },
    })

    data.value = res.data?.data ?? res.data
    page.value = 1
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load'), 'error')
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const summary = computed(() => data.value?.summary ?? null)

const items = computed(() => {
  let all = data.value?.items ?? []
  if (classFilter.value)
    all = all.filter((i: any) => i.class === classFilter.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q)
    all = all.filter((i: any) => String(i.product_name ?? '').toLowerCase().includes(q))
  return all
})

// DataTable handles its own pagination — feed it the filtered items
const itemsWithKey = computed(() =>
  items.value.map((i: any, idx: number) => ({
    ...i,
    _key: i.product_id ?? i.id ?? `${i.product_name ?? 'row'}-${idx}`,
  })),
)

const columns = computed<DataTableColumn<any>[]>(() => [
  { key: 'class', label: t('Class'), sortable: true, width: '140px' },
  { key: 'product_name', label: t('Product'), sortable: true },
  { key: 'price', label: t('Price'), sortable: true, align: 'right' },
  { key: 'qty_sold', label: t('Sold'), sortable: true, align: 'right' },
  { key: 'revenue', label: t('Revenue'), sortable: true, align: 'right' },
  { key: 'margin_per_unit', label: t('Margin/unit'), sortable: true, align: 'right' },
  { key: 'profit', label: t('Profit'), sortable: true, align: 'right' },
])

const dtPagination = computed(() => ({
  page: page.value,
  perPage: itemsPerPage.value,
  total: items.value.length,
  onPage: (p: number) => { page.value = p },
  onPerPage: (n: number) => { itemsPerPage.value = n; page.value = 1 },
}))

// Slice the rows ourselves so DataTable in controlled-pagination mode
// gets the right page (it does not re-slice when controlled).
const pageRows = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  return itemsWithKey.value.slice(start, start + itemsPerPage.value)
})

function toggleClass(key: string) {
  classFilter.value = classFilter.value === key ? undefined : key
  page.value = 1
}

function clearClassFilter() {
  classFilter.value = undefined
  page.value = 1
}

const subtitle = computed(() => `${dateFrom.value} — ${dateTo.value}`)
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Menu Engineering')"
      :subtitle="subtitle"
    />

    <!-- Filter toolbar -->
    <div
      class="card"
      style="margin-bottom: var(--sp-5);"
    >
      <div class="toolbar me-toolbar">
        <Field
          :label="t('From')"
          class="me-field me-field--date"
        >
          <Input
            v-model="dateFrom"
            type="date"
            :aria-label="t('From')"
          />
        </Field>
        <Field
          :label="t('To')"
          class="me-field me-field--date"
        >
          <Input
            v-model="dateTo"
            type="date"
            :aria-label="t('To')"
          />
        </Field>
        <Field
          :label="t('COGS fraction')"
          :error="!cogsFractionValid ? t('COGS fraction must be between 0.05 and 0.95') : undefined"
          class="me-field me-field--cogs"
        >
          <Input
            v-model="cogsFractionStr"
            type="number"
            step="0.05"
            min="0.05"
            max="0.95"
            :error="!cogsFractionValid"
            :aria-label="t('COGS fraction')"
          />
        </Field>

        <div class="me-presets">
          <Button
            variant="secondary"
            size="sm"
            @click="applyPreset(0)"
          >
            {{ t('Today') }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            @click="applyPreset(7)"
          >
            {{ t('Last 7 days') }}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            @click="applyPreset(30)"
          >
            {{ t('Last 30 days') }}
          </Button>
        </div>

        <div class="me-field me-field--search">
          <Input
            v-model="searchQuery"
            icon="search"
            :placeholder="t('Search products')"
            :aria-label="t('Search products')"
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          icon="search"
          :loading="loading"
          :disabled="!cogsFractionValid"
          @click="load"
        >
          {{ t('Analyze') }}
        </Button>
      </div>
    </div>

    <!-- Class KPI strip — click to filter by class -->
    <div
      v-if="summary"
      class="grid cols-4 me-kpi-grid"
      style="margin-bottom: var(--sp-5);"
    >
      <div
        v-for="(klass, key) in { Star: summary.stars, Plowhorse: summary.plowhorses, Puzzle: summary.puzzles, Dog: summary.dogs }"
        :key="key"
        class="me-kpi-wrap"
        :class="{ 'is-active': classFilter === key }"
        role="button"
        tabindex="0"
        :aria-pressed="classFilter === key"
        :aria-label="t(`menu_class_${(key as string).toUpperCase()}`)"
        @click="toggleClass(key as string)"
        @keydown.enter.prevent="toggleClass(key as string)"
        @keydown.space.prevent="toggleClass(key as string)"
      >
        <Kpi
          :data="{
            label: t(`menu_class_${(key as string).toUpperCase()}`),
            icon: classIcon[key],
            tone: classTone[key],
            value: klass ?? 0,
          }"
        />
      </div>
    </div>

    <!-- Results -->
    <div class="card">
      <!-- Filter chip + meta row -->
      <div
        v-if="classFilter || summary"
        class="toolbar"
        style="padding-bottom: 0;"
      >
        <div class="chips">
          <span
            v-if="classFilter"
            class="chip"
          >
            <span>{{ t('Class') }}: <b>{{ t(`menu_class_${(classFilter as string).toUpperCase()}`) }}</b></span>
            <span
              class="chip__x"
              role="button"
              :aria-label="t('Clear filter')"
              @click="clearClassFilter"
            >
              <DesignIcon
                name="close"
                :size="13"
              />
            </span>
          </span>
        </div>
        <div style="flex: 1;" />
        <span
          v-if="summary"
          class="me-meta"
        >
          {{ t('{count} days analyzed', { count: summary.window_days }) }} ·
          {{ t('Avg quantity') }}: {{ summary.avg_qty }}
        </span>
      </div>

      <div
        v-if="classFilter || summary"
        class="card__divider"
        style="margin-top: var(--sp-4);"
      />

      <DataTable
        :columns="columns"
        :rows="pageRows"
        row-key="_key"
        :loading="loading"
        :pagination="dtPagination"
        :per-page-options="[10, 20, 50, 100]"
        :empty-title="t('No menu items')"
        :empty-sub="t('Try a different date range or COGS fraction.')"
      >
        <template #cell.class="{ row }">
          <Badge
            :tone="classTone[row.class] ?? 'neutral'"
            dot
          >
            {{ t(`menu_class_${String(row.class).toUpperCase()}`) }}
          </Badge>
        </template>

        <template #cell.product_name="{ row }">
          <span class="cell-strong">{{ row.product_name ?? '—' }}</span>
        </template>

        <template #cell.price="{ row }">
          <span class="mono">{{ formatCurrency(row.price) }}</span>
        </template>

        <template #cell.qty_sold="{ row }">
          <span class="mono">{{ row.qty_sold ?? 0 }}</span>
        </template>

        <template #cell.revenue="{ row }">
          <span class="mono">{{ formatCurrency(row.revenue) }}</span>
        </template>

        <template #cell.margin_per_unit="{ row }">
          <div
            class="me-margin"
            style="display: inline-flex; flex-direction: column; align-items: flex-end; gap: 2px;"
          >
            <span class="mono">{{ formatCurrency(row.margin_per_unit) }}</span>
            <span class="cell-muted me-margin-pct">({{ row.margin_pct }}%)</span>
          </div>
        </template>

        <template #cell.profit="{ row }">
          <span class="mono cell-strong">{{ formatCurrency(row.profit) }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
/* Toolbar — design-shell .toolbar already does flex-wrap+gap.
   The inline fields below collapse to 100% on narrow widths. */
.me-toolbar {
  align-items: flex-end;
}

.me-field {
  min-inline-size: 0;
}
.me-field--date { width: 170px; }
.me-field--cogs { width: 200px; }
.me-field--search { width: 240px; flex: 1 1 240px; }

.me-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* KPI strip — clickable wrappers with active-state highlight */
.me-kpi-grid .me-kpi-wrap {
  cursor: pointer;
  border-radius: var(--r-lg);
  outline: none;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.me-kpi-grid .me-kpi-wrap:hover {
  transform: translateY(-1px);
}
.me-kpi-grid .me-kpi-wrap.is-active {
  box-shadow: 0 0 0 2px var(--primary), var(--shadow-md);
}
.me-kpi-grid .me-kpi-wrap:focus-visible {
  box-shadow: var(--shadow-focus);
}

.me-meta {
  color: var(--text-secondary);
  font-size: var(--fs-sm);
}

.me-margin-pct {
  font-size: var(--fs-label);
}

@media (max-width: 900px) {
  .me-field--date,
  .me-field--cogs,
  .me-field--search {
    width: 100%;
    flex-basis: 100%;
  }
  .me-presets {
    width: 100%;
  }
  .me-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .me-kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

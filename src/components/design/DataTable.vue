<script setup lang="ts" generic="R extends Record<string, any>">
/* ============================================================
   ALPHA POS - DataTable
   Vue 3 port of .tmp-alpha-design/alpha-design-source/DataTable.jsx
   Sortable, sticky header, selection + bulk bar, expandable rows,
   inline row actions, pagination, loading/empty states.
   ============================================================ */
import type { CSSProperties, VNode } from 'vue'
import { defineComponent, h } from 'vue'
import Button from './Button.vue'
import Checkbox from './Checkbox.vue'
import DesignIcon from './DesignIcon.vue'
import Pagination from './Pagination.vue'
import Skeleton from './Skeleton.vue'
import StateFill from './StateFill.vue'
import { cx } from './utils'

export type Align = 'left' | 'right' | 'center'
export type SortDir = 'asc' | 'desc'

export interface DataTableColumn<Row = any> {
  key: string
  label: string
  sortable?: boolean
  align?: Align
  width?: string | number
  cellClass?: string
  /**
   * Optional cell renderer. Returns a VNode (from h()), a string, or a number.
   * For complex content prefer the scoped slot `cell.{key}` instead.
   */
  render?: (row: Row) => VNode | string | number | null | undefined
  sortValue?: (row: Row) => unknown
}

export interface DataTableSort {
  key: string | null
  dir: SortDir
}

export interface DataTablePagination {
  page: number
  perPage: number
  total: number
  onPage?: (p: number) => void
  onPerPage?: (n: number) => void
}

interface Props {
  columns: DataTableColumn<R>[]
  rows: R[]
  rowKey?: string
  loading?: boolean
  /** Controlled sort. Provide `sort` + listen to `@sort`. If omitted, internal state is used. */
  sort?: DataTableSort
  /** Initial sort for uncontrolled mode. */
  initialSort?: DataTableSort
  /** Selection set (v-model:selection). When provided, component is controlled for selection. */
  selection?: Set<string | number>
  /** Enable selection column + bulk bar. Implied when `selection` is bound. */
  selectable?: boolean
  /** Enable expand column. The `expanded` slot renders the body. */
  expandable?: boolean
  /** Controlled pagination. If omitted, internal pagination kicks in (perPage default 10). */
  pagination?: DataTablePagination
  /** Default perPage for internal pagination. */
  perPage?: number
  perPageOptions?: number[]
  /** Empty-state title / sub. */
  emptyTitle?: string
  emptySub?: string
  emptyIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  rowKey: 'id',
  loading: false,
  selectable: false,
  expandable: false,
  perPage: 10,
  perPageOptions: () => [10, 20, 50],
  emptyIcon: 'inbox',
})

const emit = defineEmits<{
  (e: 'sort', value: DataTableSort): void
  (e: 'update:selection', v: Set<string | number>): void
  (e: 'row-click', row: R): void
  (e: 'page', p: number): void
  (e: 'per-page', n: number): void
}>()

const { t } = useI18n({ useScope: 'global' })

/* ---------- helpers ---------- */
function idOf(r: R): string | number {
  return r[props.rowKey] as string | number
}

/* ---------- sort (controlled / uncontrolled) ---------- */
const internalSort = ref<DataTableSort>(
  props.initialSort ?? { key: null, dir: 'asc' },
)
const currentSort = computed<DataTableSort>(() =>
  props.sort ?? internalSort.value,
)

function toggleSort(key: string) {
  const cur = currentSort.value
  const next: DataTableSort
    = cur.key === key
      ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
  if (props.sort === undefined)
    internalSort.value = next
  emit('sort', next)
}

const sorted = computed<R[]>(() => {
  const s = currentSort.value
  if (!s.key)
    return props.rows
  const col = props.columns.find(c => c.key === s.key)
  const accessor = col?.sortValue ?? ((r: R) => (r as any)[s.key as string])
  const arr = props.rows.slice().sort((a, b) => {
    const av = accessor(a) as any
    const bv = accessor(b) as any
    if (av === bv)
      return 0
    if (typeof av === 'number' && typeof bv === 'number')
      return av - bv
    return String(av).localeCompare(String(bv))
  })
  if (s.dir === 'desc')
    arr.reverse()
  return arr
})

/* ---------- pagination (controlled / uncontrolled) ---------- */
const internalPage = ref(1)
const internalPp = ref(props.perPage)

const isPagControlled = computed(() => props.pagination !== undefined)

const totalItems = computed(() =>
  isPagControlled.value ? props.pagination!.total : sorted.value.length,
)
const pp = computed(() =>
  isPagControlled.value ? props.pagination!.perPage : internalPp.value,
)
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalItems.value / pp.value)),
)
const curPage = computed(() => {
  const p = isPagControlled.value ? props.pagination!.page : internalPage.value
  return Math.min(Math.max(1, p), totalPages.value)
})

const pageRows = computed<R[]>(() => {
  if (isPagControlled.value)
    return sorted.value // controlled: server provided already-paged rows
  const start = (curPage.value - 1) * pp.value
  return sorted.value.slice(start, start + pp.value)
})

/* Reset internal page when rows length changes (uncontrolled only). */
watch(
  () => props.rows.length,
  () => {
    if (!isPagControlled.value)
      internalPage.value = 1
  },
)

function goPage(n: number) {
  if (n < 1 || n > totalPages.value)
    return
  if (isPagControlled.value) {
    clearSel()
    props.pagination!.onPage?.(n)
  }
  else
    internalPage.value = n
  emit('page', n)
}

function setPp(n: number) {
  if (isPagControlled.value) {
    clearSel()
    props.pagination!.onPerPage?.(n)
  }
  else {
    internalPp.value = n
    internalPage.value = 1
  }
  emit('per-page', n)
}

/* Pagination range, page-number list, and total formatting are owned by <Pagination>. */

/* ---------- selection (controlled / uncontrolled) ---------- */
const internalSelection = ref<Set<string | number>>(new Set())
const selection = computed<Set<string | number>>(() =>
  props.selection ?? internalSelection.value,
)
const isSelectable = computed(() => props.selectable || props.selection !== undefined)

function emitSelection(next: Set<string | number>) {
  if (props.selection === undefined)
    internalSelection.value = next
  emit('update:selection', next)
}

const allOnPageSelected = computed(() => {
  const rows = pageRows.value
  return rows.length > 0 && rows.every(r => selection.value.has(idOf(r)))
})
const selectedOnPageCount = computed(() =>
  pageRows.value.reduce((count, row) => count + (selection.value.has(idOf(row)) ? 1 : 0), 0),
)
const someSelected = computed(() =>
  selectedOnPageCount.value > 0 && selectedOnPageCount.value < pageRows.value.length,
)

function toggleAll() {
  const next = new Set(selection.value)
  if (allOnPageSelected.value)
    pageRows.value.forEach(r => next.delete(idOf(r)))
  else
    pageRows.value.forEach(r => next.add(idOf(r)))
  emitSelection(next)
}

function toggleOne(id: string | number) {
  const next = new Set(selection.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  emitSelection(next)
}

function clearSel() {
  emitSelection(new Set())
}

const selectedRows = computed<R[]>(() =>
  props.rows.filter(r => selection.value.has(idOf(r))),
)

// Server-paginated tables only have row data for the visible page. Never keep
// stale IDs after filters or data refreshes: bulk-action slots receive rows,
// and retaining an ID without its row can target the wrong/empty selection.
watch(
  () => props.rows.map(idOf),
  (ids) => {
    if (!isPagControlled.value || selection.value.size === 0)
      return
    const visible = new Set(ids)
    const next = new Set([...selection.value].filter(id => visible.has(id)))
    if (next.size !== selection.value.size)
      emitSelection(next)
  },
)

/* ---------- expand (always internal) ---------- */
const expanded = ref<Set<string | number>>(new Set())
function toggleExpand(id: string | number) {
  const next = new Set(expanded.value)
  if (next.has(id))
    next.delete(id)
  else
    next.add(id)
  expanded.value = next
}

/* ---------- column meta ---------- */
const colCount = computed(() =>
  props.columns.length
  + (isSelectable.value ? 1 : 0)
  + (hasRowActions.value ? 1 : 0)
  + (props.expandable ? 1 : 0),
)

const slots = useSlots()
const hasRowActions = computed(() => !!slots['row-actions'])
const hasBulkActions = computed(() => !!slots['bulk-actions'])

function thClass(c: DataTableColumn<R>) {
  return cx(
    c.align === 'right' && 'num',
    c.align === 'center' && 'center',
    c.sortable && 'sortable',
  )
}

function tdClass(c: DataTableColumn<R>) {
  return cx(
    c.align === 'right' && 'num',
    c.align === 'center' && 'center',
    c.cellClass,
  )
}

function thStyle(c: DataTableColumn<R>): CSSProperties {
  if (c.width === undefined)
    return {}
  return { width: typeof c.width === 'number' ? `${c.width}px` : c.width }
}

function rowStyle(): CSSProperties {
  /* v3 decision #2: row click no longer toggles expand — pointer cursor only when
     a real row-click handler is wired. */
  return hasOnRowClick.value ? { cursor: 'pointer' } : { cursor: 'default' }
}

const attrs = useAttrs()
const hasOnRowClick = computed(() => !!(attrs as any).onRowClick)

function emitRowClick(row: R) {
  /* v3 decision #2: chevron is the canonical expand toggle.
     Row clicks no longer toggle expand when expandable. */
  emit('row-click', row)
}

/**
 * Functional wrapper that invokes a column's `render(row)` and returns a VNode.
 * Lets us call user-supplied render functions from the template without `<component :is>`.
 */
const ColRender = defineComponent({
  name: 'DataTableColRender',
  props: {
    render: { type: Function, required: true },
    row: { type: null, required: true },
  },
  setup(p) {
    return () => {
      const out = (p.render as (row: any) => any)(p.row)
      if (out === null || out === undefined)
        return null
      return typeof out === 'object' ? out : h('span', null, String(out))
    }
  },
})

/* ---------- skeleton sizing ---------- */
const skeletonRowCount = computed(() => (pp.value > 10 ? 10 : pp.value))
function skeletonWidth(c: number) {
  if (c === 0)
    return '40%'
  if (c === colCount.value - 1)
    return '50%'
  return '70%'
}
</script>

<template>
  <div :aria-busy="loading ? 'true' : undefined">
    <span
      v-if="loading"
      class="visually-hidden"
      role="status"
    >{{ t('Loading') }}</span>
    <!-- Bulk action bar -->
    <div
      v-if="isSelectable && selection.size > 0"
      class="bulkbar"
    >
      <Checkbox
        :model-value="allOnPageSelected"
        :indeterminate="someSelected"
        :aria-label="t('Select')"
        @update:model-value="toggleAll"
      />
      <span class="bulkbar__count">{{ t('{count} selected', { count: selection.size }) }}</span>
      <div style="flex: 1;" />
      <slot
        name="bulk-actions"
        :selected="selectedRows"
        :clear="clearSel"
      />
      <Button
        variant="ghost"
        size="sm"
        @click="clearSel"
      >
        {{ t('Clear') }}
      </Button>
    </div>

    <div class="tablewrap">
      <table
        class="dtable"
        :aria-busy="loading ? 'true' : undefined"
      >
        <thead>
          <tr>
            <th
              v-if="expandable"
              style="width: 40px;"
            />
            <th
              v-if="isSelectable"
              style="width: 44px;"
              scope="col"
            >
              <Checkbox
                :model-value="allOnPageSelected"
                :indeterminate="someSelected"
                :aria-label="t('Select')"
                @update:model-value="toggleAll"
              />
            </th>
            <th
              v-for="c in columns"
              :key="c.key"
              :class="thClass(c)"
              :style="thStyle(c)"
              scope="col"
              :aria-sort="c.sortable && currentSort.key === c.key
                ? (currentSort.dir === 'asc' ? 'ascending' : 'descending')
                : undefined"
            >
              <button
                v-if="c.sortable"
                type="button"
                class="table-sort"
                @click="toggleSort(c.key)"
              >
                <span>{{ c.label }}</span>
                <span :class="cx('sort-ic', currentSort.key === c.key && 'is-active')">
                  <DesignIcon
                    :name="currentSort.key === c.key ? (currentSort.dir === 'asc' ? 'sortup' : 'sortdown') : 'sort'"
                    :size="13"
                  />
                </span>
              </button>
              <template v-else>
                {{ c.label }}
              </template>
            </th>
            <th
              v-if="hasRowActions"
              class="num"
              style="width: 120px;"
            >
              {{ t('Actions') }}
            </th>
          </tr>
        </thead>

        <!-- Loading skeleton -->
        <tbody v-if="loading">
          <tr
            v-for="r in skeletonRowCount"
            :key="`sk-${r}`"
          >
            <td
              v-if="expandable"
              style="width: 40px;"
            />
            <td
              v-if="isSelectable"
              style="width: 44px;"
            >
              <Skeleton
                :w="18"
                :h="18"
                :r="4"
              />
            </td>
            <td
              v-for="(c, ci) in columns"
              :key="`sk-${r}-${c.key}`"
            >
              <Skeleton
                :h="14"
                :w="skeletonWidth(ci + (isSelectable ? 1 : 0) + (expandable ? 1 : 0))"
              />
            </td>
            <td
              v-if="hasRowActions"
              class="num"
            >
              <Skeleton
                :h="14"
                w="60%"
              />
            </td>
          </tr>
        </tbody>

        <!-- Body -->
        <tbody v-else>
          <!-- Empty state -->
          <tr v-if="pageRows.length === 0">
            <td
              :colspan="colCount"
              style="padding: 0;"
            >
              <slot name="empty">
                <StateFill
                  :icon="emptyIcon"
                  :title="emptyTitle ?? t('No results')"
                  :sub="emptySub ?? t('Nothing matches your filters.')"
                />
              </slot>
            </td>
          </tr>

          <!-- Data rows -->
          <template
            v-for="r in pageRows"
            v-else
            :key="idOf(r)"
          >
            <tr
              :class="cx(selection.has(idOf(r)) && 'is-selected')"
              :style="rowStyle()"
              :tabindex="hasOnRowClick ? 0 : undefined"
              @click="emitRowClick(r)"
              @keydown.enter.self="emitRowClick(r)"
              @keydown.space.self.prevent="emitRowClick(r)"
            >
              <td
                v-if="expandable"
                style="width: 40px;"
              >
                <button
                  class="iconaction"
                  :title="expanded.has(idOf(r)) ? t('close') : t('Expand')"
                  :aria-label="expanded.has(idOf(r)) ? t('close') : t('Expand')"
                  :aria-expanded="expanded.has(idOf(r))"
                  @click.stop="toggleExpand(idOf(r))"
                >
                  <DesignIcon
                    name="chevright"
                    :size="16"
                    :style="{
                      transform: expanded.has(idOf(r)) ? 'rotate(90deg)' : 'none',
                      transition: 'transform .15s',
                    }"
                  />
                </button>
              </td>
              <td v-if="isSelectable">
                <Checkbox
                  :model-value="selection.has(idOf(r))"
                  :aria-label="`${t('Select')} ${idOf(r)}`"
                  @update:model-value="toggleOne(idOf(r))"
                />
              </td>
              <td
                v-for="c in columns"
                :key="c.key"
                :class="tdClass(c)"
              >
                <slot
                  :name="`cell.${c.key}`"
                  :row="r"
                  :value="(r as any)[c.key]"
                >
                  <ColRender
                    v-if="c.render"
                    :render="c.render"
                    :row="r"
                  />
                  <template v-else>
                    {{ (r as any)[c.key] }}
                  </template>
                </slot>
              </td>
              <td
                v-if="hasRowActions"
                class="num"
              >
                <div
                  class="row-actions"
                  @click.stop
                >
                  <slot
                    name="row-actions"
                    :row="r"
                  />
                </div>
              </td>
            </tr>
            <tr
              v-if="expandable && expanded.has(idOf(r))"
              class="row-expand"
            >
              <td :colspan="colCount">
                <div class="expand-inner">
                  <slot
                    name="expanded"
                    :row="r"
                  />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination footer (decision #3: delegated to <Pagination>) -->
    <Pagination
      v-if="!loading && totalItems > 0"
      :page="curPage"
      :per-page="pp"
      :pages="totalPages"
      :total="totalItems"
      :per-page-options="perPageOptions"
      @page="goPage"
      @per-page="setPp"
    />
  </div>
</template>

<style scoped>
/* Layout-only safeguards. All visual styling comes from
   src/styles/design-shell.css (verbatim ported alpha-design-system.css). */
.row {
  display: flex;
  align-items: center;
}
</style>

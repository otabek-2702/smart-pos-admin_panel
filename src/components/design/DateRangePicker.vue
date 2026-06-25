<script setup lang="ts">
/* ============================================================
   ALPHA POS — DateRangePicker (reusable)
   1:1 port of .tmp-cal-design/.../app/datepicker.jsx
   ============================================================ */
import DesignIcon from './DesignIcon.vue'
import { cx } from './utils'

export interface DateRangeValue {
  from: string
  to: string
  preset?: string
}

interface Props {
  modelValue?: DateRangeValue
  value?: DateRangeValue
  align?: 'left' | 'right'
  size?: 'sm'
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  align: 'left',
  placeholder: 'All time',
})
const emit = defineEmits<{
  (e: 'update:modelValue', v: DateRangeValue): void
  (e: 'change', v: DateRangeValue): void
}>()

const { t } = useI18n({ useScope: 'global' })

const current = computed<DateRangeValue>(() => props.modelValue ?? props.value ?? { from: '', to: '', preset: 'all' })

function ymd(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function parseYmd(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = String(s).split('-')
  if (m.length < 3) return null
  const d = new Date(+m[0], +m[1] - 1, +m[2])
  return Number.isNaN(d.getTime()) ? null : d
}
function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
function sameDay(a: Date | null, b: Date | null): boolean {
  return !!(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate())
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'prevmonth' | 'year' | 'all'

function presetRange(key: PresetKey, today: Date): [Date | null, Date | null] {
  const tt = startOfDay(today)
  switch (key) {
    case 'today': return [tt, tt]
    case 'yesterday': { const y = addDays(tt, -1); return [y, y] }
    case '7d': return [addDays(tt, -6), tt]
    case '30d': return [addDays(tt, -29), tt]
    case 'month': return [new Date(tt.getFullYear(), tt.getMonth(), 1), tt]
    case 'prevmonth': {
      const s = new Date(tt.getFullYear(), tt.getMonth() - 1, 1)
      const e = new Date(tt.getFullYear(), tt.getMonth(), 0)
      return [s, e]
    }
    case 'year': return [new Date(tt.getFullYear(), 0, 1), tt]
    case 'all': return [null, null]
    default: return [null, null]
  }
}

const PRESETS: { key: PresetKey, label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'prevmonth', label: 'Last month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
]

function fmtShort(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

function matchPreset(from: Date | null, to: Date | null, today: Date): string | null {
  if (!from && !to) return 'all'
  for (const p of PRESETS) {
    if (p.key === 'all') continue
    const [a, b] = presetRange(p.key, today)
    if (a && b && from && to && sameDay(from, a) && sameDay(to, b)) return p.key
  }
  return null
}

const today = startOfDay(new Date())
const open = ref(false)
const root = ref<HTMLElement | null>(null)

const from = ref<Date | null>(parseYmd(current.value.from))
const to = ref<Date | null>(parseYmd(current.value.to))
const hover = ref<Date | null>(null)
const view = ref<Date>(
  from.value ? new Date(from.value.getFullYear(), from.value.getMonth(), 1)
    : new Date(today.getFullYear(), today.getMonth(), 1),
)

watch(open, (v) => {
  if (v) {
    const vf = parseYmd(current.value.from)
    const vt = parseYmd(current.value.to)
    from.value = vf
    to.value = vt
    hover.value = null
    view.value = vf
      ? new Date(vf.getFullYear(), vf.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1)
  }
})

function onDocPointer(e: PointerEvent) {
  if (!open.value) return
  const t = e.target as Node | null
  if (t && root.value?.contains(t)) return
  open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onKey)
})

function pick(d: Date) {
  if (!from.value || (from.value && to.value)) {
    from.value = d; to.value = null; hover.value = null
  }
  else if (d.getTime() < from.value.getTime()) {
    to.value = from.value; from.value = d
  }
  else {
    to.value = d
  }
}

function emitChange(v: DateRangeValue) {
  emit('update:modelValue', v)
  emit('change', v)
}

function applyPreset(key: PresetKey) {
  const [a, b] = presetRange(key, today)
  from.value = a; to.value = b; hover.value = null
  if (a) view.value = new Date(a.getFullYear(), a.getMonth(), 1)
  emitChange({ from: a ? ymd(a) : '', to: b ? ymd(b) : '', preset: key })
  open.value = false
}

function apply() {
  const f = from.value
  const tval = to.value || from.value
  emitChange({
    from: f ? ymd(f) : '',
    to: tval ? ymd(tval) : '',
    preset: matchPreset(f, tval, today) ?? undefined,
  })
  open.value = false
}

function clear() {
  from.value = null; to.value = null; hover.value = null
}

const valFrom = computed(() => parseYmd(current.value.from))
const valTo = computed(() => parseYmd(current.value.to))
const activePreset = computed(() => matchPreset(valFrom.value, valTo.value, today))
const draftActive = computed(() => matchPreset(from.value, to.value, today))

const triggerLabel = computed(() => {
  if (activePreset.value && activePreset.value !== 'all') {
    const p = PRESETS.find(x => x.key === activePreset.value)
    if (p) return t(p.label)
  }
  if (valFrom.value && valTo.value)
    return sameDay(valFrom.value, valTo.value)
      ? fmtShort(valFrom.value)
      : `${fmtShort(valFrom.value)} – ${fmtShort(valTo.value)}`
  if (valFrom.value) return `${t('From')} ${fmtShort(valFrom.value)}`
  return t(props.placeholder)
})

const hasValue = computed(() => !!(valFrom.value || valTo.value))

const draftLabel = computed(() => {
  if (from.value && to.value)
    return sameDay(from.value, to.value)
      ? fmtShort(from.value)
      : `${fmtShort(from.value)} – ${fmtShort(to.value)}`
  if (from.value) return `${fmtShort(from.value)} – …`
  return t('Select a start date')
})

interface Cell { date: Date | null }

function buildCells(month: Date): Cell[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const startWd = (first.getDay() + 6) % 7 // Mon first
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: Cell[] = []
  for (let i = 0; i < startWd; i++) cells.push({ date: null })
  for (let d = 1; d <= daysIn; d++)
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), d) })
  while (cells.length % 7 !== 0) cells.push({ date: null })
  return cells
}

const todayT = today.getTime()
const maxT = todayT // disable future days

function cellClass(d: Date): string {
  const tt = d.getTime()
  const disabled = tt > maxT
  const isFrom = !!(from.value && sameDay(d, from.value))
  const fromT = from.value ? from.value.getTime() : null
  const toT = to.value ? to.value.getTime() : null
  const previewT = (from.value && !to.value && hover.value) ? hover.value.getTime() : toT
  const isTo = !!(previewT != null && sameDay(d, new Date(previewT)))
  const lo = fromT != null ? Math.min(fromT, previewT ?? fromT) : null
  const hi = fromT != null ? Math.max(fromT, previewT ?? fromT) : null
  const inRange = lo != null && hi != null && tt > lo && tt < hi
  const isEdge = isFrom || isTo
  const single = isFrom && isTo
  return cx(
    'drp-cell',
    disabled && 'is-disabled',
    sameDay(d, today) && 'is-today',
    inRange && 'in-range',
    isEdge && 'is-edge',
    isFrom && !single && 'is-start',
    isTo && !single && 'is-end',
    single && 'is-single',
  )
}

function cellDisabled(d: Date): boolean {
  return d.getTime() > maxT
}

function gotoPrev() { view.value = addMonths(view.value, -1) }
function gotoNext() { view.value = addMonths(view.value, 1) }
const nextView = computed(() => addMonths(view.value, 1))
</script>

<template>
  <div ref="root" :class="cx('drp', size === 'sm' && 'drp--sm')">
    <button
      type="button"
      :class="cx('drp-trigger', hasValue && 'has-value', open && 'is-open')"
      @click="open = !open"
    >
      <DesignIcon name="calendar" :size="17" />
      <span class="drp-trigger__label">{{ triggerLabel }}</span>
      <DesignIcon name="chevdown" :size="15" class="drp-trigger__chev" />
    </button>

    <div
      v-if="open"
      :class="cx('drp-pop', align === 'right' && 'drp-pop--right')"
    >
      <div class="drp-presets">
        <button
          v-for="p in PRESETS"
          :key="p.key"
          type="button"
          :class="cx('drp-preset', draftActive === p.key && 'is-active')"
          @click="applyPreset(p.key)"
        >
          {{ t(p.label) }}
        </button>
      </div>

      <div class="drp-cal">
        <div class="drp-cal__head">
          <button type="button" class="drp-nav" :title="t('Previous month')" @click="gotoPrev">
            <DesignIcon name="chevleft" :size="17" />
          </button>
          <div class="drp-cal__titles">
            <span>{{ t(MONTHS[view.getMonth()]) }} {{ view.getFullYear() }}</span>
            <span>{{ t(MONTHS[nextView.getMonth()]) }} {{ nextView.getFullYear() }}</span>
          </div>
          <button type="button" class="drp-nav" :title="t('Next month')" @click="gotoNext">
            <DesignIcon name="chevright" :size="17" />
          </button>
        </div>

        <div class="drp-months" @mouseleave="hover = null">
          <div class="drp-month">
            <div class="drp-wd">
              <span v-for="w in WD" :key="`a-${w}`">{{ t(`wd_${w}`) }}</span>
            </div>
            <div class="drp-grid">
              <template v-for="(c, i) in buildCells(view)" :key="`a${i}`">
                <span v-if="!c.date" class="drp-cell is-empty" />
                <button
                  v-else
                  type="button"
                  :class="cellClass(c.date)"
                  :disabled="cellDisabled(c.date)"
                  @click="pick(c.date)"
                  @mouseenter="hover = c.date"
                >
                  <span class="drp-num">{{ c.date.getDate() }}</span>
                </button>
              </template>
            </div>
          </div>
          <div class="drp-month">
            <div class="drp-wd">
              <span v-for="w in WD" :key="`b-${w}`">{{ t(`wd_${w}`) }}</span>
            </div>
            <div class="drp-grid">
              <template v-for="(c, i) in buildCells(nextView)" :key="`b${i}`">
                <span v-if="!c.date" class="drp-cell is-empty" />
                <button
                  v-else
                  type="button"
                  :class="cellClass(c.date)"
                  :disabled="cellDisabled(c.date)"
                  @click="pick(c.date)"
                  @mouseenter="hover = c.date"
                >
                  <span class="drp-num">{{ c.date.getDate() }}</span>
                </button>
              </template>
            </div>
          </div>
        </div>

        <div class="drp-foot">
          <span class="drp-foot__draft">{{ draftLabel }}</span>
          <div class="drp-foot__actions">
            <button v-if="from || to" type="button" class="drp-clear" @click="clear">
              {{ t('Clear') }}
            </button>
            <button type="button" class="btn btn--ghost btn--sm" @click="open = false">
              {{ t('Cancel') }}
            </button>
            <button
              type="button"
              class="btn btn--primary btn--sm"
              :disabled="!from"
              @click="apply"
            >
              {{ t('Apply') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

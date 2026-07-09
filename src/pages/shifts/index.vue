<script setup lang="ts">
/* ============================================================
   ALPHA POS — Shifts page (v3 single card-grid rewrite)
   Source: .tmp-handoff-v3/.../pages/Shifts.jsx (304 lines)
   Decision #13: drop tabs (History/Templates) + DrawerExpense
   + Performance scorecard. KPI strip + filter toolbar + card grid +
   ReceiveCashModal. Preserves real BE calls:
     GET  /shifts/active            list active shifts
     GET  /shifts (paginated)       all shifts (history)
     POST /shifts/{id}/end          end-shift
     POST /shifts/{id}/reconcile    manager handover {actual_cash, notes}
   ============================================================ */
import axios from '@/plugins/axios'
import Badge from '@/components/design/Badge.vue'
import Button from '@/components/design/Button.vue'
import Card from '@/components/design/Card.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Field from '@/components/design/Field.vue'
import Input from '@/components/design/Input.vue'
import Kpi from '@/components/design/Kpi.vue'
import KpiSkel from '@/components/design/KpiSkel.vue'
import Modal from '@/components/design/Modal.vue'
import PageHeader from '@/components/design/PageHeader.vue'
import Select from '@/components/design/Select.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import StateFill from '@/components/design/StateFill.vue'
import Switch from '@/components/design/Switch.vue'
import { Fmt } from '@/components/design/utils/format'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

/* ============================================================
   Types — normalised v3 shape (mirrors window.DB.shiftsList items
   in the v3 handoff). Raw BE fields snake_case → camelCase here.
   ============================================================ */
interface ShiftRaw {
  id: number | string
  user?: { id?: number, first_name?: string, last_name?: string, name?: string }
  status?: string
  is_live_stats?: boolean
  start_time?: string
  end_time?: string | null
  total_orders?: number
  total_orders_revenue?: number | string
  gross_revenue?: number | string
  net_revenue?: number | string
  cash_collected?: number | string
  card_collected?: number | string
  expenses_total?: number | string
  cancelled_count?: number
  cancelled_amount?: number | string
  variance?: number | null
  expected_cash?: number | string | null
  reported?: boolean | number | string | null
  reported_by?: string | { name?: string, first_name?: string, last_name?: string } | null
  avg_ticket?: number | string
  items_sold?: number
  avg_prep_time?: number | string | null
  peak_hour?: string
  template?: string
}

interface ShiftV3 {
  id: number | string
  raw: ShiftRaw
  status: string
  cashier: string
  initials: string
  start: string
  end: string | null
  orders: number
  gross: number
  net: number
  cash: number
  card: number
  expenses: number
  cancelled: number
  cancelledAmount: number
  variance: number | null
  expectedCash: number | null
  reported: number | null
  reportedBy: string
  avgTicket: number
  items: number
  avgPrep: string
  peak: string
  live: boolean
  durationLabel: string
  template: string
}

/* ============================================================
   Helpers
   ============================================================ */
function num(v: number | string | null | undefined, fb = 0): number {
  if (v === null || v === undefined || v === '')
    return fb
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? fb : n
}

function nullableNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '')
    return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? null : n
}

function cashierName(u?: ShiftRaw['user']): string {
  if (!u)
    return '—'
  const fn = (u.first_name || '').trim()
  const ln = (u.last_name || '').trim()
  const joined = `${fn} ${ln}`.trim()
  if (joined)
    return joined
  if (u.name)
    return u.name
  return '—'
}

function initialsOf(name: string): string {
  if (!name || name === '—')
    return '?'
  const parts = name.split(/\s+/).filter(Boolean)
  const a = (parts[0]?.[0] || '').toUpperCase()
  const b = (parts[1]?.[0] || '').toUpperCase()
  return (a + b) || a || '?'
}

function reporterName(r: ShiftRaw['reported_by']): string {
  if (!r)
    return ''
  if (typeof r === 'string')
    return r
  if (r.name)
    return r.name
  const fn = (r.first_name || '').trim()
  const ln = (r.last_name || '').trim()
  return `${fn} ${ln}`.trim()
}

function durationLabel(startIso?: string, endIso?: string | null): string {
  if (!startIso)
    return '—'
  const s = new Date(startIso)
  const e = endIso ? new Date(endIso) : new Date()
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
    return '—'
  const ms = e.getTime() - s.getTime()
  if (ms < 0)
    return '—'
  const mins = Math.floor(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0)
    return `${m}m`
  return `${h}h ${m}m`
}

function prepLabel(seconds: number | string | null | undefined): string {
  const n = nullableNum(seconds)
  if (n === null)
    return '—'
  const m = Math.floor(n / 60)
  const s = Math.round(n % 60)
  return `${m}m ${s}s`
}

function normalize(s: ShiftRaw): ShiftV3 {
  const name = cashierName(s.user)
  const grossRaw = s.gross_revenue ?? s.total_orders_revenue ?? 0
  return {
    id: s.id,
    raw: s,
    status: s.status || '',
    cashier: name,
    initials: initialsOf(name),
    start: s.start_time || '',
    end: s.end_time ?? null,
    orders: num(s.total_orders, 0),
    gross: num(grossRaw, 0),
    net: num(s.net_revenue, 0),
    cash: num(s.cash_collected, 0),
    card: num(s.card_collected, 0),
    expenses: num(s.expenses_total, 0),
    cancelled: num(s.cancelled_count, 0),
    cancelledAmount: num(s.cancelled_amount, 0),
    variance: nullableNum(s.variance),
    expectedCash: nullableNum(s.expected_cash),
    reported: nullableNum(s.reported as any),
    reportedBy: reporterName(s.reported_by),
    avgTicket: num(s.avg_ticket, 0),
    items: num(s.items_sold, 0),
    avgPrep: prepLabel(s.avg_prep_time),
    peak: s.peak_hour || '—',
    live: s.is_live_stats === true,
    durationLabel: durationLabel(s.start_time, s.end_time),
    template: s.template || '',
  }
}

function shiftState(s: ShiftV3): 'active' | 'awaiting' | 'reconciled' {
  const st = (s.status || '').toUpperCase()
  if (st === 'OPEN' || st === 'ACTIVE' || s.live)
    return 'active'
  if (st === 'AWAITING_CASH' || st === 'ENDED')
    return 'awaiting'
  if (st === 'CLOSED' || st === 'COMPLETED' || st === 'RECONCILED' || s.reported)
    return 'reconciled'
  return 'awaiting'
}

/* ============================================================
   State
   ============================================================ */
const shifts = ref<ShiftV3[]>([])
const loading = ref(false)

// filters (mirror v3)
const cashierFilter = ref<string>('')
const statusFilter = ref<string>('')
const liveOnly = ref(false)
const dateFrom = ref('')
const dateTo = ref('')

// sort (client-side; server list is a page snapshot)
const sortBy = ref<string>('priority')
const sortOptions = [
  { value: 'priority', label: 'Priority (needs action)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'gross', label: 'Highest gross' },
  { value: 'cashier', label: 'Cashier A–Z' },
]

// live refresh
const refreshing = ref(false)
const lastUpdated = ref<number>(0)
const now = ref<number>(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

// modal
const receiving = ref<ShiftV3 | null>(null)

/* ============================================================
   Load — merge /shifts/active (live) + /shifts (history paginated)
   ============================================================ */
async function loadShifts() {
  loading.value = true
  try {
    const [activeRes, histRes] = await Promise.all([
      axios.get('/shifts/active').catch(() => ({ data: { data: [] } })),
      axios.get('/shifts', { params: { page: 1, per_page: 50 } }).catch(() => ({ data: { data: [] } })),
    ])

    const aD = activeRes.data?.data ?? activeRes.data
    const activeList: ShiftRaw[] = Array.isArray(aD) ? aD : (aD?.shifts ?? aD?.items ?? [])

    const hD = histRes.data?.data ?? histRes.data
    const histList: ShiftRaw[] = hD?.shifts ?? hD?.items ?? (Array.isArray(hD) ? hD : [])

    // de-dup by id; active takes precedence (fresher payload).
    const seen = new Set<string | number>()
    const merged: ShiftRaw[] = []
    for (const s of activeList) {
      if (s && s.id !== undefined && !seen.has(s.id)) {
        seen.add(s.id)
        merged.push(s)
      }
    }
    for (const s of histList) {
      if (s && s.id !== undefined && !seen.has(s.id)) {
        seen.add(s.id)
        merged.push(s)
      }
    }

    shifts.value = merged.map(normalize)
  }
  catch {
    notify(t('Failed to load shifts'), 'error')
  }
  finally {
    loading.value = false
    lastUpdated.value = Date.now()
    now.value = Date.now()
  }
}

// Manual / auto refresh — never flashes the skeleton (data already present),
// so the operator can re-check live shifts without losing scroll position.
async function refresh() {
  if (refreshing.value || loading.value)
    return
  refreshing.value = true
  try {
    await loadShifts()
  }
  finally {
    refreshing.value = false
  }
}

onMounted(() => {
  loadShifts()
  // tick the clock so live durations + "updated Nm ago" stay honest
  clockTimer = setInterval(() => { now.value = Date.now() }, 30_000)
  // quietly poll while cashiers are on the floor; pause when the tab is hidden
  // or the user is mid-action (modal open / ending / reconciling).
  pollTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible')
      return
    if (receiving.value || reconBusy.value || ending.value !== null || loading.value || refreshing.value)
      return
    if (activeCount.value > 0)
      refresh()
  }, 60_000)
})

onUnmounted(() => {
  if (clockTimer)
    clearInterval(clockTimer)
  if (pollTimer)
    clearInterval(pollTimer)
})

const updatedAgo = computed(() => {
  if (!lastUpdated.value)
    return ''
  const secs = Math.max(0, Math.floor((now.value - lastUpdated.value) / 1000))
  if (secs < 60)
    return t('just now')
  return `${Math.floor(secs / 60)} ${t('min ago')}`
})

// Live duration for still-running shifts (recomputes as the clock ticks);
// ended shifts keep their frozen label.
function durationFor(s: ShiftV3): string {
  if (s.end)
    return s.durationLabel
  void now.value
  return durationLabel(s.start, null)
}

/* ============================================================
   Derived — cashier options + filtered list + KPI metrics
   ============================================================ */
const cashierOptions = computed(() => {
  const seen = new Set<string>()
  const out: { value: string, label: string }[] = []
  for (const s of shifts.value) {
    if (s.cashier && s.cashier !== '—' && !seen.has(s.cashier)) {
      seen.add(s.cashier)
      out.push({ value: s.cashier, label: s.cashier })
    }
  }
  return out
})

const statusOptions = [
  { value: 'Active', label: 'Active' },
  { value: 'Awaiting cash', label: 'Awaiting cash' },
  { value: 'Reconciled', label: 'Reconciled' },
]

const filtered = computed<ShiftV3[]>(() => {
  return shifts.value.filter((s) => {
    if (cashierFilter.value && s.cashier !== cashierFilter.value)
      return false
    if (liveOnly.value && !s.live)
      return false
    if (statusFilter.value) {
      const st = shiftState(s)
      if (statusFilter.value === 'Active' && st !== 'active')
        return false
      if (statusFilter.value === 'Awaiting cash' && st !== 'awaiting')
        return false
      if (statusFilter.value === 'Reconciled' && st !== 'reconciled')
        return false
    }
    if (dateFrom.value && s.start && new Date(s.start) < new Date(dateFrom.value))
      return false
    if (dateTo.value && s.start && new Date(s.start) > new Date(`${dateTo.value}T23:59`))
      return false
    return true
  })
})

const activeCount = computed(() => shifts.value.filter(s => shiftState(s) === 'active').length)
const awaitingList = computed(() => shifts.value.filter(s => shiftState(s) === 'awaiting'))
const cashToReceive = computed(() => awaitingList.value.reduce((a, s) => a + (s.expectedCash ?? 0), 0))
const netVariance = computed(() => shifts.value
  .filter(s => shiftState(s) === 'reconciled' && s.variance !== null)
  .reduce((a, s) => a + (s.variance ?? 0), 0))

/* ============================================================
   Sort — default surfaces the cards that need action first
   (awaiting cash → active → reconciled), then newest.
   ============================================================ */
const statePriority: Record<string, number> = { awaiting: 0, active: 1, reconciled: 2 }
function startMs(s: ShiftV3): number {
  if (!s.start)
    return 0
  const ms = new Date(s.start).getTime()
  return Number.isNaN(ms) ? 0 : ms
}
const sorted = computed<ShiftV3[]>(() => {
  const arr = [...filtered.value]
  switch (sortBy.value) {
    case 'newest':
      arr.sort((a, b) => startMs(b) - startMs(a))
      break
    case 'oldest':
      arr.sort((a, b) => startMs(a) - startMs(b))
      break
    case 'gross':
      arr.sort((a, b) => b.gross - a.gross)
      break
    case 'cashier':
      arr.sort((a, b) => a.cashier.localeCompare(b.cashier))
      break
    default:
      arr.sort((a, b) => {
        const d = statePriority[shiftState(a)] - statePriority[shiftState(b)]
        return d !== 0 ? d : startMs(b) - startMs(a)
      })
  }
  return arr
})

/* ============================================================
   Filter chips
   ============================================================ */
interface Chip { k: string, label: string, val: string, clear: () => void }
const activeChips = computed<Chip[]>(() => {
  const out: Chip[] = []
  if (cashierFilter.value)
    out.push({ k: 'c', label: t('Cashier'), val: cashierFilter.value, clear: () => { cashierFilter.value = '' } })
  if (statusFilter.value)
    out.push({ k: 's', label: t('Status'), val: t(statusFilter.value), clear: () => { statusFilter.value = '' } })
  if (liveOnly.value)
    out.push({ k: 'l', label: t('Live only'), val: t('On'), clear: () => { liveOnly.value = false } })
  if (dateFrom.value)
    out.push({ k: 'f', label: t('From'), val: dateFrom.value, clear: () => { dateFrom.value = '' } })
  if (dateTo.value)
    out.push({ k: 't', label: t('To'), val: dateTo.value, clear: () => { dateTo.value = '' } })
  return out
})

function clearAll() {
  cashierFilter.value = ''
  statusFilter.value = ''
  liveOnly.value = false
  dateFrom.value = ''
  dateTo.value = ''
}

/* ============================================================
   VarPill helper (inline component-ish)
   ============================================================ */
interface PillData { word: string, sign: string, abs: number, tone: 'success' | 'error' | 'neutral' }
function pillFor(v: number | null | undefined): PillData | null {
  if (v === null || v === undefined)
    return null
  const tone: PillData['tone'] = v === 0 ? 'neutral' : v > 0 ? 'success' : 'error'
  const word = v === 0 ? t('Exact') : v > 0 ? t('Over') : t('Short')
  const sign = v === 0 ? '' : v > 0 ? '+' : '−'
  return { word, sign, abs: Math.abs(v), tone }
}

/* ============================================================
   End-shift action
   ============================================================ */
const ending = ref<string | number | null>(null)
async function endShift(s: ShiftV3) {
  if (ending.value !== null)
    return
  ending.value = s.id
  try {
    await axios.post(`/shifts/${s.id}/end`, {})
    notify(`${s.cashier} · ${t('Shift ended')}`)
    await loadShifts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    ending.value = null
  }
}

/* ============================================================
   Receive cash modal
   ============================================================ */
const counted = ref<string>('')
const noteText = ref<string>('')
const reconBusy = ref(false)

function openReceive(s: ShiftV3) {
  receiving.value = s
  counted.value = ''
  noteText.value = ''
  reconBusy.value = false
}
function closeReceive() {
  if (reconBusy.value)
    return
  receiving.value = null
}

const parsedCounted = computed<number | null>(() => {
  if (counted.value === '' || counted.value === null || counted.value === undefined)
    return null
  const cleaned = String(counted.value).replace(/[^\d-]/g, '')
  if (cleaned === '' || cleaned === '-')
    return null
  const n = Number(cleaned)
  return Number.isNaN(n) ? null : n
})

const liveVariance = computed<number | null>(() => {
  if (parsedCounted.value === null || !receiving.value || receiving.value.expectedCash === null)
    return null
  return parsedCounted.value - (receiving.value.expectedCash ?? 0)
})

const variancePill = computed(() => pillFor(liveVariance.value))

const varianceBgStyle = computed<Record<string, string>>(() => {
  const v = liveVariance.value
  if (v === null)
    return { background: 'rgb(var(--v-theme-surface-2))', borderColor: 'rgb(var(--v-theme-border))' }
  if (v === 0)
    return { background: 'rgb(var(--v-theme-neutral-weak))', borderColor: 'rgb(var(--v-theme-neutral-border))' }
  if (v > 0)
    return { background: 'rgb(var(--v-theme-success-weak))', borderColor: 'rgb(var(--v-theme-success-border))' }
  return { background: 'rgb(var(--v-theme-error-weak))', borderColor: 'rgb(var(--v-theme-error-border))' }
})

async function confirmReceive() {
  if (!receiving.value || parsedCounted.value === null)
    return
  reconBusy.value = true
  const target = receiving.value
  try {
    await axios.post(`/shifts/${target.id}/reconcile`, {
      actual_cash: parsedCounted.value,
      notes: noteText.value,
    })
    const v = liveVariance.value ?? 0
    const tail = v === 0
      ? t('exact match')
      : (v > 0 ? `${t('over by')} ${Fmt.money(Math.abs(v))}` : `${t('short by')} ${Fmt.money(Math.abs(v))}`)
    notify(`${t('Cash received from')} ${target.cashier} · ${Fmt.money(parsedCounted.value)} UZS · ${tail}`)
    receiving.value = null
    await loadShifts()
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Error'), 'error')
  }
  finally {
    reconBusy.value = false
  }
}

/* ============================================================
   Live-report stub (placeholder; design has no analytics page yet)
   ============================================================ */
function gotoReport(_s: ShiftV3) {
  notify(t('Report coming soon'), 'info')
}
</script>

<template>
  <div class="page">
    <PageHeader
      :title="t('Shifts')"
      :subtitle="t('Reconcile cashiers and receive end-of-shift cash')"
    >
      <template #actions>
        <span
          v-if="updatedAgo"
          class="tertiary"
          style="font-size: 12px; white-space: nowrap;"
        >{{ t('Updated') }} {{ updatedAgo }}</span>
        <Button
          variant="secondary"
          icon="refresh"
          :loading="refreshing"
          @click="refresh"
        >
          {{ t('Refresh') }}
        </Button>
      </template>
    </PageHeader>

    <!-- KPI strip -->
    <div
      class="grid cols-4"
      style="margin-bottom: var(--sp-5);"
    >
      <template v-if="loading && shifts.length === 0">
        <KpiSkel
          v-for="i in 4"
          :key="i"
        />
      </template>
      <template v-else>
        <Kpi
          :data="{
            label: t('Active now'),
            value: activeCount,
            tone: 'info',
            icon: 'clock',
            sub: t('live shifts'),
          }"
        />
        <Kpi
          :data="{
            label: t('Awaiting cash'),
            value: awaitingList.length,
            tone: 'warning',
            icon: 'wallet',
            sub: t('to reconcile'),
          }"
        />
        <Kpi
          :data="{
            label: t('Cash to receive'),
            value: cashToReceive,
            money: true,
            tone: 'primary',
            icon: 'coins',
            sub: `${t('across')} ${awaitingList.length} ${t('shifts')}`,
          }"
        />
        <Kpi
          :data="{
            label: t('Net variance'),
            value: (netVariance >= 0 ? '+' : '−') + Fmt.abbr(Math.abs(netVariance)),
            tone: netVariance < 0 ? 'error' : 'success',
            icon: 'trend',
            sub: t('reconciled today'),
          }"
        />
      </template>
    </div>

    <!-- filter toolbar -->
    <Card style="margin-bottom: var(--sp-5);">
      <div class="toolbar shifts-toolbar">
        <div style="width: 200px;">
          <Select
            v-model="cashierFilter"
            icon="user"
            :placeholder="t('All cashiers')"
            :options="cashierOptions"
          />
        </div>
        <div style="width: 190px;">
          <Select
            v-model="statusFilter"
            icon="filter"
            :placeholder="t('All statuses')"
            :options="statusOptions.map(o => ({ value: o.value, label: t(o.label) }))"
          />
        </div>
        <div style="width: 200px;">
          <Select
            v-model="sortBy"
            icon="sort"
            :placeholder="t('Sort by')"
            :options="sortOptions.map(o => ({ value: o.value, label: t(o.label) }))"
          />
        </div>
        <div
          class="row"
          style="gap: 8px;"
        >
          <Input
            v-model="dateFrom"
            type="date"
            style="width: 150px;"
          />
          <span class="tertiary">→</span>
          <Input
            v-model="dateTo"
            type="date"
            style="width: 150px;"
          />
        </div>
        <div
          class="row"
          style="gap: 10px; margin-left: auto;"
        >
          <span
            class="row"
            style="gap: 8px; font-size: 14px; font-weight: 500;"
          >
            <Switch v-model="liveOnly" />
            {{ t('Live only') }}
          </span>
        </div>
      </div>

      <div
        v-if="activeChips.length > 0"
        class="toolbar"
        style="padding-top: 0;"
      >
        <div class="chips">
          <span
            class="tertiary"
            style="font-size: 13px; margin-right: 2px;"
          >{{ t('Filters') }}:</span>
          <span
            v-for="f in activeChips"
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
            @click="clearAll"
          >
            {{ t('Clear all') }}
          </button>
        </div>
      </div>
    </Card>

    <!-- result count -->
    <div
      v-if="!(loading && shifts.length === 0) && sorted.length > 0"
      class="row"
      style="margin-bottom: var(--sp-4);"
    >
      <span
        class="tertiary"
        style="font-size: 13px;"
      >{{ t('Showing') }} {{ sorted.length }} {{ t('of') }} {{ shifts.length }} {{ t('shifts') }}</span>
    </div>

    <!-- skeleton grid -->
    <div
      v-if="loading && shifts.length === 0"
      class="grid"
      style="grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); align-items: start;"
    >
      <Card
        v-for="i in 3"
        :key="`sk-${i}`"
        style="padding: var(--sp-5);"
      >
        <div
          class="row"
          style="gap: 12px; margin-bottom: 16px;"
        >
          <Skeleton
            :w="40"
            :h="40"
            :r="99"
          />
          <div style="flex: 1;">
            <Skeleton
              :w="120"
              :h="14"
            />
            <Skeleton
              :w="80"
              :h="11"
              :style="{ marginTop: '6px' }"
            />
          </div>
          <Skeleton
            :w="90"
            :h="22"
            :r="6"
          />
        </div>
        <Skeleton
          :h="38"
          :style="{ marginBottom: '16px' }"
        />
        <Skeleton
          :h="56"
          :style="{ marginBottom: '16px' }"
        />
        <Skeleton
          :h="70"
          :style="{ marginBottom: '16px' }"
        />
        <Skeleton :h="40" />
      </Card>
    </div>

    <!-- empty -->
    <Card v-else-if="filtered.length === 0">
      <StateFill
        icon="clock"
        :title="t('No shifts match your filters')"
        :sub="t('Adjust the cashier, status or date range.')"
      >
        <div style="margin-top: 12px;">
          <Button
            variant="secondary"
            @click="clearAll"
          >
            {{ t('Clear filters') }}
          </Button>
        </div>
      </StateFill>
    </Card>

    <!-- cards -->
    <div
      v-else
      class="grid"
      style="grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); align-items: start;"
    >
      <Card
        v-for="s in sorted"
        :key="s.id"
        :style="{
          display: 'flex',
          flexDirection: 'column',
          borderColor: shiftState(s) === 'awaiting' ? 'rgb(var(--v-theme-warning-border))' : undefined,
        }"
      >
        <!-- header -->
        <div
          class="row"
          style="gap: 12px; padding: var(--sp-5) var(--sp-5) var(--sp-4);"
        >
          <div class="avatar">
            {{ s.initials }}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; font-size: 15px;">
              {{ s.cashier }}
            </div>
            <div
              class="tertiary"
              style="font-size: 12px;"
            >
              {{ t('Shift') }} #{{ s.id }}<template v-if="s.template"> · {{ s.template }}</template>
            </div>
          </div>
          <Badge
            v-if="shiftState(s) === 'active'"
            tone="success"
            dot
          >
            {{ t('ACTIVE') }}
          </Badge>
          <Badge
            v-else-if="shiftState(s) === 'awaiting'"
            tone="warning"
            dot
          >
            {{ t('AWAITING CASH') }}
          </Badge>
          <Badge
            v-else
            tone="neutral"
          >
            <DesignIcon
              name="checkcircle"
              :size="13"
            />
            {{ t('RECONCILED') }}
          </Badge>
        </div>

        <!-- time strip -->
        <div
          class="row"
          style="justify-content: space-between; margin: 0 var(--sp-5); padding: 9px 12px; background: rgb(var(--v-theme-surface-inset)); border-radius: var(--r-sm); font-size: 13px;"
        >
          <span
            class="row"
            style="gap: 7px;"
          >
            <span class="mono">{{ s.start ? Fmt.dateTime(s.start) : '—' }}</span>
            <DesignIcon
              name="chevright"
              :size="14"
              class="tertiary"
            />
            <span
              class="mono"
              :style="{
                color: s.end ? 'rgb(var(--v-theme-on-surface))' : 'rgb(var(--v-theme-success))',
                fontWeight: s.end ? 400 : 600,
              }"
            >{{ s.end ? Fmt.dateTime(s.end) : t('running') }}</span>
          </span>
          <span class="badge t-neutral">
            <DesignIcon
              name="clock"
              :size="13"
            />
            {{ durationFor(s) }}
          </span>
        </div>

        <!-- sales stats -->
        <div
          class="row"
          style="gap: 0; padding: var(--sp-4) var(--sp-5) var(--sp-3);"
        >
          <div style="flex: 1; min-width: 0;">
            <div
              class="kpi__label"
              style="margin-bottom: 3px;"
            >
              {{ t('Orders') }}
            </div>
            <div
              class="mono"
              style="font-weight: 700; font-size: 16px; letter-spacing: -0.02em;"
            >
              {{ Fmt.num(s.orders) }}
            </div>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div
              class="kpi__label"
              style="margin-bottom: 3px;"
            >
              {{ t('Gross') }}
            </div>
            <div
              class="mono"
              style="font-weight: 700; font-size: 20px; letter-spacing: -0.02em;"
            >
              {{ Fmt.money(s.gross) }}
            </div>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div
              class="kpi__label"
              style="margin-bottom: 3px;"
            >
              {{ t('Net') }}
            </div>
            <div
              class="mono"
              style="font-weight: 700; font-size: 20px; letter-spacing: -0.02em; color: rgb(var(--v-theme-success));"
            >
              {{ Fmt.money(s.net) }}
            </div>
          </div>
        </div>

        <div class="card__divider" />

        <!-- reconciliation hero -->
        <div style="padding: var(--sp-4) var(--sp-5); flex: 1;">
          <div
            class="row"
            style="justify-content: space-between; margin-bottom: 10px;"
          >
            <span class="kpi__label">
              {{ shiftState(s) === 'reconciled' ? t('Cash received') : t('Cash to receive') }}
            </span>
            <template v-if="shiftState(s) === 'reconciled'">
              <Badge
                v-if="pillFor(s.variance)"
                :tone="pillFor(s.variance)?.tone || 'neutral'"
              >
                {{ pillFor(s.variance)?.word }}<template v-if="s.variance !== 0 && s.variance !== null">
                  {{ ' ' + pillFor(s.variance)?.sign + Fmt.num(pillFor(s.variance)?.abs ?? 0) }}
                </template>
              </Badge>
            </template>
          </div>
          <div
            class="row"
            style="justify-content: space-between; align-items: flex-end; margin-bottom: 12px;"
          >
            <span
              class="mono"
              style="font-size: 26px; font-weight: 700; letter-spacing: -0.03em;"
            >
              {{ Fmt.money(shiftState(s) === 'reconciled' ? (s.reported ?? 0) : (s.expectedCash ?? 0)) }}<span
                class="tertiary"
                style="font-size: 12px; font-weight: 500;"
              > UZS</span>
            </span>
          </div>

          <!-- PayRows -->
          <div
            class="row"
            style="justify-content: space-between; padding: 5px 0;"
          >
            <span
              class="row"
              style="gap: 8px; color: rgb(var(--v-theme-text-secondary)); font-size: 13px;"
            >
              <DesignIcon
                name="coins"
                :size="15"
                :style="{ color: 'rgb(var(--v-theme-success))' }"
              />
              {{ t('Cash sales') }}
            </span>
            <span
              class="mono"
              style="font-weight: 600; font-size: 13px;"
            >{{ Fmt.money(s.cash) }}</span>
          </div>
          <div
            class="row"
            style="justify-content: space-between; padding: 5px 0;"
          >
            <span
              class="row"
              style="gap: 8px; color: rgb(var(--v-theme-text-secondary)); font-size: 13px;"
            >
              <DesignIcon
                name="register"
                :size="15"
                :style="{ color: 'rgb(var(--v-theme-info))' }"
              />
              {{ t('Card / digital') }}
            </span>
            <span
              class="mono"
              style="font-weight: 600; font-size: 13px;"
            >{{ Fmt.money(s.card) }}</span>
          </div>
          <div
            class="row"
            style="justify-content: space-between; padding: 5px 0;"
          >
            <span
              class="row"
              style="gap: 8px; color: rgb(var(--v-theme-text-secondary)); font-size: 13px;"
            >
              <DesignIcon
                name="receipt"
                :size="15"
                class="tertiary"
              />
              {{ t('Expenses') }}
            </span>
            <span
              class="mono"
              style="font-weight: 600; font-size: 13px;"
            >− {{ Fmt.money(s.expenses) }}</span>
          </div>
          <div
            class="row"
            style="justify-content: space-between; padding: 5px 0;"
          >
            <span
              class="row"
              style="gap: 8px; color: rgb(var(--v-theme-text-secondary)); font-size: 13px;"
            >
              <DesignIcon
                name="close"
                :size="15"
                class="tertiary"
              />
              {{ t('Cancelled') }} · {{ s.cancelled }}
            </span>
            <span
              class="mono"
              style="font-weight: 600; font-size: 13px;"
            >{{ s.cancelledAmount ? `− ${Fmt.money(s.cancelledAmount)}` : '—' }}</span>
          </div>

          <div
            v-if="shiftState(s) === 'reconciled' && s.reported !== null"
            class="row"
            style="justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgb(var(--v-theme-border-strong, var(--v-theme-border))); font-size: 12px;"
          >
            <span class="tertiary">
              {{ t('Counted') }} {{ Fmt.money(s.reported) }}<template v-if="s.reportedBy"> · {{ t('received by') }} {{ s.reportedBy }}</template>
            </span>
          </div>
        </div>

        <!-- footer meta -->
        <div style="padding: 0 var(--sp-5) var(--sp-3);">
          <div
            class="row"
            style="flex-wrap: wrap; gap: 14px; font-size: 11px; color: rgb(var(--v-theme-text-tertiary)); padding-bottom: 12px;"
          >
            <span>{{ t('Avg ticket') }} <b
              class="mono"
              style="color: rgb(var(--v-theme-text-secondary));"
            >{{ Fmt.abbr(s.avgTicket) }}</b></span>
            <span>{{ t('Items') }} <b
              class="mono"
              style="color: rgb(var(--v-theme-text-secondary));"
            >{{ s.items }}</b></span>
            <span>{{ t('Avg prep') }} <b style="color: rgb(var(--v-theme-text-secondary));">{{ s.avgPrep }}</b></span>
            <span>{{ t('Peak') }} <b style="color: rgb(var(--v-theme-text-secondary));">{{ s.peak }}</b></span>
          </div>
        </div>

        <!-- action row -->
        <div
          class="row"
          style="gap: 8px; padding: var(--sp-4) var(--sp-5); border-top: 1px solid rgb(var(--v-theme-border)); background: rgb(var(--v-theme-surface-2)); border-radius: 0 0 var(--r-lg) var(--r-lg);"
        >
          <template v-if="shiftState(s) === 'active'">
            <Button
              variant="secondary"
              icon="chart"
              style="flex: 1;"
              @click="gotoReport(s)"
            >
              {{ t('Live report') }}
            </Button>
            <Button
              variant="ghost"
              icon="clock"
              :loading="ending === s.id"
              @click="endShift(s)"
            >
              {{ t('End shift') }}
            </Button>
          </template>
          <template v-else-if="shiftState(s) === 'awaiting'">
            <Button
              variant="primary"
              icon="dollar"
              style="flex: 1;"
              @click="openReceive(s)"
            >
              {{ t('Receive cash') }}
            </Button>
            <Button
              variant="secondary"
              icon="chart"
              @click="gotoReport(s)"
            >
              {{ t('Report') }}
            </Button>
          </template>
          <template v-else>
            <div
              class="row"
              style="gap: 7px; flex: 1; color: rgb(var(--v-theme-success)); font-weight: 600; font-size: 13px;"
            >
              <DesignIcon
                name="checkcircle"
                :size="17"
              />
              {{ t('Handover complete') }}
            </div>
            <Button
              variant="ghost"
              icon="chart"
              @click="gotoReport(s)"
            >
              {{ t('Report') }}
            </Button>
          </template>
        </div>
      </Card>
    </div>

    <!-- Receive cash modal -->
    <Modal
      :open="!!receiving"
      :title="receiving ? `${t('Receive cash')} · ${receiving.cashier}` : ''"
      :subtitle="receiving ? `${t('Shift')} #${receiving.id} · ${t('count the drawer and confirm the handover')}` : ''"
      :width="520"
      @close="closeReceive"
    >
      <template v-if="receiving">
        <!-- expected breakdown -->
        <div
          style="background: rgb(var(--v-theme-surface-inset)); border: 1px solid rgb(var(--v-theme-border)); border-radius: var(--r-md); padding: var(--sp-4); margin-bottom: var(--sp-5);"
        >
          <div
            class="row"
            style="justify-content: space-between; padding: 5px 0;"
          >
            <span
              class="row"
              style="gap: 8px; color: rgb(var(--v-theme-text-secondary)); font-size: 13px;"
            >
              <DesignIcon
                name="coins"
                :size="15"
                :style="{ color: 'rgb(var(--v-theme-success))' }"
              />
              {{ t('Cash sales') }}
            </span>
            <span
              class="mono"
              style="font-weight: 600; font-size: 13px;"
            >{{ Fmt.money(receiving.cash) }}</span>
          </div>
          <div
            class="row"
            style="justify-content: space-between; padding: 5px 0;"
          >
            <span
              class="row"
              style="gap: 8px; color: rgb(var(--v-theme-text-secondary)); font-size: 13px;"
            >
              <DesignIcon
                name="receipt"
                :size="15"
                class="tertiary"
              />
              {{ t('Cash expenses paid') }}
            </span>
            <span
              class="mono"
              style="font-weight: 600; font-size: 13px; color: rgb(var(--v-theme-text-secondary));"
            >− {{ Fmt.money(receiving.expenses) }}</span>
          </div>
          <div
            class="hr"
            style="margin: 8px 0;"
          />
          <div
            class="row"
            style="justify-content: space-between;"
          >
            <span style="font-weight: 600; font-size: 14px;">{{ t('Expected in drawer') }}</span>
            <span
              class="mono"
              style="font-weight: 700; font-size: 16px;"
            >
              {{ Fmt.money(receiving.expectedCash ?? 0) }}
              <span
                class="tertiary"
                style="font-size: 12px;"
              >UZS</span>
            </span>
          </div>
        </div>

        <Field
          :label="t('Counted cash (UZS)')"
          :hint="t('Enter the amount you physically counted from the till.')"
        >
          <Input
            v-model="counted"
            inputmode="numeric"
            :placeholder="t('e.g. 1 301 000')"
            icon="wallet"
            autofocus
          />
        </Field>

        <!-- live variance row -->
        <div
          class="row"
          :style="{
            justifyContent: 'space-between',
            marginTop: '14px',
            padding: '12px 14px',
            borderRadius: 'var(--r-md)',
            background: varianceBgStyle.background,
            border: `1px solid ${varianceBgStyle.borderColor}`,
          }"
        >
          <span style="font-weight: 600; font-size: 14px;">{{ t('Variance') }}</span>
          <span
            v-if="liveVariance === null"
            class="tertiary"
          >{{ t('Enter counted amount') }}</span>
          <span
            v-else
            class="row"
            style="gap: 10px;"
          >
            <span
              class="mono"
              :style="{
                fontWeight: 700,
                fontSize: '16px',
                color: liveVariance === 0
                  ? 'rgb(var(--v-theme-on-surface))'
                  : liveVariance > 0
                    ? 'rgb(var(--v-theme-success))'
                    : 'rgb(var(--v-theme-error))',
              }"
            >
              {{ (liveVariance > 0 ? '+' : liveVariance < 0 ? '−' : '') + Fmt.money(Math.abs(liveVariance)) }}
            </span>
            <Badge
              v-if="variancePill"
              :tone="variancePill.tone"
            >
              {{ variancePill.word }}
              <template v-if="liveVariance !== 0">
                {{ ' ' + variancePill.sign + Fmt.num(variancePill.abs) }}
              </template>
            </Badge>
          </span>
        </div>

        <Field
          :label="t('Note (optional)')"
          style="margin-top: 16px;"
        >
          <textarea
            v-model="noteText"
            class="control"
            rows="3"
            :placeholder="t('Reason for any difference, deposits, etc.')"
          />
        </Field>
      </template>

      <template #footer>
        <Button
          variant="ghost"
          :disabled="reconBusy"
          @click="closeReceive"
        >
          {{ t('Cancel') }}
        </Button>
        <Button
          variant="primary"
          icon="check"
          :loading="reconBusy"
          :disabled="parsedCounted === null"
          @click="confirmReceive"
        >
          {{ t('Confirm handover') }}
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
.avatar {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface-inset));
  color: rgb(var(--v-theme-on-surface));
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 14px;
}

/* Responsive toolbar */
@media (max-width: 720px) {
  .shifts-toolbar > div {
    width: 100% !important;
  }
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>
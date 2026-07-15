<script setup lang="ts">
/* ============================================================
   ALPHA POS — Shifts page (v3 single card-grid rewrite)
   Source: .tmp-handoff-v3/.../pages/Shifts.jsx (304 lines)
   Decision #13: drop tabs (History/Templates) + DrawerExpense
   + Performance scorecard. KPI strip + filter toolbar + card grid +
   ReceiveCashModal. Preserves real BE calls:
     GET  /shifts                   filtered and paginated shifts
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
import Pagination from '@/components/design/Pagination.vue'
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
  cashierId: string
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
    return `${m} ${t('time_minute_short')}`
  return `${h} ${t('time_hour_short')} ${m} ${t('time_minute_short')}`
}

function prepLabel(seconds: number | string | null | undefined): string {
  const n = nullableNum(seconds)
  if (n === null)
    return '—'
  const m = Math.floor(n / 60)
  const s = Math.round(n % 60)
  return `${m} ${t('time_minute_short')} ${s} ${t('time_second_short')}`
}

function normalize(s: ShiftRaw): ShiftV3 {
  const name = cashierName(s.user)
  const grossRaw = s.gross_revenue ?? s.total_orders_revenue ?? 0
  return {
    id: s.id,
    raw: s,
    status: s.status || '',
    cashierId: s.user?.id === undefined ? '' : String(s.user.id),
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
const loadError = ref(false)
const totalShifts = ref(0)
const page = ref(1)
const itemsPerPage = ref(24)
const shiftSummary = ref({
  activeCount: 0,
  awaitingCount: 0,
  expectedHandover: 0,
  reconciledCount: 0,
  netVariance: 0,
})
const cashierDirectory = ref<{ value: string, label: string }[]>([])
let shiftsRequestId = 0

// filters (mirror v3)
const cashierFilter = ref<string>('')
const statusFilter = ref<string>('')
const liveOnly = ref(false)
const dateFrom = ref('')
const dateTo = ref('')

// Sorting is performed by the server before pagination.
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
   Load — server-filtered, server-sorted, paginated shift history
   ============================================================ */
async function loadShifts(options: { preserve?: boolean } = {}) {
  const requestId = ++shiftsRequestId
  loading.value = true
  loadError.value = false
  if (!options.preserve) {
    shifts.value = []
    totalShifts.value = 0
    shiftSummary.value = { activeCount: 0, awaitingCount: 0, expectedHandover: 0, reconciledCount: 0, netVariance: 0 }
  }
  try {
    const res = await axios.get('/shifts', {
      params: {
        page: page.value,
        per_page: itemsPerPage.value,
        sort: sortBy.value,
        cashier_id: cashierFilter.value || undefined,
        status: statusFilter.value || undefined,
        date_from: dateFrom.value || undefined,
        date_to: dateTo.value || undefined,
        live_only: liveOnly.value || undefined,
      },
    })
    if (requestId !== shiftsRequestId)
      return false

    const data = res.data?.data ?? res.data ?? {}
    const list: ShiftRaw[] = data?.shifts ?? data?.items ?? (Array.isArray(data) ? data : [])
    const summary = data?.summary ?? {}
    const total = Number(data?.pagination?.total ?? list.length) || 0
    const lastPage = Math.max(1, Math.ceil(total / itemsPerPage.value))
    if (page.value > lastPage) {
      page.value = lastPage
      return false
    }

    shifts.value = list.map(normalize)
    totalShifts.value = total
    shiftSummary.value = {
      activeCount: Number(summary.active_count) || 0,
      awaitingCount: Number(summary.awaiting_count) || 0,
      // New API exposes every tender; retain cash_to_receive only as a safe
      // fallback while old deployments are upgraded.
      expectedHandover: Number(summary.total_expected_to_receive ?? summary.expected_handover ?? summary.cash_to_receive) || 0,
      reconciledCount: Number(summary.reconciled_count) || 0,
      netVariance: Number(summary.net_variance) || 0,
    }
    lastUpdated.value = Date.now()
    now.value = Date.now()
    return true
  }
  catch {
    if (requestId === shiftsRequestId) {
      shifts.value = []
      totalShifts.value = 0
      shiftSummary.value = { activeCount: 0, awaitingCount: 0, expectedHandover: 0, reconciledCount: 0, netVariance: 0 }
      loadError.value = true
      notify(t('Failed to load shifts'), 'error')
    }
    return false
  }
  finally {
    if (requestId === shiftsRequestId)
      loading.value = false
  }
}

async function loadCashierDirectory() {
  try {
    const users: any[] = []
    for (let directoryPage = 1; directoryPage <= 50; directoryPage += 1) {
      const res = await axios.get('/users', { params: { page: directoryPage, per_page: 100 } })
      const data = res.data?.data ?? res.data ?? {}
      const batch: any[] = data?.users ?? data?.items ?? []
      users.push(...batch)

      const pagination = data?.pagination ?? {}
      const total = Number(pagination.total_users ?? pagination.total ?? 0)
      if (batch.length === 0 || pagination.has_next === false || (total > 0 && users.length >= total) || batch.length < 100)
        break
    }

    const seen = new Set<string>()
    cashierDirectory.value = users.flatMap((user) => {
      if (user?.id === undefined || user?.id === null)
        return []
      const value = String(user.id)
      if (seen.has(value))
        return []
      seen.add(value)
      const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.name || user.username || `#${value}`
      return [{ value, label: name }]
    }).sort((a, b) => a.label.localeCompare(b.label))
  }
  catch {
    cashierDirectory.value = []
    notify(t('Failed to load users'), 'error')
  }
}

// Manual / auto refresh — never flashes the skeleton (data already present),
// so the operator can re-check live shifts without losing scroll position.
async function refresh() {
  if (refreshing.value || loading.value)
    return
  refreshing.value = true
  try {
    await loadShifts({ preserve: true })
  }
  finally {
    refreshing.value = false
  }
}

onMounted(() => {
  void loadShifts()
  void loadCashierDirectory()
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

watch([cashierFilter, statusFilter, liveOnly, dateFrom, dateTo, sortBy], () => {
  if (page.value !== 1)
    page.value = 1
  else
    void loadShifts()
})

watch(page, () => {
  void loadShifts()
})

function changePerPage(value: number) {
  if (itemsPerPage.value === value)
    return
  itemsPerPage.value = value
  if (page.value !== 1)
    page.value = 1
  else
    void loadShifts()
}

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
  const options = new Map(cashierDirectory.value.map(option => [option.value, option.label]))
  for (const shift of shifts.value) {
    if (shift.cashierId && shift.cashier !== '—' && !options.has(shift.cashierId))
      options.set(shift.cashierId, shift.cashier)
  }
  return [...options].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
})

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ENDED,ABANDONED', label: 'Awaiting cash' },
  { value: 'COMPLETED', label: 'Reconciled' },
]

const filtered = computed<ShiftV3[]>(() => shifts.value)

const pageCount = computed(() => Math.max(1, Math.ceil(totalShifts.value / itemsPerPage.value)))
const activeCount = computed(() => shiftSummary.value.activeCount)
const awaitingCount = computed(() => shiftSummary.value.awaitingCount)
const expectedHandover = computed(() => shiftSummary.value.expectedHandover)
const reconciledCount = computed(() => shiftSummary.value.reconciledCount)
const netVariance = computed(() => shiftSummary.value.netVariance)

/* ============================================================
   The server sorts before slicing the requested page.
   ============================================================ */
const sorted = computed<ShiftV3[]>(() => filtered.value)

/* ============================================================
   Filter chips
   ============================================================ */
interface Chip { k: string, label: string, val: string, clear: () => void }
const activeChips = computed<Chip[]>(() => {
  const out: Chip[] = []
  if (cashierFilter.value)
    out.push({
      k: 'c',
      label: t('Cashier'),
      val: cashierOptions.value.find(option => option.value === cashierFilter.value)?.label ?? cashierFilter.value,
      clear: () => { cashierFilter.value = '' },
    })
  if (statusFilter.value)
    out.push({
      k: 's',
      label: t('Status'),
      val: t(statusOptions.find(option => option.value === statusFilter.value)?.label ?? statusFilter.value),
      clear: () => { statusFilter.value = '' },
    })
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
   Receive money modal — per-tender blind count
   ============================================================ */
/* Per-tender BLIND count. The manager counts each tender without seeing the
   system figure; expected + difference are revealed only once a value is typed.
   Confirmed amounts post to the SAFE (cash) / BANK (cards + Payme) via the
   backend's deposit_shift, driven by the `confirmed` map on /reconcile. */
const TENDERS = ['CASH', 'HUMO', 'UZCARD', 'PAYME'] as const
type Tender = typeof TENDERS[number]
const CARD_TENDERS: Tender[] = ['HUMO', 'UZCARD', 'PAYME']
const TENDER_LABEL: Record<Tender, string> = { CASH: 'Cash', HUMO: 'Humo', UZCARD: 'Uzcard', PAYME: 'Payme' }

const noteText = ref<string>('')
const reconBusy = ref(false)
const settlementLoading = ref(false)
const expectedByTender = ref<Record<Tender, number>>({ CASH: 0, HUMO: 0, UZCARD: 0, PAYME: 0 })
const countedByTender = ref<Record<Tender, string>>({ CASH: '', HUMO: '', UZCARD: '', PAYME: '' })

function openReceive(s: ShiftV3) {
  receiving.value = s
  noteText.value = ''
  reconBusy.value = false
  countedByTender.value = { CASH: '', HUMO: '', UZCARD: '', PAYME: '' }
  expectedByTender.value = { CASH: 0, HUMO: 0, UZCARD: 0, PAYME: 0 }
  void loadSettlement(s.id)
}
function closeReceive() {
  if (reconBusy.value)
    return
  receiving.value = null
}

// Per-tender expected lives on the shift DETAIL (`settlement[]`); the list row
// only carries the rolled-up cash figure.
//
// CASH is taken from `expected_cash` (Order-level: cash sales − cashbox expenses),
// NOT from settlement.CASH. Reason: settlement is derived from OrderPayment rows,
// and a payment path still exists that never writes them — verified on prod shift
// 47 (cash_collected 8,870,000 vs settlement CASH 6,593,000, expenses 0). Using
// settlement.CASH would understate the drawer and make an honest cashier look
// massively over. Card/Payme OrderPayment rows are complete, so settlement is
// correct for those. Revert CASH to settlement once the backend writes an
// OrderPayment for every cash sale.
async function loadSettlement(id: number | string) {
  settlementLoading.value = true
  try {
    const res = await axios.get(`/shifts/${id}`)
    const data = res.data?.data ?? res.data ?? {}
    const rows: any[] = data?.settlement ?? []
    const next: Record<Tender, number> = { CASH: 0, HUMO: 0, UZCARD: 0, PAYME: 0 }
    for (const r of rows) {
      const m = String(r?.method ?? '').toUpperCase() as Tender
      if ((TENDERS as readonly string[]).includes(m))
        next[m] = Number(r?.expected) || 0
    }
    const orderLevelCash = Number(data?.expected_cash)
    if (Number.isFinite(orderLevelCash))
      next.CASH = orderLevelCash
    expectedByTender.value = next
  }
  catch { /* leave zeros — the blind count still works */ }
  finally {
    settlementLoading.value = false
  }
}

function parseAmount(v: string): number | null {
  if (v === '' || v === null || v === undefined)
    return null
  const cleaned = String(v).replace(/[^\d-]/g, '')
  if (cleaned === '' || cleaned === '-')
    return null
  const n = Number(cleaned)
  return Number.isNaN(n) ? null : n
}
function countedOf(m: Tender): number | null {
  return parseAmount(countedByTender.value[m])
}
function varianceOf(m: Tender): number | null {
  const c = countedOf(m)
  return c === null ? null : c - (expectedByTender.value[m] ?? 0)
}
function toneOf(m: Tender): 'neutral' | 'success' | 'error' {
  const v = varianceOf(m)
  if (v === null || v === 0)
    return 'neutral'
  return v > 0 ? 'success' : 'error'
}
function fmtVariance(m: Tender): string {
  const v = varianceOf(m) ?? 0
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return sign + Fmt.money(Math.abs(v))
}

const anyCounted = computed(() => TENDERS.some(m => countedOf(m) !== null))
const toSafe = computed(() => countedOf('CASH') ?? 0)
const toBank = computed(() => CARD_TENDERS.reduce((a, m) => a + (countedOf(m) ?? 0), 0))
const totalReceived = computed(() => toSafe.value + toBank.value)

async function confirmReceive() {
  if (!receiving.value || !anyCounted.value)
    return
  reconBusy.value = true
  const target = receiving.value
  try {
    const confirmed: Record<string, number> = {}
    for (const m of TENDERS) confirmed[m] = countedOf(m) ?? 0
    await axios.post(`/shifts/${target.id}/reconcile`, {
      actual_cash: confirmed.CASH, // BE still requires cash explicitly (back-compat)
      confirmed, // per-tender → posts cash to SAFE, cards + Payme to BANK
      notes: noteText.value,
    })
    const v = varianceOf('CASH')
    const tail = v === null || v === 0
      ? t('exact match')
      : (v > 0 ? `${t('over by')} ${Fmt.money(Math.abs(v))}` : `${t('short by')} ${Fmt.money(Math.abs(v))}`)
    notify(`${t('Money received from')} ${target.cashier} · ${Fmt.money(totalReceived.value)} UZS · ${tail}`)
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
            label: t('Open shifts'),
            value: activeCount,
            tone: 'info',
            icon: 'clock',
            sub: t('cashiers currently working'),
          }"
        />
        <Kpi
          :data="{
            label: t('Awaiting handover'),
            value: awaitingCount,
            tone: 'warning',
            icon: 'wallet',
            sub: t('manager confirmation needed'),
          }"
        />
        <Kpi
          :data="{
            label: t('Expected handover'),
            value: expectedHandover,
            money: true,
            tone: 'primary',
            icon: 'coins',
            sub: t('cash, card and digital payments'),
          }"
        />
        <Kpi
          :data="{
            label: t('Reconciled shifts'),
            value: reconciledCount,
            tone: 'success',
            icon: 'check',
            sub: t('completed manager handovers'),
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
      >{{ t('Showing') }} {{ sorted.length }} {{ t('of') }} {{ totalShifts }} {{ t('shifts') }}</span>
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

    <!-- error -->
    <Card v-else-if="loadError">
      <StateFill
        icon="alert"
        error
        :title="t('Failed to load shifts')"
        :sub="t('Check your connection and try again.')"
      >
        <div style="margin-top: 12px;">
          <Button
            variant="secondary"
            icon="refresh"
            @click="() => loadShifts()"
          >
            {{ t('Retry') }}
          </Button>
        </div>
      </StateFill>
    </Card>

    <!-- empty -->
    <Card v-else-if="filtered.length === 0">
      <StateFill
        icon="clock"
        :title="activeChips.length ? t('No shifts match your filters') : t('No shifts found')"
        :sub="activeChips.length ? t('Adjust the cashier, status or date range.') : ''"
      >
        <div
          v-if="activeChips.length"
          style="margin-top: 12px;"
        >
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
              {{ t('Receive money') }}
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

    <Pagination
      v-if="totalShifts > itemsPerPage"
      :page="page"
      :per-page="itemsPerPage"
      :pages="pageCount"
      :total="totalShifts"
      :per-page-options="[12, 24, 48, 96]"
      style="margin-top: var(--sp-5);"
      @page="(nextPage: number) => page = nextPage"
      @per-page="changePerPage"
    />

    <!-- Receive money modal (per-tender blind count) -->
    <Modal
      :open="!!receiving"
      :title="receiving ? `${t('Receive money')} · ${receiving.cashier}` : ''"
      :subtitle="receiving ? `${t('Shift')} #${receiving.id} · ${t('count each tender and confirm the handover')}` : ''"
      :width="620"
      @close="closeReceive"
    >
      <template v-if="receiving">
        <!-- Blind count: the system figure stays hidden per tender until counted -->
        <p
          class="tertiary"
          style="font-size: 13px; margin: 0 0 14px;"
        >
          {{ t('Count each tender first. The system figure and the difference appear only after you enter an amount.') }}
        </p>

        <div class="rm-grid">
          <div class="rm-head">
            <span>{{ t('Payment type') }}</span>
            <span>{{ t('Counted') }}</span>
            <span class="rm-right">{{ t('System expected') }}</span>
            <span class="rm-right">{{ t('Difference') }}</span>
          </div>

          <div
            v-for="m in TENDERS"
            :key="m"
            class="rm-row"
          >
            <span class="rm-tender">
              <DesignIcon
                :name="m === 'CASH' ? 'coins' : 'wallet'"
                :size="15"
                :style="{ color: m === 'CASH' ? 'rgb(var(--v-theme-success))' : 'rgb(var(--v-theme-primary))' }"
              />
              {{ m === 'CASH' ? t('Cash') : TENDER_LABEL[m] }}
            </span>

            <Input
              v-model="countedByTender[m]"
              inputmode="numeric"
              :placeholder="t('Count…')"
            />

            <span class="mono rm-right rm-dim">
              <template v-if="countedOf(m) !== null">{{ Fmt.money(expectedByTender[m]) }}</template>
              <span
                v-else
                class="tertiary"
              >—</span>
            </span>

            <span class="rm-right">
              <Badge
                v-if="varianceOf(m) !== null"
                :tone="toneOf(m)"
              >{{ fmtVariance(m) }}</Badge>
              <span
                v-else
                class="tertiary"
              >—</span>
            </span>
          </div>
        </div>

        <!-- where the money lands -->
        <div class="rm-totals">
          <div
            class="row"
            style="justify-content: space-between; padding: 4px 0;"
          >
            <span
              class="row"
              style="gap: 8px; font-size: 13px; color: rgb(var(--v-theme-text-secondary));"
            >
              <DesignIcon
                name="lock"
                :size="15"
                :style="{ color: 'rgb(var(--v-theme-success))' }"
              />
              {{ t('To Safe (cash)') }}
            </span>
            <span
              class="mono"
              style="font-weight: 600; font-size: 13px;"
            >{{ Fmt.money(toSafe) }}</span>
          </div>
          <div
            class="row"
            style="justify-content: space-between; padding: 4px 0;"
          >
            <span
              class="row"
              style="gap: 8px; font-size: 13px; color: rgb(var(--v-theme-text-secondary));"
            >
              <DesignIcon
                name="building"
                :size="15"
                :style="{ color: 'rgb(var(--v-theme-primary))' }"
              />
              {{ t('To Bank (cards + Payme)') }}
            </span>
            <span
              class="mono"
              style="font-weight: 600; font-size: 13px;"
            >{{ Fmt.money(toBank) }}</span>
          </div>
          <div
            class="hr"
            style="margin: 8px 0;"
          />
          <div
            class="row"
            style="justify-content: space-between;"
          >
            <span style="font-weight: 600; font-size: 14px;">{{ t('Total received') }}</span>
            <span
              class="mono"
              style="font-weight: 700; font-size: 16px;"
            >
              {{ Fmt.money(totalReceived) }}
              <span
                class="tertiary"
                style="font-size: 12px;"
              >UZS</span>
            </span>
          </div>
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
          :disabled="!anyCounted"
          @click="confirmReceive"
        >
          {{ t('Confirm & deposit') }}
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

/* Receive-money modal — per-tender blind-count grid */
.rm-grid {
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-md);
  overflow: hidden;
}
.rm-head,
.rm-row {
  display: grid;
  grid-template-columns: 1.05fr 1.15fr 1fr 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
}
.rm-head {
  background: rgb(var(--v-theme-surface-inset));
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
  color: rgb(var(--v-theme-text-secondary));
}
.rm-row {
  border-top: 1px solid rgb(var(--v-theme-border));
}
.rm-tender {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  font-size: 13px;
}
.rm-right {
  text-align: right;
  justify-self: end;
}
.rm-dim {
  color: rgb(var(--v-theme-text-secondary));
  font-size: 13px;
}
.rm-totals {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  background: rgb(var(--v-theme-surface-inset));
  border: 1px solid rgb(var(--v-theme-border));
}
@media (max-width: 560px) {
  .rm-head { display: none; }
  .rm-row { grid-template-columns: 1fr 1fr; row-gap: 8px; }
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

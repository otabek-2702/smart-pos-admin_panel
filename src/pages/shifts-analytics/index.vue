<script setup lang="ts">
/* ============================================================
   SHIFTS — daily cash handover / reconciliation
   Ported 1:1 from .tmp-design-bundle/project/pages/Shifts.jsx
   ============================================================ */
import axios from '@/plugins/axios'
import { buildCsv } from '@/utils/csv'
import DateRangePicker, { type DateRangeValue } from '@/components/design/DateRangePicker.vue'
import Select from '@/components/design/Select.vue'
import { formatWindow } from '@/composables/useWindowLabel'

const { t } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

// ============================================================
// Number / date formatters (mirror bundle's Fmt helpers)
// ============================================================
const NB = ' '
function num(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const neg = Number(n) < 0
  const s = Math.round(Math.abs(Number(n))).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB)
  return (neg ? '−' : '') + s
}
function fmtMoney(n: number | null | undefined): string {
  return fmtNum(n)
}
function fmtAbbr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  const a = Math.abs(v)
  const trim2 = (x: number) => x.toFixed(2).replace(/\.?0+$/, '')
  const trim1 = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  let out: string
  if (a >= 1e9) out = `${trim2(a / 1e9)}B`
  else if (a >= 1e6) out = `${trim2(a / 1e6)}M`
  else if (a >= 1e3) out = `${trim1(a / 1e3)}K`
  else out = String(Math.round(a))
  return (v < 0 ? '−' : '') + out
}
function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  const p = (v: number) => v < 10 ? `0${v}` : `${v}`
  return `${p(x.getDate())}.${p(x.getMonth() + 1)} ${p(x.getHours())}:${p(x.getMinutes())}`
}
function fmtDuration(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(Number(min))) return '—'
  const total = Math.max(0, Math.floor(Number(min)))
  const h = Math.floor(total / 60)
  const m = total % 60
  return h
    ? `${h} ${t('time_hour_short')} ${String(m).padStart(2, '0')} ${t('time_minute_short')}`
    : `${m} ${t('time_minute_short')}`
}
function fmtPrep(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—'
  const n = Number(sec)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 60) return `${Math.round(n)} ${t('time_second_short')}`
  return `${Math.floor(n / 60)} ${t('time_minute_short')} ${String(Math.round(n % 60)).padStart(2, '0')} ${t('time_second_short')}`
}
function fmtPeak(p: any): string {
  if (!p || p.hour === undefined || p.hour === null) return '—'
  const h = String(p.hour).padStart(2, '0')
  return p.orders !== undefined ? `${h}:00 (${p.orders})` : `${h}:00`
}
function initialsOf(first?: string, last?: string, email?: string, name?: string): string {
  // BE list serializer returns user as { id, uuid, name } only (no first_name/last_name/email).
  // Prefer the combined `name` field; fall back to first/last/email for other endpoints (e.g. /users).
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) return ((f[0] || '') + (l[0] || '')).toUpperCase() || '?'
  const combined = (name || '').trim()
  if (combined) {
    const parts = combined.split(/\s+/)
    const a = parts[0]?.[0] || ''
    const b = parts[1]?.[0] || ''
    return (a + b).toUpperCase() || '?'
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}
function fullName(u: any): string {
  if (!u) return t('Unknown')
  // BE shift serializer returns { id, uuid, name }. Other endpoints (e.g. /users) return first/last/email.
  if (u.name) return String(u.name).trim() || `#${u.id}`
  const n = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return n || u.email || `#${u.id}`
}

// ============================================================
// Filters
// ============================================================
const dateRange = ref<DateRangeValue>({ from: '', to: '', preset: 'all' })
const cashierId = ref<number | ''>('')
// status uses BE Shift.Status enum directly: ACTIVE | ENDED | COMPLETED | ABANDONED
const statusF = ref<'' | 'ACTIVE' | 'ENDED' | 'COMPLETED' | 'ABANDONED'>('')
const liveOnly = ref(false)

const cashiers = ref<any[]>([])

async function loadCashiers() {
  try {
    // The role control was removed from this toolbar. Fetch all staff once so
    // the cashier filter can still find every shift owner.
    const res = await axios.get('/users', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data
    cashiers.value = d?.users ?? []
  }
  catch {
    cashiers.value = []
  }
}

// ============================================================
// Shifts data
// ============================================================
const shifts = ref<any[]>([])
const loading = ref(true)

async function loadShifts() {
  loading.value = true
  try {
    const params: any = { page: 1, per_page: 100 }
    if (dateRange.value.from) params.date_from = dateRange.value.from
    if (dateRange.value.to) params.date_to = dateRange.value.to
    if (cashierId.value) params.user_id = cashierId.value
    if (statusF.value) params.status = statusF.value
    if (liveOnly.value) params.live_only = true

    const res = await axios.get('/shifts', { params })
    const d = res.data?.data ?? res.data
    shifts.value = Array.isArray(d) ? d : (d?.shifts ?? d?.items ?? [])
  }
  catch (e: any) {
    notify(e?.response?.data?.message ?? t('Failed to load shifts'), 'error')
    shifts.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(() => { loadCashiers(); loadShifts() })
watch([dateRange, cashierId, statusF, liveOnly], () => { loadShifts() })

// ============================================================
// Shape & derived helpers
// ============================================================
function shiftState(s: any): 'active' | 'awaiting' | 'reconciled' {
  if (s.status === 'ACTIVE') return 'active'
  // BE reconciliation shape: { id, expected_cash, actual_cash, difference, notes, reconciled_by, created_at }.
  // Old keys (counted_cash, reported) kept as soft fallback for any cached/older response.
  if (s.reconciliation && (s.reconciliation.id || s.reconciliation.actual_cash !== undefined || s.reconciliation.counted_cash !== undefined || s.reconciliation.reported !== undefined)) return 'reconciled'
  return 'awaiting'
}
function expectedCash(s: any): number {
  // BE reconciliation carries the authoritative expected_cash (cash_collected - expenses). The list
  // serializer (_serialize_shift) omits expenses_total entirely — it only appears on dashboard/cashbox
  // views. Without a reconciliation row we cannot subtract expenses, so fall back to cash_collected.
  if (s.reconciliation?.expected_cash !== undefined && s.reconciliation?.expected_cash !== null)
    return num(s.reconciliation.expected_cash)
  return num(s.cash_collected)
}
function expectedSettlement(s: any): number {
  const rows = Array.isArray(s?.settlement) ? s.settlement : []
  if (rows.length) {
    return rows.reduce(
      (total: number, row: any) => total + num(row?.expected),
      0,
    )
  }
  // List rows deliberately omit settlement details to avoid N+1 queries. The
  // gross paid total is the only all-tender figure available until the manager
  // opens the settlement modal, which fetches the authoritative breakdown.
  return num(s.total_revenue)
}
function confirmedSettlement(s: any): number | null {
  const rows = Array.isArray(s?.settlement) ? s.settlement : []
  if (!rows.length) return null
  return rows.reduce(
    (total: number, row: any) => total + num(row?.confirmed),
    0,
  )
}
function reportedCash(s: any): number {
  const r = s.reconciliation || {}
  // BE returns `actual_cash`. Old fallback keys retained for safety.
  return num(r.actual_cash ?? r.counted_cash ?? r.reported ?? r.amount)
}
function reportedBy(s: any): string {
  const r = s.reconciliation || {}
  // BE returns `reconciled_by: { id, name }`. Keep legacy fallbacks for older data shapes.
  const u = r.reconciled_by || r.reported_by_user || r.reported_by || r.user
  if (typeof u === 'string') return u
  return u ? fullName(u) : t('Manager')
}
function varianceOf(s: any): number {
  const r = s.reconciliation || {}
  // BE returns `difference` (actual - expected); old client code used `variance`. Use either.
  if (r.difference !== undefined && r.difference !== null) return num(r.difference)
  if (r.variance !== undefined && r.variance !== null) return num(r.variance)
  const counted = r.actual_cash ?? r.counted_cash
  if (counted !== undefined) return num(counted) - expectedCash(s)
  return 0
}
// Returns [{ method, amount }] sorted desc, excluding zero entries.
// Used to surface per-tender breakdown (CASH/UZCARD/HUMO/PAYME/MIXED) in the card.
// NOTE: payment_mix is only present on detail responses (_serialize_shift detail=True via _shift_stats).
// The /shifts list endpoint does NOT include it, so this expander only renders when a detail payload is loaded.
function paymentMixRows(s: any): { method: string, amount: number }[] {
  const mix = s.payment_mix || {}
  const out: { method: string, amount: number }[] = []
  for (const k of Object.keys(mix)) {
    const amt = num((mix as any)[k]?.amount)
    if (amt > 0) out.push({ method: k, amount: amt })
  }
  out.sort((a, b) => b.amount - a.amount)
  return out
}

// Per-card UI state for the "show per-method breakdown" expander.
const expandedMix = ref<Record<number, boolean>>({})
function toggleMix(id: number) {
  expandedMix.value = { ...expandedMix.value, [id]: !expandedMix.value[id] }
}

function cardPayments(s: any): number {
  // payment_mix is detail-only (omitted from /shifts list serializer); the fallback
  // total_revenue - cash_collected is what actually runs in list view.
  const mix = s.payment_mix || {}
  let total = 0
  for (const k of Object.keys(mix)) {
    if (k === 'CASH') continue
    total += num((mix as any)[k]?.amount)
  }
  if (total > 0) return total
  return Math.max(0, num(s.total_revenue) - num(s.cash_collected))
}
function avgTicket(s: any): number {
  // total_revenue arrives as a string from BE (str(...) coerce). Wrap both in num() for safety.
  const o = num(s.total_orders)
  return o > 0 ? num(s.total_revenue) / o : 0
}
function netOf(s: any): number {
  // BE /shifts list serializer omits net_revenue, expenses_total and cancelled_orders_value entirely.
  // Use net_revenue when present (detail payloads); otherwise fall back to gross total_revenue
  // since we have no expense/cancelled data to subtract on the list endpoint.
  if (s.net_revenue !== undefined && s.net_revenue !== null) return num(s.net_revenue)
  return num(s.total_revenue)
}

// ============================================================
// Filtering
// ============================================================
const filtered = computed(() => {
  return shifts.value.filter((s) => {
    if (cashierId.value && s.user?.id !== cashierId.value) return false
    // liveOnly is a UI shortcut for status === ACTIVE
    if (liveOnly.value && s.status !== 'ACTIVE') return false
    // status filter is delegated to BE; no client-side narrowing here.
    return true
  })
})

// ============================================================
// Summary KPIs
// ============================================================
const summary = computed(() => {
  let active = 0
  let awaiting = 0
  let settlementToReceive = 0
  let netVariance = 0
  for (const s of shifts.value) {
    const st = shiftState(s)
    if (st === 'active') active++
    else if (st === 'awaiting') { awaiting++; settlementToReceive += expectedSettlement(s) }
    else if (st === 'reconciled') netVariance += varianceOf(s)
  }
  return { active, awaiting, settlementToReceive, netVariance }
})

// ============================================================
// Active filter chips
// ============================================================
const activeFilters = computed(() => {
  const arr: { k: string, label: string, val: string, clear: () => void }[] = []
  if (cashierId.value) {
    const u = cashiers.value.find((c: any) => c.id === cashierId.value)
    arr.push({ k: 'c', label: t('Cashier'), val: u ? fullName(u) : `#${cashierId.value}`, clear: () => (cashierId.value = '') })
  }
  if (statusF.value) arr.push({ k: 's', label: t('Status'), val: t(`shift_status_${statusF.value}`), clear: () => (statusF.value = '') })
  if (liveOnly.value) arr.push({ k: 'l', label: t('Live only'), val: t('On'), clear: () => (liveOnly.value = false) })
  if (dateRange.value.from || dateRange.value.to) {
    arr.push({
      k: 'd',
      label: t('Period'),
      val: formatWindow(dateRange.value, t),
      clear: () => { dateRange.value = { from: '', to: '', preset: 'all' } },
    })
  }
  return arr
})
function clearAllFilters() {
  cashierId.value = ''
  statusF.value = ''
  liveOnly.value = false
  dateRange.value = { from: '', to: '', preset: 'all' }
}

// ============================================================
// Receive-money modal — per-tender settlement
// ============================================================
const receiving = ref<any | null>(null)
const note = ref('')
const busy = ref(false)

type Tender = string
const STANDARD_TENDERS = ['CASH', 'HUMO', 'UZCARD', 'CARD', 'PAYME'] as const
const TENDER_LABEL: Record<string, string> = {
  CASH: 'Cash',
  HUMO: 'Humo',
  UZCARD: 'Uzcard',
  CARD: 'Card',
  PAYME: 'Payme',
}

function emptyTenderAmounts(): Record<Tender, number> {
  return Object.fromEntries(STANDARD_TENDERS.map(method => [method, 0]))
}
function emptyTenderCounts(): Record<Tender, string> {
  return Object.fromEntries(STANDARD_TENDERS.map(method => [method, '']))
}

const settlementLoading = ref(false)
const settlementReady = ref(false)
const settlementError = ref(false)
const settlementMethods = ref<Tender[]>([])
const expectedByTender = ref<Record<Tender, number>>(emptyTenderAmounts())
const countedByTender = ref<Record<Tender, string>>(emptyTenderCounts())
let settlementRequestId = 0

// Do not render empty/unrelated payment inputs. A manager can only confirm
// methods that the backend created for this exact shift (plus the cash audit).
const visibleTenders = computed<Tender[]>(() => [
  ...new Set(['CASH', ...settlementMethods.value]),
])
const requiredTenders = computed(() => visibleTenders.value.filter(method => (expectedByTender.value[method] ?? 0) > 0))

function tenderLabel(method: Tender): string {
  return TENDER_LABEL[method] ? t(TENDER_LABEL[method]) : method
}
function parseAmount(v: string | undefined): number | null {
  if (v === '' || v === null || v === undefined) return null
  const stripped = String(v).replace(/[^\d-]/g, '')
  if (stripped === '' || stripped === '-') return null
  const n = Number(stripped)
  return Number.isFinite(n) ? n : null
}
function countedOf(method: Tender): number | null {
  return parseAmount(countedByTender.value[method])
}
function tenderVariance(method: Tender): number | null {
  const counted = countedOf(method)
  return counted === null ? null : counted - (expectedByTender.value[method] ?? 0)
}
const allExpectedTendersCounted = computed(() => requiredTenders.value.every(method => countedOf(method) !== null))
const canConfirmSettlement = computed(() => settlementReady.value && !settlementLoading.value && allExpectedTendersCounted.value)
const totalReceived = computed(() => visibleTenders.value.reduce(
  (total, method) => total + (countedOf(method) ?? 0),
  0,
))

async function loadSettlement(id: number | string) {
  const requestId = ++settlementRequestId
  settlementLoading.value = true
  settlementReady.value = false
  settlementError.value = false
  try {
    const res = await axios.get(`/shifts/${id}`)
    if (requestId !== settlementRequestId) return
    const data = res.data?.data ?? res.data ?? {}
    const rows: any[] = Array.isArray(data?.settlement) ? data.settlement : []
    const next = emptyTenderAmounts()
    const methods: Tender[] = []
    for (const row of rows) {
      const method = String(row?.method ?? '').trim().toUpperCase()
      if (!method) continue
      methods.push(method)
      next[method] = num(row?.expected)
    }
    const orderLevelCash = Number(data?.expected_cash)
    if (Number.isFinite(orderLevelCash)) {
      next.CASH = orderLevelCash
      methods.push('CASH')
    }
    expectedByTender.value = next
    settlementMethods.value = [...new Set(methods)]
    countedByTender.value = Object.fromEntries(
      [...new Set([...STANDARD_TENDERS, ...methods])].map(method => [method, '']),
    )
    settlementReady.value = true
  }
  catch {
    if (requestId === settlementRequestId)
      settlementError.value = true
  }
  finally {
    if (requestId === settlementRequestId)
      settlementLoading.value = false
  }
}

function openReceive(s: any) {
  receiving.value = s
  note.value = ''
  busy.value = false
  settlementReady.value = false
  settlementError.value = false
  settlementMethods.value = []
  expectedByTender.value = emptyTenderAmounts()
  countedByTender.value = emptyTenderCounts()
  void loadSettlement(s.id)
}
function closeReceive() {
  if (busy.value) return
  settlementRequestId++
  receiving.value = null
}

const router = useRouter()
function openReport(s: any) {
  router.push({ path: '/analytics/shift-handover', query: { shift: String(s.id) } })
}

// ------------------------------------------------------------
// End shift confirmation (destructive)
// ------------------------------------------------------------
const endingShift = ref<any | null>(null)
function askEndShift(s: any) {
  endingShift.value = s
}
function cancelEndShift() {
  endingShift.value = null
}
async function confirmEndShift() {
  const s = endingShift.value
  if (!s || busy.value) return
  busy.value = true
  try {
    // POST /shifts/<id>/end — actually closes the shift (previously this button
    // only navigated to the report and never ended anything). BE guards: the
    // shift must be ACTIVE and have no open/preparing/ready orders; a manager
    // may close any cashier's till. The blind cash count is taken later at
    // reconcile, so `counted` is omitted here and `notes` is optional.
    await axios.post(`/shifts/${s.id}/end`, { notes: '' })
    notify(`${t('Shift ended')} · ${fullName(s.user)}`, 'success')
    endingShift.value = null
    // Refresh so the card flips ACTIVE → awaiting-cash and the manager can
    // reconcile the drawer from it.
    await loadShifts()
  }
  catch (e: any) {
    const status = e?.response?.status
    const beMsg = e?.response?.data?.message || ''
    if (status === 404)
      notify(t('Shift not found'), 'error')
    else
      // Surfaces BE guard messages verbatim, e.g. "Cannot close shift while N
      // order(s) are still open." so the manager knows what to fix.
      notify(beMsg || e?.message || t('Failed to end shift'), 'error')
  }
  finally {
    busy.value = false
  }
}

// ------------------------------------------------------------
// Export (CSV) — current filtered set
// ------------------------------------------------------------
function exportShifts() {
  const rows = filtered.value
  if (!rows.length) {
    notify(t('Nothing to export'), 'warning')
    return
  }

  const header = ['id', 'cashier', 'start', 'end', 'orders', 'gross', 'net', 'cash_collected', 'expenses', 'state']

  const csv = buildCsv([
    header,
    ...rows.map(s => [
      s.id,
      fullName(s.user),
      s.start_time || '',
      s.end_time || '',
      num(s.total_orders),
      num(s.total_revenue),
      netOf(s),
      num(s.cash_collected),
      num(s.expenses_total),
      shiftState(s),
    ]),
  ])

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = `shifts-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function confirmReceive() {
  if (!receiving.value || !canConfirmSettlement.value) return
  busy.value = true
  const s = receiving.value
  try {
    const confirmed: Record<string, number> = {}
    const methodsToConfirm = new Set<Tender>(settlementMethods.value)
    methodsToConfirm.add('CASH')
    for (const method of methodsToConfirm)
      confirmed[method] = countedOf(method) ?? 0

    const res = await axios.post(`/shifts/${s.id}/reconcile`, {
      // The backend still requires this cash audit field alongside the
      // full per-tender confirmation map.
      actual_cash: confirmed.CASH,
      confirmed,
      notes: note.value || undefined,
    })
    const result = res.data?.data ?? res.data ?? {}
    const cashVariance = tenderVariance('CASH')
    const tail = cashVariance === null || cashVariance === 0
      ? t('exact match')
      : cashVariance > 0
        ? `${t('over by')} ${fmtMoney(Math.abs(cashVariance))}`
        : `${t('short by')} ${fmtMoney(Math.abs(cashVariance))}`
    const postedToSafe = result?.treasury_posting?.status === 'posted'
    const outcome = postedToSafe ? t('Added to Safe') : t('Settlement confirmed')
    notify(`${outcome} · ${fullName(s.user)} · ${fmtMoney(totalReceived.value)} UZS · ${tail}`, postedToSafe ? 'success' : 'info')
    receiving.value = null
    await loadShifts()
  }
  catch (e: any) {
    const status = e?.response?.status
    const beMsg = e?.response?.data?.message || ''
    if (status === 400 && /ended/i.test(beMsg) && s.status !== 'ENDED') {
      notify(t('Shift must be ended before reconciling'), 'error')
    }
    else {
      const msg = beMsg || e?.message || t('Failed to record settlement')
      notify(msg, 'error')
    }
  }
  finally {
    busy.value = false
  }
}

// ============================================================
// Status options for the filter select — use BE Shift.Status enum values directly.
// A separate "Awaiting cash" UX state is derived (status === ENDED) and surfaced
// via translation key shift_status_AWAITING_CASH in the badge logic below.
// ============================================================
const statusOptions: { value: '' | 'ACTIVE' | 'ENDED' | 'COMPLETED' | 'ABANDONED' }[] = [
  { value: 'ACTIVE' },
  { value: 'ENDED' },
  { value: 'COMPLETED' },
  { value: 'ABANDONED' },
]
const cashierSelectOptions = computed(() => cashiers.value.map(c => ({ value: String(c.id), label: fullName(c) })))
const statusSelectOptions = computed(() => statusOptions.filter(o => o.value).map(o => ({ value: o.value, label: t(`shift_status_${o.value}`) })))

// ============================================================
// Modal ergonomics: ESC to close + focus trap.
// Applies to both the receive-cash modal and the end-shift confirm modal.
// ============================================================
const receiveModalEl = ref<HTMLElement | null>(null)
const endModalEl = ref<HTMLElement | null>(null)

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter(el => !el.hasAttribute('aria-hidden'))
}
function trapTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== 'Tab' || !root) return
  const list = focusableIn(root)
  if (list.length === 0) return
  const first = list[0]
  const last = list[list.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey) {
    if (active === first || !root.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  }
  else {
    if (active === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

function onReceiveKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && !busy.value) {
    e.preventDefault()
    closeReceive()
  }
  else if (e.key === 'Tab') {
    trapTab(e, receiveModalEl.value)
  }
}
function onEndKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelEndShift()
  }
  else if (e.key === 'Tab') {
    trapTab(e, endModalEl.value)
  }
}

watch(receiving, async (val) => {
  if (val) {
    document.addEventListener('keydown', onReceiveKey)
    await nextTick()
    const list = focusableIn(receiveModalEl.value)
    list[0]?.focus()
  }
  else {
    document.removeEventListener('keydown', onReceiveKey)
  }
})
watch(settlementReady, async ready => {
  if (!ready || !receiving.value) return
  await nextTick()
  receiveModalEl.value?.querySelector<HTMLInputElement>('.settlement-input')?.focus()
})
watch(endingShift, async (val) => {
  if (val) {
    document.addEventListener('keydown', onEndKey)
    await nextTick()
    const list = focusableIn(endModalEl.value)
    list[0]?.focus()
  }
  else {
    document.removeEventListener('keydown', onEndKey)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onReceiveKey)
  document.removeEventListener('keydown', onEndKey)
})

// Guard for click-overlay-to-close so we don't dismiss the modal when the user
// click-drags from inside the dialog and releases outside. Only close when both
// mousedown and mouseup happened on the overlay itself.
const overlayMouseDownTarget = ref<EventTarget | null>(null)
function onOverlayMouseDown(e: MouseEvent) {
  overlayMouseDownTarget.value = e.target
}
function onOverlayMouseUp(e: MouseEvent, closeFn: () => void) {
  if (overlayMouseDownTarget.value === e.currentTarget && e.target === e.currentTarget && !busy.value)
    closeFn()
  overlayMouseDownTarget.value = null
}

// ============================================================
// Count-up motion on the 4 summary KPI numbers.
// See src/composables/useDesignMotion.ts and .tmp-design-bundle/app/anim.jsx.
// ============================================================
const activeCounted = useCountUp(() => Number(summary.value.active ?? 0))
const awaitingCounted = useCountUp(() => Number(summary.value.awaiting ?? 0))
const settlementCounted = useCountUp(() => Number(summary.value.settlementToReceive ?? 0))
const varCounted = useCountUp(() => Math.abs(Number(summary.value.netVariance ?? 0)))
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <div class="page__head">
      <div>
        <h1 class="page__title">
          {{ t('Shifts') }}
        </h1>
        <div class="page__subtitle">
          {{ t('Reconcile cashiers and receive end-of-shift settlements') }}
        </div>
      </div>
      <div class="page__head-actions">
        <button class="btn btn--secondary" :disabled="loading" @click="loadShifts">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 11-3-6.7" /><polyline points="21 4 21 11 14 11" />
          </svg>
          {{ t('Refresh') }}
        </button>
        <button class="btn btn--secondary" @click="exportShifts">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {{ t('Export') }}
        </button>
      </div>
    </div>

    <!-- Summary KPI strip -->
    <div class="grid cols-4 shifts-kpi-strip" style="margin-bottom: var(--sp-5);">
      <!-- Active now -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-info">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Active now') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:60px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtNum(Math.round(activeCounted)) }}
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('live shifts') }}</span>
        </div>
      </div>

      <!-- Awaiting settlement -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-warning">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /><path d="M3 7l3-4h12l3 4" /><path d="M16 13a4 4 0 01-8 0" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Awaiting settlement') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:60px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtNum(Math.round(awaitingCounted)) }}
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('to reconcile') }}</span>
        </div>
      </div>

      <!-- All-tender settlement to receive -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="6" rx="9" ry="3" /><path d="M3 6v6c0 1.7 4 3 9 3s9-1.3 9-3V6" /><path d="M3 12v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Settlement to receive') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:140px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(settlementCounted) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('All payment types') }} · {{ t('across {n} shifts', { n: summary.awaiting }) }}</span>
        </div>
      </div>

      <!-- Net variance -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon" :class="summary.netVariance < 0 ? 't-error' : 't-success'">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Net variance') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:110px;height:30px;" />
        <div v-else class="kpi__value" :style="{ color: summary.netVariance < 0 ? 'var(--error)' : summary.netVariance > 0 ? 'var(--success)' : 'var(--text)' }">
          {{ summary.netVariance > 0 ? '+' : summary.netVariance < 0 ? '−' : '' }}{{ fmtAbbr(varCounted) }}
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('in current results') }}</span>
        </div>
      </div>
    </div>

    <!-- Filter toolbar -->
    <div class="card" style="margin-bottom: var(--sp-5);">
      <div class="toolbar">
        <!-- Cashier select -->
        <div class="shift-filter shift-filter--cashier">
          <Select
            :model-value="cashierId === '' ? '' : String(cashierId)"
            icon="user"
            :placeholder="t('All cashiers')"
            :options="cashierSelectOptions"
            @update:model-value="cashierId = $event ? Number($event) : ''"
          />
        </div>

        <!-- Status select -->
        <div class="shift-filter shift-filter--status">
          <Select
            v-model="statusF"
            icon="filter"
            :placeholder="t('All statuses')"
            :options="statusSelectOptions"
          />
        </div>

        <!-- The shift API accepts business dates, not arbitrary timestamps. -->
        <DateRangePicker
          class="shift-filter--date"
          v-model="dateRange"
          :enable-time="false"
          :placeholder="t('All time')"
        />

        <!-- Live only switch -->
        <div class="row live-only-wrap" style="gap:10px;">
          <span
            class="row"
            style="gap:8px;font-size:14px;font-weight:500;cursor:pointer;"
            @click="liveOnly = !liveOnly"
          >
            <span
              class="switch"
              :class="{ 'is-on': liveOnly }"
              role="switch"
              :aria-checked="liveOnly"
            />
            {{ t('Live only') }}
          </span>
        </div>
      </div>

      <!-- Active filter chips -->
      <div v-if="activeFilters.length > 0" class="toolbar" style="padding-top:0;">
        <div class="chips">
          <span class="tertiary" style="font-size:13px;margin-right:2px;">{{ t('Filters') }}:</span>
          <span v-for="f in activeFilters" :key="f.k" class="chip">
            <span>{{ f.label }}: <b>{{ f.val }}</b></span>
            <span class="chip__x" @click="f.clear()">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </span>
          </span>
          <button class="chip--clear" @click="clearAllFilters">
            {{ t('Clear all') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Cards grid -->
    <div v-if="loading" class="grid shift-cards-grid">
      <div v-for="i in 3" :key="i" class="card" style="padding: var(--sp-5);">
        <div class="row" style="gap:12px;margin-bottom:16px;">
          <div class="skel" style="width:40px;height:40px;border-radius:99px;" />
          <div style="flex:1;">
            <div class="skel" style="width:120px;height:14px;" />
            <div class="skel" style="width:80px;height:11px;margin-top:6px;" />
          </div>
          <div class="skel" style="width:90px;height:22px;border-radius:6px;" />
        </div>
        <div class="skel" style="height:38px;margin-bottom:16px;" />
        <div class="skel" style="height:56px;margin-bottom:16px;" />
        <div class="skel" style="height:70px;margin-bottom:16px;" />
        <div class="skel" style="height:40px;" />
      </div>
    </div>

    <div v-else-if="filtered.length === 0" class="card">
      <div class="statefill">
        <div class="statefill__icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
          </svg>
        </div>
        <div class="statefill__title">
          {{ t('No shifts match your filters') }}
        </div>
        <div class="statefill__sub">
          {{ t('Adjust the cashier, status or date range.') }}
        </div>
        <div v-if="shifts.length > 0" class="statefill__sub" style="margin-top:6px;font-size:12px;">
          {{ t('Note: status and live-only filters only narrow the first {n} shifts loaded.', { n: shifts.length }) }}
        </div>
        <div style="margin-top:12px;">
          <button class="btn btn--secondary" @click="clearAllFilters">
            {{ t('Clear filters') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="grid shift-cards-grid" style="align-items:start;">
      <div
        v-for="s in filtered"
        :key="s.id"
        class="card"
        :style="{ display: 'flex', flexDirection: 'column', borderColor: shiftState(s) === 'awaiting' ? 'var(--warning-border)' : 'var(--border)', borderLeft: shiftState(s) === 'awaiting' ? '3px solid var(--warning)' : '' }"
      >
        <!-- header: avatar + name + status pill -->
        <div class="row" style="gap:12px;padding: var(--sp-5) var(--sp-5) var(--sp-4);">
          <div class="avatar">
            <!-- BE shift.user = { id, uuid, name } only; pass the combined name plus a `#<id>` fallback -->
            {{ initialsOf(undefined, undefined, undefined, s.user?.name || (s.user?.id ? `#${s.user.id}` : undefined)) }}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;">
              {{ fullName(s.user) }}
            </div>
            <div class="tertiary" style="font-size:12px;">
              {{ t('Shift') }} #{{ s.id }} · {{ s.shift_template?.name || '—' }}
            </div>
          </div>
          <!-- status badge: keep the BE Shift.Status as truth, plus the derived AWAITING_CASH UX state -->
          <span v-if="shiftState(s) === 'active'" class="badge badge--dot t-success">{{ t(`shift_status_${s.status}`) }}</span>
          <span v-else-if="shiftState(s) === 'awaiting'" class="badge badge--dot t-warning">{{ t('shift_status_AWAITING_CASH') }}</span>
          <span v-else class="badge t-neutral">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="9 12 11 14 15 10" /></svg>
            {{ t(`shift_status_${s.status}`) }}
          </span>
        </div>

        <!-- time strip -->
        <div class="row between" style="margin:0 var(--sp-5);padding: 9px 12px;background: var(--surface-inset);border-radius: var(--r-sm);font-size:13px;">
          <span class="row" style="gap:7px;">
            <span class="mono">{{ fmtDateTime(s.start_time) }}</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tertiary"><polyline points="9 6 15 12 9 18" /></svg>
            <span class="mono" :style="{ color: s.end_time ? 'var(--text)' : 'var(--success)', fontWeight: s.end_time ? 400 : 600 }">
              {{ s.end_time ? fmtDateTime(s.end_time) : t('running') }}
            </span>
          </span>
          <span class="badge t-neutral">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
            {{ fmtDuration(s.duration_minutes) }}
          </span>
        </div>

        <!-- KPI strip: orders / gross / net -->
        <div class="row" style="flex-wrap:wrap; gap:12px; padding: var(--sp-4) var(--sp-5) var(--sp-3);">
          <div style="flex:1 1 90px; min-width:0;">
            <div class="kpi__label" style="margin-bottom:3px;">
              {{ t('Orders') }}
            </div>
            <div class="mono" style="font-weight:700;font-size:16px;letter-spacing:-0.02em;">
              {{ fmtNum(s.total_orders) }}
            </div>
          </div>
          <div style="flex:1 1 90px; min-width:0;">
            <div class="kpi__label" style="margin-bottom:3px;">
              {{ t('Gross') }}
            </div>
            <div class="mono" style="font-weight:700;font-size:20px;letter-spacing:-0.02em;">
              {{ fmtMoney(num(s.total_revenue)) }}
            </div>
          </div>
          <div style="flex:1 1 90px; min-width:0;">
            <div class="kpi__label" style="margin-bottom:3px;">
              {{ t('Net') }}
            </div>
            <div class="mono" style="font-weight:700;font-size:20px;letter-spacing:-0.02em;color:var(--success);">
              {{ fmtMoney(netOf(s)) }}
            </div>
          </div>
        </div>

        <div class="card__divider" />

        <!-- reconciliation block — the hero -->
        <div style="padding: var(--sp-4) var(--sp-5);flex:1;">
          <div class="row between" style="margin-bottom:10px;">
            <span class="kpi__label">
              {{ shiftState(s) === 'reconciled'
                ? (confirmedSettlement(s) !== null ? t('Settlement confirmed') : t('Cash received'))
                : t('Settlement to receive') }}
            </span>
            <span v-if="shiftState(s) === 'reconciled'">
              <span
                class="badge"
                :class="{
                  't-neutral': varianceOf(s) === 0,
                  't-success': varianceOf(s) > 0,
                  't-error': varianceOf(s) < 0,
                }"
              >
                {{ varianceOf(s) === 0 ? t('Exact') : varianceOf(s) > 0 ? `${t('Over')} +${fmtNum(Math.abs(varianceOf(s)))}` : `${t('Short')} −${fmtNum(Math.abs(varianceOf(s)))}` }}
              </span>
            </span>
          </div>
          <div class="row between" style="align-items:flex-end;margin-bottom:12px;">
            <span class="mono shift-hero-amount">
              {{ fmtMoney(shiftState(s) === 'reconciled' ? (confirmedSettlement(s) ?? reportedCash(s)) : expectedSettlement(s)) }}<span class="tertiary" style="font-size:12px;font-weight:500;"> UZS</span>
            </span>
          </div>

          <!-- pay rows -->
          <div class="row between" style="padding:5px 0;">
            <span class="row" style="gap:8px;color:var(--text-secondary);font-size:13px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--success);">
                <ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
              </svg>
              {{ t('Cash sales') }}
            </span>
            <span class="mono" style="font-weight:600;font-size:13px;">{{ fmtMoney(s.cash_collected) }}</span>
          </div>
          <div class="row between" style="padding:5px 0;">
            <span class="row" style="gap:8px;color:var(--text-secondary);font-size:13px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--info);">
                <rect x="2" y="6" width="20" height="12" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              {{ t('Card / digital') }}
            </span>
            <span class="mono" style="font-weight:600;font-size:13px;">{{ fmtMoney(cardPayments(s)) }}</span>
          </div>
          <!-- Per-method breakdown toggle (CASH/UZCARD/HUMO/PAYME/MIXED) -->
          <div v-if="paymentMixRows(s).length > 0" style="padding:2px 0 5px 23px;">
            <button
              type="button"
              class="chip--clear"
              style="font-size:11px;padding:2px 8px;"
              @click="toggleMix(s.id)"
            >
              {{ expandedMix[s.id] ? t('Hide per-method breakdown') : t('Show per-method breakdown') }}
            </button>
          </div>
          <div v-if="expandedMix[s.id]" style="padding:2px 0 6px 23px;">
            <div v-for="m in paymentMixRows(s)" :key="m.method" class="row between" style="padding:3px 0;">
              <span class="tertiary" style="font-size:12px;">{{ t(`payment_method_${m.method}`) }}</span>
              <span class="mono" style="font-weight:600;font-size:12px;">{{ fmtMoney(m.amount) }}</span>
            </div>
          </div>
          <!--
            expenses_total / cancelled_orders_count / cancelled_orders_value are NOT in the /shifts list
            serializer (see _serialize_shift in shift_service.py). They only appear when a detail payload
            is merged onto s, hence the strict v-if guards. Rendered defensively for that case.
          -->
          <div v-if="s.expenses_total !== undefined && num(s.expenses_total) > 0" class="row between" style="padding:5px 0;">
            <span class="row" style="gap:8px;color:var(--text-secondary);font-size:13px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);">
                <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" />
              </svg>
              {{ t('Expenses') }}
            </span>
            <span class="mono" style="font-weight:600;font-size:13px;">− {{ fmtMoney(s.expenses_total) }}</span>
          </div>
          <div v-if="s.cancelled_orders_count !== undefined && num(s.cancelled_orders_count) > 0" class="row between" style="padding:5px 0;">
            <span class="row" style="gap:8px;color:var(--text-secondary);font-size:13px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              {{ t('Cancelled') }} · {{ fmtNum(s.cancelled_orders_count) }}
            </span>
            <span class="mono" style="font-weight:600;font-size:13px;">
              {{ s.cancelled_orders_value ? `− ${fmtMoney(s.cancelled_orders_value)}` : '—' }}
            </span>
          </div>

          <div v-if="shiftState(s) === 'reconciled'" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-strong);">
            <div class="row between" style="font-size:12px;">
              <span class="tertiary">
                {{ t('Counted') }} {{ fmtMoney(reportedCash(s)) }} · {{ t('received by') }} {{ reportedBy(s) }}
              </span>
            </div>
            <div v-if="s.reconciliation?.created_at" class="row between" style="font-size:11px;margin-top:3px;">
              <span class="tertiary">{{ t('Reconciled at') }}</span>
              <span class="mono tertiary">{{ fmtDateTime(s.reconciliation.created_at) }}</span>
            </div>
            <div v-if="s.reconciliation?.notes" style="font-size:11px;margin-top:4px;">
              <span class="tertiary">{{ t('Reconciliation notes') }}:</span>
              <span style="color:var(--text-secondary);"> {{ s.reconciliation.notes }}</span>
            </div>
          </div>
        </div>

        <!-- footer meta -->
        <div style="padding: 0 var(--sp-5) var(--sp-3);">
          <!--
            units_sold / avg_prep_seconds / peak_hour live in _shift_stats and are only attached when
            _serialize_shift is called with detail=True (shift_detail endpoint). On the /shifts list these
            render as '—'. Use units_sold (BE canonical field name), not the legacy items_sold.
          -->
          <div class="row wrap" style="gap:14px;font-size:11px;color:var(--text-tertiary);padding-bottom:12px;">
            <span>{{ t('Avg ticket') }} <b class="mono" style="color:var(--text-secondary);">{{ fmtAbbr(avgTicket(s)) }}</b></span>
            <span>{{ t('Items') }} <b class="mono" style="color:var(--text-secondary);">{{ fmtNum(s.units_sold) }}</b></span>
            <span>{{ t('Avg prep') }} <b style="color:var(--text-secondary);">{{ fmtPrep(s.avg_prep_seconds) }}</b></span>
            <span>{{ t('Peak') }} <b style="color:var(--text-secondary);">{{ fmtPeak(s.peak_hour) }}</b></span>
          </div>
        </div>

        <!-- actions -->
        <div class="row" style="gap:8px;padding: var(--sp-4) var(--sp-5);border-top:1px solid var(--border);background: var(--surface-2);border-radius: 0 0 var(--r-lg) var(--r-lg); flex-wrap:wrap;">
          <template v-if="shiftState(s) === 'active'">
            <button class="btn btn--secondary" style="flex:1 1 160px;" @click="openReport(s)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
              </svg>
              {{ t('Live report') }}
            </button>
            <button class="btn btn--ghost" @click="askEndShift(s)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
              </svg>
              {{ t('End shift') }}
            </button>
          </template>
          <template v-else-if="shiftState(s) === 'awaiting'">
            <button class="btn btn--primary" style="flex:1 1 160px;" @click="openReceive(s)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="22" /><path d="M17 6H9a3 3 0 100 6h6a3 3 0 110 6H7" />
              </svg>
              {{ t('Receive money') }}
            </button>
            <button class="btn btn--secondary" @click="openReport(s)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
              </svg>
              {{ t('Report') }}
            </button>
          </template>
          <template v-else>
            <div class="row" style="gap:7px;flex:1 1 160px;color:var(--success);font-weight:600;font-size:13px;">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" /><polyline points="9 12 11 14 15 10" />
              </svg>
              {{ t('Handover complete') }}
            </div>
            <button class="btn btn--ghost" @click="openReport(s)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
              </svg>
              {{ t('Report') }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Receive-money modal -->
    <div
      v-if="receiving"
      class="overlay"
      @mousedown="onOverlayMouseDown"
      @mouseup="onOverlayMouseUp($event, closeReceive)"
    >
      <form
        ref="receiveModalEl"
        class="modal modal--receive"
        role="dialog"
        aria-modal="true"
        @submit.prevent="canConfirmSettlement && !busy && confirmReceive()"
        @mousedown.stop
        @mouseup.stop
      >
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h3 class="modal__title">
              {{ t('Receive money') }} &middot; {{ fullName(receiving.user) }}
            </h3>
            <div class="modal__sub">
              {{ t('Shift') }} #{{ receiving.id }} &middot; {{ t('All payment types') }}
            </div>
          </div>
          <button type="button" class="iconaction" :title="t('Close')" @click="closeReceive">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div class="modal__body">
          <div v-if="settlementLoading" class="settlement-state">
            {{ t('Loading') }}
          </div>

          <div v-else-if="settlementError" class="settlement-state settlement-state--error">
            <p>{{ t('Failed to load settlement') }}</p>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              @click="receiving && loadSettlement(receiving.id)"
            >
              {{ t('Retry') }}
            </button>
          </div>

          <template v-else-if="settlementReady">
            <p class="settlement-intro">
              {{ t('Count each tender first. The system figure and the difference appear only after you enter an amount.') }}
            </p>

            <div class="settlement-grid">
              <div class="settlement-grid__head">
                <span>{{ t('Payment type') }}</span>
                <span>{{ t('Counted') }}</span>
                <span>{{ t('System expected') }}</span>
                <span>{{ t('Difference') }}</span>
              </div>

              <div
                v-for="method in visibleTenders"
                :key="method"
                class="settlement-grid__row"
              >
                <div class="settlement-grid__tender">
                  {{ tenderLabel(method) }}
                </div>
                <div class="settlement-grid__input">
                  <input
                    v-model="countedByTender[method]"
                    class="settlement-input"
                    inputmode="numeric"
                    :aria-label="`${tenderLabel(method)}: ${t('Counted')}`"
                    :placeholder="t('Enter counted amount')"
                  >
                </div>
                <div class="settlement-grid__expected" :data-label="t('System expected')">
                  <span v-if="countedOf(method) !== null" class="mono">
                    {{ fmtMoney(expectedByTender[method] ?? 0) }}
                  </span>
                  <span v-else class="tertiary">&mdash;</span>
                </div>
                <div class="settlement-grid__difference" :data-label="t('Difference')">
                  <template v-if="tenderVariance(method) !== null">
                    <span
                      class="settlement-difference"
                      :class="{
                        'settlement-difference--exact': tenderVariance(method) === 0,
                        'settlement-difference--over': (tenderVariance(method) ?? 0) > 0,
                        'settlement-difference--short': (tenderVariance(method) ?? 0) < 0,
                      }"
                    >
                      {{ tenderVariance(method) === 0 ? t('Exact') : (tenderVariance(method) ?? 0) > 0 ? t('Over') : t('Short') }}
                      {{ tenderVariance(method) === 0 ? '' : `${(tenderVariance(method) ?? 0) > 0 ? '+' : '-'}${fmtMoney(Math.abs(tenderVariance(method) ?? 0))}` }}
                    </span>
                  </template>
                  <span v-else class="tertiary">&mdash;</span>
                </div>
              </div>
            </div>

            <div class="settlement-total">
              <div>
                <div class="settlement-total__label">{{ t('Total received') }}</div>
                <div class="settlement-total__hint">{{ t('All payment types') }}</div>
              </div>
              <strong class="mono">{{ fmtMoney(totalReceived) }} <span>UZS</span></strong>
            </div>

            <label class="field" style="margin-top:16px;">
              <span class="field__label">{{ t('Note (optional)') }}</span>
              <textarea v-model="note" class="control" :placeholder="t('Reason for any difference, deposits, etc.')" />
            </label>
          </template>
        </div>
        <div class="modal__foot" style="justify-content:flex-end;">
          <button
            type="submit"
            class="btn btn--primary"
            :class="{ 'is-loading': busy }"
            :disabled="!canConfirmSettlement || busy"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ t('Confirm settlement') }}
          </button>
        </div>
      </form>
    </div>

    <!-- End-shift confirm modal -->
    <div
      v-if="endingShift"
      class="overlay"
      @mousedown="onOverlayMouseDown"
      @mouseup="onOverlayMouseUp($event, cancelEndShift)"
    >
      <div
        ref="endModalEl"
        class="modal modal--end"
        role="dialog"
        aria-modal="true"
        @mousedown.stop
        @mouseup.stop
      >
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h3 class="modal__title">
              {{ t('End this shift?') }}
            </h3>
            <div class="modal__sub">
              {{ t('Shift') }} #{{ endingShift.id }} · {{ fullName(endingShift.user) }}
            </div>
          </div>
          <button type="button" class="iconaction" :title="t('Close')" @click="cancelEndShift">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div class="modal__body">
          <p style="font-size:14px;color:var(--text-secondary);line-height:1.5;margin:0;">
            {{ t('Once ended, the cashier will no longer be able to take orders and the drawer must be reconciled before the next shift starts.') }}
          </p>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" :disabled="busy" @click="cancelEndShift">
            {{ t('Cancel') }}
          </button>
          <button type="button" class="btn btn--primary" :disabled="busy" @click="confirmEndShift">
            {{ busy ? t('Ending…') : t('End shift') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast / snackbar -->
    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      location="top end"
      timeout="3500"
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

<style scoped>
/* Responsive shift cards grid — auto-fill with sensible breakpoints */
.shift-cards-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(430px, 100%), 1fr));
}
/* The toolbar should read as a compact set of filters, not four equal-width
   fields. Keep the date range flexible without stretching the selects. */
.shift-filter {
  flex: 0 1 auto;
  min-width: 0;
}

.shift-filter--cashier {
  flex-basis: 248px;
  max-width: 280px;
}

.shift-filter--status {
  flex-basis: 185px;
  max-width: 210px;
}

.drp.shift-filter--date {
  flex: 0 1 260px;
  max-width: 290px;
}

.drp.shift-filter--date .drp-trigger {
  width: 100%;
}

.drp.shift-filter--date .drp-trigger__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 900px) {
  .shift-cards-grid {
    grid-template-columns: 1fr;
  }
}

/* Hero amount in each shift card — long money values may overflow at phone widths */
.shift-hero-amount {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}
@media (max-width: 768px) {
  .shift-hero-amount {
    font-size: 22px;
  }
}
@media (max-width: 420px) {
  .shift-hero-amount {
    font-size: 19px;
  }
}

/* Modals — collapse hard-coded widths on narrow viewports (canonical phone breakpoint 768px) */
.modal--receive {
  max-width: 680px;
  width: 100%;
}
.modal--end {
  max-width: 440px;
  width: 100%;
}

.settlement-state {
  display: grid;
  min-height: 144px;
  place-items: center;
  gap: var(--sp-3);
  color: var(--text-secondary);
  text-align: center;
}

.settlement-state p {
  margin: 0;
}

.settlement-state--error {
  color: var(--error);
}

.settlement-intro {
  margin: 0 0 var(--sp-4);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.settlement-grid {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.settlement-grid__head,
.settlement-grid__row {
  display: grid;
  grid-template-columns: minmax(88px, 1fr) minmax(116px, 1.1fr) minmax(96px, 0.9fr) minmax(88px, 0.85fr);
  align-items: center;
  gap: var(--sp-3);
  padding: 10px 12px;
}

.settlement-grid__head {
  background: var(--surface-inset);
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.settlement-grid__row + .settlement-grid__row {
  border-top: 1px solid var(--border);
}

.settlement-grid__tender {
  min-width: 0;
  font-size: 13px;
  font-weight: 650;
}

.settlement-grid__expected,
.settlement-grid__difference {
  min-width: 0;
  font-size: 13px;
  text-align: right;
}

.settlement-input {
  width: 100%;
  min-width: 0;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-variant-numeric: tabular-nums;
  padding: 0 9px;
}

.settlement-input:focus {
  border-color: var(--primary);
  outline: 2px solid color-mix(in srgb, var(--primary) 20%, transparent);
  outline-offset: 1px;
}

.settlement-difference {
  display: inline-flex;
  justify-content: flex-end;
  gap: 4px;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.settlement-difference--exact { color: var(--text-secondary); }
.settlement-difference--over { color: var(--success); }
.settlement-difference--short { color: var(--error); }

.settlement-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
  padding: 12px 14px;
  border: 1px solid var(--success-border);
  border-radius: var(--r-md);
  background: var(--success-weak);
}

.settlement-total__label {
  color: var(--text);
  font-size: 14px;
  font-weight: 700;
}

.settlement-total__hint {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 12px;
}

.settlement-total strong {
  color: var(--success);
  font-size: 17px;
  white-space: nowrap;
}

.settlement-total strong span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

@media (max-width: 600px) {
  .settlement-grid__head {
    display: none;
  }

  .settlement-grid__row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'tender input'
      'expected difference';
    gap: 8px 12px;
  }

  .settlement-grid__tender { grid-area: tender; }
  .settlement-grid__input { grid-area: input; }
  .settlement-grid__expected { grid-area: expected; text-align: left; }
  .settlement-grid__difference { grid-area: difference; }

  .settlement-grid__expected::before,
  .settlement-grid__difference::before {
    display: block;
    margin-bottom: 2px;
    color: var(--text-tertiary);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .settlement-grid__expected::before,
  .settlement-grid__difference::before { content: attr(data-label); }
}

@media (max-width: 768px) {
  .modal--receive,
  .modal--end {
    max-width: 100%;
    margin: var(--sp-3);
  }
}

/* KPI strip — keep 2-up on phone (cols-4 → 2 cols at 768) instead of collapsing to 1 col */
@media (max-width: 768px) {
  .shifts-kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
@media (max-width: 420px) {
  .shifts-kpi-strip {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 640px) {
  .shift-filter--cashier,
  .shift-filter--status,
  .drp.shift-filter--date,
  .live-only-wrap {
    flex: 1 1 100%;
    max-width: none;
  }
}

</style>

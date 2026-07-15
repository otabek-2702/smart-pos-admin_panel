<script setup lang="ts">
/* ============================================================
   SHIFTS — daily cash handover / reconciliation
   Ported 1:1 from .tmp-design-bundle/project/pages/Shifts.jsx
   ============================================================ */
import axios from '@/plugins/axios'
import { buildCsv } from '@/utils/csv'
import Select from '@/components/design/Select.vue'

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
const dateFrom = ref('')
const dateTo = ref('')
const cashierId = ref<number | ''>('')
// status uses BE Shift.Status enum directly: ACTIVE | ENDED | COMPLETED | ABANDONED
const statusF = ref<'' | 'ACTIVE' | 'ENDED' | 'COMPLETED' | 'ABANDONED'>('')
const templateId = ref<number | ''>('')
const staffRole = ref<'CASHIER' | 'MANAGER' | 'ALL'>('CASHIER')
const liveOnly = ref(false)

const cashiers = ref<any[]>([])
const templates = ref<any[]>([])

async function loadCashiers() {
  try {
    const params: any = { per_page: 200 }
    if (staffRole.value !== 'ALL') params.role = staffRole.value
    const res = await axios.get('/users', { params })
    const d = res.data?.data ?? res.data
    cashiers.value = d?.users ?? []
  }
  catch {
    cashiers.value = []
  }
}

async function loadTemplates() {
  try {
    const res = await axios.get('/shift-templates', { params: { per_page: 200 } })
    const d = res.data?.data ?? res.data
    templates.value = Array.isArray(d) ? d : (d?.shift_templates ?? d?.templates ?? d?.items ?? [])
  }
  catch {
    templates.value = []
  }
}

function templateName(tpl: any): string {
  if (!tpl || typeof tpl !== 'object') return '—'
  return tpl.name || `#${tpl.id}`
}

// ============================================================
// Shifts data
// ============================================================
const shifts = ref<any[]>([])
const loading = ref(true)

async function loadShifts() {
  loading.value = true
  try {
    // client-side swap if from > to to avoid a confusing empty result
    if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
      const tmp = dateFrom.value
      dateFrom.value = dateTo.value
      dateTo.value = tmp
      notify(t('Swapped date range (from was after to)'), 'warning')
    }
    const params: any = { page: 1, per_page: 100 }
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    if (cashierId.value) params.user_id = cashierId.value
    if (statusF.value) params.status = statusF.value
    if (templateId.value) params.shift_template_id = templateId.value

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

onMounted(() => { loadCashiers(); loadTemplates(); loadShifts() })
watch([dateFrom, dateTo, cashierId, statusF, templateId], () => { loadShifts() })
watch(staffRole, () => { loadCashiers() })

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
    if (templateId.value && s.shift_template?.id !== templateId.value) return false
    if (dateFrom.value && s.start_time && new Date(s.start_time) < new Date(dateFrom.value)) return false
    if (dateTo.value && s.start_time && new Date(s.start_time) > new Date(`${dateTo.value}T23:59`)) return false
    return true
  })
})

// ============================================================
// Summary KPIs
// ============================================================
const summary = computed(() => {
  let active = 0
  let awaiting = 0
  let cashToReceive = 0
  let netVariance = 0
  for (const s of shifts.value) {
    const st = shiftState(s)
    if (st === 'active') active++
    else if (st === 'awaiting') { awaiting++; cashToReceive += expectedCash(s) }
    else if (st === 'reconciled') netVariance += varianceOf(s)
  }
  return { active, awaiting, cashToReceive, netVariance }
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
  if (templateId.value) {
    const tpl = templates.value.find((x: any) => x.id === templateId.value)
    arr.push({ k: 'tpl', label: t('Template'), val: tpl ? templateName(tpl) : `#${templateId.value}`, clear: () => (templateId.value = '') })
  }
  if (liveOnly.value) arr.push({ k: 'l', label: t('Live only'), val: t('On'), clear: () => (liveOnly.value = false) })
  if (dateFrom.value) arr.push({ k: 'f', label: t('Date from'), val: dateFrom.value, clear: () => (dateFrom.value = '') })
  if (dateTo.value) arr.push({ k: 't', label: t('Date to'), val: dateTo.value, clear: () => (dateTo.value = '') })
  return arr
})
function clearAllFilters() {
  cashierId.value = ''
  statusF.value = ''
  templateId.value = ''
  liveOnly.value = false
  dateFrom.value = ''
  dateTo.value = ''
}

// ============================================================
// Receive-cash modal
// ============================================================
const receiving = ref<any | null>(null)
const counted = ref('')
const note = ref('')
const busy = ref(false)

const countedParsed = computed<number | null>(() => {
  if (counted.value === '' || counted.value === null) return null
  const stripped = String(counted.value).replace(/[^\d-]/g, '')
  if (stripped === '' || stripped === '-') return null
  const n = Number(stripped)
  return Number.isFinite(n) ? n : null
})
const liveVariance = computed<number | null>(() => {
  if (countedParsed.value === null || !receiving.value) return null
  return countedParsed.value - expectedCash(receiving.value)
})

function openReceive(s: any) {
  receiving.value = s
  counted.value = ''
  note.value = ''
}
function closeReceive() {
  if (busy.value) return
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
  if (!receiving.value || countedParsed.value === null) return
  busy.value = true
  const s = receiving.value
  const variance = liveVariance.value ?? 0
  let success = false
  let endpointMissing = false
  try {
    // POST to backend reconciliation endpoint — BE expects `actual_cash` + `notes`
    // (it recomputes variance server-side and ignores any client-sent variance).
    await axios.post(`/shifts/${s.id}/reconcile`, {
      actual_cash: countedParsed.value,
      notes: note.value || undefined,
    })
    success = true
    notify(`${t('Cash received from')} ${fullName(s.user)} · ${fmtMoney(countedParsed.value!)} UZS`, variance === 0 ? 'success' : variance > 0 ? 'info' : 'warning')
  }
  catch (e: any) {
    const status = e?.response?.status
    const beMsg = e?.response?.data?.message || ''
    if (status === 404) {
      // Treat as a graceful fallback — endpoint not deployed yet.
      endpointMissing = true
      notify(`${t('Recorded locally — backend endpoint not available')} (${fmtMoney(countedParsed.value!)} UZS)`, 'warning')
    }
    else if (status === 400 && /ended/i.test(beMsg) && s.status !== 'ENDED') {
      notify(t('Shift must be ended before reconciling'), 'error')
    }
    else {
      // Real backend error — surface as error and do NOT optimistically update.
      const msg = beMsg || e?.message || t('Failed to record cash handover')
      notify(msg, 'error')
    }
  }
  // Only flip the card locally when we actually succeeded (or when BE is missing).
  if (success || endpointMissing) {
    shifts.value = shifts.value.map((x: any) => x.id === s.id
      ? {
          ...x,
          reconciliation: {
            ...(x.reconciliation || {}),
            // Mirror BE reconciliation shape: actual_cash + difference + reconciled_by {id,name}.
            counted_cash: countedParsed.value,
            actual_cash: countedParsed.value,
            expected_cash: expectedCash(x),
            variance,
            difference: variance,
            reconciled_by: { id: 0, name: 'Manager' },
            reported_by_user: { first_name: 'Manager' },
            notes: note.value || undefined,
            created_at: new Date().toISOString(),
          },
        }
      : x)
    receiving.value = null
  }
  busy.value = false
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
const templateSelectOptions = computed(() => templates.value.map(tpl => ({ value: String(tpl.id), label: templateName(tpl) })))

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
const cashCounted = useCountUp(() => Number(summary.value.cashToReceive ?? 0))
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
          {{ t('Reconcile cashiers and receive end-of-shift cash') }}
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

      <!-- Awaiting cash -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-warning">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /><path d="M3 7l3-4h12l3 4" /><path d="M16 13a4 4 0 01-8 0" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Awaiting cash') }}
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

      <!-- Cash to receive -->
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="6" rx="9" ry="3" /><path d="M3 6v6c0 1.7 4 3 9 3s9-1.3 9-3V6" /><path d="M3 12v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
            </svg>
          </div>
          <div class="kpi__label">
            {{ t('Cash to receive') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:140px;height:30px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(cashCounted) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__foot">
          <span class="kpi__subtext">{{ t('across {n} shifts', { n: summary.awaiting }) }}</span>
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
        <div style="flex:1 1 200px; min-width:0;">
          <Select
            :model-value="cashierId === '' ? '' : String(cashierId)"
            icon="user"
            :placeholder="t('All cashiers')"
            :options="cashierSelectOptions"
            @update:model-value="cashierId = $event ? Number($event) : ''"
          />
        </div>

        <!-- Status select -->
        <div style="flex:1 1 190px; min-width:0;">
          <Select
            v-model="statusF"
            icon="filter"
            :placeholder="t('All statuses')"
            :options="statusSelectOptions"
          />
        </div>

        <!-- Shift template select -->
        <div style="flex:1 1 190px; min-width:0;">
          <Select
            :model-value="templateId === '' ? '' : String(templateId)"
            icon="calendar"
            :placeholder="t('All templates')"
            :options="templateSelectOptions"
            @update:model-value="templateId = $event ? Number($event) : ''"
          />
        </div>

        <!-- Staff role toggle (which roles populate the cashier dropdown) -->
        <div class="row staff-role-toggle" style="gap:6px;flex:0 0 auto;flex-wrap:wrap;">
          <button
            type="button"
            class="badge"
            :class="staffRole === 'CASHIER' ? 't-primary' : 't-neutral'"
            :title="t('Show cashiers only in the staff dropdown')"
            @click="staffRole = 'CASHIER'"
          >
            {{ t('role_CASHIER') }}
          </button>
          <button
            type="button"
            class="badge"
            :class="staffRole === 'MANAGER' ? 't-primary' : 't-neutral'"
            :title="t('Show managers only in the staff dropdown')"
            @click="staffRole = 'MANAGER'"
          >
            {{ t('role_MANAGER') }}
          </button>
          <button
            type="button"
            class="badge"
            :class="staffRole === 'ALL' ? 't-primary' : 't-neutral'"
            :title="t('Show every user who can run a till')"
            @click="staffRole = 'ALL'"
          >
            {{ t('All staff') }}
          </button>
        </div>

        <!-- Date range -->
        <div class="date-range-wrap" style="display:flex; align-items:center; gap:8px; flex:1 1 320px; min-width:0;">
          <div class="control control--sm" style="flex:1 1 140px; min-width:0;">
            <input v-model="dateFrom" type="date" :max="dateTo || undefined" :placeholder="t('From')">
          </div>
          <span class="tertiary">→</span>
          <div class="control control--sm" style="flex:1 1 140px; min-width:0;">
            <input v-model="dateTo" type="date" :min="dateFrom || undefined" :placeholder="t('To')">
          </div>
        </div>

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
              {{ shiftState(s) === 'reconciled' ? t('Cash received') : t('Cash to receive') }}
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
              {{ fmtMoney(shiftState(s) === 'reconciled' ? reportedCash(s) : expectedCash(s)) }}<span class="tertiary" style="font-size:12px;font-weight:500;"> UZS</span>
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
              {{ t('Receive cash') }}
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

    <!-- Receive-cash modal -->
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
        @submit.prevent="countedParsed !== null && !busy && confirmReceive()"
        @mousedown.stop
        @mouseup.stop
      >
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h3 class="modal__title">
              {{ t('Receive cash') }} · {{ fullName(receiving.user) }}
            </h3>
            <div class="modal__sub">
              {{ t('Shift') }} #{{ receiving.id }} · {{ t('count the drawer and confirm the handover') }}
            </div>
          </div>
          <button type="button" class="iconaction" :title="t('Close')" @click="closeReceive">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div class="modal__body">
          <!-- expected breakdown -->
          <div style="background:var(--surface-inset);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--sp-4);margin-bottom:var(--sp-5);">
            <div class="row between" style="padding:5px 0;">
              <span class="row" style="gap:8px;color:var(--text-secondary);font-size:13px;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--success);">
                  <ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
                </svg>
                {{ t('Cash sales') }}
              </span>
              <span class="mono" style="font-weight:600;font-size:13px;">{{ fmtMoney(receiving.cash_collected) }}</span>
            </div>
            <div v-if="num(receiving.expenses_total) > 0" class="row between" style="padding:5px 0;">
              <span class="row" style="gap:8px;color:var(--text-secondary);font-size:13px;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);">
                  <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" />
                </svg>
                {{ t('Cash expenses paid') }}
              </span>
              <span class="mono" style="font-weight:600;font-size:13px;color:var(--text-secondary);">− {{ fmtMoney(receiving.expenses_total) }}</span>
            </div>
            <div class="hr" style="margin:8px 0;" />
            <div class="row between">
              <span style="font-weight:600;font-size:14px;">{{ t('Expected in drawer') }}</span>
              <span class="mono" style="font-weight:700;font-size:16px;">
                {{ fmtMoney(expectedCash(receiving)) }} <span class="tertiary" style="font-size:12px;">UZS</span>
              </span>
            </div>
          </div>

          <!-- Counted cash input -->
          <label class="field">
            <span class="field__label">{{ t('Counted cash (UZS)') }}</span>
            <div class="control">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);flex:0 0 18px;">
                <rect x="2" y="6" width="20" height="12" rx="2" /><path d="M16 12h2" />
              </svg>
              <input v-model="counted" inputmode="numeric" :placeholder="t('e.g. 1 301 000')" autofocus>
            </div>
            <span class="field__hint">{{ t('Enter the amount you physically counted from the till.') }}</span>
          </label>

          <!-- Live variance -->
          <div
            class="row between"
            :style="{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: 'var(--r-md)',
              background: liveVariance === null ? 'var(--surface-2)' : liveVariance === 0 ? 'var(--neutral-weak)' : liveVariance > 0 ? 'var(--success-weak)' : 'var(--error-weak)',
              border: '1px solid ' + (liveVariance === null ? 'var(--border)' : liveVariance === 0 ? 'var(--neutral-border)' : liveVariance > 0 ? 'var(--success-border)' : 'var(--error-border)'),
            }"
          >
            <span style="font-weight:600;font-size:14px;">{{ t('Variance') }}</span>
            <span v-if="liveVariance === null" class="tertiary">{{ t('Enter counted amount') }}</span>
            <span v-else class="row" style="gap:10px;">
              <span
                class="mono"
                :style="{
                  fontWeight: 700,
                  fontSize: '16px',
                  color: liveVariance === 0 ? 'var(--text)' : liveVariance > 0 ? 'var(--success)' : 'var(--error)',
                }"
              >
                {{ liveVariance > 0 ? '+' : liveVariance < 0 ? '−' : '' }}{{ fmtMoney(Math.abs(liveVariance)) }}
              </span>
              <span
                class="badge"
                :class="{
                  't-neutral': liveVariance === 0,
                  't-success': liveVariance > 0,
                  't-error': liveVariance < 0,
                }"
              >
                {{ liveVariance === 0 ? t('Exact') : liveVariance > 0 ? `${t('Over')} +${fmtNum(Math.abs(liveVariance))}` : `${t('Short')} −${fmtNum(Math.abs(liveVariance))}` }}
              </span>
            </span>
          </div>

          <!-- Note -->
          <label class="field" style="margin-top:16px;">
            <span class="field__label">{{ t('Note (optional)') }}</span>
            <textarea v-model="note" class="control" :placeholder="t('Reason for any difference, deposits, etc.')" />
          </label>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" :disabled="busy" @click="closeReceive">
            {{ t('Cancel') }}
          </button>
          <button
            type="submit"
            class="btn btn--primary"
            :class="{ 'is-loading': busy }"
            :disabled="countedParsed === null || busy"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ t('Confirm handover') }}
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
  max-width: 520px;
  width: 100%;
}
.modal--end {
  max-width: 440px;
  width: 100%;
}
@media (max-width: 768px) {
  .modal--receive,
  .modal--end {
    max-width: 100%;
    margin: var(--sp-3);
  }
}

/* Date range — drop to full width on narrow viewports so the two inputs stack cleanly */
@media (max-width: 900px) {
  .date-range-wrap {
    flex: 1 1 100% !important;
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

/* Toolbar role-toggle + live-only switch — span full width at phone widths so they don't collide */
@media (max-width: 768px) {
  .staff-role-toggle,
  .live-only-wrap {
    flex: 1 1 100% !important;
  }
  .staff-role-toggle .badge {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>

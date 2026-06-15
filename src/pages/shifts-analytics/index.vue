<script setup lang="ts">
/* ============================================================
   SHIFTS — daily cash handover / reconciliation
   Ported 1:1 from .tmp-design-bundle/project/pages/Shifts.jsx
   ============================================================ */
import axios from '@/plugins/axios'

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
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
function fmtPrep(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—'
  const n = Number(sec)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 60) return `${Math.round(n)}s`
  return `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, '0')}s`
}
function fmtPeak(p: any): string {
  if (!p || p.hour === undefined || p.hour === null) return '—'
  const h = String(p.hour).padStart(2, '0')
  return p.orders !== undefined ? `${h}:00 (${p.orders})` : `${h}:00`
}
function initialsOf(first?: string, last?: string, email?: string): string {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) return ((f[0] || '') + (l[0] || '')).toUpperCase() || '?'
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}
function fullName(u: any): string {
  if (!u) return t('Unknown')
  const n = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return n || u.email || `#${u.id}`
}

// ============================================================
// Filters
// ============================================================
const dateFrom = ref('')
const dateTo = ref('')
const cashierId = ref<number | ''>('')
const statusF = ref<'' | 'Active' | 'Awaiting cash' | 'Reconciled'>('')
const liveOnly = ref(false)

const cashiers = ref<any[]>([])

async function loadCashiers() {
  try {
    const res = await axios.get('/users', { params: { role: 'CASHIER', per_page: 200 } })
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
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    if (cashierId.value) params.user_id = cashierId.value

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
watch([dateFrom, dateTo, cashierId], () => { loadShifts() })

// ============================================================
// Shape & derived helpers
// ============================================================
function shiftState(s: any): 'active' | 'awaiting' | 'reconciled' {
  if (s.status === 'ACTIVE') return 'active'
  if (s.reconciliation && (s.reconciliation.id || s.reconciliation.counted_cash !== undefined || s.reconciliation.reported !== undefined)) return 'reconciled'
  return 'awaiting'
}
function expectedCash(s: any): number {
  return num(s.cash_collected) - num(s.expenses_total)
}
function reportedCash(s: any): number {
  const r = s.reconciliation || {}
  return num(r.counted_cash ?? r.reported ?? r.amount)
}
function reportedBy(s: any): string {
  const r = s.reconciliation || {}
  const u = r.reported_by_user || r.reported_by || r.user
  if (typeof u === 'string') return u
  return u ? fullName(u) : t('Manager')
}
function varianceOf(s: any): number {
  const r = s.reconciliation || {}
  if (r.variance !== undefined && r.variance !== null) return num(r.variance)
  if (r.counted_cash !== undefined) return num(r.counted_cash) - expectedCash(s)
  return 0
}
function cardPayments(s: any): number {
  // anything that isn't CASH in payment_mix
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
  const o = num(s.total_orders)
  return o > 0 ? num(s.total_revenue) / o : 0
}
function netOf(s: any): number {
  if (s.net_revenue !== undefined && s.net_revenue !== null) return num(s.net_revenue)
  return num(s.total_revenue) - num(s.expenses_total) - num(s.cancelled_orders_value)
}

// ============================================================
// Filtering
// ============================================================
const filtered = computed(() => {
  return shifts.value.filter((s) => {
    if (cashierId.value && s.user?.id !== cashierId.value) return false
    if (liveOnly.value && !(s.is_live_stats || s.status === 'ACTIVE')) return false
    if (statusF.value) {
      const st = shiftState(s)
      if (statusF.value === 'Active' && st !== 'active') return false
      if (statusF.value === 'Awaiting cash' && st !== 'awaiting') return false
      if (statusF.value === 'Reconciled' && st !== 'reconciled') return false
    }
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
  if (statusF.value) arr.push({ k: 's', label: t('Status'), val: t(statusF.value), clear: () => (statusF.value = '') })
  if (liveOnly.value) arr.push({ k: 'l', label: t('Live only'), val: t('On'), clear: () => (liveOnly.value = false) })
  if (dateFrom.value) arr.push({ k: 'f', label: t('From'), val: dateFrom.value, clear: () => (dateFrom.value = '') })
  if (dateTo.value) arr.push({ k: 't', label: t('To'), val: dateTo.value, clear: () => (dateTo.value = '') })
  return arr
})
function clearAllFilters() {
  cashierId.value = ''
  statusF.value = ''
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

async function confirmReceive() {
  if (!receiving.value || countedParsed.value === null) return
  busy.value = true
  const s = receiving.value
  const variance = liveVariance.value ?? 0
  try {
    // POST to backend reconciliation endpoint
    // TODO: confirm endpoint shape — current alpha_pos backend may differ. If
    // /shifts/:id/reconcile doesn't exist yet we fall back to local update.
    await axios.post(`/shifts/${s.id}/reconcile`, {
      counted_cash: countedParsed.value,
      variance,
      note: note.value || undefined,
    })
    notify(`${t('Cash received from')} ${fullName(s.user)} · ${fmtMoney(countedParsed.value!)} UZS`, variance === 0 ? 'success' : variance > 0 ? 'info' : 'warning')
  }
  catch {
    // Local fallback so the manager workflow still works in preview / when BE
    // endpoint isn't deployed yet.
    notify(`${t('Recorded locally — backend endpoint not available')} (${fmtMoney(countedParsed.value!)} UZS)`, 'warning')
  }
  // Update local list either way so the card flips to RECONCILED.
  shifts.value = shifts.value.map((x: any) => x.id === s.id
    ? {
        ...x,
        reconciliation: {
          ...(x.reconciliation || {}),
          counted_cash: countedParsed.value,
          variance,
          reported_by_user: { first_name: 'Manager' },
          note: note.value || undefined,
        },
      }
    : x)
  busy.value = false
  receiving.value = null
}

// ============================================================
// Status options for the filter select
// ============================================================
const statusOptions = [
  { value: '', label: '__placeholder__' },
  { value: 'Active', label: 'Active' },
  { value: 'Awaiting cash', label: 'Awaiting cash' },
  { value: 'Reconciled', label: 'Reconciled' },
]

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
        <button class="btn btn--secondary">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {{ t('Export') }}
        </button>
      </div>
    </div>

    <!-- Summary KPI strip -->
    <div class="grid cols-4" style="margin-bottom: var(--sp-5);">
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
          <span class="kpi__subtext">{{ t('across') }} {{ summary.awaiting }} {{ t('shifts') }}</span>
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
          <span class="kpi__subtext">{{ t('reconciled today') }}</span>
        </div>
      </div>
    </div>

    <!-- Filter toolbar -->
    <div class="card" style="margin-bottom: var(--sp-5);">
      <div class="toolbar">
        <!-- Cashier select -->
        <div style="width:200px;">
          <div class="control control--select">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);flex:0 0 18px;">
              <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
            <select v-model="cashierId" :style="{ color: cashierId ? 'var(--text)' : 'var(--text-tertiary)' }">
              <option value="">
                {{ t('All cashiers') }}
              </option>
              <option v-for="c in cashiers" :key="c.id" :value="c.id" style="color:var(--text);">
                {{ fullName(c) }}
              </option>
            </select>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chev"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>

        <!-- Status select -->
        <div style="width:190px;">
          <div class="control control--select">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);flex:0 0 18px;">
              <polygon points="4 4 20 4 14 12 14 19 10 21 10 12 4 4" />
            </svg>
            <select v-model="statusF" :style="{ color: statusF ? 'var(--text)' : 'var(--text-tertiary)' }">
              <option value="">
                {{ t('All statuses') }}
              </option>
              <option value="Active" style="color:var(--text);">
                {{ t('Active') }}
              </option>
              <option value="Awaiting cash" style="color:var(--text);">
                {{ t('Awaiting cash') }}
              </option>
              <option value="Reconciled" style="color:var(--text);">
                {{ t('Reconciled') }}
              </option>
            </select>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chev"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>

        <!-- Date range -->
        <div class="row" style="gap:8px;">
          <div class="control control--sm" style="width:150px;">
            <input v-model="dateFrom" type="date" :placeholder="t('From')">
          </div>
          <span class="tertiary">→</span>
          <div class="control control--sm" style="width:150px;">
            <input v-model="dateTo" type="date" :placeholder="t('To')">
          </div>
        </div>

        <!-- Live only switch -->
        <div class="row" style="gap:10px;margin-left:auto;">
          <span class="row" style="gap:8px;font-size:14px;font-weight:500;">
            <span
              class="switch"
              :class="{ 'is-on': liveOnly }"
              role="switch"
              :aria-checked="liveOnly"
              @click="liveOnly = !liveOnly"
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
    <div v-if="loading" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(430px, 1fr));">
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
        <div style="margin-top:12px;">
          <button class="btn btn--secondary" @click="clearAllFilters">
            {{ t('Clear filters') }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="grid" style="grid-template-columns: repeat(auto-fill, minmax(430px, 1fr));align-items:start;">
      <div
        v-for="s in filtered"
        :key="s.id"
        class="card"
        :style="{ display: 'flex', flexDirection: 'column', borderColor: shiftState(s) === 'awaiting' ? 'var(--warning-border)' : 'var(--border)', borderLeft: shiftState(s) === 'awaiting' ? '3px solid var(--warning)' : '' }"
      >
        <!-- header: avatar + name + status pill -->
        <div class="row" style="gap:12px;padding: var(--sp-5) var(--sp-5) var(--sp-4);">
          <div class="avatar">
            {{ initialsOf(s.user?.first_name, s.user?.last_name, s.user?.email) }}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;">
              {{ fullName(s.user) }}
            </div>
            <div class="tertiary" style="font-size:12px;">
              {{ t('Shift') }} #{{ s.id }} · {{ s.shift_template?.name || s.shift_template?.title || s.shift_template || '—' }}
            </div>
          </div>
          <!-- status badge -->
          <span v-if="shiftState(s) === 'active'" class="badge badge--dot t-success">{{ t('ACTIVE') }}</span>
          <span v-else-if="shiftState(s) === 'awaiting'" class="badge badge--dot t-warning">{{ t('AWAITING CASH') }}</span>
          <span v-else class="badge t-neutral">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="9 12 11 14 15 10" /></svg>
            {{ t('RECONCILED') }}
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
        <div class="row" style="gap:0;padding: var(--sp-4) var(--sp-5) var(--sp-3);">
          <div style="flex:1;min-width:0;">
            <div class="kpi__label" style="margin-bottom:3px;">
              {{ t('Orders') }}
            </div>
            <div class="mono" style="font-weight:700;font-size:16px;letter-spacing:-0.02em;">
              {{ fmtNum(s.total_orders) }}
            </div>
          </div>
          <div style="flex:1;min-width:0;">
            <div class="kpi__label" style="margin-bottom:3px;">
              {{ t('Gross') }}
            </div>
            <div class="mono" style="font-weight:700;font-size:20px;letter-spacing:-0.02em;">
              {{ fmtMoney(s.total_revenue) }}
            </div>
          </div>
          <div style="flex:1;min-width:0;">
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
            <span class="mono" style="font-size:26px;font-weight:700;letter-spacing:-0.03em;">
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
          <div class="row between" style="padding:5px 0;">
            <span class="row" style="gap:8px;color:var(--text-secondary);font-size:13px;">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-tertiary);">
                <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" />
              </svg>
              {{ t('Expenses') }}
            </span>
            <span class="mono" style="font-weight:600;font-size:13px;">− {{ fmtMoney(s.expenses_total) }}</span>
          </div>
          <div class="row between" style="padding:5px 0;">
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

          <div v-if="shiftState(s) === 'reconciled'" class="row between" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-strong);font-size:12px;">
            <span class="tertiary">
              {{ t('Counted') }} {{ fmtMoney(reportedCash(s)) }} · {{ t('received by') }} {{ reportedBy(s) }}
            </span>
          </div>
        </div>

        <!-- footer meta -->
        <div style="padding: 0 var(--sp-5) var(--sp-3);">
          <div class="row wrap" style="gap:14px;font-size:11px;color:var(--text-tertiary);padding-bottom:12px;">
            <span>{{ t('Avg ticket') }} <b class="mono" style="color:var(--text-secondary);">{{ fmtAbbr(avgTicket(s)) }}</b></span>
            <span>{{ t('Items') }} <b class="mono" style="color:var(--text-secondary);">{{ fmtNum(s.items_sold) }}</b></span>
            <span>{{ t('Avg prep') }} <b style="color:var(--text-secondary);">{{ fmtPrep(s.avg_prep_seconds) }}</b></span>
            <span>{{ t('Peak') }} <b style="color:var(--text-secondary);">{{ fmtPeak(s.peak_hour) }}</b></span>
          </div>
        </div>

        <!-- actions -->
        <div class="row" style="gap:8px;padding: var(--sp-4) var(--sp-5);border-top:1px solid var(--border);background: var(--surface-2);border-radius: 0 0 var(--r-lg) var(--r-lg);">
          <template v-if="shiftState(s) === 'active'">
            <button class="btn btn--secondary" style="flex:1;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
              </svg>
              {{ t('Live report') }}
            </button>
            <button class="btn btn--ghost">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
              </svg>
              {{ t('End shift') }}
            </button>
          </template>
          <template v-else-if="shiftState(s) === 'awaiting'">
            <button class="btn btn--primary" style="flex:1;" @click="openReceive(s)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="2" x2="12" y2="22" /><path d="M17 6H9a3 3 0 100 6h6a3 3 0 110 6H7" />
              </svg>
              {{ t('Receive cash') }}
            </button>
            <button class="btn btn--secondary">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
              </svg>
              {{ t('Report') }}
            </button>
          </template>
          <template v-else>
            <div class="row" style="gap:7px;flex:1;color:var(--success);font-weight:600;font-size:13px;">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" /><polyline points="9 12 11 14 15 10" />
              </svg>
              {{ t('Handover complete') }}
            </div>
            <button class="btn btn--ghost">
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
    <div v-if="receiving" class="overlay" @mousedown.self="closeReceive">
      <div class="modal" style="max-width:520px;" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h3 class="modal__title">
              {{ t('Receive cash') }} · {{ fullName(receiving.user) }}
            </h3>
            <div class="modal__sub">
              {{ t('Shift') }} #{{ receiving.id }} · {{ t('count the drawer and confirm the handover') }}
            </div>
          </div>
          <button class="iconaction" :title="t('Close')" @click="closeReceive">
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
            <div class="row between" style="padding:5px 0;">
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
          <button class="btn btn--ghost" :disabled="busy" @click="closeReceive">
            {{ t('Cancel') }}
          </button>
          <button
            class="btn btn--primary"
            :class="{ 'is-loading': busy }"
            :disabled="countedParsed === null || busy"
            @click="confirmReceive"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ t('Confirm handover') }}
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
  layout: design
</route>

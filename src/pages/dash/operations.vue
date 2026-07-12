<script setup lang="ts">
// ============================================================
// ALPHA POS - Dashboard 3: Operations / Live
// Ported from .tmp-handoff-v3/.../pages/dash/Operations.jsx.
// Mock data only for now; BE wiring is TODO (see notes below).
// ============================================================
import Card from '@/components/design/Card.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import BarChart from '@/components/design/BarChart.vue'
import StateFill from '@/components/design/StateFill.vue'
import { fmtNum } from '@/components/design/utils/format'
import axiosIns from '@/plugins/axios'
import { useDashboardData } from '@/composables/useDashboardData'
import { businessPreset, buildDateParams } from '@/composables/useBusinessDay'
import { formatWindow } from '@/composables/useWindowLabel'

const { t } = useI18n({ useScope: 'global' })

// Live counts come from /orders/stats (today). Tables-seated stays 0 until BE
// item 17 (/dashboard/operations) ships the table grid. Best-effort: a failed
// fetch just leaves the counts at 0 instead of breaking the page.
interface OrdersStats {
  total_orders?: number
  preparing_orders?: number
  ready_orders?: number
  completed_orders?: number
  paid_orders?: number
  unpaid_orders?: number
}
const ordersStats = ref<OrdersStats>({})

async function loadOrderStats(): Promise<void> {
  try {
    // Scope the "live" counters to TODAY's business day. Without date params the
    // backend aggregates over ALL TIME, so the "Jonli" badges showed ~9k open
    // orders. order_stats reads date_from/date_to, hence { orders: true }.
    const res = await axiosIns.get('/orders/stats', {
      params: buildDateParams({ ...businessPreset('today') }, { orders: true }),
    })
    ordersStats.value = res?.data?.data ?? {}
  }
  catch { /* leave zeros */ }
}

// Status → funnel color/label mapping. BE returns { status, count } per stage.
const FUNNEL_TONE: Record<string, string> = {
  OPEN: 'rgb(var(--v-theme-warning))',
  PAID: 'rgb(var(--v-theme-info))',
  PREPARING: 'rgb(var(--v-theme-info))',
  READY: 'rgb(var(--v-theme-success))',
  COMPLETED: 'rgb(var(--v-theme-success-strong))',
  CANCELED: 'rgb(var(--v-theme-error))',
}

async function loadOperations(): Promise<void> {
  try {
    // Follow the hub's date picker. This used to be called with NO params, so the
    // backend fell back to today's business day — the tab re-fetched on every range
    // change but always returned today, silently ignoring the picker. (The "live"
    // counters above stay pinned to today on purpose; these panels are analytical.)
    const r = sharedRange.value
    const params = (r?.from && r?.to)
      ? buildDateParams({ from: r.from, to: r.to, fromTime: r.fromTime, toTime: r.toTime })
      : buildDateParams({ ...businessPreset('30d') })
    const res = await axiosIns.get('/dashboard/operations', { params })
    const d = res?.data?.data ?? {}
    // Funnel: BE { status, count } → FE { label, value, color }
    if (Array.isArray(d.funnel)) {
      funnelData.value = d.funnel.map((r: any) => ({
        label: t(`order_status_${r.status}`) || r.status,
        value: Number(r.count) || 0,
        color: FUNNEL_TONE[r.status] || 'rgb(var(--v-theme-text-secondary))',
      })).filter((r: any) => r.value > 0)
    }
    // Orders by hour: BE { hour: "09", orders } → FE { hour: 9, label, orders, peak }.
    // Skip the chart entirely if BE returned all zeros (today before noon, e.g.) so we
    // don't paint 14 empty bars; let the empty-state card explain.
    if (Array.isArray(d.ordersByHour)) {
      const max = Math.max(0, ...d.ordersByHour.map((h: any) => Number(h.orders) || 0))
      if (max > 0) {
        ordersByHour.value = d.ordersByHour.map((h: any) => {
          const orders = Number(h.orders) || 0
          return {
            hour: Number(h.hour) || 0,
            label: String(h.hour ?? '').padStart(2, '0'),
            orders,
            peak: orders === max,
          }
        })
      }
    }
    // Prep-by-category: shape from BE matches FE (label, mins, target, orders).
    if (Array.isArray(d.prepByCategory)) {
      prepByCategory.value = d.prepByCategory.map((r: any) => ({
        label: String(r.label ?? ''),
        mins: Number(r.mins) || 0,
        target: Number(r.target) || 0,
        orders: Number(r.orders) || 0,
      }))
    }
    // Table grid: BE { n, status, guests, mins } → FE same. Filter to valid status enum.
    if (Array.isArray(d.tableGrid)) {
      tableGrid.value = d.tableGrid
        .filter((c: any) => ['free', 'seated', 'reserved', 'cleaning'].includes(c.status))
        .map((c: any) => ({
          n: Number(c.n) || 0,
          status: c.status,
          guests: Number(c.guests) || 0,
          mins: Number(c.mins) || 0,
        }))
    }
  }
  catch { /* leave empty arrays; empty-state card renders */ }
}

onMounted(() => {
  void loadOrderStats()
  void loadOperations()
})

// /dashboard/operations IS range-scoped (loadOperations now forwards from/to).
// The "live" counters (loadOrderStats) stay pinned to today on purpose.
const { range: sharedRange } = useDashboardData()
watch(sharedRange, () => {
  void loadOrderStats()
  void loadOperations()
})

// Localized label for the active picker window, so card titles stop claiming
// "today" when the user has selected something else.
const windowLabel = computed(() => formatWindow(sharedRange.value, t))

// Open orders = paid but not completed yet (in-flight) + unpaid. A "live"
// number the manager actually cares about during service.
const openOrdersCount = computed(() => {
  const s = ordersStats.value
  const inflight = (s.preparing_orders ?? 0) + (s.ready_orders ?? 0)
  const unpaid = s.unpaid_orders ?? 0
  return inflight + unpaid
})

// ---- BE-driven data (no mock) ---------------------------------------------
// Pending BACKEND_TODO item 17: /dashboard/operations?today returning:
//   { live_counts: { open_orders, in_kitchen, ready_to_serve, tables_seated },
//     tables: [{ n, status: 'free'|'seated'|'reserved'|'cleaning', guests, mins }],
//     funnel: [{ stage, value }],
//     prep_by_category: [{ label, mins, target, orders }],
//     orders_by_hour: [{ hour, orders, peak }] }
// Until shipped, page renders empty arrays → cards show empty state.
interface TableCell {
  n: number
  status: 'free' | 'seated' | 'reserved' | 'cleaning'
  guests: number
  mins: number
}
const tableGrid = ref<TableCell[]>([])
const seatedCount = computed(() => tableGrid.value.filter(x => x.status === 'seated').length)

interface LiveCount { labelKey: string, value: number, icon: string, tone: 'warning' | 'info' | 'success' | 'primary' }
const liveCounts = computed<LiveCount[]>(() => [
  { labelKey: 'Open orders', value: openOrdersCount.value, icon: 'receipt', tone: 'warning' },
  { labelKey: 'In kitchen', value: ordersStats.value.preparing_orders ?? 0, icon: 'clock', tone: 'info' },
  { labelKey: 'Ready to serve', value: ordersStats.value.ready_orders ?? 0, icon: 'check', tone: 'success' },
  { labelKey: 'Tables seated', value: seatedCount.value, icon: 'table', tone: 'primary' },
])

interface FunnelRow { label: string, value: number, color: string }
const funnelData = ref<FunnelRow[]>([])
// These are order *statuses*, not a strict decreasing funnel — a later stage
// (e.g. Ready) can hold more orders than the first (e.g. Preparing). So the bar
// width is scaled to the largest stage (widest bar = 100% fill) and the badge
// shows each stage's share of all orders, never > 100%.
const funnelMax = computed(() => Math.max(1, ...funnelData.value.map(f => f.value)))
const funnelTotal = computed(() => funnelData.value.reduce((a, f) => a + f.value, 0) || 1)

interface PrepRow { label: string, mins: number, target: number, orders: number }
const prepByCategory = ref<PrepRow[]>([])
// Zero-suppress: when BE hasn't computed prep times yet every row is 0.0m / 0m.
// Rendering a wall of empty bars reads as broken, so treat all-zero as "no data"
// and let the card hide instead.
const prepSorted = computed(() => {
  const rows = prepByCategory.value
  if (!rows.some(d => d.mins > 0 || d.target > 0)) return []
  return rows.slice().sort((a, b) => b.mins - a.mins)
})
const prepMax = computed(() => {
  if (!prepSorted.value.length) return 1
  const m = Math.max(...prepSorted.value.map(d => Math.max(d.mins, d.target)))
  return m * 1.1
})

interface HourPoint { hour: number, label: string, orders: number, peak: boolean }
const ordersByHour = ref<HourPoint[]>([])
const barData = computed(() => ordersByHour.value.map(h => ({ label: h.label, value: h.orders, peak: h.peak })))

// ---- CountUp (lightweight inline) -----------------------------------------
function useCountUp(target: () => number, durationMs = 800) {
  const val = ref(0)
  let raf = 0
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  watch(target, (to) => {
    cancelAnimationFrame(raf)
    if (reduced) { val.value = to; return }
    const from = val.value
    const start = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - k) ** 3
      val.value = from + (to - from) * eased
      if (k < 1) raf = requestAnimationFrame(tick)
      else val.value = to
    }
    raf = requestAnimationFrame(tick)
  }, { immediate: true })
  onBeforeUnmount(() => cancelAnimationFrame(raf))
  return val
}

// ---- intersection-observer mount animation (for PrepByCategory rows) ------
const prepWrap = ref<HTMLElement | null>(null)
const prepShown = ref(false)
onMounted(() => {
  if (!prepWrap.value) return
  const io = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      prepShown.value = true
      io.disconnect()
    }
  }, { threshold: 0.2 })
  io.observe(prepWrap.value)
  onBeforeUnmount(() => io.disconnect())
})

// ---- Gauge geometry (270 deg arc, value 8.3 / max 15) ---------------------
const gauge = computed(() => {
  const size = 190
  const stroke = 16
  const value = 8.3
  const max = 15
  const pct = Math.max(0, Math.min(1, value / max))
  const r = (size - stroke) / 2 - 6
  const cx = size / 2
  const cy = size / 2
  const startA = Math.PI * 0.75
  const endA = Math.PI * 2.25
  const sweep = endA - startA
  const polar = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
  const arcPath = (a0: number, a1: number) => {
    const [x0, y0] = polar(a0)
    const [x1, y1] = polar(a1)
    const large = (a1 - a0) > Math.PI ? 1 : 0
    return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`
  }
  const valA = startA + sweep * pct
  return {
    size, stroke, cx, cy,
    track: arcPath(startA, endA),
    fill: arcPath(startA, valA),
    centerFs: size * 0.17,
    labelFs: size * 0.066,
    labelY: cy + size * 0.12,
  }
})

// ---- ProgressRing helper --------------------------------------------------
interface RingDef { value: number, max?: number, color: string, centerValue?: string, labelKey: string }
const rings: RingDef[] = [
  { value: 94, color: 'var(--success)', labelKey: 'On-time' },
  { value: 86, color: 'var(--primary)', labelKey: 'Paid' },
  { value: 2.8, max: 100, color: 'var(--error)', centerValue: '2.8%', labelKey: 'Cancelled' },
]

function ringGeom(value: number, max = 100) {
  const size = 92
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value / max))
  return { size, stroke, r, c, offset: c * (1 - pct), cxy: size / 2 }
}

// ---- counter live values --------------------------------------------------
// Index-based count-up bindings — each row's count animates from its previous
// value to the latest BE number. The original code captured `c.value` at the
// time of map() (running once at mount) so subsequent ordersStats updates were
// ignored and every counter stayed at 0. Map by index so the closure rereads
// liveCounts.value[i].value on every change.
const liveValues = liveCounts.value.map((_c, i) => useCountUp(() => liveCounts.value[i]?.value ?? 0))
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: var(--sp-6);">
    <!-- pulsing live counters -->
    <div class="grid" style="grid-template-columns: repeat(4, 1fr);">
      <div
        v-for="(c, i) in liveCounts"
        :key="c.labelKey"
        class="herokpi"
      >
        <div class="herokpi__top">
          <span class="herokpi__label">{{ t(c.labelKey) }}</span>
          <span class="herokpi__icon" :class="`t-${c.tone}`">
            <DesignIcon :name="c.icon" :size="17" />
          </span>
        </div>
        <div class="herokpi__value">{{ fmtNum(Math.round(liveValues[i].value)) }}</div>
        <div class="herokpi__foot">
          <span class="badge t-success badge--dot">{{ t('Live') }}</span>
        </div>
      </div>
    </div>

    <!-- Empty-state explainer rendered when none of the BE-item-17 datasets have shipped yet.
         Keeps the page from looking broken behind the live counts strip. -->
    <Card v-if="!funnelData.length && !ordersByHour.length && !prepByCategory.length && !tableGrid.length">
      <div class="card__body">
        <StateFill
          icon="bx-time-five"
          :title="t('Live operations data is coming soon')"
          :sub="t('Detailed funnel, kitchen prep times and table occupancy unlock when the backend operations endpoint ships. Live counts above already update from real orders.')"
        />
      </div>
    </Card>

    <!-- funnel + prep gauge + service rings — only when BE item 17 (/dashboard/operations) ships data -->
    <div v-if="funnelData.length || ordersByHour.length" class="grid" style="grid-template-columns: 1.3fr 1fr;">
      <Card v-if="funnelData.length">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Order pipeline · today') }}</div>
          </div>
        </div>
        <div class="card__body">
          <!-- Funnel (inline) -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div
              v-for="(d, i) in funnelData"
              :key="d.label"
            >
              <div class="row between" style="margin-bottom: 5px;">
                <span style="font-size: 13px; font-weight: 600;">{{ d.label }}</span>
                <span class="row" style="gap: 8px;">
                  <span class="mono" style="font-weight: 700; font-size: 14px;">{{ fmtNum(d.value) }}</span>
                  <span class="badge">{{ Math.round(d.value / funnelTotal * 100) }}%</span>
                </span>
              </div>
              <div style="height: 30px; background: var(--chart-track); border-radius: 8px; overflow: hidden;">
                <div
                  :style="{
                    width: (d.value / funnelMax * 100) + '%',
                    height: '100%',
                    background: d.color,
                    borderRadius: '8px',
                    transition: 'width .7s cubic-bezier(.2,.8,.2,1) ' + (i * 0.08) + 's',
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <!-- Orders-by-hour sits beside the funnel so the row stays balanced
           (the kitchen-speed gauge + fulfilment rings below are disabled until
           BE ships those fields, so they no longer leave empty columns here). -->
      <Card v-if="ordersByHour.length">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Orders by hour · {window}', { window: windowLabel }) }}</div>
          </div>
        </div>
        <div class="card__body">
          <BarChart
            :data="barData"
            :height="250"
            :value-label="t('Orders')"
            :y-format="(v: number) => String(Math.round(v))"
          />
        </div>
      </Card>

      <Card v-if="false">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Kitchen speed') }}</div>
            <h3 class="card__title">{{ t('Avg prep time') }}</h3>
          </div>
        </div>
        <div class="card__body">
          <!-- Gauge (inline SVG, hardcoded 8:20 — disabled until BE ships /dashboard/operations) -->
          <div :style="{ position: 'relative', width: gauge.size + 'px', height: (gauge.size * 0.82) + 'px', margin: '0 auto' }">
            <svg
              :width="gauge.size"
              :height="gauge.size * 0.92"
              :viewBox="`0 0 ${gauge.size} ${gauge.size * 0.92}`"
            >
              <path
                :d="gauge.track"
                fill="none"
                stroke="var(--chart-track)"
                :stroke-width="gauge.stroke"
                stroke-linecap="round"
              />
              <path
                :d="gauge.fill"
                fill="none"
                stroke="var(--success)"
                :stroke-width="gauge.stroke"
                stroke-linecap="round"
                style="transition: all 1s cubic-bezier(.2,.8,.2,1);"
              />
              <text
                :x="gauge.cx"
                :y="gauge.cy - 2"
                text-anchor="middle"
                font-family="var(--font-mono)"
                font-weight="700"
                :font-size="gauge.centerFs"
                fill="var(--text)"
                letter-spacing="-0.02em"
              >8:20</text>
              <text
                :x="gauge.cx"
                :y="gauge.labelY"
                text-anchor="middle"
                :font-size="gauge.labelFs"
                font-weight="600"
                fill="var(--text-secondary)"
              >{{ t('min / order') }}</text>
            </svg>
            <div style="text-align: center; margin-top: -6px; font-size: 13px; color: var(--text-tertiary);">
              {{ t('Target under 12:00') }}
            </div>
          </div>
        </div>
      </Card>

      <!-- Fulfilment rings disabled — values hardcoded 94/86/2.8%. Enable when BE
           ships on_time / paid / cancelled fields on /dashboard/operations. -->
      <Card v-if="false">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Service rings') }}</div>
            <h3 class="card__title">{{ t('Fulfilment') }}</h3>
          </div>
        </div>
        <div class="card__body">
          <div class="row" style="gap: 18px; justify-content: space-around; flex-wrap: wrap;">
            <div
              v-for="r in rings"
              :key="r.labelKey"
              style="text-align: center;"
            >
              <div :style="{ position: 'relative', width: ringGeom(r.value, r.max ?? 100).size + 'px', height: ringGeom(r.value, r.max ?? 100).size + 'px', margin: '0 auto' }">
                <svg
                  :width="ringGeom(r.value, r.max ?? 100).size"
                  :height="ringGeom(r.value, r.max ?? 100).size"
                  style="transform: rotate(-90deg);"
                >
                  <circle
                    :cx="ringGeom(r.value, r.max ?? 100).cxy"
                    :cy="ringGeom(r.value, r.max ?? 100).cxy"
                    :r="ringGeom(r.value, r.max ?? 100).r"
                    fill="none"
                    stroke="var(--chart-track)"
                    :stroke-width="ringGeom(r.value, r.max ?? 100).stroke"
                  />
                  <circle
                    :cx="ringGeom(r.value, r.max ?? 100).cxy"
                    :cy="ringGeom(r.value, r.max ?? 100).cxy"
                    :r="ringGeom(r.value, r.max ?? 100).r"
                    fill="none"
                    :stroke="r.color"
                    :stroke-width="ringGeom(r.value, r.max ?? 100).stroke"
                    stroke-linecap="round"
                    :stroke-dasharray="ringGeom(r.value, r.max ?? 100).c"
                    :stroke-dashoffset="ringGeom(r.value, r.max ?? 100).offset"
                    style="transition: stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1);"
                  />
                </svg>
                <div style="position: absolute; inset: 0; display: grid; place-items: center;">
                  <span class="mono" style="font-weight: 700; font-size: 18px; line-height: 1;">
                    {{ r.centerValue ?? Math.round(r.value) + '%' }}
                  </span>
                </div>
              </div>
              <div class="muted" style="font-size: 12px; margin-top: 8px;">{{ t(r.labelKey) }}</div>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- prep by category + table occupancy — only when their data arrives -->
    <div v-if="prepSorted.length || tableGrid.length" class="grid" style="grid-template-columns: 1fr 1fr;">
      <Card v-if="prepSorted.length">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Avg prep time by category') }}</div>
          </div>
        </div>
        <div class="card__body">
          <!-- PrepByCategory (inline) -->
          <div
            ref="prepWrap"
            style="display: flex; flex-direction: column; gap: 13px;"
          >
            <div
              v-for="(d, i) in prepSorted"
              :key="d.label"
            >
              <div class="row between" style="margin-bottom: 5px;">
                <span style="font-size: 13px; font-weight: 600;">{{ d.label }}</span>
                <span class="row" style="gap: 8px; font-size: 12px;">
                  <span
                    class="mono"
                    :style="{ fontWeight: 700, color: d.mins > d.target ? 'var(--error)' : 'var(--success)' }"
                  >{{ d.mins.toFixed(1) }}m</span>
                  <span class="tertiary mono">/ {{ d.target }}m</span>
                </span>
              </div>
              <div style="position: relative; height: 12px; background: var(--chart-track); border-radius: 99px;">
                <div
                  :style="{
                    position: 'absolute', inset: 0,
                    width: (prepShown ? (d.mins / prepMax * 100) : 0) + '%',
                    background: d.mins > d.target ? 'var(--error)' : 'var(--success)',
                    borderRadius: '99px',
                    transition: 'width .6s cubic-bezier(.2,.8,.2,1) ' + (i * 0.04) + 's',
                  }"
                />
                <div
                  :style="{
                    position: 'absolute', top: '-3px', bottom: '-3px',
                    left: (d.target / prepMax * 100) + '%',
                    width: '2.5px', borderRadius: '2px',
                    background: 'var(--text)', opacity: 0.5,
                  }"
                  :title="t('Target') + ' ' + d.target + 'm'"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card v-if="tableGrid.length">
        <div class="card__head between">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Floor · {n} tables', { n: tableGrid.length }) }}</div>
            <h3 class="card__title">{{ t('Table occupancy') }}</h3>
          </div>
          <div class="row" style="gap: 10px; font-size: 11px;">
            <span class="row" style="gap: 4px;">
              <span style="width: 9px; height: 9px; border-radius: 3px; background: var(--success);" />
              {{ t('Seated') }}
            </span>
            <span class="row" style="gap: 4px;">
              <span style="width: 9px; height: 9px; border-radius: 3px; background: var(--warning);" />
              {{ t('Reserved') }}
            </span>
          </div>
        </div>
        <div class="card__body">
          <div class="tablegrid">
            <div
              v-for="cell in tableGrid"
              :key="cell.n"
              class="tablecell"
              :class="`s-${cell.status}`"
              :title="cell.status"
            >
              <span class="tablecell__n">{{ cell.n }}</span>
              <span class="tablecell__m">
                {{ cell.status === 'seated' ? `${cell.guests}p · ${cell.mins}m` : cell.status }}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

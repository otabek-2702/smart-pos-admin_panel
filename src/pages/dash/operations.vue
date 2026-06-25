<script setup lang="ts">
// ============================================================
// ALPHA POS - Dashboard 3: Operations / Live
// Ported from .tmp-handoff-v3/.../pages/dash/Operations.jsx.
// Mock data only for now; BE wiring is TODO (see notes below).
// ============================================================
import Card from '@/components/design/Card.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import BarChart from '@/components/design/BarChart.vue'
import { fmtNum } from '@/components/design/utils/format'

const { t } = useI18n({ useScope: 'global' })

// ---- mock data (TODO: wire to BE) -----------------------------------------
// TODO(backend): /orders/stats?today + /kitchen/queue -> openOrders, inKitchen,
// readyToServe; /tables/state -> tableGrid.
interface TableCell {
  n: number
  status: 'free' | 'seated' | 'reserved' | 'cleaning'
  guests: number
  mins: number
}
const tableStatuses: TableCell['status'][] = [
  'seated', 'seated', 'free', 'seated',
  'reserved', 'free', 'seated', 'cleaning',
  'seated', 'free', 'seated', 'seated',
  'reserved', 'free', 'seated', 'seated',
]
const tableGrid = computed<TableCell[]>(() =>
  tableStatuses.map((status, i) => ({
    n: i + 1,
    status,
    guests: status === 'seated' ? 2 + (i % 4) : 0,
    mins: status === 'seated' ? 12 + (i * 7) % 70 : 0,
  })),
)

const seatedCount = computed(() => tableGrid.value.filter(x => x.status === 'seated').length)

interface LiveCount { labelKey: string, value: number, icon: string, tone: 'warning' | 'info' | 'success' | 'primary' }
const liveCounts = computed<LiveCount[]>(() => [
  { labelKey: 'Open orders', value: 5, icon: 'receipt', tone: 'warning' },
  { labelKey: 'In kitchen', value: 3, icon: 'clock', tone: 'info' },
  { labelKey: 'Ready to serve', value: 2, icon: 'check', tone: 'success' },
  { labelKey: 'Tables seated', value: seatedCount.value, icon: 'table', tone: 'primary' },
])

// TODO(backend): /orders/funnel?today
interface FunnelRow { label: string, value: number, color: string }
const funnelData: FunnelRow[] = [
  { label: 'Orders placed', value: 2555, color: 'rgb(var(--v-theme-c1, 58 91 219))' },
  { label: 'Accepted by kitchen', value: 2488, color: 'rgb(var(--v-theme-c4, 58 91 219))' },
  { label: 'Prepared', value: 2471, color: 'var(--primary)' },
  { label: 'Served', value: 2455, color: 'var(--success)' },
  { label: 'Paid', value: 2417, color: 'var(--success-strong)' },
]

// TODO(backend): /kitchen/prep-by-category?today
interface PrepRow { label: string, mins: number, target: number, orders: number }
const prepByCategory: PrepRow[] = [
  { label: 'Hot Dogs', mins: 5.2, target: 8, orders: 190 },
  { label: 'Drinks', mins: 1.4, target: 4, orders: 612 },
  { label: 'Lavash', mins: 7.8, target: 9, orders: 401 },
  { label: 'Burgers', mins: 9.1, target: 9, orders: 318 },
  { label: 'Pizza', mins: 13.4, target: 12, orders: 207 },
  { label: 'Salads', mins: 3.6, target: 5, orders: 144 },
]
const prepSorted = computed(() =>
  prepByCategory.slice().sort((a, b) => b.mins - a.mins),
)
const prepMax = computed(() => {
  const m = Math.max(...prepSorted.value.map(d => Math.max(d.mins, d.target)))
  return m * 1.1
})

// TODO(backend): /orders/by-hour?today
interface HourPoint { hour: number, label: string, orders: number, peak: boolean }
const hours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]
const hourCounts = [4, 9, 14, 11, 7, 6, 12, 18, 23, 16, 9, 5]
const ordersByHour = computed<HourPoint[]>(() =>
  hours.map((h, i) => ({
    hour: h,
    label: `${h < 10 ? `0${h}` : h}:00`,
    orders: hourCounts[i],
    peak: h === 19,
  })),
)
const barData = computed(() =>
  ordersByHour.value.map(h => ({ label: h.label, value: h.orders, peak: h.peak })),
)

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
const liveValues = liveCounts.value.map(c => useCountUp(() => c.value))
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

    <!-- funnel + prep gauge + service rings -->
    <div class="grid" style="grid-template-columns: 1.3fr 1fr 1fr;">
      <Card>
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Order pipeline · today') }}</div>
            <h3 class="card__insight">{{ t('94% of orders close cleanly') }}</h3>
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
                  <span class="badge">{{ i === 0 ? 100 : Math.round(d.value / funnelData[0].value * 100) }}%</span>
                </span>
              </div>
              <div style="height: 30px; background: var(--chart-track); border-radius: 8px; overflow: hidden;">
                <div
                  :style="{
                    width: (d.value / funnelData[0].value * 100) + '%',
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

      <Card>
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Kitchen speed') }}</div>
            <h3 class="card__title">{{ t('Avg prep time') }}</h3>
          </div>
        </div>
        <div class="card__body">
          <!-- Gauge (inline SVG) -->
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

      <Card>
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

    <!-- prep by category + table occupancy -->
    <div class="grid" style="grid-template-columns: 1fr 1fr;">
      <Card>
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Avg prep time by category') }}</div>
            <h3 class="card__insight">{{ t('Pizza runs over target') }}</h3>
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

      <Card>
        <div class="card__head between">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Floor · 16 tables') }}</div>
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

    <!-- orders by hour full width -->
    <Card>
      <div class="card__head">
        <div class="card__head-text">
          <div class="kpi__label">{{ t('Orders by hour · today') }}</div>
          <h3 class="card__insight">{{ t('Peak trade at 19:00') }}</h3>
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
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

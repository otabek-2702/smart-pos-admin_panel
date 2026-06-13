<script setup lang="ts">
import axios from '@/plugins/axios'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

// ====================================================================
// Inline format helpers (no external file — keeps page self-contained)
// ====================================================================
const NB = ' '
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'
  const neg = n < 0
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NB)

  return (neg ? '-' : '') + s
}
function fmtAbbr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n))
    return '—'
  const a = Math.abs(n)
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, '')
  const trim1 = (x: number) => x.toFixed(1).replace(/\.0$/, '')
  let out: string
  if (a >= 1e9) out = `${trim(a / 1e9)}B`
  else if (a >= 1e6) out = `${trim(a / 1e6)}M`
  else if (a >= 1e3) out = `${trim1(a / 1e3)}K`
  else out = String(Math.round(a))

  return (n < 0 ? '-' : '') + out
}
function fmtMoney(n: number | null | undefined): string {
  return fmtNum(n)
}
function fmtTime(d: string | null | undefined): string {
  if (!d) return '—'
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  const p = (v: number) => v < 10 ? `0${v}` : `${v}`

  return `${p(x.getHours())}:${p(x.getMinutes())}`
}
function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  const p = (v: number) => v < 10 ? `0${v}` : `${v}`

  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}, ${p(x.getHours())}:${p(x.getMinutes())}`
}

// ====================================================================
// Data wiring
// ====================================================================
const loading = ref(true)
const data = ref<any>(null)
const recentOrders = ref<any[]>([])
const recentOrdersLoading = ref(true)

async function load() {
  loading.value = true
  try {
    const res = await axios.get('/dashboard/today')
    data.value = res.data?.data ?? res.data
  }
  catch { data.value = null }
  finally { loading.value = false }
}

async function loadRecentOrders() {
  recentOrdersLoading.value = true
  try {
    const res = await axios.get('/orders', { params: { per_page: 5, page: 1 } })
    const d = res.data?.data ?? res.data
    recentOrders.value = d?.orders ?? d?.items ?? (Array.isArray(d) ? d : [])
  }
  catch { recentOrders.value = [] }
  finally { recentOrdersLoading.value = false }
}

onMounted(() => { load(); loadRecentOrders() })
function refresh() { load(); loadRecentOrders() }

const today = computed(() => data.value?.today ?? null)
const paymentBreakdown = computed(() => data.value?.payment_breakdown_today ?? {})
const topProducts = computed<any[]>(() => data.value?.top_products_today ?? [])
const lowStockCount = computed(() => data.value?.low_stock_count ?? null)
const clockedIn = computed<any[]>(() => data.value?.clocked_in ?? [])

const aov = computed(() => {
  if (!today.value) return null
  const paid = Number(today.value.paid_orders) || 0
  const rev = Number(today.value.revenue) || 0
  return paid ? Math.round(rev / paid) : 0
})
const paidPct = computed(() => {
  if (!today.value) return null
  const total = Number(today.value.orders) || 0
  return total ? Math.round(((Number(today.value.paid_orders) || 0) / total) * 100) : 0
})

const PAYMENT_PALETTE = ['#3A5BDB', '#15935A', '#E0823C', '#6E8BFF', '#9AA3B2', '#8A929E']
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', UZCARD: 'UzCard', HUMO: 'Humo',
  PAYME: 'Payme', CLICK: 'Click', MIXED: 'Mixed',
}
const paymentMix = computed(() => {
  return Object.entries(paymentBreakdown.value)
    .map(([k, v], i) => ({
      label: PAYMENT_LABELS[k] ?? k,
      value: Number(v) || 0,
      color: PAYMENT_PALETTE[i % PAYMENT_PALETTE.length],
    }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value)
})
const paymentTotal = computed(() => paymentMix.value.reduce((a, b) => a + b.value, 0))
const paymentInsight = computed(() => {
  if (!paymentMix.value.length) return 'No paid orders yet'
  const t = paymentTotal.value || 1
  const top = paymentMix.value[0]
  return `${top.label} leads at ${Math.round(top.value / t * 100)}%`
})

const topProductsForChart = computed(() =>
  topProducts.value.slice(0, 5).map((p: any) => ({
    name: p.product_name,
    value: Number(p.revenue) || 0,
    units: Number(p.quantity) || 0,
  })),
)
const topProductInsight = computed(() =>
  topProductsForChart.value.length
    ? `${topProductsForChart.value[0].name} leads revenue`
    : 'No sales yet today',
)
const topProductMax = computed(() => Math.max(1, ...topProductsForChart.value.map(p => p.value)))

const peakHourLabel = computed(() => {
  const h = today.value?.peak_hour
  if (h === null || h === undefined) return null
  return `${String(h).padStart(2, '0')}:00`
})
const ordersByHourInsight = computed(() =>
  peakHourLabel.value ? `Peak trade at ${peakHourLabel.value}` : 'No orders today yet',
)

const todayDateLine = computed(() => `Today's snapshot · ${fmtDateTime(new Date())}`)

// ====================================================================
// Donut arcs (inline SVG)
// ====================================================================
const DONUT_SIZE = 188
const donutHover = ref<number | null>(null)
const donutArcs = computed(() => {
  const R = DONUT_SIZE / 2, r = R * 0.62, cx = R, cy = R, gap = 0.018
  let acc = -0.25
  const total = paymentTotal.value || 1
  return paymentMix.value.map(d => {
    const frac = d.value / total
    const a0 = acc * 2 * Math.PI + gap * Math.PI
    const a1 = (acc + frac) * 2 * Math.PI - gap * Math.PI
    acc += frac
    const big = (a1 - a0) > Math.PI ? 1 : 0
    const p = (ang: number, rad: number) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]
    const o0 = p(a0, R), o1 = p(a1, R), i1 = p(a1, r), i0 = p(a0, r)
    return {
      path: `M${o0[0]} ${o0[1]} A${R} ${R} 0 ${big} 1 ${o1[0]} ${o1[1]} L${i1[0]} ${i1[1]} A${r} ${r} 0 ${big} 0 ${i0[0]} ${i0[1]} Z`,
      pct: Math.round(frac * 100),
      d,
    }
  })
})

// ====================================================================
// Status pill tone
// ====================================================================
function statusTone(v: string): string {
  const u = (v || '').toUpperCase()
  if (['ACTIVE', 'COMPLETED', 'READY', 'PAID'].includes(u)) return 'success'
  if (['PREPARING', 'PENDING'].includes(u)) return 'warning'
  if (['CANCELLED', 'CANCELED', 'UNPAID', 'FAILED'].includes(u)) return 'error'
  if (['CASHIER', 'DELIVERY'].includes(u)) return 'info'
  if (['MANAGER', 'ADMIN', 'PICKUP'].includes(u)) return 'primary'
  return 'neutral'
}
function titleCase(v: any): string {
  if (!v) return '—'
  const s = String(v)
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
</script>

<template>
  <div class="dash">
    <!-- Page header -->
    <div class="head">
      <div>
        <h1 class="head__title">
          {{ t('Dashboard') }}
        </h1>
        <div class="head__sub">
          {{ todayDateLine }}
        </div>
      </div>
      <div class="head__actions">
        <button
          class="btn btn--secondary"
          :disabled="loading"
          @click="refresh"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3-6.7" /><polyline points="21 4 21 11 14 11" /></svg>
          {{ t('Refresh') }}
        </button>
      </div>
    </div>

    <!-- Row 1: 4 KPI cards -->
    <div class="grid cols-4 mb-5">
      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-success">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>
          </div>
          <div class="kpi__label">
            {{ t(`Today's Revenue`) }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:140px;height:30px;border-radius:4px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(Number(today?.revenue ?? 0)) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__sub">
          {{ today?.paid_orders ?? 0 }} paid
        </div>
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12l-2 20H8L6 2zM8 7h8M8 12h8M8 17h8" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Orders Today') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:30px;border-radius:4px;" />
        <div v-else class="kpi__value">
          {{ today?.orders ?? 0 }}
        </div>
        <div class="kpi__sub">
          {{ today?.open ?? 0 }} open
        </div>
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div class="kpi__icon t-info">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Avg Order Value') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:120px;height:30px;border-radius:4px;" />
        <div v-else class="kpi__value">
          {{ fmtAbbr(aov ?? 0) }}<span class="kpi__unit">UZS</span>
        </div>
        <div class="kpi__sub">
          {{ t('per paid order') }}
        </div>
      </div>

      <div class="kpi">
        <div class="kpi__top">
          <div
            class="kpi__icon"
            :class="lowStockCount && lowStockCount > 0 ? 't-warning' : 't-success'"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zM2 7l10 5 10-5M12 22V12" /></svg>
          </div>
          <div class="kpi__label">
            {{ t('Low Stock Items') }}
          </div>
        </div>
        <div v-if="loading" class="skel" style="width:60px;height:30px;border-radius:4px;" />
        <div v-else class="kpi__value">
          {{ lowStockCount ?? 0 }}
        </div>
        <div class="kpi__sub">
          {{ lowStockCount && lowStockCount > 0 ? t('needs reorder') : t('all stocked') }}
        </div>
      </div>
    </div>

    <!-- Row 2: secondary mini KPIs -->
    <div class="grid cols-4 mb-5">
      <div class="kpi-mini">
        <div class="kpi-mini__label">
          {{ t('Open orders') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;border-radius:4px;" />
        <div v-else class="kpi-mini__value" style="color: rgb(var(--v-theme-primary));">
          {{ today?.open ?? 0 }}
        </div>
      </div>
      <div class="kpi-mini">
        <div class="kpi-mini__label">
          {{ t('Cancelled') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;border-radius:4px;" />
        <div v-else class="kpi-mini__value" style="color: rgb(var(--v-theme-error));">
          {{ today?.cancelled ?? 0 }}
        </div>
      </div>
      <div class="kpi-mini">
        <div class="kpi-mini__label">
          {{ t('Paid') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;border-radius:4px;" />
        <div v-else class="kpi-mini__value" style="color: rgb(var(--v-theme-success));">
          {{ paidPct ?? 0 }}%
        </div>
        <div class="kpi-mini__sub">
          {{ today?.paid_orders ?? 0 }}/{{ today?.orders ?? 0 }}
        </div>
      </div>
      <div class="kpi-mini">
        <div class="kpi-mini__label">
          {{ t('Clocked in') }}
        </div>
        <div v-if="loading" class="skel" style="width:80px;height:24px;border-radius:4px;" />
        <div v-else class="kpi-mini__value" style="color: rgb(var(--v-theme-info));">
          {{ clockedIn.length }}
        </div>
      </div>
    </div>

    <!-- Row 3: payment mix donut (full width — revenue trend hidden until BE ships) -->
    <div class="grid cols-1 mb-5">
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="card__eyebrow">
              Payment mix · today
            </div>
            <h3 class="card__insight">
              {{ paymentInsight }}
            </h3>
            <div class="card__sub">
              Share of paid revenue by method
            </div>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="skel" :style="`width:${DONUT_SIZE}px;height:${DONUT_SIZE}px;border-radius:50%;margin:0 auto;`" />
          <div v-else-if="!paymentMix.length" class="empty">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12A9 9 0 1112 3v9h9z" /></svg>
            <div>No data for this range</div>
          </div>
          <div v-else class="donut-wrap">
            <svg :width="DONUT_SIZE" :height="DONUT_SIZE">
              <path
                v-for="(a, i) in donutArcs"
                :key="i"
                :d="a.path"
                :fill="a.d.color"
                :opacity="donutHover !== null && donutHover !== i ? 0.4 : 1"
                @mouseenter="donutHover = i"
                @mouseleave="donutHover = null"
              />
              <text :x="DONUT_SIZE / 2" :y="DONUT_SIZE / 2 - 4" text-anchor="middle" font-size="22" font-weight="700" fill="rgb(var(--v-theme-on-surface))" font-family="var(--font-mono)">{{ fmtAbbr(paymentTotal) }}</text>
              <text :x="DONUT_SIZE / 2" :y="DONUT_SIZE / 2 + 16" text-anchor="middle" font-size="11" fill="rgb(var(--v-theme-text-secondary))">Collected</text>
            </svg>
            <div class="donut-legend">
              <div
                v-for="(a, i) in donutArcs"
                :key="i"
                class="donut-legend__row"
                :style="{ opacity: donutHover !== null && donutHover !== i ? 0.5 : 1 }"
              >
                <span class="legend-item">
                  <span class="legend-swatch" :style="{ background: a.d.color }" />
                  {{ a.d.label }}
                </span>
                <span class="legend-vals">
                  <b class="mono">{{ fmtAbbr(a.d.value) }}</b>
                  <span class="legend-pct">{{ a.pct }}%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 4: top products HBar -->
    <div class="grid cols-1 mb-5">
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <div class="card__eyebrow">
              Top products · today
            </div>
            <h3 class="card__insight">
              {{ topProductInsight }}
            </h3>
            <div class="card__sub">
              By revenue contribution
            </div>
          </div>
        </div>
        <div class="card__body">
          <div v-if="loading" class="hbar-list">
            <div v-for="i in 5" :key="i" class="skel" style="height:26px;" />
          </div>
          <div v-else-if="!topProductsForChart.length" class="empty">
            <div>{{ topProductInsight }}</div>
          </div>
          <div v-else class="hbar-list">
            <div v-for="(d, i) in topProductsForChart" :key="i" class="hbar-row">
              <div class="hbar-head">
                <span class="hbar-name">
                  <svg v-if="i === 0" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="color: rgb(var(--v-theme-warning));"><path d="M12 2L14.6 8.6 21.5 9.1 16.2 13.5 17.8 20.3 12 16.7 6.2 20.3 7.8 13.5 2.5 9.1 9.4 8.6Z" /></svg>
                  {{ d.name }}
                  <span v-if="d.units" class="hbar-units">· {{ d.units }} units</span>
                </span>
                <span class="hbar-val">{{ fmtAbbr(d.value) }}</span>
              </div>
              <div class="hbar-track">
                <div
                  class="hbar-fill"
                  :style="{
                    width: `${(d.value / topProductMax) * 100}%`,
                    background: i === 0 ? 'rgb(var(--v-theme-chart-revenue))' : 'rgb(var(--v-theme-c4))',
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 5: recent orders + side column -->
    <div class="grid grid--2col">
      <div class="card">
        <div class="card__head">
          <div class="card__head-text">
            <h3 class="card__title">
              {{ t('Recent orders') }}
            </h3>
            <div class="card__sub">
              {{ t('Latest activity today') }}
            </div>
          </div>
          <button class="link-btn" @click="router.push('/orders')">
            {{ t('View all') }} →
          </button>
        </div>
        <div class="divider" />
        <div v-if="recentOrdersLoading" style="padding:20px;display:flex;flex-direction:column;gap:14px;">
          <div v-for="i in 5" :key="i" class="skel" style="height:18px;" />
        </div>
        <div v-else-if="!recentOrders.length" class="empty">
          <div>No orders yet today</div>
        </div>
        <table v-else class="dtable">
          <thead>
            <tr>
              <th>{{ t('Order') }}</th>
              <th>{{ t('Type') }}</th>
              <th>{{ t('Status') }}</th>
              <th>{{ t('Payment') }}</th>
              <th class="num">
                {{ t('Total') }}
              </th>
              <th class="num">
                {{ t('Time') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in recentOrders" :key="o.id">
              <td class="cell-strong mono">
                #{{ o.display_id ?? o.id }}
              </td>
              <td>
                <span class="badge t-neutral">{{ titleCase(o.order_type ?? 'HALL') }}</span>
              </td>
              <td>
                <span class="badge badge--dot" :class="`t-${statusTone(o.status)}`">{{ titleCase(o.status) }}</span>
              </td>
              <td>
                <span class="badge" :class="`t-${statusTone(o.is_paid ? 'PAID' : 'UNPAID')}`">{{ o.is_paid ? 'Paid' : 'Unpaid' }}</span>
              </td>
              <td class="num mono cell-strong">
                {{ fmtMoney(Number(o.total_amount) || 0) }}
              </td>
              <td class="num mono cell-muted">
                {{ fmtTime(o.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="side-col">
        <div class="card">
          <div class="card__head card__head--tight">
            <h3 class="card__title">
              {{ t('Clocked In') }}
            </h3>
            <span class="badge t-primary">{{ clockedIn.length }} active</span>
          </div>
          <div class="card__body card__body--tight">
            <div v-if="loading" style="display:flex;flex-direction:column;gap:10px;">
              <div v-for="i in 2" :key="i" class="skel" style="height:40px;" />
            </div>
            <div v-else-if="!clockedIn.length" class="empty">
              <div>{{ t('No one on shift') }}</div>
            </div>
            <div
              v-for="c in clockedIn"
              v-else
              :key="c.shift_id ?? c.name"
              class="clockin-row"
              @click="router.push('/shifts-analytics')"
            >
              <div class="av">
                {{ ((c.name ?? '?').trim()[0] || '?').toUpperCase() }}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:14px;color:rgb(var(--v-theme-on-surface));">
                  {{ c.name }}
                </div>
                <div style="font-size:12px;color:rgb(var(--v-theme-text-tertiary));">
                  {{ t('Since') }} {{ fmtDateTime(c.start_time) }}
                </div>
              </div>
              <span class="badge badge--dot t-success">{{ t('On shift') }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head card__head--tight">
            <h3 class="card__title">
              {{ t('Low stock') }}
            </h3>
            <span class="badge t-warning">{{ lowStockCount ?? 0 }} items</span>
          </div>
          <div class="card__body card__body--tight">
            <div class="empty">
              <div>{{ t('Detailed list pending') }}</div>
              <button class="link-btn" style="margin-top:8px;" @click="router.push('/stock/items')">
                {{ t('View items') }} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dash {
  padding: 32px;
  max-width: 1440px;
  margin: 0 auto;
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;

  &__title {
    font-size: 24px;
    line-height: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
    color: rgb(var(--v-theme-on-surface));
  }
  &__sub {
    color: rgb(var(--v-theme-text-secondary));
    font-size: 13px;
    margin-top: 4px;
  }
  &__actions {
    margin-left: auto;
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  border: 1px solid transparent;
  cursor: pointer;
  font-family: inherit;
  background: transparent;

  &--secondary {
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-on-surface));
    border-color: rgb(var(--v-theme-border-strong));
  }
  &--secondary:hover {
    background: rgb(var(--v-theme-surface-2));
  }
}

.link-btn {
  background: transparent;
  border: 0;
  color: rgb(var(--v-theme-text-secondary));
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 6px;
}
.link-btn:hover { background: rgb(var(--v-theme-surface-2)); color: rgb(var(--v-theme-on-surface)); }

.grid {
  display: grid;
  gap: 20px;
}
.cols-1 { grid-template-columns: 1fr; }
.cols-4 { grid-template-columns: repeat(4, 1fr); }
.grid--2col { grid-template-columns: 1.7fr 1fr; }

@media (max-width: 1100px) {
  .cols-4 { grid-template-columns: repeat(2, 1fr); }
  .grid--2col { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .cols-4 { grid-template-columns: 1fr; }
}
.mb-5 { margin-bottom: 20px; }

/* ============================================================
   KPI cards
   ============================================================ */
.kpi {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: box-shadow .16s, border-color .16s;

  &:hover {
    border-color: rgb(var(--v-theme-border-strong));
  }
  &__top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  &__icon {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    flex: 0 0 38px;

    &.t-primary { background: rgb(var(--v-theme-primary-weak)); color: rgb(var(--v-theme-primary)); }
    &.t-success { background: rgb(var(--v-theme-success-weak)); color: rgb(var(--v-theme-success)); }
    &.t-warning { background: rgb(var(--v-theme-warning-weak)); color: rgb(var(--v-theme-warning)); }
    &.t-error { background: rgb(var(--v-theme-error-weak)); color: rgb(var(--v-theme-error)); }
    &.t-info { background: rgb(var(--v-theme-info-weak)); color: rgb(var(--v-theme-info)); }
  }
  &__label {
    font-size: 13px;
    color: rgb(var(--v-theme-text-secondary));
    font-weight: 500;
  }
  &__value {
    font-family: var(--font-mono);
    font-size: 30px;
    line-height: 36px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: rgb(var(--v-theme-on-surface));
  }
  &__unit {
    font-size: 13px;
    color: rgb(var(--v-theme-text-tertiary));
    font-weight: 500;
    font-family: var(--font-sans);
    margin-left: 4px;
  }
  &__sub {
    font-size: 13px;
    color: rgb(var(--v-theme-text-tertiary));
    margin-top: 8px;
  }
}

.kpi-mini {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 14px;
  padding: 16px 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  &__label {
    font-size: 13px;
    color: rgb(var(--v-theme-text-secondary));
    font-weight: 500;
    margin-bottom: 6px;
  }
  &__value {
    font-family: var(--font-mono);
    font-size: 24px;
    line-height: 32px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  &__sub {
    font-size: 13px;
    color: rgb(var(--v-theme-text-tertiary));
    margin-top: 4px;
  }
}

/* ============================================================
   Cards
   ============================================================ */
.card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}
.card__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 20px 16px;

  &--tight { padding-bottom: 12px; }
}
.card__head-text { min-width: 0; }
.card__eyebrow {
  font-size: 13px;
  color: rgb(var(--v-theme-text-secondary));
  font-weight: 500;
  margin-bottom: 3px;
}
.card__title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
  color: rgb(var(--v-theme-on-surface));
}
.card__insight {
  font-size: 19px;
  line-height: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}
.card__sub {
  font-size: 13px;
  color: rgb(var(--v-theme-text-secondary));
  margin-top: 3px;
}
.card__body {
  padding: 0 20px 20px;
  &--tight { padding-top: 0; }
}
.divider {
  height: 1px;
  background: rgb(var(--v-theme-border));
}

/* ============================================================
   Skeleton
   ============================================================ */
.skel {
  background: linear-gradient(
    90deg,
    rgba(var(--v-theme-on-surface), 0.06) 25%,
    rgba(var(--v-theme-on-surface), 0.12) 37%,
    rgba(var(--v-theme-on-surface), 0.06) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
  border-radius: 6px;
}
@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}

/* ============================================================
   Donut
   ============================================================ */
.donut-wrap {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}
.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 200px;
}
.donut-legend__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: opacity .12s;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: rgb(var(--v-theme-text-secondary));
  font-weight: 500;
}
.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.legend-vals {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.legend-vals b {
  font-size: 13px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}
.legend-pct {
  font-family: var(--font-mono);
  font-size: 12px;
  width: 38px;
  text-align: right;
  color: rgb(var(--v-theme-text-tertiary));
}

/* ============================================================
   HBar chart
   ============================================================ */
.hbar-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hbar-row { }
.hbar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.hbar-name {
  font-weight: 500;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: rgb(var(--v-theme-on-surface));
}
.hbar-units {
  font-size: 12px;
  color: rgb(var(--v-theme-text-tertiary));
}
.hbar-val {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface));
}
.hbar-track {
  height: 10px;
  border-radius: 99px;
  background: rgb(var(--v-theme-chart-track));
  overflow: hidden;
}
.hbar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width .5s cubic-bezier(.2, .8, .3, 1);
}

/* ============================================================
   Empty state
   ============================================================ */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  padding: 40px 20px;
  color: rgb(var(--v-theme-text-secondary));
  font-size: 13px;

  svg { color: rgb(var(--v-theme-text-tertiary)); }
}

/* ============================================================
   Badge / status pill
   ============================================================ */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 9px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;

  &--dot::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 99px;
    background: currentColor;
  }
  &.t-success { background: rgb(var(--v-theme-success-weak)); color: rgb(var(--v-theme-success-strong)); border-color: rgb(var(--v-theme-success-border)); }
  &.t-warning { background: rgb(var(--v-theme-warning-weak)); color: rgb(var(--v-theme-warning-strong)); border-color: rgb(var(--v-theme-warning-border)); }
  &.t-error { background: rgb(var(--v-theme-error-weak)); color: rgb(var(--v-theme-error-strong)); border-color: rgb(var(--v-theme-error-border)); }
  &.t-info { background: rgb(var(--v-theme-info-weak)); color: rgb(var(--v-theme-info-strong)); border-color: rgb(var(--v-theme-info-border)); }
  &.t-primary { background: rgb(var(--v-theme-primary-weak)); color: rgb(var(--v-theme-primary)); border-color: rgb(var(--v-theme-primary-border)); }
  &.t-neutral { background: rgb(var(--v-theme-neutral-weak)); color: rgb(var(--v-theme-text-secondary)); border-color: rgb(var(--v-theme-neutral-border)); }
}

/* ============================================================
   Data table
   ============================================================ */
.dtable {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
}
.dtable thead th {
  background: rgb(var(--v-theme-surface-2));
  color: rgb(var(--v-theme-text-secondary));
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
  padding: 12px 16px;
  white-space: nowrap;
  border-bottom: 1px solid rgb(var(--v-theme-border));
}
.dtable th.num, .dtable td.num { text-align: right; }
.dtable tbody td {
  padding: 14px 16px;
  border-bottom: 1px solid rgb(var(--v-theme-border));
  color: rgb(var(--v-theme-on-surface));
}
.dtable tbody tr:last-child td { border-bottom: 0; }
.dtable tbody tr:hover { background: rgb(var(--v-theme-surface-2)); }
.dtable .cell-strong { font-weight: 600; }
.dtable .cell-muted { color: rgb(var(--v-theme-text-secondary)); }
.dtable .mono {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
}

/* ============================================================
   Side column / clocked-in
   ============================================================ */
.side-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.clockin-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  cursor: pointer;
  border-radius: 8px;
}
.clockin-row:hover {
  background: rgb(var(--v-theme-surface-2));
  padding-inline: 6px;
  margin-inline: -6px;
}
.av {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary-weak));
  color: rgb(var(--v-theme-primary));
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 600;
  flex: 0 0 28px;
}

.mono {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

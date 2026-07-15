<script setup lang="ts">
/* ============================================================
   ALPHA POS — Products & Menu performance dashboard (v3 port)
   Source: .tmp-handoff-v3/.../pages/dash/Products.jsx
   Sister page to dash/executive.vue. Reuses ported design primitives:
     - Kpi.vue              → HeroKpi tiles (string→number coercion baked in)
     - DonutChart.vue       → category share donut
     - Treemap.vue          → revenue composition treemap (new this port)
     - ComboPareto.vue      → pareto chart (new this port)
     - Sparkline.vue        → in-row sparkline (new this port)
     - Delta.vue            → trend pill
   Charts are pure-Vue SVG, no chart libs.
   ============================================================ */
import axiosIns from '@/plugins/axios'
import Card from '@/components/design/Card.vue'
import Kpi from '@/components/design/Kpi.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import Delta from '@/components/design/Delta.vue'
import DonutChart from '@/components/design/DonutChart.vue'
import Treemap from '@/components/design/Treemap.vue'
import ComboPareto from '@/components/design/ComboPareto.vue'
import Sparkline from '@/components/design/Sparkline.vue'
import Affinity from '@/components/design/Affinity.vue'
import { fmtAbbr } from '@/components/design/utils/format'
import { useFormatters } from '@/composables/useFormatters'
import { useDashboardData } from '@/composables/useDashboardData'
import { formatWindow } from '@/composables/useWindowLabel'
import { buildDateParams } from '@/composables/useBusinessDay'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()

/* ---------- Data shape (mirrors window.DASH in handoff v3) ---------- */
interface CategoryRow { label: string; value: number; units: number; color?: string }
interface ParetoRow { label: string; value: number }
interface TrendRow {
  name: string
  units: number
  revenue: number
  delta: number
  spark: number[]
}
interface Overview {
  menuItems: number
  categoryCount: number
  bestSellerName: string
  bestSellerUnits: number
  units30d: number
  units30dDelta: number | null
  menuRevenue: number
  menuRevenueDelta: number | null
}
interface ProductsDashData {
  overview: Overview
  categories: CategoryRow[]
  pareto: ParetoRow[]
  trends: TrendRow[]
  prepByCategory: PrepRow[]
}
interface PrepRow { label: string; mins: number; target: number; orders: number }

const data = ref<ProductsDashData | null>(null)
const loading = ref(true)

/* ---------- Hero KPI cards ---------- */
const heroKpis = computed(() => {
  const D = data.value
  if (!D) return []
  const o = D.overview
  return [
    {
      label: t('Menu items'),
      value: o.menuItems,
      icon: 'box',
      tone: 'primary' as const,
      sub: t('across {n} categories', { n: o.categoryCount }),
    },
    {
      label: t('Best seller'),
      value: o.bestSellerName,
      icon: 'star',
      tone: 'warning' as const,
      sub: t('{n} units · {window}', { n: o.bestSellerUnits, window: windowLabel.value }),
    },
    {
      label: t('Units sold · {window}', { window: windowLabel.value }),
      value: o.units30d,
      delta: o.units30dDelta,
      icon: 'receipt',
      tone: 'info' as const,
    },
    {
      label: t('Menu revenue'),
      value: o.menuRevenue,
      money: true,
      delta: o.menuRevenueDelta,
      icon: 'wallet',
      tone: 'success' as const,
    },
  ]
})

/* ---------- Donut/Treemap palette: assign --c1..--c5 + accents ---------- */
const palette = [
  'rgb(var(--v-theme-c1))',
  'rgb(var(--v-theme-c2))',
  'rgb(var(--v-theme-c3))',
  'rgb(var(--v-theme-c4))',
  'rgb(var(--v-theme-c5))',
  'rgb(var(--v-theme-primary-hover))',
]

// Toggle: revenue vs sold-units for both the treemap and donut. Same categories
// list, different scalar per slice.
const catMetric = ref<'revenue' | 'units'>('revenue')
const catMetrics = computed(() => [
  { key: 'revenue', label: t('Revenue') },
  { key: 'units', label: t('Units sold') },
] as const)

function catValue(c: CategoryRow): number {
  return catMetric.value === 'units' ? c.units : c.value
}

const categoryTreemap = computed(() => {
  const cats = data.value?.categories || []
  return cats.slice(0, 6).map((c, i) => ({
    label: c.label,
    value: catValue(c),
    color: c.color || palette[i % palette.length],
  }))
})

const categoryDonut = computed(() =>
  (data.value?.categories || []).slice(0, 6).map((c, i) => ({
    label: c.label,
    value: catValue(c),
    color: c.color || palette[i % palette.length],
  })),
)

/* ---------- BE → FE shape mappers ----------
   Confirmed BE contracts (alpha_pos_server/admins/views/analytics_views.py
   + admins/services/product_analytics_service.py):
     GET /analytics/products/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
       → { range, window_days, total_revenue, total_units, distinct_products_sold,
            order_lines, orders, avg_line_revenue,
            top_products[{ product_id, product_name, qty_sold, revenue }],
            slowest_products[...] }
     GET /analytics/products/categories?from=&to=
       → { range, total_revenue, categories[{ category_id, category, units, revenue, pct_of_revenue }] }
     GET /analytics/products/pareto?from=&to=
       → { range, total_revenue, products[{ product_id, product_name, qty_sold,
           revenue, pct_of_revenue, cumulative_pct, class }], summary }
     GET /analytics/products/trends?from=&to=&top_n=5
       → { range, daily[{ date, units, revenue }],
            top_products_trend[{ product_id, product_name, total_revenue,
              points[{ date, qty, revenue }] }] }
   NOTE: BE returns money as integer-so'm STRINGS; coerce with Number().
   BE does NOT support `?range=30d` for products — compute the [from, to] window.
*/

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeDates(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - (days - 1))
  return { from: isoDate(from), to: isoDate(to) }
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

function mapOverview(raw: any, catCount: number, deltas: { units?: number | null; revenue?: number | null }): Overview {
  const top = Array.isArray(raw?.top_products) ? raw.top_products[0] : null
  return {
    menuItems: num(raw?.distinct_products_sold),
    categoryCount: catCount,
    bestSellerName: top?.product_name ?? '—',
    bestSellerUnits: num(top?.qty_sold),
    units30d: num(raw?.total_units),
    units30dDelta: deltas.units ?? null,
    menuRevenue: num(raw?.total_revenue),
    menuRevenueDelta: deltas.revenue ?? null,
  }
}

function mapCategories(raw: any): CategoryRow[] {
  const rows = Array.isArray(raw?.categories) ? raw.categories : []
  return rows.map((c: any) => ({
    label: c?.category ?? '—',
    value: num(c?.revenue),
    units: num(c?.units),
  }))
}

function mapPareto(raw: any): ParetoRow[] {
  const products = Array.isArray(raw?.products) ? raw.products : []
  return products.map((p: any) => ({
    label: p?.product_name ?? '—',
    value: num(p?.revenue),
  }))
}

function mapTrends(raw: any, previousRaw?: any): TrendRow[] {
  const series = Array.isArray(raw?.top_products_trend) ? raw.top_products_trend : []
  const previous = new Map<string, number>((Array.isArray(previousRaw?.top_products_trend) ? previousRaw.top_products_trend : [])
    .map((s: any) => [String(s?.product_name ?? ''), num(s?.total_revenue)]))
  return series.map((s: any) => {
    const points: any[] = Array.isArray(s?.points) ? s.points : []
    const spark = points.map(p => num(p?.revenue))
    const total = num(s?.total_revenue)
    const units = points.reduce((acc, p) => acc + num(p?.qty), 0)
    // Compare the selected range with the immediately preceding equal-length
    // range. Splitting a selected period in half made a four-day selection
    // compare days 1–2 against days 3–4, which is not a useful KPI.
    const previousRevenue = previous.get(String(s?.product_name ?? '')) ?? 0
    const delta = previousRevenue > 0
      ? Math.round(((total - previousRevenue) / previousRevenue) * 1000) / 10
      : 0
    return {
      name: s?.product_name ?? '—',
      units,
      revenue: total,
      delta,
      spark,
    }
  })
}

/* ---------- Loader ---------- */
async function loadDashboard() {
  loading.value = true
  try {
    // Consume hub's shared range; fall back to last 30d when hub hasn't fired.
    let from = ''
    let to = ''
    const sr = sharedRange.value
    if (sr?.from && sr?.to) { from = sr.from; to = sr.to }
    else { const d = rangeDates(30); from = d.from; to = d.to }
    // Previous period of same length for delta computation.
    const prev = (() => {
      const fromD = new Date(from)
      const toD = new Date(to)
      const span = Math.max(0, Math.round((toD.getTime() - fromD.getTime()) / 86400000))
      const prevTo = new Date(fromD)
      prevTo.setDate(prevTo.getDate() - 1)
      const prevFrom = new Date(prevTo)
      prevFrom.setDate(prevTo.getDate() - span)
      return { from: isoDate(prevFrom), to: isoDate(prevTo) }
    })()

    // Same time-of-day filter (Working hours / custom) on the current window;
    // apply it to the previous period too so the delta compares like-for-like.
    const tod = { fromTime: sr?.fromTime, toTime: sr?.toTime }
    const curParams = buildDateParams({ from, to, ...tod })
    const prevParams = buildDateParams({ from: prev.from, to: prev.to, ...tod })
    const [ovRes, catRes, parRes, trRes, ovPrevRes, trPrevRes, opsRes] = await Promise.all([
      axiosIns.get('/analytics/products/overview', { params: curParams }),
      axiosIns.get('/analytics/products/categories', { params: curParams }),
      axiosIns.get('/analytics/products/pareto', { params: curParams }),
      axiosIns.get('/analytics/products/trends', { params: { ...curParams, top_n: 6 } }),
      // Previous-period overview so we can compute units30dDelta + menuRevenueDelta.
      // Best-effort: if it fails, deltas stay null.
      axiosIns.get('/analytics/products/overview', { params: prevParams }).catch(() => null),
      axiosIns.get('/analytics/products/trends', { params: { ...prevParams, top_n: 6 } }).catch(() => null),
      // The useful category-speed insight used to be isolated on Operations.
      // Keep it with the product/category decisions it informs.
      axiosIns.get('/dashboard/operations', { params: curParams }).catch(() => null),
    ])

    const ovRaw = ovRes.data?.data ?? ovRes.data
    const catRaw = catRes.data?.data ?? catRes.data
    const parRaw = parRes.data?.data ?? parRes.data
    const trRaw = trRes.data?.data ?? trRes.data
    const ovPrevRaw = ovPrevRes?.data?.data ?? ovPrevRes?.data ?? null
    const trPrevRaw = trPrevRes?.data?.data ?? trPrevRes?.data ?? null
    const opsRaw = opsRes?.data?.data ?? opsRes?.data ?? null
    const prepByCategory: PrepRow[] = Array.isArray(opsRaw?.prep_by_category)
      ? opsRaw.prep_by_category.map((row: any) => ({
          label: String(row?.category ?? row?.label ?? '—'),
          mins: num(row?.mins ?? row?.avg_prep_minutes),
          target: num(row?.target ?? row?.target_minutes),
          orders: num(row?.orders),
        })).filter((row: PrepRow) => row.label !== '—')
      : []

    const categories = mapCategories(catRaw)
    let deltas: { units: number | null; revenue: number | null } = { units: null, revenue: null }
    if (ovPrevRaw) {
      const prevUnits = num(ovPrevRaw.total_units)
      const prevRev = num(ovPrevRaw.total_revenue)
      const curUnits = num(ovRaw?.total_units)
      const curRev = num(ovRaw?.total_revenue)
      deltas = {
        units: prevUnits > 0 ? Math.round(((curUnits - prevUnits) / prevUnits) * 1000) / 10 : null,
        revenue: prevRev > 0 ? Math.round(((curRev - prevRev) / prevRev) * 1000) / 10 : null,
      }
    }

    data.value = {
      overview: mapOverview(ovRaw, categories.length, deltas),
      categories,
      pareto: mapPareto(parRaw),
      trends: mapTrends(trRaw, trPrevRaw),
      prepByCategory,
    }
  }
  catch (err) {
    // Soft-degrade so the page renders empty-states/skeletons instead of throwing.
    data.value = {
      overview: {
        menuItems: 0,
        categoryCount: 0,
        bestSellerName: '—',
        bestSellerUnits: 0,
        units30d: 0,
        units30dDelta: null,
        menuRevenue: 0,
        menuRevenueDelta: null,
      },
      categories: [],
      pareto: [],
      trends: [],
      prepByCategory: [],
    }
    void err
  }
  finally {
    loading.value = false
  }
}

const { range: sharedRange } = useDashboardData()
watch(sharedRange, () => { void loadDashboard() })

// Localized label for the active date-picker window (see useWindowLabel).
const windowLabel = computed(() => formatWindow(sharedRange.value, t))
onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <div class="dashprod">
    <!-- Loading state — skeletons mirror final layout shape -->
    <div
      v-if="loading"
      class="dashprod-sk"
      style="display: flex; flex-direction: column; gap: var(--sp-6);"
    >
      <div class="grid cols-4">
        <Card v-for="i in 4" :key="`hsk${i}`" :style="{ padding: '18px' }">
          <Skeleton :h="14" w="60%" />
          <Skeleton :h="28" w="80%" :style="{ marginTop: '14px' }" />
          <Skeleton :h="16" w="50%" :style="{ marginTop: '12px' }" />
        </Card>
      </div>
      <div class="grid dashprod-grid--mix">
        <Card :style="{ padding: '20px' }">
          <Skeleton :h="18" w="40%" />
          <div class="dashprod-sk__chart" :style="{ marginTop: '16px', height: '300px' }" />
        </Card>
        <Card :style="{ padding: '20px' }">
          <Skeleton :h="18" w="40%" />
          <div class="dashprod-sk__chart" :style="{ marginTop: '16px', height: '300px' }" />
        </Card>
      </div>
      <div class="grid dashprod-grid--pareto">
        <Card :style="{ padding: '20px' }">
          <Skeleton :h="18" w="40%" />
          <div class="dashprod-sk__chart" :style="{ marginTop: '16px', height: '280px' }" />
        </Card>
        <Card :style="{ padding: '20px' }">
          <Skeleton :h="18" w="40%" />
          <div
            v-for="r in 5"
            :key="`tsk${r}`"
            class="dashprod-sk__row"
            :style="{ marginTop: r === 1 ? '16px' : undefined }"
          >
            <div class="sk-box" :style="{ width: '120px', height: '14px' }" />
            <div class="sk-box" :style="{ width: '60px', height: '14px', marginLeft: 'auto' }" />
            <div class="sk-box" :style="{ width: '100px', height: '28px' }" />
            <div class="sk-box" :style="{ width: '80px', height: '14px' }" />
          </div>
        </Card>
      </div>
    </div>

    <!-- Loaded state -->
    <div
      v-else
      style="display: flex; flex-direction: column; gap: var(--sp-6);"
    >
      <!-- 4-up hero KPIs -->
      <div class="grid cols-4">
        <Kpi
          v-for="k in heroKpis"
          :key="k.label"
          :data="k as any"
        />
      </div>

      <!-- Revenue composition treemap + category-mix donut -->
      <div class="grid dashprod-grid--mix">
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ catMetric === 'units' ? t('Sold units composition') : t('Revenue composition') }}
              </div>
              <h3 class="card__insight">
                {{ t('Top categories dominate sales') }}
              </h3>
            </div>
            <div
              class="seg"
              role="tablist"
              style="align-self: flex-start;"
            >
              <button
                v-for="m in catMetrics"
                :key="m.key"
                type="button"
                class="seg__btn"
                :class="{ 'is-active': catMetric === m.key }"
                @click="catMetric = m.key"
              >{{ m.label }}</button>
            </div>
          </div>
          <div class="card__body">
            <Treemap
              :data="categoryTreemap"
              :height="320"
              :value-unit="catMetric === 'units' ? 'units' : 'money'"
            />
          </div>
        </Card>

        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Category mix') }}
              </div>
              <h3 class="card__title">
                {{ catMetric === 'units' ? t('Share of sold units') : t('Share of revenue') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <DonutChart
              :data="categoryDonut"
              :center-label="t('Categories')"
              :size="180"
            />
          </div>
        </Card>
      </div>

      <Card v-if="data?.prepByCategory?.length">
        <div class="card__head">
          <div class="card__head-text">
            <div class="kpi__label">{{ t('Avg prep time by category') }}</div>
            <h3 class="card__title">{{ t('Kitchen speed · {window}', { window: windowLabel }) }}</h3>
          </div>
        </div>
        <div class="card__body" style="display: grid; gap: 14px;">
          <div v-for="row in data.prepByCategory" :key="row.label">
            <div class="row between" style="margin-bottom: 5px;">
              <span style="font-size: 13px; font-weight: 600;">{{ row.label }}</span>
              <span class="mono" style="font-size: 12px; font-weight: 700;">
                {{ row.mins.toFixed(1) }}m<span v-if="row.target"> / {{ row.target }}m</span>
              </span>
            </div>
            <div style="height: 10px; border-radius: 999px; background: rgb(var(--v-theme-chart-track)); overflow: hidden;">
              <div :style="{ width: `${Math.min(100, row.target ? row.mins / row.target * 100 : 0)}%`, height: '100%', borderRadius: 'inherit', background: row.target && row.mins > row.target ? 'rgb(var(--v-theme-error))' : 'rgb(var(--v-theme-success))' }" />
            </div>
          </div>
        </div>
      </Card>

      <!-- Frequently bought together — switchable views -->
      <Affinity
        :loading="loading"
        :range="sharedRange?.from && sharedRange?.to ? { from: sharedRange.from, to: sharedRange.to } : null"
        :window-label="windowLabel"
      />

      <!-- Pareto + sparkline-trends table -->
      <div class="grid dashprod-grid--pareto">
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Pareto analysis') }}
              </div>
              <h3 class="card__insight">
                {{ t('Top products drive most revenue') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <ComboPareto
              :data="data?.pareto || []"
              :height="300"
            />
          </div>
        </Card>

        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Product trends · {window}', { window: windowLabel }) }}
              </div>
              <h3 class="card__title">
                {{ t('Movers & shakers') }}
              </h3>
            </div>
          </div>
          <div class="card__divider" />
          <div class="dashprod-tablewrap">
            <table class="dtable sparktable">
              <thead>
                <tr>
                  <th>{{ t('Product') }}</th>
                  <th class="num col-units">
                    {{ t('Units sold') }}
                  </th>
                  <th class="col-spark">
                    {{ t('Trend') }}
                  </th>
                  <th class="num">
                    {{ t('Revenue') }}
                  </th>
                  <th class="num col-delta">
                    {{ t('Δ') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!data?.trends?.length">
                  <td colspan="5" style="padding: 24px; text-align: center; color: rgb(var(--v-theme-text-secondary));">
                    {{ t('No products yet') }}
                  </td>
                </tr>
                <tr
                  v-for="p in data?.trends || []"
                  :key="p.name"
                >
                  <td class="cell-strong">
                    {{ p.name }}
                  </td>
                  <td class="num mono">
                    {{ p.units }}
                  </td>
                  <td class="col-spark">
                    <Sparkline
                      :data="p.spark"
                      :width="100"
                      :height="28"
                      color-by-trend
                      :dot="false"
                    />
                  </td>
                  <td class="num mono cell-strong">
                    {{ formatCurrency(p.revenue) }}
                  </td>
                  <td class="num">
                    <Delta :value="p.delta" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashprod {
  display: block;
}
.sk-box {
  background: rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 4px;
}
</style>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

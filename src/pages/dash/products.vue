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
import { fmtAbbr } from '@/components/design/utils/format'
import { useFormatters } from '@/composables/useFormatters'

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()

/* ---------- Data shape (mirrors window.DASH in handoff v3) ---------- */
interface CategoryRow { label: string; value: number; color?: string }
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
}

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
      sub: t('{n} units · 30d', { n: o.bestSellerUnits }),
    },
    {
      label: t('Units sold (30d)'),
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

const categoryTreemap = computed(() => {
  const cats = data.value?.categories || []
  return cats.slice(0, 6).map((c, i) => ({
    label: c.label,
    value: c.value,
    color: c.color || palette[i % palette.length],
  }))
})

const categoryDonut = computed(() =>
  (data.value?.categories || []).slice(0, 6).map((c, i) => ({
    label: c.label,
    value: c.value,
    color: c.color || palette[i % palette.length],
  })),
)

/* ---------- Loader ---------- */
async function loadDashboard() {
  loading.value = true
  try {
    // BE endpoint shape (REQUEST BACKEND):
    //   GET /analytics/products/overview?range=30d   → Overview
    //   GET /analytics/products/categories?range=30d → CategoryRow[]
    //   GET /analytics/products/pareto?range=30d     → ParetoRow[]
    //   GET /analytics/products/trends?days=14       → TrendRow[]
    // Until BE ships, fall through to the empty-state branch below.
    const [ovRes, catRes, parRes, trRes] = await Promise.all([
      axiosIns.get('/analytics/products/overview', { params: { range: '30d' } }),
      axiosIns.get('/analytics/products/categories', { params: { range: '30d' } }),
      axiosIns.get('/analytics/products/pareto', { params: { range: '30d' } }),
      axiosIns.get('/analytics/products/trends', { params: { days: 14 } }),
    ])
    data.value = {
      overview: ovRes.data?.data ?? ovRes.data,
      categories: catRes.data?.data ?? catRes.data,
      pareto: parRes.data?.data ?? parRes.data,
      trends: trRes.data?.data ?? trRes.data,
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
    }
    void err
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <div class="page dashprod">
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
                {{ t('Revenue composition') }}
              </div>
              <h3 class="card__insight">
                {{ t('Top categories dominate sales') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <Treemap
              :data="categoryTreemap"
              :height="320"
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
                {{ t('Share of revenue') }}
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
                {{ t('Product trends · 14 days') }}
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
                    {{ t('Units') }}
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

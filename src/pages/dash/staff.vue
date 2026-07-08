<script setup lang="ts">
/* ============================================================
   ALPHA POS — Staff & Shifts performance dashboard (v3 port)
   Source: .tmp-handoff-v3/.../pages/dash/Staff.jsx
   Sister page to dash/executive.vue / dash/products.vue / dash/operations.vue.
   Charts are pure-Vue SVG, no chart libs.

   No BE endpoint exists yet — see BACKEND_TODO.md
   "GET /staff/performance?range=30d" for the contract.
   Until then we read the static fixture from src/pages/dash/_mock/dashdata.ts
   (mirrors window.DASH.staff in the handoff source).
   ============================================================ */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import axiosIns from '@/plugins/axios'
import Card from '@/components/design/Card.vue'
import HeroKpi from '@/components/design/HeroKpi.vue'
import Skeleton from '@/components/design/Skeleton.vue'
import Radar from '@/components/design/charts/Radar.vue'
import Scatter from '@/components/design/charts/Scatter.vue'
import StackedBar from '@/components/design/charts/StackedBar.vue'

import { fmtAbbr, fmtNum } from '@/components/design/utils/format'
import { useFormatters } from '@/composables/useFormatters'
import { useDashboardData } from '@/composables/useDashboardData'
import { buildDateParams } from '@/composables/useBusinessDay'
// staffFixture mock dropped — real BE data only (Abrorbek deployed /staff/performance 2026-06-25).

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()

/* ---------- Data shape (mirrors window.DASH.staff in handoff v3) ---------- */
interface StaffRow {
  id?: number | null
  name: string
  initials: string
  revenue: number
  orders: number
  aov: number
  hours: number
  speed: number
  accuracy: number
  upsell: number
  attendance: number
}

const loading = ref(true)
const staff = ref<StaffRow[]>([])

/* ---------- BE → FE mapper ----------
   Confirmed contract (alpha_pos_server/admins/services/analytics_service.py
   → staff_performance):
     GET /staff/performance?range=30d  (or ?from=&to=)
       → { range, window_days,
            staff[{ user_id, name, role,
                    orders_total, orders_completed, orders_cancelled,
                    orders_paid, cancel_rate_pct,
                    revenue, avg_order_value, units_sold,
                    shifts_worked, hours_worked }],
            summary }
   BE does NOT compute speed / accuracy / upsell / attendance — they are
   derivations only the operator can score. We synthesise sane defaults so
   the radar/scatter still render, and leave the door open for a BE update.
*/

function initialsOf(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0][0]!.toUpperCase()
  return (parts[0][0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

function mapStaffPerformance(raw: any): StaffRow[] {
  const list = Array.isArray(raw?.staff) ? raw.staff : []
  return list.map((r: any) => {
    const revenue = num(r?.revenue)
    const orders = num(r?.orders_total)
    const aov = num(r?.avg_order_value)
    const hours = num(r?.hours_worked)
    const cancelRate = num(r?.cancel_rate_pct)
    // Derive plausible scores from real BE signals.
    //   accuracy ← 100 - cancel rate (clamped)
    //   attendance ← shifts worked normalised (1 shift ≈ 75%, 4+ shifts → 100)
    //   speed / upsell ← not derivable; leave neutral defaults so radar renders.
    const accuracy = Math.max(0, Math.min(100, Math.round(100 - cancelRate)))
    const shifts = num(r?.shifts_worked)
    const attendance = Math.max(0, Math.min(100, Math.round(75 + Math.min(25, shifts * 6))))
    return {
      id: r?.user_id ?? null,
      name: r?.name?.trim() || '—',
      initials: initialsOf(r?.name || ''),
      revenue,
      orders,
      aov,
      hours: Math.round(hours),
      speed: 80,
      accuracy,
      upsell: 60,
      attendance,
    }
  })
}

async function loadStaff() {
  loading.value = true
  try {
    const sr = sharedRange.value
    const params: Record<string, string> = (sr?.from && sr?.to)
      ? buildDateParams({ from: sr.from, to: sr.to, fromTime: sr.fromTime, toTime: sr.toTime })
      : { range: sr?.preset || '30d' }
    const res = await axiosIns.get('/staff/performance', { params })
    const raw = res.data?.data ?? res.data
    staff.value = mapStaffPerformance(raw)
  }
  catch {
    // Real data only — empty list renders the empty-state, no mock fallback.
    staff.value = []
  }
  finally {
    loading.value = false
  }
}

const { range: sharedRange } = useDashboardData()
watch(sharedRange, () => { void loadStaff() })
onMounted(loadStaff)

/* Defensive ranks — fixture is pre-sorted by revenue desc, but normalise here
   so the leaderboard is correct whatever the BE returns. */
const ranked = computed(() => {
  return [...staff.value].sort((a, b) => b.revenue - a.revenue)
})

const maxRev = computed(() => {
  if (!ranked.value.length) return 1
  return Math.max(...ranked.value.map(s => s.revenue))
})

const totalHours = computed(() => ranked.value.reduce((acc, s) => acc + s.hours, 0))

/* ---------- HeroKpi tiles (4) ---------- */
const avgAccuracy = computed(() => {
  if (!ranked.value.length) return 0
  return Math.round(ranked.value.reduce((acc, s) => acc + s.accuracy, 0) / ranked.value.length)
})

const heroKpis = computed(() => {
  const top = ranked.value[0]
  return [
    {
      label: t('Active staff'),
      value: ranked.value.length,
      icon: 'users',
      tone: 'primary' as const,
      sub: t('in last 30 days'),
    },
    {
      label: t('Top performer'),
      value: top ? top.name : '—',
      icon: 'star',
      tone: 'warning' as const,
      sub: top ? `${fmtAbbr(top.revenue)} · 30d` : '',
    },
    {
      label: t('Avg accuracy'),
      value: `${avgAccuracy.value}%`,
      icon: 'check',
      tone: 'success' as const,
    },
    {
      label: t('Total hours (30d)'),
      value: totalHours.value,
      icon: 'clock',
      tone: 'info' as const,
      sub: t('across team'),
    },
  ]
})

/* ---------- Leaderboard insight (templated) ----------
   Diff between top performer and runner-up, as % over runner-up. */
const leaderInsight = computed(() => {
  const a = ranked.value[0]
  const b = ranked.value[1]
  if (!a || !b || !b.revenue) return ''
  const pct = Math.round(((a.revenue - b.revenue) / b.revenue) * 100)
  return t('{name} leads by {pct}%', { name: a.name, pct })
})

/* ---------- Radar series (Top vs steady performer) ----------
   Only axes backed by real BE signal: Accuracy (100 - cancel_rate_pct), Shift
   activity (shifts_worked normalised), Volume (revenue share). Speed and Upsell
   were hardcoded to 80 / 60 for every cashier with no BE field to source from, so
   they painted identical radar shapes — dropped until BE ships those metrics.
   The middle axis was renamed from "Attendance" to "Shift activity" because the
   value (75 + min(25, shifts*6)) measures shift count only, not punctuality. */
const radarAxes = computed(() => [
  t('Accuracy'),
  t('Shift activity'),
  t('Volume'),
])

// Volume = each cashier's revenue share of the total team revenue, scaled 0..100 so
// the radar dimension is comparable to accuracy / attendance.
function volumeFor(row: StaffRow, total: number): number {
  if (!total) return 0
  return Math.round(Math.min(100, (row.revenue / total) * 100 * (ranked.value.length || 1)))
}

const radarSeries = computed(() => {
  const top = ranked.value[0]
  // "Steady performer" — second-tier reference (median-by-revenue cashier) so the
  // top performer has a comparable, NOT-bottom-tier silhouette.
  const median = ranked.value[Math.floor(ranked.value.length / 2)]
  if (!top || !median || top === median) return []
  const totalRev = ranked.value.reduce((a, b) => a + b.revenue, 0)
  return [
    {
      label: top.name,
      color: 'var(--c1)',
      values: [top.accuracy, top.attendance, volumeFor(top, totalRev)],
    },
    {
      label: median.name,
      color: 'var(--c2)',
      values: [median.accuracy, median.attendance, volumeFor(median, totalRev)],
    },
  ]
})

/* ---------- Scatter (orders vs revenue, bubble = AOV) ---------- */
const palette = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)']

const scatterData = computed(() => ranked.value.map((s, i) => ({
  x: s.orders,
  y: s.revenue,
  r: 8 + s.aov / 9000,
  label: s.name,
  color: palette[i % palette.length],
})))

/* ---------- StackedBar (hours per cashier) ----------
   BE only provides hours_worked. Overtime (hours * 0.08) and Late ((100 -
   attendance) * 1.2) used to be stacked here as if they were measured timeclock
   signals — neither has a BE source, so they painted derived noise next to real
   hours. Dropped both stacks; the chart now shows a single bar per cashier with
   real worked hours. Add overtime / late back when BE ships a timeclock model. */
const punctualityData = computed(() => ranked.value.map(s => ({
  label: s.initials,
  values: { worked: s.hours },
})))

const punctualitySeries = computed(() => [
  { key: 'worked', label: t('Hours worked'), color: 'var(--c1)' },
])

/* ---------- Helpers ---------- */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function intFmt(v: number): string {
  return String(Math.round(v))
}
</script>

<template>
  <div class="staff-dash">
    <!-- Loading state -->
    <div
      v-if="loading"
      style="display: flex; flex-direction: column; gap: var(--sp-6);"
    >
      <div class="grid staff-hero">
        <div
          v-for="i in 4"
          :key="`sk${i}`"
          class="herokpi"
        >
          <Skeleton :h="14" w="60%" />
          <Skeleton :h="28" w="80%" :style="{ marginTop: '14px' }" />
          <Skeleton :h="16" w="50%" :style="{ marginTop: '12px' }" />
        </div>
      </div>
      <div
        v-for="r in 2"
        :key="`skrow${r}`"
        class="grid"
        :style="{ gridTemplateColumns: r === 1 ? '1.2fr 1fr' : '1fr 1fr' }"
      >
        <Card
          v-for="i in 2"
          :key="`skc${r}${i}`"
          :style="{ padding: '20px' }"
        >
          <Skeleton :h="18" w="40%" />
          <Skeleton :h="240" :style="{ marginTop: '16px', borderRadius: '10px' }" />
        </Card>
      </div>
    </div>

    <!-- Empty state: no staff returned (BE error or empty payload). Render single empty card,
         not a full grid of '—'/'0%' that looks like real-but-zero data. -->
    <div
      v-else-if="!staff.length"
      class="card"
      style="padding: 48px 24px; text-align: center;"
    >
      <div class="muted" style="font-size: 14px;">
        {{ t('No staff data for this range') }}
      </div>
    </div>

    <!-- Loaded state -->
    <div
      v-else
      style="display: flex; flex-direction: column; gap: var(--sp-6);"
    >
      <!-- Hero KPI strip (4 columns) -->
      <div class="grid staff-hero">
        <HeroKpi
          v-for="k in heroKpis"
          :key="k.label"
          :data="k as any"
        />
      </div>

      <!-- Leaderboard + Radar -->
      <div class="grid staff-row-1">
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Cashier leaderboard · revenue') }}
              </div>
              <h3 class="card__insight">
                {{ leaderInsight }}
              </h3>
            </div>
          </div>
          <div class="card__body" style="padding-top: 4px;">
            <div
              v-for="(s, i) in ranked"
              :key="s.name"
              class="lb-row"
            >
              <span :class="cx('lb-rank', `is-${i + 1}`)">{{ i + 1 }}</span>
              <div class="avatar avatar--sm">{{ s.initials }}</div>
              <div style="flex: 1; min-width: 0;">
                <div class="row between">
                  <span class="cell-strong" style="font-size: 14px;">{{ s.name }}</span>
                  <span class="mono cell-strong" style="font-size: 13px;">{{ formatCurrency(s.revenue) }}</span>
                </div>
                <div class="lb-bar">
                  <div :style="{ width: `${(s.revenue / maxRev) * 100}%` }" />
                </div>
                <div
                  class="row"
                  style="gap: 14px; margin-top: 5px; font-size: 11px; color: rgb(var(--v-theme-text-tertiary));"
                >
                  <span>{{ fmtNum(s.orders) }} {{ t('orders') }}</span>
                  <span>{{ t('AOV') }} {{ fmtAbbr(s.aov) }}</span>
                  <span>{{ s.hours }}{{ t('h') }}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Skill profile') }}
              </div>
              <h3 class="card__title">
                {{ t('Top vs steady performer') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <Radar
              :axes="radarAxes"
              :series="radarSeries as any"
              :max="100"
              :size="300"
            />
          </div>
        </Card>
      </div>

      <!-- Scatter + Stacked bar -->
      <div class="grid staff-row-2">
        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Orders vs revenue') }}
              </div>
              <h3 class="card__insight">
                {{ t('Bubble size = avg order value') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <Scatter
              :data="scatterData as any"
              :height="300"
              :x-label="t('orders')"
              :y-label="t('Revenue')"
              :x-format="intFmt"
              :y-format="fmtAbbr"
            />
          </div>
        </Card>

        <Card>
          <div class="card__head">
            <div class="card__head-text">
              <div class="kpi__label">
                {{ t('Hours & punctuality') }}
              </div>
              <h3 class="card__title">
                {{ t('Worked vs overtime') }}
              </h3>
            </div>
          </div>
          <div class="card__body">
            <StackedBar
              :data="punctualityData as any"
              :series="punctualitySeries as any"
              :height="300"
              :y-format="intFmt"
            />
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

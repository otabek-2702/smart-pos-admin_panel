<script setup lang="ts">
/**
 * ComboPareto — bars (per-product revenue) + cumulative% line + right-axis.
 * Port of charts2.jsx ComboPareto. Pure SVG, no chart libs.
 */
import { fmtAbbr, fmtMoney } from './utils/format'
import { niceTicks } from './utils/niceTicks'
import { useWidth } from './utils/useWidth'
import StateFill from './StateFill.vue'
import ChartTip from './ChartTip.vue'

interface ParetoDatum {
  label: string
  value: number
}

interface Props {
  data: ParetoDatum[]
  height?: number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  loading: false,
})

const { t } = useI18n({ useScope: 'global' })

const [elRef, w] = useWidth()

const padL = 48
const padR = 46
const padT = 16
const padB = 46

const hover = ref<number | null>(null)
const tip = ref<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 })
function reset() {
  hover.value = null
  tip.value = { show: false, x: 0, y: 0 }
}

const sorted = computed(() => [...(props.data || [])].sort((a, b) => b.value - a.value))
const total = computed(() => sorted.value.reduce((a, b) => a + b.value, 0) || 1)
const maxV = computed(() => Math.max(1, ...sorted.value.map(d => d.value)))
const ticks = computed(() => niceTicks(maxV.value, 4))
const top = computed(() => ticks.value.top)

const iw = computed(() => Math.max(10, w.value - padL - padR))
const ih = computed(() => props.height - padT - padB)
const band = computed(() => iw.value / Math.max(1, sorted.value.length))
const bw = computed(() => Math.min(band.value * 0.6, 44))

function y(v: number) {
  return padT + ih.value - (v / top.value) * ih.value
}
function yC(p: number) {
  return padT + ih.value - (p / 100) * ih.value
}

const cum = computed<number[]>(() => {
  let acc = 0
  return sorted.value.map(d => {
    acc += d.value
    return (acc / total.value) * 100
  })
})

const linePts = computed(() =>
  cum.value.map((p, i) => [padL + band.value * i + band.value / 2, yC(p)] as [number, number]),
)
const linePath = computed(() =>
  linePts.value.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '),
)
const ref80 = computed(() => yC(80))

function onEnter(i: number, e: MouseEvent) {
  hover.value = i
  tip.value = { show: true, x: e.clientX, y: e.clientY }
}
function onMove(e: MouseEvent) {
  tip.value = { show: true, x: e.clientX, y: e.clientY }
}

const tipTitle = computed(() => hover.value !== null ? sorted.value[hover.value]?.label || '' : '')
const tipRows = computed(() => {
  if (hover.value === null)
    return []
  const d = sorted.value[hover.value]
  if (!d)
    return []
  return [
    { color: 'rgb(var(--v-theme-chart-revenue))', label: t('Revenue'), value: fmtMoney(d.value) },
    { color: 'rgb(var(--v-theme-chart-expense))', label: t('Cumulative'), value: `${Math.round(cum.value[hover.value])}%` },
  ]
})

function truncate(s: string): string {
  return s.length > 9 ? `${s.slice(0, 8)}…` : s
}
</script>

<template>
  <div
    v-if="loading"
    ref="elRef"
    :style="{ height: `${height}px` }"
  >
    <div class="sk-box pareto-sk" :style="{ width: '100%', height: '100%', borderRadius: '8px' }" />
  </div>
  <div
    v-else-if="!sorted.length"
    ref="elRef"
    :style="{ height: `${height}px` }"
  >
    <StateFill icon="bx-bar-chart-square" :title="t('No data')" />
  </div>
  <div
    v-else
    ref="elRef"
    style="position: relative;"
    @mouseleave="reset"
  >
    <svg
      :width="w"
      :height="height"
      style="display: block;"
    >
      <!-- left-axis ticks -->
      <g v-for="(tval, i) in ticks.ticks" :key="`gp${i}`">
        <line
          :x1="padL"
          :x2="w - padR"
          :y1="y(tval)"
          :y2="y(tval)"
          stroke="rgb(var(--v-theme-chart-grid))"
          stroke-width="1"
        />
        <text
          :x="padL - 8"
          :y="y(tval) + 4"
          text-anchor="end"
          font-size="11"
          fill="rgb(var(--v-theme-chart-axis))"
          font-family="var(--font-mono)"
        >{{ fmtAbbr(tval) }}</text>
      </g>

      <!-- right-axis % ticks -->
      <text
        v-for="p in [0, 25, 50, 75, 100]"
        :key="`pct${p}`"
        :x="w - padR + 8"
        :y="yC(p) + 4"
        font-size="10"
        fill="rgb(var(--v-theme-chart-axis))"
        font-family="var(--font-mono)"
      >{{ p }}%</text>

      <!-- 80% reference -->
      <line
        :x1="padL"
        :x2="w - padR"
        :y1="ref80"
        :y2="ref80"
        stroke="rgb(var(--v-theme-chart-expense))"
        stroke-width="1"
        stroke-dasharray="4 4"
        opacity="0.45"
      />

      <!-- bars + x-axis labels -->
      <g v-for="(d, i) in sorted" :key="`pb${i}`">
        <rect
          :x="padL + band * i + (band - bw) / 2"
          :y="y(d.value)"
          :width="bw"
          :height="Math.max((d.value / top) * ih, 1)"
          rx="4"
          :fill="i === 0 ? 'rgb(var(--v-theme-chart-revenue))' : 'rgb(var(--v-theme-c4))'"
          :opacity="hover !== null && hover !== i ? 0.55 : 1"
          style="transition: opacity .12s;"
        />
        <text
          :x="padL + band * i + band / 2"
          :y="height - 26"
          text-anchor="middle"
          font-size="10"
          fill="rgb(var(--v-theme-chart-axis))"
        >{{ truncate(d.label) }}</text>
        <rect
          :x="padL + band * i"
          :y="padT"
          :width="band"
          :height="ih"
          fill="transparent"
          @mouseenter="onEnter(i, $event)"
          @mousemove="onMove($event)"
        />
      </g>

      <!-- cumulative line -->
      <path
        :d="linePath"
        fill="none"
        stroke="rgb(var(--v-theme-chart-expense))"
        stroke-width="2.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle
        v-for="(p, i) in linePts"
        :key="`pt${i}`"
        :cx="p[0]"
        :cy="p[1]"
        r="3.5"
        fill="rgb(var(--v-theme-surface))"
        stroke="rgb(var(--v-theme-chart-expense))"
        stroke-width="2"
      />
    </svg>
    <ChartTip
      :show="tip.show"
      :x="tip.x"
      :y="tip.y"
      :title="tipTitle"
      :rows="tipRows"
    />
  </div>
</template>

<style scoped>
.pareto-sk {
  background: rgba(var(--v-theme-on-surface), 0.06);
  animation: sk-pulse 1.5s ease-in-out infinite;
}
@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
</style>

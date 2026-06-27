<script setup lang="ts">
/**
 * Gradient area + line chart.
 * Direct port of LineAreaChart(props) in
 * .tmp-alpha-design/alpha-design-source/charts.svg.jsx (lines 52-133).
 *
 * - Loading state -> Skeleton, empty state -> StateFill.
 * - First series gets the gradient area fill (defs/linearGradient).
 * - Entrance animation: SVG `.spark-line` paths use `pathLength=1` and
 *   `stroke-dashoffset` switches 1 -> 0 once useShown(140) flips. Dashed
 *   series skip the animation (no pathLength / dashoffset).
 * - Hover: vertical crosshair + dot per series + ChartTip with one row
 *   per series. Mouse band rects fill the plot area for pointer capture.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { Fmt } from '../utils/format'
import Skeleton from '../Skeleton.vue'
import StateFill from '../StateFill.vue'
import ChartTip from './ChartTip.vue'
import { niceTicks } from './niceTicks'
import { useWidth } from './useWidth'

const { t } = useI18n({ useScope: 'global' })

interface Series {
  key: string
  label: string
  color: string
  data: number[]
  dashed?: boolean
}

interface Props {
  series: Series[]
  categories: string[]
  target?: number
  height?: number
  unit?: string
  yFormat?: (n: number) => string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 240,
})

const [elRef, w] = useWidth()
const shown = useShown(140)

const padL = 52
const padR = 16
const padT = 16
const padB = 28

// Per-instance gradient id (mirrors `_tipId` counter in source).
let _gid = 0
const id = `chart-line-${++_gid}`

const hover = ref<number | null>(null)
const tip = ref<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 })

function reset() {
  hover.value = null
  tip.value = { show: false, x: 0, y: 0 }
}

const yfmt = computed(() => props.yFormat ?? Fmt.abbr)

const maxV = computed(() => {
  let m = 0
  for (const s of props.series) {
    for (const v of s.data) {
      if (v > m)
        m = v
    }
  }
  if (props.target && props.target > m)
    m = props.target

  return m
})

const ticks = computed(() => niceTicks(maxV.value || 1, 4))
const top = computed(() => ticks.value.top)

const iw = computed(() => Math.max(10, w.value - padL - padR))
const ih = computed(() => props.height - padT - padB)

function x(i: number): number {
  const n = props.categories.length
  if (n <= 1)
    return padL + iw.value / 2

  return padL + (i / (n - 1)) * iw.value
}

function y(v: number): number {
  return padT + ih.value - (v / top.value) * ih.value
}

const labelEvery = computed(() => Math.ceil(props.categories.length / 7))

const paths = computed(() => {
  if (!w.value)
    return []

  return props.series.map((s, si) => {
    const pts = s.data.map((v, i) => [x(i), y(v)])
    const line = pts
      .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
      .join(' ')
    const area
      = `${line} L${x(props.categories.length - 1)} ${padT + ih.value} `
      + `L${x(0)} ${padT + ih.value} Z`

    return { si, series: s, line, area }
  })
})

function onBandEnter(i: number, e: MouseEvent) {
  hover.value = i
  // Source line 123: tip Y locks to the first series' data point (so the
  // tip floats just above the area line), translated by the chart's top
  // offset within the page.
  const rect = elRef.value ? elRef.value.getBoundingClientRect() : null
  const baseY = rect ? y(props.series[0].data[i]) + rect.top - padT : e.clientY
  tip.value = { show: true, x: e.clientX, y: baseY }
}

function onBandMove(e: MouseEvent) {
  // Source line 125: subsequent moves follow the cursor directly.
  tip.value = { show: true, x: e.clientX, y: e.clientY }
}

const tipRows = computed(() => {
  if (hover.value === null)
    return []
  const i = hover.value

  return props.series.map(s => ({
    color: s.color,
    label: s.label,
    value: (props.unit ? '' : '') + Fmt.num(s.data[i]),
  }))
})

const tipTitle = computed(() => hover.value !== null ? props.categories[hover.value] : '')
</script>

<template>
  <div
    v-if="loading"
    ref="elRef"
    :style="{ height: `${height}px` }"
  >
    <Skeleton :h="height" :r="10" />
  </div>
  <div
    v-else-if="!series.length || !categories.length"
    ref="elRef"
  >
    <StateFill
      icon="chart"
      :title="t('No data for this range')"
      :sub="t('Try a different date range.')"
      :style="{ height: `${height}px` }"
    />
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
      <defs>
        <linearGradient :id="id" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="series[0].color" stop-opacity="0.18" />
          <stop offset="100%" :stop-color="series[0].color" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- gridlines + y tick labels -->
      <g v-for="(t, i) in ticks.ticks" :key="`g${i}`">
        <line
          :x1="padL"
          :x2="w - padR"
          :y1="y(t)"
          :y2="y(t)"
          stroke="var(--chart-grid)"
          stroke-width="1"
        />
        <text
          :x="padL - 10"
          :y="y(t) + 4"
          text-anchor="end"
          font-size="11"
          fill="var(--chart-axis)"
          font-family="var(--font-mono)"
        >{{ yfmt(t) }}</text>
      </g>

      <!-- target reference -->
      <g v-if="target">
        <line
          :x1="padL"
          :x2="w - padR"
          :y1="y(target)"
          :y2="y(target)"
          stroke="var(--chart-target)"
          stroke-width="1.5"
          stroke-dasharray="5 4"
        />
        <text
          :x="w - padR"
          :y="y(target) - 6"
          text-anchor="end"
          font-size="11"
          font-weight="600"
          fill="var(--chart-target)"
        >Target {{ yfmt(target) }}</text>
      </g>

      <!-- series paths: area (first only) + line -->
      <g v-for="p in paths" :key="`p${p.si}`">
        <path
          v-if="p.si === 0"
          class="spark-area"
          :d="p.area"
          :fill="`url(#${id})`"
        />
        <path
          :class="p.series.dashed ? '' : 'spark-line'"
          :d="p.line"
          fill="none"
          :stroke="p.series.color"
          :stroke-width="p.series.key === 'expense' ? 2 : 2.5"
          :stroke-dasharray="p.series.dashed ? '5 4' : '1'"
          :pathLength="p.series.dashed ? undefined : 1"
          :stroke-dashoffset="p.series.dashed ? undefined : (shown ? 0 : 1)"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </g>

      <!-- hover crosshair -->
      <line
        v-if="hover !== null"
        :x1="x(hover)"
        :x2="x(hover)"
        :y1="padT"
        :y2="padT + ih"
        stroke="var(--border-strong)"
        stroke-width="1"
      />
      <!-- hover dots per series -->
      <circle
        v-for="(s, si) in (hover !== null ? series : [])"
        :key="`hc${si}`"
        :cx="x(hover!)"
        :cy="y(s.data[hover!])"
        r="4.5"
        fill="var(--surface)"
        :stroke="s.color"
        stroke-width="2.5"
      />

      <!-- x-axis labels (every labelEvery + last) -->
      <template v-for="(c, i) in categories" :key="`x${i}`">
        <text
          v-if="i % labelEvery === 0 || i === categories.length - 1"
          :x="x(i)"
          :y="height - 8"
          text-anchor="middle"
          font-size="11"
          fill="var(--chart-axis)"
        >{{ c }}</text>
      </template>

      <!-- hover bands -->
      <rect
        v-for="(_, i) in categories"
        :key="`h${i}`"
        :x="x(i) - (iw / categories.length) / 2"
        :y="padT"
        :width="iw / categories.length"
        :height="ih"
        fill="transparent"
        @mouseenter="onBandEnter(i, $event)"
        @mousemove="onBandMove($event)"
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

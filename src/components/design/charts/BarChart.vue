<script setup lang="ts">
/**
 * Vertical bars (one per data point).
 * Direct port of BarChart(props) in
 * .tmp-alpha-design/alpha-design-source/charts.svg.jsx (lines 135-188).
 *
 * - Loading state -> Skeleton, empty state -> StateFill.
 * - `peak` items render in --chart-revenue with a label on top.
 *   Non-peak hovered = --primary-hover, idle = --c4.
 * - Entrance: each bar has class `bar-rise` (transform-origin bottom,
 *   transform transitions per CSS) and scales 0 -> 1 staggered by index
 *   using inline transform + transitionDelay once useShown(120) flips.
 * - Hover bands extend the full band width over the plot area; mousemove
 *   updates ChartTip x/y to track the cursor.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { Fmt } from '../utils/format'
import Skeleton from '../Skeleton.vue'
import StateFill from '../StateFill.vue'
import ChartTip from './ChartTip.vue'
import { niceTicks } from './niceTicks'
import { useWidth } from './useWidth'

interface BarPoint {
  label: string
  value: number
  peak?: boolean
}

interface Props {
  data: BarPoint[]
  valueLabel?: string
  yFormat?: (n: number) => string
  height?: number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 240,
  valueLabel: 'Orders',
})

const [elRef, w] = useWidth()
const shown = useShown(120)

const padL = 44
const padR = 12
const padT = 14
const padB = 28

const hover = ref<number | null>(null)
const tip = ref<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 })

function reset() {
  hover.value = null
  tip.value = { show: false, x: 0, y: 0 }
}

const yfmt = computed(() => props.yFormat ?? Fmt.abbr)

const maxV = computed(() => Math.max(...props.data.map(d => d.value), 0))
const ticks = computed(() => niceTicks(maxV.value || 1, 4))
const top = computed(() => ticks.value.top)

const iw = computed(() => Math.max(10, w.value - padL - padR))
const ih = computed(() => props.height - padT - padB)
const band = computed(() => iw.value / Math.max(1, props.data.length))
const bw = computed(() => Math.min(band.value * 0.62, 40))

function y(v: number): number {
  return padT + ih.value - (v / top.value) * ih.value
}

// Source line 170: peak -> chart-revenue, hover & not-peak -> primary-hover,
// otherwise the muted c4. Track inactive bars at 0.55 opacity when something
// else is being hovered (peak stays at 1).
function fillFor(d: BarPoint, i: number): string {
  if (d.peak)
    return 'var(--chart-revenue)'
  if (hover.value === i)
    return 'var(--primary-hover)'

  return 'var(--c4)'
}

function opacityFor(d: BarPoint, i: number): number {
  if (hover.value === null)
    return 1
  if (i === hover.value || d.peak)
    return 1

  return 0.55
}

function onEnter(i: number, e: MouseEvent) {
  hover.value = i
  tip.value = { show: true, x: e.clientX, y: e.clientY }
}
function onMove(e: MouseEvent) {
  tip.value = { show: true, x: e.clientX, y: e.clientY }
}

const tipRows = computed(() => {
  if (hover.value === null)
    return []

  return [{
    color: 'var(--chart-revenue)',
    label: props.valueLabel,
    value: Fmt.num(props.data[hover.value].value),
  }]
})

const tipTitle = computed(() => hover.value !== null ? props.data[hover.value].label : '')
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
    v-else-if="!data.length"
    ref="elRef"
  >
    <StateFill
      icon="chart"
      title="No data for this range"
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
      <!-- gridlines + y-axis ticks -->
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
          :x="padL - 9"
          :y="y(t) + 4"
          text-anchor="end"
          font-size="11"
          fill="var(--chart-axis)"
          font-family="var(--font-mono)"
        >{{ yfmt(t) }}</text>
      </g>

      <!-- bars + peak labels + x labels + hover bands -->
      <g v-for="(d, i) in data" :key="`b${i}`">
        <rect
          class="bar-rise"
          :x="padL + band * i + (band - bw) / 2"
          :y="y(d.value)"
          :width="bw"
          :height="Math.max((d.value / top) * ih, 1)"
          rx="4"
          :fill="fillFor(d, i)"
          :opacity="opacityFor(d, i)"
          :style="{
            transition: 'opacity .12s ease, transform .6s cubic-bezier(.2,.8,.2,1)',
            transform: shown ? 'scaleY(1)' : 'scaleY(0)',
            transitionDelay: `${0.04 + i * 0.03}s`,
          }"
        />
        <text
          v-if="d.peak"
          :x="padL + band * i + bw / 2 + (band - bw) / 2"
          :y="y(d.value) - 7"
          text-anchor="middle"
          font-size="11"
          font-weight="700"
          fill="var(--chart-revenue)"
        >{{ d.value }}</text>
        <text
          :x="padL + band * i + bw / 2 + (band - bw) / 2"
          :y="height - 9"
          text-anchor="middle"
          font-size="11"
          fill="var(--chart-axis)"
        >{{ d.label }}</text>
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

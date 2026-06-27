<script setup lang="ts">
import { fmtAbbr, fmtNum } from './utils/format'
import { niceTicks } from './utils/niceTicks'
import { useWidth } from './utils/useWidth'
import Skeleton from './Skeleton.vue'
import StateFill from './StateFill.vue'
import ChartTip from './ChartTip.vue'

interface BarPoint {
  label: string
  value: number
  peak?: boolean
}

interface Props {
  data: BarPoint[]
  height?: number
  valueLabel?: string
  yFormat?: (n: number) => string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 240,
  valueLabel: 'Orders',
})

const [elRef, w] = useWidth()

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

const yfmt = computed(() => props.yFormat ?? fmtAbbr)

const maxV = computed(() => {
  let m = 0
  for (const d of props.data) {
    if (d.value > m)
      m = d.value
  }

  return m
})

const ticks = computed(() => niceTicks(maxV.value || 1, 4))
const top = computed(() => ticks.value.top)

const iw = computed(() => Math.max(10, w.value - padL - padR))
const ih = computed(() => props.height - padT - padB)
const band = computed(() => iw.value / Math.max(1, props.data.length))
const bw = computed(() => Math.min(band.value * 0.62, 40))

function y(v: number): number {
  return padT + ih.value - (v / top.value) * ih.value
}

function fillFor(d: BarPoint, i: number): string {
  if (d.peak)
    return 'rgb(var(--v-theme-chart-revenue))'
  if (hover.value === i)
    return 'rgb(var(--v-theme-primary-hover))'

  return 'rgb(var(--v-theme-c4))'
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
    color: 'rgb(var(--v-theme-chart-revenue))',
    label: props.valueLabel,
    value: fmtNum(props.data[hover.value].value),
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
    <StateFill icon="bx-bar-chart-alt-2" title="No data for this range" />
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
      overflow="visible"
      style="display: block; overflow: visible;"
    >
      <!-- gridlines + ticks -->
      <g v-for="(t, i) in ticks.ticks" :key="`g${i}`">
        <line
          :x1="padL"
          :x2="w - padR"
          :y1="y(t)"
          :y2="y(t)"
          stroke="rgb(var(--v-theme-chart-grid))"
          stroke-width="1"
        />
        <text
          :x="padL - 9"
          :y="y(t) + 4"
          text-anchor="end"
          font-size="11"
          fill="rgb(var(--v-theme-chart-axis))"
          font-family="var(--font-mono)"
        >{{ yfmt(t) }}</text>
      </g>

      <g v-for="(d, i) in data" :key="`b${i}`">
        <rect
          :x="padL + band * i + (band - bw) / 2"
          :y="y(d.value)"
          :width="bw"
          :height="Math.max((d.value / top) * ih, 1)"
          rx="4"
          :fill="fillFor(d, i)"
          :opacity="opacityFor(d, i)"
          style="transition: opacity .12s;"
        />
        <text
          v-if="d.peak"
          :x="padL + band * i + band / 2"
          :y="y(d.value) - 7"
          text-anchor="middle"
          font-size="11"
          font-weight="700"
          fill="rgb(var(--v-theme-chart-revenue))"
        >{{ d.value }}</text>
        <text
          :x="padL + band * i + band / 2"
          :y="height - 9"
          text-anchor="middle"
          font-size="11"
          fill="rgb(var(--v-theme-chart-axis))"
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

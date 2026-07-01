<script setup lang="ts">
/**
 * Tiny inline line+area chart. Animates the line-draw on shown.
 * Direct port of Sparkline(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 98-122).
 *
 * - Line: stroke-dashoffset 1 -> 0 via .9s cubic-bezier transition.
 * - Area: linear gradient fading the stroke color from 22% -> 0% opacity.
 * - Optional trailing dot at last point.
 * - colorByTrend swaps to success/error based on last vs first sample.
 */
import { useShown } from '@/composables/useAlphaMotion'

interface Props {
  width?: number
  height?: number
  data: number[]
  color?: string
  colorByTrend?: boolean
  fill?: boolean
  dot?: boolean
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 120,
  height: 34,
  color: 'var(--chart-revenue)',
  colorByTrend: false,
  fill: true,
  dot: true,
  delay: 60,
})

const shown = useShown(props.delay)
const gradId = `spk${Math.random().toString(36).slice(2, 7)}`

const computed_color = computed(() => {
  if (!props.colorByTrend || props.data.length < 2)
    return props.color
  const up = props.data[props.data.length - 1] >= props.data[0]
  return up ? 'var(--success)' : 'var(--error)'
})

const geometry = computed(() => {
  const data = props.data
  if (!data.length)
    return null
  const w = props.width
  const h = props.height
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [
    (i / Math.max(1, data.length - 1)) * (w - 4) + 2,
    h - 3 - ((v - min) / span) * (h - 6),
  ] as [number, number])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const area = `${line} L${last[0]} ${h} L${first[0]} ${h} Z`
  return { pts, line, area, last }
})
</script>

<template>
  <svg
    v-if="geometry"
    :width="width"
    :height="height"
    style="display: block; overflow: visible;"
  >
    <defs>
      <linearGradient
        :id="gradId"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop offset="0%" :stop-color="computed_color" stop-opacity="0.22" />
        <stop offset="100%" :stop-color="computed_color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path
      v-if="fill"
      :d="geometry.area"
      :fill="`url(#${gradId})`"
      :style="{ opacity: shown ? 1 : 0, transition: 'opacity .6s ease .2s' }"
    />
    <path
      class="spark-line"
      path-length="1"
      :d="geometry.line"
      fill="none"
      :stroke="computed_color"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
      :style="{
        strokeDasharray: 1,
        strokeDashoffset: shown ? 0 : 1,
        transition: 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)',
      }"
    />
    <circle
      v-if="dot"
      :cx="geometry.last[0]"
      :cy="geometry.last[1]"
      r="2.6"
      :fill="computed_color"
      :style="{ opacity: shown ? 1 : 0, transition: 'opacity .3s ease .8s' }"
    />
  </svg>
  <svg
    v-else
    :width="width"
    :height="height"
  />
</template>

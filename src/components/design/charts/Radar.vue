<script setup lang="ts">
/**
 * Polygon radar chart with 4 rings + per-axis spokes.
 * Direct port of Radar(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 293-330).
 *
 * - axes: ["label", ...] (vertex labels at 1.16 * R from center).
 * - series: [{label, color, values:[per-axis]}]. Multi-series shows a legend.
 * - max defaults to 100. Animation: polygon points scale from 0 -> value on shown.
 * - Vertex dots are hoverable for tooltip per series/axis.
 */
import { useShown } from '@/composables/useAlphaMotion'
import ChartTip from '../ChartTip.vue'
import StateFill from '../StateFill.vue'
import { useTip } from './useTip'

const { t } = useI18n({ useScope: 'global' })

interface Series {
  label: string
  color: string
  values: number[]
}

interface Props {
  size?: number
  axes: string[]
  series: Series[]
  max?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 280,
  max: 100,
})

const shown = useShown(80)
const { tip, show, move, hide } = useTip()

const geom = computed(() => {
  const size = props.size
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 38
  const n = props.axes.length
  const ang = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2
  const pt = (i: number, val: number) => [
    cx + R * (val / props.max) * Math.cos(ang(i)),
    cy + R * (val / props.max) * Math.sin(ang(i)),
  ] as [number, number]
  return { size, cx, cy, R, n, pt }
})

const rings = [0.25, 0.5, 0.75, 1]

function ringPoints(r: number) {
  return props.axes.map((_, ai) => {
    const p = geom.value.pt(ai, props.max * r)
    return `${p[0]},${p[1]}`
  }).join(' ')
}

function spokePt(i: number) {
  return geom.value.pt(i, props.max)
}

function labelPt(i: number) {
  return geom.value.pt(i, props.max * 1.16)
}

function seriesPoly(s: Series) {
  return props.axes.map((_, ai) => {
    const p = geom.value.pt(ai, shown.value ? (s.values[ai] || 0) : 0)
    return `${p[0]},${p[1]}`
  }).join(' ')
}

function vertexPt(s: Series, ai: number) {
  return geom.value.pt(ai, shown.value ? (s.values[ai] || 0) : 0)
}
</script>

<template>
  <StateFill
    v-if="!axes.length"
    icon="chart"
    :title="t('No data')"
  />
  <div
    v-else
    :style="{ position: 'relative', width: `${size}px`, margin: '0 auto' }"
    @mouseleave="hide"
  >
    <svg
      :width="size"
      :height="size"
    >
      <polygon
        v-for="(r, i) in rings"
        :key="`ring${i}`"
        :points="ringPoints(r)"
        fill="none"
        stroke="var(--chart-grid)"
        stroke-width="1"
      />
      <line
        v-for="(_, ai) in axes"
        :key="`spoke${ai}`"
        :x1="geom.cx"
        :y1="geom.cy"
        :x2="spokePt(ai)[0]"
        :y2="spokePt(ai)[1]"
        stroke="var(--chart-grid)"
      />
      <text
        v-for="(lab, ai) in axes"
        :key="`lab${ai}`"
        :x="labelPt(ai)[0]"
        :y="labelPt(ai)[1]"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="11"
        font-weight="600"
        fill="var(--text-secondary)"
      >{{ lab }}</text>
      <g
        v-for="(s, si) in series"
        :key="`s${si}`"
        :style="{ transition: 'all .8s cubic-bezier(.2,.8,.2,1)' }"
      >
        <polygon
          :points="seriesPoly(s)"
          :fill="s.color"
          fill-opacity="0.16"
          :stroke="s.color"
          stroke-width="2"
          :style="{ transition: 'all .8s cubic-bezier(.2,.8,.2,1)' }"
        />
        <circle
          v-for="(_, ai) in axes"
          :key="`v${si}-${ai}`"
          :cx="vertexPt(s, ai)[0]"
          :cy="vertexPt(s, ai)[1]"
          r="3.5"
          fill="var(--surface)"
          :stroke="s.color"
          stroke-width="2"
          @mouseenter="show($event, axes[ai], [{ color: s.color, label: s.label, value: String(s.values[ai] || 0) }])"
          @mousemove="move"
        />
      </g>
    </svg>
    <div
      v-if="series.length > 1"
      class="chart-legend"
      style="justify-content: center; margin-top: 4px;"
    >
      <span
        v-for="s in series"
        :key="s.label"
        class="legend-item"
      >
        <span
          class="legend-swatch"
          :style="{ background: s.color }"
        />{{ s.label }}
      </span>
    </div>
    <ChartTip
      :show="tip.show"
      :x="tip.x"
      :y="tip.y"
      :title="tip.title"
      :rows="tip.rows"
    />
  </div>
</template>

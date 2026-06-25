<script setup lang="ts">
/**
 * Scatter / bubble plot with x+y axis ticks + per-point tooltip.
 * Direct port of Scatter(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 392-422).
 *
 * - data: [{x, y, r?, label, color?}]; r defaults to 8.
 * - niceTicks() picks both x and y top + ticks; radius transitions 0 -> r on shown.
 * - Tooltip rows: xLabel + yLabel (default "X" / "Y"); both axis values formatted.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { fmtAbbr, fmtNum } from '../utils/format'
import ChartTip from '../ChartTip.vue'
import StateFill from '../StateFill.vue'
import { niceTicks } from './niceTicks'
import { useTip } from './useTip'
import { useWidth } from './useWidth'

const { t } = useI18n({ useScope: 'global' })

interface Point {
  x: number
  y: number
  r?: number
  label: string
  color?: string
}

interface Props {
  data: Point[]
  height?: number
  xLabel?: string
  yLabel?: string
  xFormat?: (n: number) => string
  yFormat?: (n: number) => string
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
})

const shown = useShown(80)
const [boxRef, w] = useWidth()
const { tip, show, move, hide } = useTip()

const padL = 50
const padR = 16
const padT = 14
const padB = 36

const layout = computed(() => {
  const iw = Math.max(10, w.value - padL - padR)
  const ih = props.height - padT - padB
  const maxX = Math.max(0, ...props.data.map(d => d.x))
  const maxY = Math.max(0, ...props.data.map(d => d.y))
  const nx = niceTicks(maxX || 1, 4)
  const ny = niceTicks(maxY || 1, 4)
  const X = (v: number) => padL + (v / nx.top) * iw
  const Y = (v: number) => padT + ih - (v / ny.top) * ih
  return { iw, ih, nx, ny, X, Y }
})

const xFmt = computed(() => props.xFormat ?? fmtAbbr)
const yFmt = computed(() => props.yFormat ?? fmtAbbr)

const labelX = computed(() => props.xLabel || t('X'))
const labelY = computed(() => props.yLabel || t('Y'))
</script>

<template>
  <div
    v-if="!data.length"
    ref="boxRef"
  >
    <StateFill
      icon="chart"
      :title="t('No data')"
      :style="{ height: `${height}px` }"
    />
  </div>
  <div
    v-else
    ref="boxRef"
    style="position: relative;"
  >
    <svg
      :width="w"
      :height="height"
      @mouseleave="hide"
    >
      <g v-for="(tk, i) in layout.ny.ticks" :key="`yt${i}`">
        <line
          :x1="padL"
          :x2="w - padR"
          :y1="layout.Y(tk)"
          :y2="layout.Y(tk)"
          stroke="var(--chart-grid)"
        />
        <text
          :x="padL - 8"
          :y="layout.Y(tk) + 4"
          text-anchor="end"
          font-size="11"
          fill="var(--chart-axis)"
          font-family="var(--font-mono)"
        >{{ yFmt(tk) }}</text>
      </g>
      <text
        v-for="(tk, i) in layout.nx.ticks"
        :key="`xt${i}`"
        :x="layout.X(tk)"
        :y="height - 12"
        text-anchor="middle"
        font-size="11"
        fill="var(--chart-axis)"
        font-family="var(--font-mono)"
      >{{ xFmt(tk) }}</text>
      <text
        v-if="xLabel"
        :x="padL + layout.iw / 2"
        :y="height"
        text-anchor="middle"
        font-size="11"
        font-weight="600"
        fill="var(--text-tertiary)"
      >{{ xLabel }}</text>
      <circle
        v-for="(d, i) in data"
        :key="`p${i}`"
        :cx="layout.X(d.x)"
        :cy="layout.Y(d.y)"
        :r="shown ? (d.r || 8) : 0"
        :fill="d.color || 'var(--primary)'"
        fill-opacity="0.7"
        :stroke="d.color || 'var(--primary)'"
        stroke-width="1.5"
        :style="{
          transition: `r .5s cubic-bezier(.2,.8,.2,1) ${i * 0.05}s`,
          cursor: 'default',
        }"
        @mouseenter="show(
          $event,
          d.label,
          [
            { color: d.color || 'var(--primary)', label: labelX, value: fmtNum(d.x) },
            { color: d.color || 'var(--primary)', label: labelY, value: fmtNum(d.y) },
          ],
        )"
        @mousemove="move"
      />
    </svg>
    <ChartTip
      :show="tip.show"
      :x="tip.x"
      :y="tip.y"
      :title="tip.title"
      :rows="tip.rows"
    />
  </div>
</template>

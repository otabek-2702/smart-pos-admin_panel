<script setup lang="ts">
/**
 * Pareto combo chart: descending value bars + cumulative-% line on dual y-axes.
 * Direct port of ComboPareto(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 425-467).
 *
 * - Sorted descending by value; leader bar uses --chart-revenue, rest --c4.
 * - Right axis ticks are 0/25/50/75/100% for the cumulative line.
 * - Bar scaleY transition + line stroke-dashoffset draw-in on shown.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { fmtAbbr, fmtMoney } from '../utils/format'
import ChartTip from '../ChartTip.vue'
import StateFill from '../StateFill.vue'
import { niceTicks } from './niceTicks'
import { useTip } from './useTip'
import { useWidth } from './useWidth'

const { t } = useI18n({ useScope: 'global' })

interface Datum {
  label: string
  value: number
}

interface Props {
  data: Datum[]
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
})

const shown = useShown(80)
const [boxRef, w] = useWidth()
const { tip, show, move, hide } = useTip()

const padL = 48
const padR = 46
const padT = 16
const padB = 46

const sorted = computed(() => props.data.slice().sort((a, b) => b.value - a.value))

const layout = computed(() => {
  const data = sorted.value
  const iw = Math.max(10, w.value - padL - padR)
  const ih = props.height - padT - padB
  const total = data.reduce((a, b) => a + b.value, 0) || 1
  const maxV = Math.max(1, ...data.map(d => d.value))
  const { top, ticks } = niceTicks(maxV, 4)
  const band = iw / Math.max(1, data.length)
  const bw = Math.min(band * 0.6, 44)
  const y = (v: number) => padT + ih - (v / top) * ih
  const yC = (p: number) => padT + ih - (p / 100) * ih
  let acc = 0
  const cum = data.map(d => {
    acc += d.value
    return (acc / total) * 100
  })
  const linePts = cum.map((p, i) => [padL + band * i + band / 2, yC(shown.value ? p : 0)] as [number, number])
  const line = linePts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  return { data, iw, ih, total, top, ticks, band, bw, y, yC, cum, linePts, line }
})

const labelValue = computed(() => t('Value'))
const labelCumulative = computed(() => t('Cumulative'))
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
      <g v-for="(tk, i) in layout.ticks" :key="`yt${i}`">
        <line
          :x1="padL"
          :x2="w - padR"
          :y1="layout.y(tk)"
          :y2="layout.y(tk)"
          stroke="var(--chart-grid)"
        />
        <text
          :x="padL - 8"
          :y="layout.y(tk) + 4"
          text-anchor="end"
          font-size="11"
          fill="var(--chart-axis)"
          font-family="var(--font-mono)"
        >{{ fmtAbbr(tk) }}</text>
      </g>
      <text
        v-for="(p, i) in [0, 25, 50, 75, 100]"
        :key="`r${i}`"
        :x="w - padR + 8"
        :y="layout.yC(p) + 4"
        font-size="10"
        fill="var(--chart-axis)"
        font-family="var(--font-mono)"
      >{{ p }}%</text>
      <g v-for="(d, i) in layout.data" :key="`b${i}`">
        <rect
          :x="padL + layout.band * i + (layout.band - layout.bw) / 2"
          :y="layout.y(d.value)"
          :width="layout.bw"
          :height="Math.max(0, (d.value / layout.top) * layout.ih)"
          rx="4"
          :fill="i === 0 ? 'var(--chart-revenue)' : 'var(--c4)'"
          :style="{
            transformBox: 'fill-box',
            transformOrigin: 'bottom',
            transform: shown ? 'scaleY(1)' : 'scaleY(0)',
            transition: `transform .6s cubic-bezier(.2,.8,.2,1) ${i * 0.04}s`,
          }"
          @mouseenter="show(
            $event,
            d.label,
            [
              { color: 'var(--chart-revenue)', label: labelValue, value: fmtMoney(d.value) },
              { color: 'var(--chart-expense)', label: labelCumulative, value: `${Math.round(layout.cum[i])}%` },
            ],
          )"
          @mousemove="move"
        />
        <text
          :x="padL + layout.band * i + layout.band / 2"
          :y="height - 26"
          text-anchor="middle"
          font-size="10"
          fill="var(--chart-axis)"
        >{{ d.label.length > 9 ? `${d.label.slice(0, 8)}…` : d.label }}</text>
      </g>
      <path
        :d="layout.line"
        fill="none"
        stroke="var(--chart-expense)"
        stroke-width="2.5"
        stroke-linejoin="round"
        :style="{
          strokeDasharray: 1,
          strokeDashoffset: shown ? 0 : 1,
          transition: 'stroke-dashoffset 1s ease .3s',
        }"
        path-length="1"
      />
      <circle
        v-for="(p, i) in layout.linePts"
        :key="`d${i}`"
        :cx="p[0]"
        :cy="p[1]"
        r="3.5"
        fill="var(--surface)"
        stroke="var(--chart-expense)"
        stroke-width="2"
        :style="{ opacity: shown ? 1 : 0, transition: `opacity .3s ease ${0.4 + i * 0.05}s` }"
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

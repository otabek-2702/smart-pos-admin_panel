<script setup lang="ts">
/**
 * Row-greedy treemap with palette colors + per-rect entrance + tooltip.
 * Direct port of Treemap(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 242-290).
 *
 * Packing: greedy horizontal strips of ceil(sqrt(N)) items each. Within each
 * strip the row height matches the strip's share of total, and width is
 * proportional to value within the strip. Big-enough rects (w>64 && h>38)
 * print label + abbreviated value over the fill.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { fmtAbbr, fmtMoney } from '../utils/format'
import ChartTip from '../ChartTip.vue'
import StateFill from '../StateFill.vue'
import { useTip } from './useTip'
import { useWidth } from './useWidth'

const { t } = useI18n({ useScope: 'global' })

interface Datum {
  label: string
  value: number
  color?: string
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

const palette = [
  'var(--c1)',
  'var(--c2)',
  'var(--c3)',
  'var(--c4)',
  'var(--c5)',
  'var(--primary-hover)',
]

const sorted = computed(() => props.data.slice().sort((a, b) => b.value - a.value))
const total = computed(() => sorted.value.reduce((a, b) => a + b.value, 0) || 1)

const rects = computed(() => {
  if (!w.value)
    return [] as { d: Datum; x: number; y: number; w: number; h: number; color: string }[]
  const out: { d: Datum; x: number; y: number; w: number; h: number; color: string }[] = []
  const data = sorted.value
  const cols = Math.max(1, Math.ceil(Math.sqrt(data.length)))
  let idx = 0
  let y = 0
  while (idx < data.length) {
    const rowItems = data.slice(idx, idx + cols)
    const rowVal = rowItems.reduce((a, b) => a + b.value, 0) || 1
    const rowH = (rowVal / total.value) * props.height
    let rx = 0
    rowItems.forEach((d, j) => {
      const rw = (d.value / rowVal) * w.value
      out.push({ d, x: rx, y, w: rw, h: rowH, color: d.color || palette[(idx + j) % palette.length] })
      rx += rw
    })
    y += rowH
    idx += cols
  }
  return out
})

const labelRevenue = computed(() => t('Revenue'))
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
    :style="{ position: 'relative', height: `${height}px` }"
  >
    <svg
      :width="w"
      :height="height"
      overflow="visible"
      style="overflow: visible;"
      @mouseleave="hide"
    >
      <g
        v-for="(r, i) in rects"
        :key="`r${i}`"
        :style="{
          opacity: shown ? 1 : 0,
          transform: shown ? 'none' : 'scale(.92)',
          transformBox: 'fill-box',
          transformOrigin: 'center',
          transition: `opacity .5s ease ${i * 0.04}s, transform .5s cubic-bezier(.2,.8,.2,1) ${i * 0.04}s`,
        }"
        @mouseenter="show(
          $event,
          r.d.label,
          [{
            color: r.color,
            label: labelRevenue,
            value: `${fmtMoney(r.d.value)} (${Math.round((r.d.value / total) * 100)}%)`,
          }],
        )"
        @mousemove="move"
      >
        <rect
          :x="r.x + 2"
          :y="r.y + 2"
          :width="Math.max(0, r.w - 4)"
          :height="Math.max(0, r.h - 4)"
          rx="8"
          :fill="r.color"
        />
        <template v-if="r.w > 64 && r.h > 38">
          <text
            :x="r.x + 12"
            :y="r.y + 24"
            font-size="13"
            font-weight="700"
            fill="#fff"
          >{{ r.d.label }}</text>
          <text
            :x="r.x + 12"
            :y="r.y + 42"
            font-size="12"
            font-family="var(--font-mono)"
            fill="rgba(255,255,255,.85)"
          >{{ fmtAbbr(r.d.value) }}</text>
        </template>
      </g>
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

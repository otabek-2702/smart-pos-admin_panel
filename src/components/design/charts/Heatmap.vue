<script setup lang="ts">
/**
 * Hour x day matrix grid with opacity gradient on a single base color.
 * Direct port of Heatmap(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 195-239).
 *
 * - rows/cols are label arrays; matrix[r][c] = value.
 * - Cell opacity scales 0.12 -> 1 based on value/max; zero values get 0.04.
 * - Optional legend strip at the bottom shows Less ... More gradient swatches.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { fmtNum } from '../utils/format'
import ChartTip from '../ChartTip.vue'
import StateFill from '../StateFill.vue'
import { useTip } from './useTip'
import { useWidth } from './useWidth'

const { t } = useI18n({ useScope: 'global' })

interface Props {
  rows: string[]
  cols: string[]
  matrix: number[][]
  /** RGB base (e.g. "58, 91, 219" for primary). Defaults to primary. */
  color?: string
  /** Tooltip unit label (defaults to t('Value')). */
  unit?: string
  scale?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  color: '58, 91, 219',
  unit: '',
  scale: true,
})

const shown = useShown(80)
const [boxRef, w] = useWidth()
const { tip, show, move, hide } = useTip()

const labelW = 42
const gap = 3
const padT = 22

const layout = computed(() => {
  const cols = props.cols.length
  const cw = Math.max(8, (w.value - labelW - gap * Math.max(0, cols - 1)) / Math.max(1, cols))
  const ch = Math.min(cw, 30)
  const max = Math.max(1, ...props.matrix.flat())
  const h = padT + props.rows.length * (ch + gap)
  return { cw, ch, max, h }
})

const tipUnit = computed(() => props.unit || t('Value'))
const labelLess = computed(() => t('Less'))
const labelMore = computed(() => t('More'))

function cellOpacity(v: number) {
  if (v === 0)
    return 0.04
  return 0.12 + (v / layout.value.max) * 0.88
}

function cellLabel(rLab: string, cLab: string) {
  return `${rLab} · ${cLab}`
}
</script>

<template>
  <div
    v-if="!rows.length || !cols.length"
    ref="boxRef"
  >
    <StateFill
      icon="chart"
      :title="t('No data')"
    />
  </div>
  <div
    v-else
    ref="boxRef"
    style="position: relative;"
  >
    <svg
      :width="w"
      :height="layout.h"
      style="display: block;"
      @mouseleave="hide"
    >
      <template v-for="(c, ci) in cols" :key="`c${ci}`">
        <text
          v-if="ci % (cols.length > 16 ? 2 : 1) === 0"
          :x="labelW + ci * (layout.cw + gap) + layout.cw / 2"
          :y="14"
          text-anchor="middle"
          font-size="10"
          fill="var(--chart-axis)"
        >{{ c }}</text>
      </template>
      <g v-for="(rLab, ri) in rows" :key="`r${ri}`">
        <text
          :x="labelW - 8"
          :y="padT + ri * (layout.ch + gap) + layout.ch / 2 + 4"
          text-anchor="end"
          font-size="11"
          font-weight="600"
          fill="var(--text-secondary)"
        >{{ rLab }}</text>
        <rect
          v-for="(cLab, ci) in cols"
          :key="`cell${ri}-${ci}`"
          :x="labelW + ci * (layout.cw + gap)"
          :y="padT + ri * (layout.ch + gap)"
          :width="layout.cw"
          :height="layout.ch"
          rx="4"
          :fill="`rgba(${color}, ${cellOpacity((matrix[ri] && matrix[ri][ci]) || 0)})`"
          :style="{
            opacity: shown ? 1 : 0,
            transition: `opacity .5s ease ${(ri + ci) * 0.012}s`,
            cursor: 'default',
          }"
          @mouseenter="show(
            $event,
            cellLabel(rLab, cLab),
            [{ color: 'var(--primary)', label: tipUnit, value: fmtNum((matrix[ri] && matrix[ri][ci]) || 0) }],
          )"
          @mousemove="move"
        />
      </g>
    </svg>
    <div
      v-if="scale"
      class="row"
      style="gap: 8px; justify-content: flex-end; margin-top: 10px; font-size: 11px; color: var(--text-tertiary);"
    >
      <span>{{ labelLess }}</span>
      <span
        v-for="(o, i) in [0.08, 0.3, 0.55, 0.8, 1]"
        :key="i"
        :style="{
          width: '16px',
          height: '12px',
          borderRadius: '3px',
          background: `rgba(${color},${o})`,
        }"
      />
      <span>{{ labelMore }}</span>
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

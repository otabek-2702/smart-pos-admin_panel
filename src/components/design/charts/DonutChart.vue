<script setup lang="ts">
/**
 * Donut chart with center label/value + legend on the right.
 * Direct port of DonutChart(props) in
 * .tmp-alpha-design/alpha-design-source/charts.svg.jsx (lines 223-280).
 *
 * - Loading state -> circular Skeleton sized = size, empty/all-zero -> StateFill.
 * - Arcs computed via param-equation: start at -0.25 (top), accumulate
 *   fractions, leave a `gap * Math.PI` radian wedge between adjacent slices.
 * - Entrance: SVG carries class `donut-in` (CSS handles the actual transition);
 *   inline style applies opacity 0 -> 1 + transform rotate(-10deg) scale(.9) ->
 *   none once useShown(120) flips.
 * - Hover: dim non-hovered arcs to 0.4 opacity + scale(1.03) on hover; legend
 *   rows mirror with 0.5 dim. ChartTip follows the cursor with one row.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { Fmt } from '../utils/format'
import Skeleton from '../Skeleton.vue'
import StateFill from '../StateFill.vue'
import ChartTip from './ChartTip.vue'

const { t } = useI18n({ useScope: 'global' })

interface DonutSlice {
  label: string
  value: number
  color: string
}

interface Props {
  data: DonutSlice[]
  size?: number
  centerLabel?: string
  centerValue?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 200,
})

const hover = ref<number | null>(null)
const shown = useShown(120)
const tip = ref<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 })

function reset() {
  hover.value = null
  tip.value = { show: false, x: 0, y: 0 }
}

const total = computed(() => props.data.reduce((a, b) => a + b.value, 0))

const geom = computed(() => {
  const R = props.size / 2
  const r = R * 0.62
  const cx = R
  const cy = R

  return { R, r, cx, cy }
})

const arcs = computed(() => {
  const { R, r, cx, cy } = geom.value
  const gap = 0.018
  let acc = -0.25
  const t = total.value || 1

  return props.data.map(d => {
    const frac = d.value / t
    const a0 = acc * 2 * Math.PI + gap * Math.PI
    const a1 = (acc + frac) * 2 * Math.PI - gap * Math.PI
    acc += frac
    const big = (a1 - a0) > Math.PI ? 1 : 0
    const p = (ang: number, rad: number): [number, number] => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]
    const o0 = p(a0, R)
    const o1 = p(a1, R)
    const i1 = p(a1, r)
    const i0 = p(a0, r)
    const path
      = `M${o0[0]} ${o0[1]} A${R} ${R} 0 ${big} 1 ${o1[0]} ${o1[1]}`
      + ` L${i1[0]} ${i1[1]} A${r} ${r} 0 ${big} 0 ${i0[0]} ${i0[1]} Z`

    return { path, frac, d }
  })
})

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
  const d = props.data[hover.value]
  const pct = Math.round(d.value / (total.value || 1) * 100)

  return [{ color: d.color, label: 'Amount', value: `${Fmt.num(d.value)} (${pct}%)` }]
})

const tipTitle = computed(() => hover.value !== null ? props.data[hover.value].label : '')
</script>

<template>
  <div
    v-if="loading"
    :style="{ height: `${size}px`, display: 'grid', placeItems: 'center' }"
  >
    <Skeleton :w="size" :h="size" :style="{ borderRadius: '50%' }" />
  </div>
  <StateFill
    v-else-if="!data.length || data.every(d => !d.value)"
    icon="chart"
    :title="t('No data for this range')"
    :style="{ height: `${size}px` }"
  />
  <div
    v-else
    class="row"
    style="gap: 24px; align-items: center; flex-wrap: wrap;"
    @mouseleave="reset"
  >
    <div style="position: relative; flex: 0 0 auto;">
      <svg
        class="donut-in"
        :width="size"
        :height="size"
        :style="{
          opacity: shown ? 1 : 0,
          transform: shown ? 'none' : 'rotate(-10deg) scale(.9)',
        }"
      >
        <path
          v-for="(a, i) in arcs"
          :key="`a${i}`"
          :d="a.path"
          :fill="a.d.color"
          :opacity="hover !== null && hover !== i ? 0.4 : 1"
          :style="{
            transition: 'opacity .12s',
            cursor: 'default',
            transformOrigin: `${geom.cx}px ${geom.cy}px`,
            transform: hover === i ? 'scale(1.03)' : 'scale(1)',
          }"
          @mouseenter="onEnter(i, $event)"
          @mousemove="onMove($event)"
        />
        <text
          :x="geom.cx"
          :y="geom.cy - 4"
          text-anchor="middle"
          class="donut-center donut-center__v"
          font-size="22"
        >{{ centerValue || Fmt.abbr(total) }}</text>
        <text
          :x="geom.cx"
          :y="geom.cy + 16"
          text-anchor="middle"
          class="donut-center donut-center__l"
          font-size="11"
        >{{ centerLabel || 'Total' }}</text>
      </svg>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 160px;">
      <div
        v-for="(d, i) in data"
        :key="`l${i}`"
        class="row between"
        :style="{
          opacity: hover !== null && hover !== i ? 0.5 : 1,
          transition: 'opacity .12s',
        }"
        @mouseenter="hover = i"
        @mouseleave="hover = null"
      >
        <span class="legend-item">
          <span
            class="legend-swatch"
            :style="{ background: d.color }"
          />
          {{ d.label }}
        </span>
        <span class="row" style="gap: 8px;">
          <b class="mono" style="font-size: var(--fs-sm);">{{ Fmt.abbr(d.value) }}</b>
          <span class="tertiary mono" style="font-size: var(--fs-label); width: 38px; text-align: right;">
            {{ Math.round((d.value / (total || 1)) * 100) }}%
          </span>
        </span>
      </div>
    </div>
    <ChartTip
      :show="tip.show"
      :x="tip.x"
      :y="tip.y"
      :title="tipTitle"
      :rows="tipRows"
    />
  </div>
</template>

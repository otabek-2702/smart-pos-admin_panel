<script setup lang="ts">
/**
 * Treemap — squarified-ish row-based slice/dice port of charts2.jsx Treemap.
 * Pure SVG, no chart libs. Tooltip via ChartTip. i18n labels via t().
 */
import { fmtAbbr, fmtMoney } from './utils/format'
import { useWidth } from './utils/useWidth'
import StateFill from './StateFill.vue'
import ChartTip from './ChartTip.vue'

interface TreemapDatum {
  label: string
  value: number
  color?: string
}

interface Props {
  data: TreemapDatum[]
  height?: number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  loading: false,
})

const { t } = useI18n({ useScope: 'global' })

const [elRef, w] = useWidth()

const hover = ref<number | null>(null)
const tip = ref<{ show: boolean; x: number; y: number }>({ show: false, x: 0, y: 0 })

function reset() {
  hover.value = null
  tip.value = { show: false, x: 0, y: 0 }
}

const sorted = computed(() =>
  [...(props.data || [])].sort((a, b) => b.value - a.value),
)

const total = computed(() => sorted.value.reduce((a, b) => a + b.value, 0) || 1)

const palette = [
  'var(--c1)',
  'var(--c2)',
  'var(--c3)',
  'var(--c4)',
  'var(--c5)',
  'var(--primary-hover)',
]

interface Rect {
  d: TreemapDatum
  x: number
  y: number
  w: number
  h: number
}

const rects = computed<Rect[]>(() => {
  if (!w.value || !sorted.value.length)
    return []
  const out: Rect[] = []
  const data = sorted.value
  const cols = Math.ceil(Math.sqrt(data.length))
  let y = 0
  let idx = 0
  while (idx < data.length) {
    const rowItems = data.slice(idx, idx + cols)
    const rowVal = rowItems.reduce((a, b) => a + b.value, 0) || 1
    const rowH = (rowVal / total.value) * props.height
    let rx = 0
    rowItems.forEach(d => {
      const rw = (d.value / rowVal) * w.value
      out.push({ d, x: rx, y, w: rw, h: rowH })
      rx += rw
    })
    y += rowH
    idx += cols
  }
  return out
})

function colorFor(r: Rect, i: number): string {
  return r.d.color || palette[i % palette.length]
}

function onEnter(i: number, e: MouseEvent) {
  hover.value = i
  tip.value = { show: true, x: e.clientX, y: e.clientY }
}
function onMove(e: MouseEvent) {
  tip.value = { show: true, x: e.clientX, y: e.clientY }
}

const tipTitle = computed(() => hover.value !== null ? rects.value[hover.value]?.d.label || '' : '')
const tipRows = computed(() => {
  if (hover.value === null)
    return []
  const r = rects.value[hover.value]
  if (!r)
    return []
  const pct = Math.round((r.d.value / total.value) * 100)
  return [{
    color: colorFor(r, hover.value),
    label: t('Revenue'),
    value: `${fmtMoney(r.d.value)} (${pct}%)`,
  }]
})
</script>

<template>
  <div
    v-if="loading"
    ref="elRef"
    :style="{ height: `${height}px`, display: 'grid', placeItems: 'center' }"
  >
    <div class="sk-box treemap-sk" :style="{ width: '100%', height: '100%', borderRadius: '8px' }" />
  </div>
  <div
    v-else-if="!sorted.length"
    ref="elRef"
    :style="{ height: `${height}px` }"
  >
    <StateFill icon="bx-grid" :title="t('No data')" />
  </div>
  <div
    v-else
    ref="elRef"
    :style="{ position: 'relative', height: `${height}px` }"
    @mouseleave="reset"
  >
    <svg
      :width="w"
      :height="height"
      style="display: block;"
    >
      <g v-for="(r, i) in rects" :key="`tm${i}`">
        <rect
          :x="r.x + 2"
          :y="r.y + 2"
          :width="Math.max(0, r.w - 4)"
          :height="Math.max(0, r.h - 4)"
          rx="8"
          :fill="colorFor(r, i)"
          :opacity="hover !== null && hover !== i ? 0.55 : 1"
          style="transition: opacity .12s;"
          @mouseenter="onEnter(i, $event)"
          @mousemove="onMove($event)"
        />
        <template v-if="r.w > 64 && r.h > 38">
          <text
            :x="r.x + 12"
            :y="r.y + 24"
            font-size="13"
            font-weight="700"
            fill="#fff"
            style="pointer-events: none;"
          >{{ r.d.label }}</text>
          <text
            :x="r.x + 12"
            :y="r.y + 42"
            font-size="12"
            font-family="var(--font-mono)"
            fill="rgba(255,255,255,.85)"
            style="pointer-events: none;"
          >{{ fmtAbbr(r.d.value) }}</text>
        </template>
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

<style scoped>
.treemap-sk {
  background: rgba(var(--v-theme-on-surface), 0.06);
  animation: sk-pulse 1.5s ease-in-out infinite;
}
@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
</style>

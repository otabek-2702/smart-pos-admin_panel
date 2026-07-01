<script setup lang="ts">
/**
 * Radial 270deg arc gauge (track + filled-arc) with center value + label.
 * Direct port of Gauge(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 63-95).
 *
 * Arc sweep: 0.75pi -> 2.25pi (270deg). Fill animates from 0 -> pct on shown.
 * Color defaults to var(--primary); track is var(--chart-track).
 */
import { useShown } from '@/composables/useAlphaMotion'

interface Props {
  size?: number
  value?: number
  max?: number
  stroke?: number
  color?: string
  centerValue?: string
  label?: string
  footer?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 200,
  value: 0,
  max: 100,
  stroke: 16,
  color: 'var(--primary)',
  centerValue: '',
  label: '',
  footer: '',
})

const shown = useShown(80)

const geom = computed(() => {
  const size = props.size
  const stroke = props.stroke
  const r = (size - stroke) / 2 - 6
  const cx = size / 2
  const cy = size / 2
  const startA = Math.PI * 0.75
  const endA = Math.PI * 2.25
  const sweep = endA - startA
  const polar = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
  function arcPath(a0: number, a1: number) {
    const [x0, y0] = polar(a0)
    const [x1, y1] = polar(a1)
    const large = (a1 - a0) > Math.PI ? 1 : 0
    return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`
  }
  return { size, stroke, r, cx, cy, startA, endA, sweep, arcPath }
})

const pct = computed(() => Math.max(0, Math.min(1, props.value / (props.max || 1))))

const fullPath = computed(() => geom.value.arcPath(geom.value.startA, geom.value.endA))

const valPath = computed(() => {
  const g = geom.value
  const valA = g.startA + g.sweep * (shown.value ? pct.value : 0)
  return g.arcPath(g.startA, valA)
})

const display = computed(() => props.centerValue || `${Math.round(pct.value * 100)}%`)
</script>

<template>
  <div
    :style="{
      position: 'relative',
      width: `${size}px`,
      height: `${size * 0.82}px`,
      margin: '0 auto',
    }"
  >
    <svg
      :width="size"
      :height="size * 0.92"
      :viewBox="`0 0 ${size} ${size * 0.92}`"
    >
      <path
        :d="fullPath"
        fill="none"
        stroke="var(--chart-track)"
        :stroke-width="stroke"
        stroke-linecap="round"
      />
      <path
        :d="valPath"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        style="transition: all 1s cubic-bezier(.2,.8,.2,1);"
      />
      <text
        :x="geom.cx"
        :y="geom.cy - 2"
        text-anchor="middle"
        font-family="var(--font-mono)"
        font-weight="700"
        :font-size="size * 0.17"
        fill="var(--text)"
        letter-spacing="-0.02em"
      >
        {{ display }}
      </text>
      <text
        :x="geom.cx"
        :y="geom.cy + size * 0.12"
        text-anchor="middle"
        :font-size="size * 0.066"
        font-weight="600"
        fill="var(--text-secondary)"
      >
        {{ label }}
      </text>
    </svg>
    <div
      v-if="footer"
      :style="{ textAlign: 'center', marginTop: '-6px', fontSize: '13px', color: 'var(--text-tertiary)' }"
    >
      {{ footer }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Compact circular progress ring with centered value.
 * Direct port of ProgressRing(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 470-488).
 *
 * - SVG rotated -90deg so the stroke draws from 12 o'clock.
 * - stroke-dashoffset transitions c -> c*(1-pct) on shown.
 * - centerValue defaults to "{pct}%".
 */
import { useShown } from '@/composables/useAlphaMotion'

interface Props {
  size?: number
  stroke?: number
  value?: number
  max?: number
  color?: string
  centerValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 92,
  stroke: 9,
  value: 0,
  max: 100,
  color: 'var(--primary)',
  centerValue: '',
})

const shown = useShown(80)

const geom = computed(() => {
  const size = props.size
  const stroke = props.stroke
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, props.value / (props.max || 1)))
  return { size, stroke, r, c, pct }
})

const display = computed(() => props.centerValue || `${Math.round(geom.value.pct * 100)}%`)
</script>

<template>
  <div :style="{ position: 'relative', width: `${size}px`, height: `${size}px` }">
    <svg
      :width="size"
      :height="size"
      style="transform: rotate(-90deg);"
    >
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="geom.r"
        fill="none"
        stroke="var(--chart-track)"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="geom.r"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="geom.c"
        :stroke-dashoffset="shown ? geom.c * (1 - geom.pct) : geom.c"
        style="transition: stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1);"
      />
    </svg>
    <div
      style="position: absolute; inset: 0; display: grid; place-items: center;"
    >
      <span
        class="mono"
        :style="{ fontWeight: 700, fontSize: `${size * 0.2}px`, lineHeight: 1 }"
      >
        {{ display }}
      </span>
    </div>
  </div>
</template>

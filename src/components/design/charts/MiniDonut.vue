<script setup lang="ts">
/**
 * Compact 1-slice donut showing percentage of a max.
 *
 * The source file (`charts2.jsx` line 7) advertises a MiniDonut export but the
 * implementation block isn't present in the v3 handoff. To keep the surface
 * complete we ship a small wrapper around <ProgressRing> that matches the
 * documented intent (compact arc + center value) so callers in the v3
 * dashboards don't fail to import.
 */
import ProgressRing from './ProgressRing.vue'

interface Props {
  size?: number
  stroke?: number
  value?: number
  max?: number
  color?: string
  centerValue?: string
}

withDefaults(defineProps<Props>(), {
  size: 64,
  stroke: 7,
  value: 0,
  max: 100,
  color: 'var(--primary)',
  centerValue: '',
})
</script>

<template>
  <ProgressRing
    :size="size"
    :stroke="stroke"
    :value="value"
    :max="max"
    :color="color"
    :center-value="centerValue"
  />
</template>

<script setup lang="ts">
/**
 * Thin re-export wrapper. Real implementation lives in ../ChartTip.vue so both
 * the design/ and design/charts/ variants share the same viewport-clamp logic.
 */
import RootChartTip from '../ChartTip.vue'

interface TipRow { color?: string; label: string; value: string }

const props = withDefaults(defineProps<{
  show: boolean
  x?: number
  y?: number
  title?: string
  rows: TipRow[]
}>(), { x: 0, y: 0, title: '' })
</script>

<template>
  <RootChartTip
    :show="props.show"
    :x="props.x"
    :y="props.y"
    :title="props.title"
    :rows="props.rows"
  />
</template>

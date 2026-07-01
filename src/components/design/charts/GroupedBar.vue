<script setup lang="ts">
/**
 * Thin wrapper over <StackedBar grouped /> — bars sit side-by-side per band
 * instead of stacked. Exposed as its own component for caller clarity, since
 * the source `charts2.jsx` distinguishes the two modes by prop only.
 */
import StackedBar from './StackedBar.vue'

interface Series {
  key: string
  label: string
  color: string
}

interface Datum {
  label: string
  values: Record<string, number>
}

interface Props {
  data: Datum[]
  series: Series[]
  height?: number
  yFormat?: (n: number) => string
}

defineProps<Props>()
</script>

<template>
  <StackedBar
    :data="data"
    :series="series"
    :height="height"
    :y-format="yFormat"
    grouped
  />
</template>

<script setup lang="ts">
/**
 * Fixed-position hover tooltip used by every chart in this folder.
 * Direct port of ChartTip(props) in
 * .tmp-alpha-design/alpha-design-source/charts.svg.jsx (lines 22-37).
 *
 * Returns null when !show. Otherwise positions at (x, y) and renders an
 * optional title + a list of {color, label, value} rows. Styling is global
 * (.charttip / .charttip__t / .charttip__row / .charttip__v / .legend-swatch
 * in src/styles/design-shell.css) — no scoped styles here.
 */
interface TipRow {
  color?: string
  label: string
  value: string
}

interface Props {
  show: boolean
  x?: number
  y?: number
  title?: string
  rows: TipRow[]
}

withDefaults(defineProps<Props>(), {
  x: 0,
  y: 0,
  title: '',
})
</script>

<template>
  <div
    v-if="show"
    class="charttip"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <div
      v-if="title"
      class="charttip__t"
    >
      {{ title }}
    </div>
    <div
      v-for="(r, i) in rows"
      :key="i"
      class="charttip__row"
    >
      <span
        v-if="r.color"
        class="legend-swatch"
        :style="{ background: r.color }"
      />
      <span>{{ r.label }}</span>
      <span class="charttip__v">{{ r.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TipRow {
  color?: string
  label: string
  value: string
}

interface Props {
  show: boolean
  x: number
  y: number
  title?: string
  rows: TipRow[]
}

defineProps<Props>()
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

<style scoped>
.charttip {
  position: fixed;
  z-index: 80;
  pointer-events: none;
  background: rgb(var(--v-theme-on-surface));
  color: rgb(var(--v-theme-surface));
  border-radius: var(--r-sm);
  padding: 8px 11px;
  font-size: var(--fs-sm);
  box-shadow: var(--shadow-lg);
  transform: translate(-50%, -118%);
  min-width: 92px;
  /* Smooth glide between hover points instead of teleporting */
  transition: left .12s cubic-bezier(.2, .8, .2, 1), top .12s cubic-bezier(.2, .8, .2, 1);
}
:global([data-theme="dark"]) .charttip,
:global(.v-theme--dark) .charttip {
  background: rgb(var(--v-theme-surface-2));
  color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgb(var(--v-theme-border-strong));
}
.charttip__t {
  font-size: var(--fs-label);
  opacity: .7;
  margin-bottom: 3px;
}
.charttip__row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.charttip__v {
  font-family: var(--font-mono);
  font-weight: var(--fw-bold);
  margin-left: auto;
}
.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: 0 0 10px;
}
</style>

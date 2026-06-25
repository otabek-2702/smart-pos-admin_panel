<script setup lang="ts">
/* Pure-Vue inline bar chart.
   Port of v3 MiniBars (Orders insights · hourly distribution).
   Props:
     data:   number[]      - bar values
     labels: string[]      - x-axis labels (same length as data)
*/
interface Props {
  data: number[]
  labels?: string[]
  height?: number
  barHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  labels: () => [],
  height: 64,
  barHeight: 46,
})

const mounted = ref(false)
onMounted(() => {
  nextTick(() => { mounted.value = true })
})

const max = computed(() => {
  const m = Math.max(...props.data, 0)
  return m > 0 ? m : 1
})
const peakIdx = computed(() => props.data.indexOf(max.value))

function barH(v: number) {
  if (!mounted.value) return 0
  return (v / max.value) * props.barHeight
}
function isPeak(i: number) {
  return i === peakIdx.value && props.data[i] > 0
}
function tooltipFor(i: number, v: number) {
  const l = props.labels[i] || String(i)
  return `${l} · ${v}`
}
</script>

<template>
  <div class="minibars" :style="{ height: `${height}px` }">
    <div
      v-for="(v, i) in data"
      :key="i"
      class="minibars__col"
      :title="tooltipFor(i, v)"
    >
      <div
        class="minibars__bar"
        :class="{ 'is-peak': isPeak(i) }"
        :style="{
          height: `${barH(v)}px`,
          transitionDelay: `${i * 0.025}s`,
        }"
      />
      <span v-if="labels[i] !== undefined" class="minibars__lbl mono">{{ labels[i] }}</span>
    </div>
  </div>
</template>

<style scoped>
.minibars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  width: 100%;
}
.minibars__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  justify-content: flex-end;
  min-width: 0;
}
.minibars__bar {
  width: 100%;
  min-height: 2px;
  border-radius: 3px;
  background: var(--c4, var(--text-tertiary));
  transition: height .5s cubic-bezier(.2,.8,.2,1);
}
.minibars__bar.is-peak {
  background: var(--chart-revenue, var(--primary));
}
.minibars__lbl {
  font-size: 9px;
  color: var(--text-tertiary);
  line-height: 1;
}
</style>

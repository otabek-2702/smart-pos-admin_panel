<script setup lang="ts">
/**
 * Horizontal bars with direct labels above each track.
 * Direct port of HBarChart(props) in
 * .tmp-alpha-design/alpha-design-source/charts.svg.jsx (lines 190-221).
 *
 * - Loading state -> 5 stacked Skeletons (gap 16), empty state -> StateFill.
 * - Leader row (i === 0) renders the warning-colored star icon and fills
 *   the bar in --chart-revenue; other rows fill in --c4.
 * - Entrance: each bar's `width` transitions 0% -> pct staggered by index,
 *   gated by useShown(140) (delay `0.05 + i*0.06s`).
 * - Hover dims sibling bars to 0.6 opacity.
 *
 * Source line 208 uses Icon name="star" weight=default (1.7). Inlined here
 * as raw <svg> to keep this folder lib-free.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { Fmt } from '../utils/format'
import Skeleton from '../Skeleton.vue'
import StateFill from '../StateFill.vue'

interface HBarPoint {
  name: string
  value: number
  units?: number
}

interface Props {
  data: HBarPoint[]
  valueFormat?: (n: number) => string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const hover = ref<number | null>(null)
const shown = useShown(140)

const fmt = computed(() => props.valueFormat ?? Fmt.abbr)

const maxV = computed(() => Math.max(...props.data.map(d => d.value), 0) || 1)
</script>

<template>
  <div
    v-if="loading"
    style="display: flex; flex-direction: column; gap: 16px;"
  >
    <Skeleton
      v-for="i in 5"
      :key="i"
      :h="26"
    />
  </div>
  <StateFill
    v-else-if="!data.length"
    icon="chart"
    title="No data for this range"
  />
  <div
    v-else
    style="display: flex; flex-direction: column; gap: 14px;"
  >
    <div
      v-for="(d, i) in data"
      :key="i"
      class="hbar-row"
      @mouseenter="hover = i"
      @mouseleave="hover = null"
    >
      <div class="row between" style="margin-bottom: 6px;">
        <span style="font-weight: 500; font-size: var(--fs-sm); display: flex; align-items: center; gap: 7px;">
          <svg
            v-if="i === 0"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="color: var(--warning); flex: 0 0 14px;"
          >
            <path d="m12 4 2.4 5 5.6.7-4 3.8 1 5.5L12 16l-5 3 1-5.5-4-3.8 5.6-.7L12 4Z" />
          </svg>
          {{ d.name }}
          <span
            v-if="d.units !== undefined"
            class="tertiary"
            style="font-size: var(--fs-label);"
          >· {{ d.units }} units</span>
        </span>
        <span class="mono" style="font-weight: 700; font-size: var(--fs-sm);">{{ fmt(d.value) }}</span>
      </div>
      <div style="height: 10px; border-radius: 99px; background: var(--chart-track); overflow: hidden;">
        <div
          :style="{
            width: `${shown ? (d.value / maxV) * 100 : 0}%`,
            height: '100%',
            borderRadius: '99px',
            background: i === 0 ? 'var(--chart-revenue)' : 'var(--c4)',
            opacity: hover !== null && hover !== i ? 0.6 : 1,
            transition: `width .55s cubic-bezier(.2,.8,.3,1) ${0.05 + i * 0.06}s, opacity .12s`,
          }"
        />
      </div>
    </div>
  </div>
</template>

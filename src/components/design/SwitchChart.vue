<script setup lang="ts">
/**
 * SwitchChart — interactive chart wrapper that lets the user toggle the
 * displayed metric (segmented buttons), optionally overlay a previous-period
 * comparison series, and switch between an area and a bar chart representation.
 *
 * Port of `.tmp-handoff-v3/.../pages/dash/Shared.jsx` `SwitchChart`. Source
 * exposes only 'area' + 'bar' toggle buttons but supports 'line' internally —
 * we preserve that parity: render only the area/bar segctl, but accept
 * `defaultType: 'line'` programmatically.
 */
import BarChart from './BarChart.vue'
import LineAreaChart from './LineAreaChart.vue'
import DesignIcon from './DesignIcon.vue'
import { fmtAbbr } from './utils/format'

export interface SwitchMetric {
  key: string
  label: string
  color: string
  data: number[]
  format?: (n: number) => string
}

interface Props {
  metrics: SwitchMetric[]
  categories: string[]
  defaultType?: 'area' | 'line' | 'bar'
  compareData?: Record<string, number[]>
  compareLabel?: string
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  defaultType: 'area',
  height: 300,
})

const { t } = useI18n({ useScope: 'global' })

const metricKey = ref<string>(props.metrics[0]?.key ?? '')
const type = ref<'area' | 'line' | 'bar'>(props.defaultType)
const compare = ref<boolean>(false)

const m = computed<SwitchMetric>(
  () => props.metrics.find(x => x.key === metricKey.value) || props.metrics[0],
)
const fmt = computed<(n: number) => string>(() => m.value?.format || fmtAbbr)

interface Series { key: string; label: string; color: string; data: number[]; dashed?: boolean }

const series = computed<Series[]>(() => {
  const base: Series[] = [{
    key: m.value.key,
    label: m.value.label,
    color: m.value.color,
    data: m.value.data,
  }]
  if (compare.value && props.compareData && props.compareData[m.value.key]) {
    base.push({
      key: 'cmp',
      label: props.compareLabel || t('Previous'),
      color: 'var(--chart-target)',
      data: props.compareData[m.value.key],
      dashed: true,
    })
  }
  return base
})

const lineSeries = computed<Series[]>(() =>
  series.value.map(s => ({ ...s, _noArea: true } as Series & { _noArea: boolean })),
)

const barData = computed(() =>
  props.categories.map((c, i) => ({ label: c, value: m.value.data[i] ?? 0 })),
)

// Toolbar config — only area & bar buttons (matches source).
const typeButtons: Array<{ k: 'area' | 'bar'; i: string }> = [
  { k: 'area', i: 'trend' },
  { k: 'bar', i: 'grid' },
]
</script>

<template>
  <div>
    <div class="row between wrap" style="gap: 12px; margin-bottom: 16px;">
      <div class="seg" role="tablist">
        <button
          v-for="x in metrics"
          :key="x.key"
          class="seg__btn"
          :class="{ 'is-active': metricKey === x.key }"
          @click="metricKey = x.key"
        >
          {{ x.label }}
        </button>
      </div>
      <div class="row" style="gap: 10px;">
        <button
          v-if="compareData"
          class="chip"
          :class="{ 'is-on': compare }"
          :style="compare ? undefined : {
            background: 'transparent',
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-strong)',
          }"
          @click="compare = !compare"
        >
          <DesignIcon :name="compare ? 'check' : 'plus'" :size="13" />
          {{ t('Compare') }}
        </button>
        <div class="seg" role="tablist">
          <button
            v-for="tBtn in typeButtons"
            :key="tBtn.k"
            class="seg__btn"
            :class="{ 'is-active': type === tBtn.k }"
            :title="tBtn.k"
            style="padding: 0 10px;"
            @click="type = tBtn.k"
          >
            <DesignIcon :name="tBtn.i" :size="15" />
          </button>
        </div>
      </div>
    </div>

    <BarChart
      v-if="type === 'bar'"
      :data="barData"
      :height="height"
      :value-label="m.label"
      :y-format="fmt"
    />
    <LineAreaChart
      v-else
      :categories="categories"
      :series="type === 'line' ? lineSeries : series"
      :height="height"
      :y-format="fmt"
    />
  </div>
</template>

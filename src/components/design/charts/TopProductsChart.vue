<script setup lang="ts">
/**
 * Revenue/Units toggle wrapper around HBarChart.
 * Direct port of TopProductsChart(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 494-511).
 *
 * - Two-segment toggle (Revenue / Units) — re-projects each datum's value to
 *   the selected metric, then re-sorts descending and re-renders HBarChart.
 * - Revenue uses Fmt.abbr; Units appends " pcs" (kept as plain string per
 *   source — caller can override via slot if i18n'd unit needed).
 */
import { fmtAbbr } from '../utils/format'
import HBarChart from '../HBarChart.vue'
import Segmented from '../Segmented.vue'

const { t } = useI18n({ useScope: 'global' })

interface TopProductRow {
  name: string
  value: number
  units?: number
}

interface Props {
  data: TopProductRow[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const metric = ref<'value' | 'units'>('value')

const projected = computed(() => {
  return props.data.map(d => ({
    name: d.name,
    value: metric.value === 'value' ? d.value : (d.units || 0),
    units: d.units,
  })).sort((a, b) => b.value - a.value)
})

const fmt = computed(() =>
  metric.value === 'value'
    ? fmtAbbr
    : (v: number) => `${Math.round(v)} ${t('pcs')}`,
)

const options = computed(() => [
  { value: 'value', label: t('Revenue'), icon: 'wallet' },
  { value: 'units', label: t('Units'), icon: 'chart' },
])
</script>

<template>
  <div>
    <div class="row" style="justify-content: flex-end; margin-bottom: 14px;">
      <Segmented
        v-model="metric"
        :options="options"
      />
    </div>
    <HBarChart
      :data="projected"
      :value-format="fmt"
      :loading="loading"
    />
  </div>
</template>

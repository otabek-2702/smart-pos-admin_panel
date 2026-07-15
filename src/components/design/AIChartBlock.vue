<script setup lang="ts">
/* ============================================================
   ALPHA POS — AIChartBlock
   Render an inline chart inside an AI assistant reply.

   The AI is expected to emit a fenced code block tagged "chart"
   whose body is a JSON config. Example:

     ```chart
     {
       "type": "bar",
       "title": "Sales by day",
       "categories": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
       "series": [{"label": "Revenue", "data": [...]}]
     }
     ```

   MarkdownMessage.vue splits the content into text + chart segments
   and renders this component per chart segment, so the chart appears
   inline in the chat thread instead of as a literal JSON code block.

   Supported types:
     - line   → LineAreaChart  (series[].data + categories[])
     - bar    → BarChart       (single series: data[].value/label)
     - donut  → DonutChart     (data[].label/value)
     - hbar   → HBarChart      (data[].label/value)

   Theming: uses the project's CSS-var palette (--v-theme-c1..--v-theme-c5,
   chart-revenue, chart-expense) so charts pick up dark/light flips for free.
   ============================================================ */
import LineAreaChart from './LineAreaChart.vue'
import BarChart from './BarChart.vue'
import DonutChart from './DonutChart.vue'
import HBarChart from './HBarChart.vue'

export interface AIChartConfig {
  type: 'line' | 'bar' | 'donut' | 'hbar'
  title?: string
  subtitle?: string
  categories?: string[]
  series?: { label: string; data: number[]; color?: string }[]
  data?: { label: string; value: number; color?: string }[]
}

interface Props {
  config: AIChartConfig
  /** Set true while the AI is mid-stream so we don't try to render half-typed JSON. */
  streaming?: boolean
}

const props = withDefaults(defineProps<Props>(), { streaming: false })
const { t } = useI18n({ useScope: 'global' })

const PALETTE = [
  'rgb(var(--v-theme-c1))',
  'rgb(var(--v-theme-c2))',
  'rgb(var(--v-theme-c3))',
  'rgb(var(--v-theme-c4))',
  'rgb(var(--v-theme-c5))',
  'rgb(var(--v-theme-primary))',
]

function num(v: unknown): number {
  if (v == null) return 0
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

const safeConfig = computed<AIChartConfig | null>(() => {
  const c = props.config
  if (!c || typeof c !== 'object') return null
  if (!['line', 'bar', 'donut', 'hbar'].includes(c.type)) return null
  // Coerce strings → numbers (BE/AI sometimes returns Decimal strings).
  if (Array.isArray(c.series)) {
    c.series = c.series.map((s, i) => ({
      label: String(s?.label ?? ''),
      color: s?.color || PALETTE[i % PALETTE.length],
      data: Array.isArray(s?.data) ? s.data.map(num) : [],
    }))
  }
  if (Array.isArray(c.data)) {
    c.data = c.data.map((d, i) => ({
      label: String(d?.label ?? ''),
      value: num(d?.value),
      color: d?.color || PALETTE[i % PALETTE.length],
    }))
  }
  return c
})

const lineSeries = computed(() => {
  const c = safeConfig.value
  if (!c?.series?.length) return []
  return c.series.map((s, i) => ({
    key: `s${i}`,
    label: s.label,
    color: s.color || PALETTE[i % PALETTE.length],
    data: s.data,
  }))
})

const barData = computed(() => {
  const c = safeConfig.value
  // BarChart wants [{label, value}] — derive from first series if user passed series[].
  if (c?.data?.length) return c.data
  if (c?.series?.length && c.categories?.length) {
    const s = c.series[0]
    return c.categories.map((label, i) => ({ label, value: s.data[i] ?? 0, color: s.color }))
  }
  return []
})

const donutData = computed(() => {
  const c = safeConfig.value
  if (!c?.data?.length) return []
  return c.data.map((d, i) => ({
    label: d.label,
    value: d.value,
    color: d.color || PALETTE[i % PALETTE.length],
  }))
})

const hbarData = computed(() => {
  const c = safeConfig.value
  if (!c?.data?.length) return []
  return c.data.map(item => ({
    name: item.label,
    value: item.value,
  }))
})
</script>

<template>
  <div v-if="!streaming && safeConfig" class="aichart">
    <div v-if="safeConfig.title" class="aichart__head">
      <div class="aichart__title">
        {{ safeConfig.title }}
      </div>
      <div v-if="safeConfig.subtitle" class="aichart__sub">
        {{ safeConfig.subtitle }}
      </div>
    </div>
    <LineAreaChart
      v-if="safeConfig.type === 'line' && safeConfig.categories && lineSeries.length"
      :series="lineSeries"
      :categories="safeConfig.categories"
      :height="220"
    />
    <BarChart
      v-else-if="safeConfig.type === 'bar' && barData.length"
      :data="barData"
      :height="220"
      :value-label="safeConfig.series?.[0]?.label || ''"
    />
    <DonutChart
      v-else-if="safeConfig.type === 'donut' && donutData.length"
      :data="donutData"
      :size="200"
      :center-label="safeConfig.title || ''"
    />
    <HBarChart
      v-else-if="safeConfig.type === 'hbar' && hbarData.length"
      :data="hbarData"
    />
  </div>
  <div v-else-if="streaming" class="aichart aichart--placeholder">
    <span class="aichart__placeholder-label">{{ t('Generating chart…') }}</span>
  </div>
</template>

<style scoped>
.aichart {
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--sp-3);
  margin: var(--sp-3) 0;
  background: var(--surface);
}
.aichart__head {
  margin-bottom: var(--sp-2);
}
.aichart__title {
  font-weight: var(--fw-semibold);
  font-size: var(--fs-md);
  color: var(--text);
}
.aichart__sub {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
  margin-top: 2px;
}
.aichart--placeholder {
  padding: 24px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--fs-sm);
}
</style>

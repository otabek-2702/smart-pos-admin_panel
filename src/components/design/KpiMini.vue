<script setup lang="ts">
import { fmtNum } from './utils/format'
import type { Tone } from './utils'

interface KpiMiniData {
  label: string
  value: number | string | null
  tone?: Tone
  sub?: string
}

interface Props {
  data: KpiMiniData
}

const props = defineProps<Props>()

const COLOR_MAP: Record<Tone, string> = {
  info: 'var(--info)',
  error: 'var(--error)',
  success: 'var(--success)',
  primary: 'var(--primary)',
  warning: 'var(--warning)',
  neutral: 'var(--text)',
}

const tone = computed<Tone>(() => props.data.tone || 'neutral')

const display = computed(() => {
  const v = props.data.value
  if (typeof v === 'string')
    return v
  if (v === null || v === undefined)
    return '—'
  return fmtNum(v)
})

const valueStyle = computed(() => ({
  fontSize: 'var(--fs-h1)',
  lineHeight: 'var(--lh-h1)',
  color: COLOR_MAP[tone.value],
}))
</script>

<template>
  <div
    class="kpi"
    style="padding: var(--sp-4) var(--sp-5);"
  >
    <div
      class="kpi__label"
      style="margin-bottom: 6px;"
    >
      {{ data.label }}
    </div>
    <div
      class="kpi__value"
      :style="valueStyle"
    >
      {{ display }}
    </div>
    <div
      v-if="data.sub"
      class="kpi__subtext"
      style="margin-top: 4px;"
    >
      {{ data.sub }}
    </div>
  </div>
</template>

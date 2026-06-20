<script setup lang="ts">
import DesignIcon from './DesignIcon.vue'
import Delta from './Delta.vue'
import { fmtAbbr, fmtNum } from './utils/format'
import { cx, type Tone } from './utils'

interface KpiData {
  label: string
  value: number | string | null
  icon?: string
  tone?: Tone
  money?: boolean
  delta?: number | null
  deltaLabel?: string
  sub?: string
}

interface Props {
  data: KpiData
}

const props = defineProps<Props>()

const tone = computed<Tone>(() => props.data.tone || 'primary')

const display = computed<{ text: string; unit?: string }>(() => {
  const v = props.data.value
  if (typeof v === 'string')
    return { text: v }
  if (v === null || v === undefined)
    return { text: '—' }
  if (props.data.money)
    return { text: fmtAbbr(v), unit: 'UZS' }
  return { text: fmtNum(v) }
})
</script>

<template>
  <div class="kpi">
    <div class="kpi__top">
      <div
        v-if="data.icon"
        :class="cx('kpi__icon', `t-${tone}`)"
      >
        <DesignIcon
          :name="data.icon"
          :size="20"
        />
      </div>
      <div class="kpi__label">
        {{ data.label }}
      </div>
    </div>
    <div class="kpi__value">
      {{ display.text }}<span
        v-if="display.unit"
        class="kpi__unit"
      >{{ display.unit }}</span>
    </div>
    <div
      v-if="data.delta !== null && data.delta !== undefined || data.sub || data.deltaLabel"
      class="kpi__foot"
    >
      <Delta
        v-if="data.delta !== null && data.delta !== undefined"
        :value="data.delta"
      />
      <span
        v-if="data.sub"
        class="kpi__subtext"
      >{{ data.sub }}</span>
      <span
        v-if="data.deltaLabel"
        class="kpi__subtext"
      >{{ data.deltaLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Horizontal funnel bars with conversion-% badge per row.
 * Direct port of Funnel(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 333-358).
 *
 * - data: [{label, value, color?}]; first row anchors 100% conversion.
 * - Each bar width = value/max; the badge shows value/data[0].value %.
 * - Stagger: each row fades + slides 8px on shown with 80ms step.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { fmtNum } from '../utils/format'
import StateFill from '../StateFill.vue'

const { t } = useI18n({ useScope: 'global' })

interface Datum {
  label: string
  value: number
  color?: string
}

interface Props {
  data: Datum[]
}

const props = defineProps<Props>()

const shown = useShown(80)

const max = computed(() => props.data.length ? Math.max(...props.data.map(d => d.value)) || 1 : 1)
const first = computed(() => (props.data[0]?.value || 1))
</script>

<template>
  <StateFill
    v-if="!data.length"
    icon="chart"
    :title="t('No data')"
  />
  <div
    v-else
    style="display: flex; flex-direction: column; gap: 10px;"
  >
    <div
      v-for="(d, i) in data"
      :key="i"
      :style="{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateX(-8px)',
        transition: `all .5s cubic-bezier(.2,.8,.2,1) ${i * 0.08}s`,
      }"
    >
      <div class="row between" style="margin-bottom: 5px;">
        <span style="font-size: 13px; font-weight: 600;">{{ d.label }}</span>
        <span class="row" style="gap: 8px;">
          <span class="mono" style="font-weight: 700; font-size: 14px;">{{ fmtNum(d.value) }}</span>
          <span class="badge t-neutral">
            {{ i === 0 ? 100 : Math.round((d.value / first) * 100) }}%
          </span>
        </span>
      </div>
      <div
        style="height: 30px; background: var(--chart-track); border-radius: 8px; overflow: hidden;"
      >
        <div
          :style="{
            width: `${shown ? (d.value / max) * 100 : 0}%`,
            height: '100%',
            background: d.color || 'var(--primary)',
            borderRadius: '8px',
            transition: `width .7s cubic-bezier(.2,.8,.2,1) ${i * 0.08}s`,
          }"
        />
      </div>
    </div>
  </div>
</template>

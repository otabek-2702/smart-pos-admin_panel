<script setup lang="ts">
import { fmtNum } from './utils/format'
import Skeleton from './Skeleton.vue'

type Tone = 'info' | 'error' | 'success' | 'primary' | 'warning' | 'neutral'

interface Props {
  label: string
  value?: number | string | null
  tone?: Tone
  sub?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'neutral',
})

const display = computed(() => {
  if (typeof props.value === 'string')
    return props.value
  if (props.value === null || props.value === undefined)
    return '—'

  return fmtNum(props.value)
})

const valueColor = computed(() => {
  const map: Record<Tone, string> = {
    info: 'var(--v-theme-info)',
    error: 'var(--v-theme-error)',
    success: 'var(--v-theme-success)',
    primary: 'var(--v-theme-primary)',
    warning: 'var(--v-theme-warning)',
    neutral: 'var(--v-theme-on-surface)',
  }

  return `rgb(${map[props.tone]})`
})
</script>

<template>
  <div class="kpi-mini">
    <template v-if="loading">
      <Skeleton :w="70" :h="13" />
      <div style="margin-top:10px;">
        <Skeleton :w="90" :h="24" />
      </div>
    </template>
    <template v-else>
      <div class="kpi-mini__label">
        {{ label }}
      </div>
      <div
        class="kpi-mini__value"
        :style="{ color: valueColor }"
      >
        {{ display }}
      </div>
      <div
        v-if="sub"
        class="kpi-mini__sub"
      >
        {{ sub }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.kpi-mini {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-lg);
  padding: var(--sp-4) var(--sp-5);
  box-shadow: var(--shadow-xs);
}
.kpi-mini__label {
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-secondary));
  font-weight: var(--fw-medium);
  margin-bottom: 6px;
}
.kpi-mini__value {
  font-family: var(--font-mono);
  font-size: var(--fs-h1);
  line-height: var(--lh-h1);
  font-weight: var(--fw-bold);
  letter-spacing: -0.03em;
}
.kpi-mini__sub {
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-tertiary));
  margin-top: 4px;
}
</style>

<script setup lang="ts">
import { fmtMoneyAbbr, fmtNum } from './utils/format'
import Skeleton from './Skeleton.vue'
import Delta from './Delta.vue'

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface Props {
  label: string
  value?: number | string | null
  icon?: string
  tone?: Tone
  money?: boolean
  delta?: number | null
  deltaLabel?: string
  sub?: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'primary',
})

const display = computed<{ text: string; unit?: string }>(() => {
  if (typeof props.value === 'string')
    return { text: props.value }
  if (props.value === null || props.value === undefined)
    return { text: '—' }
  if (props.money)
    return { text: fmtMoneyAbbr(props.value), unit: 'UZS' }

  return { text: fmtNum(props.value) }
})
</script>

<template>
  <div class="kpi">
    <template v-if="loading">
      <div class="kpi__top">
        <Skeleton :w="38" :h="38" :r="8" />
        <Skeleton :w="90" :h="13" />
      </div>
      <Skeleton :w="140" :h="30" />
      <div style="margin-top: 12px;">
        <Skeleton :w="80" :h="18" :r="99" />
      </div>
    </template>
    <template v-else>
      <div class="kpi__top">
        <div
          v-if="icon"
          class="kpi__icon"
          :class="`t-${tone}`"
        >
          <VIcon :icon="icon" size="20" />
        </div>
        <div class="kpi__label">
          {{ label }}
        </div>
      </div>
      <div class="kpi__value">
        {{ display.text }}<span
          v-if="display.unit"
          class="kpi__unit"
        >{{ display.unit }}</span>
      </div>
      <div
        v-if="delta !== null && delta !== undefined || sub || deltaLabel"
        class="kpi__foot"
      >
        <Delta
          v-if="delta !== null && delta !== undefined"
          :value="delta"
        />
        <span
          v-if="sub"
          class="kpi__subtext"
        >{{ sub }}</span>
        <span
          v-if="deltaLabel"
          class="kpi__subtext"
        >{{ deltaLabel }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kpi {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-lg);
  padding: var(--sp-5);
  box-shadow: var(--shadow-xs);
  transition: box-shadow .16s, border-color .16s;
  position: relative;
  overflow: hidden;
}
.kpi:hover {
  box-shadow: var(--shadow-sm);
  border-color: rgb(var(--v-theme-border-strong));
}
.kpi__top {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}
.kpi__icon {
  width: 38px;
  height: 38px;
  border-radius: var(--r-sm);
  display: grid;
  place-items: center;
  flex: 0 0 38px;
}
.kpi__icon.t-primary { background: rgb(var(--v-theme-primary-weak)); color: rgb(var(--v-theme-primary)); }
.kpi__icon.t-success { background: rgb(var(--v-theme-success-weak)); color: rgb(var(--v-theme-success)); }
.kpi__icon.t-warning { background: rgb(var(--v-theme-warning-weak)); color: rgb(var(--v-theme-warning)); }
.kpi__icon.t-error   { background: rgb(var(--v-theme-error-weak));   color: rgb(var(--v-theme-error)); }
.kpi__icon.t-info    { background: rgb(var(--v-theme-info-weak));    color: rgb(var(--v-theme-info)); }
.kpi__icon.t-neutral { background: rgb(var(--v-theme-neutral-weak)); color: rgb(var(--v-theme-text-secondary)); }

.kpi__label {
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-secondary));
  font-weight: var(--fw-medium);
}
.kpi__value {
  font-family: var(--font-mono);
  font-size: var(--fs-kpi);
  line-height: var(--lh-kpi);
  font-weight: var(--fw-bold);
  letter-spacing: -0.03em;
  color: rgb(var(--v-theme-on-surface));
}
.kpi__unit {
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-tertiary));
  font-weight: var(--fw-medium);
  font-family: var(--font-sans);
  margin-left: 4px;
}
.kpi__foot {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
}
.kpi__subtext {
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-tertiary));
}
</style>

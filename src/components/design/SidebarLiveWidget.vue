<script setup lang="ts">
/**
 * Sidebar ambient "Today" widget.
 * Ported from .tmp-handoff-v3/pos-admin-panel/project/app/shell.jsx
 * (SidebarLiveWidget, lines 137-162).
 *
 * Source polled every 4.2s with Math.random delta — this port is wired to
 * the real `navCounts` Pinia store (polls /orders/stats?today every 90s).
 * Click emits `nav-go` so the parent can route to the dashboard.
 * Hidden when `collapsed` is true.
 */
import { storeToRefs } from 'pinia'
import { useNavCountsStore } from '@/stores/navCounts'
import { useFormatters } from '@/composables/useFormatters'
import DesignIcon from './DesignIcon.vue'
import Sparkline from './charts/Sparkline.vue'

interface Props {
  collapsed?: boolean
  /** Pre-computed day-over-day delta as a percentage (e.g. +12.4). */
  delta?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
  delta: null,
})

const emit = defineEmits<{
  (e: 'nav-go', route: string): void
}>()

const { t } = useI18n({ useScope: 'global' })
const { formatCurrency } = useFormatters()

const store = useNavCountsStore()
const { counts } = storeToRefs(store)

// Fallback 12-point flat-ish series when BE doesn't yet expose hourly revenue.
const FALLBACK_SPARK = [8, 9, 8.5, 10, 9.5, 11, 10.5, 12, 11.5, 13, 12.5, 14]

const spark = computed<number[]>(() => {
  const series = counts.value.revenueSeries
  if (Array.isArray(series) && series.length >= 2)
    return series.slice(-12)
  return FALLBACK_SPARK
})

const rev = computed<number>(() => counts.value.todayRevenue ?? 0)
const orders = computed<number>(() => counts.value.orders ?? 0)

const deltaPct = computed<number | null>(() => {
  if (props.delta !== null && props.delta !== undefined)
    return props.delta
  // Derive from sparkline: last vs first, percent change.
  const s = spark.value
  if (s.length < 2 || s[0] === 0)
    return null
  return ((s[s.length - 1] - s[0]) / s[0]) * 100
})

const deltaIsUp = computed(() => (deltaPct.value ?? 0) >= 0)
const deltaText = computed(() => {
  const v = deltaPct.value
  if (v === null)
    return ''
  const abs = Math.abs(v).toFixed(1).replace(/\.0$/, '')
  return `${v >= 0 ? '+' : '−'}${abs}%`
})

function onClick() {
  emit('nav-go', 'dashboard')
}
</script>

<template>
  <div
    v-if="!collapsed"
    class="sidewidget"
    :title="t('Open dashboards')"
    @click="onClick"
  >
    <div class="row between" style="margin-bottom: 8px;">
      <span class="sidewidget__label">
        <span class="livedot" />
        {{ t('Today') }}
      </span>
      <DesignIcon name="chevright" :size="14" style="color: var(--text-tertiary);" />
    </div>
    <div class="sidewidget__value mono">
      {{ formatCurrency(rev) }}<span class="sidewidget__unit">{{ t('currency_short') }}</span>
    </div>
    <div class="sidewidget__spark">
      <Sparkline
        :data="spark"
        :width="196"
        :height="30"
        color="var(--primary)"
        :dot="false"
      />
    </div>
    <div class="row between" style="margin-top: 6px;">
      <span class="sidewidget__meta">
        {{ orders }} {{ t('orders') }}
      </span>
      <span
        v-if="deltaText"
        class="delta"
        :class="deltaIsUp ? 'is-up' : 'is-down'"
        style="font-size: 11px; padding: 1px 6px;"
      >
        <DesignIcon
          :name="deltaIsUp ? 'arrowup' : 'arrowdown'"
          :size="11"
          :weight="2.2"
        />
        {{ deltaText.replace(/^[+−]/, '') }}
      </span>
    </div>
  </div>
</template>

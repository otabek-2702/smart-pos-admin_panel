<script setup lang="ts">
/**
 * Bullet chart — actual vs target with a vertical target tick.
 * Direct port of Bullet(props) in
 * .tmp-handoff-v3/pos-admin-panel/project/app/charts2.jsx (lines 361-389).
 *
 * - items: [{label, value, target, max?, color?}]; max defaults to max(v,t) * 1.25.
 * - Filled bar = actual; target tick (3px) sits at target/max %.
 * - Badge tone: t-success if value >= target, else t-warning.
 * - Bar width transitions 0% -> vp% staggered by 50ms per item on shown.
 */
import { useShown } from '@/composables/useAlphaMotion'
import { fmtAbbr } from '../utils/format'
import { cx } from '../utils'

const { t } = useI18n({ useScope: 'global' })

interface Item {
  label: string
  value: number
  target: number
  max?: number
  color?: string
}

interface Props {
  items: Item[]
}

const props = defineProps<Props>()

const shown = useShown(80)

function metrics(it: Item) {
  const max = it.max || Math.max(it.value, it.target) * 1.25 || 1
  return {
    max,
    vp: Math.min(100, (it.value / max) * 100),
    tp: Math.min(100, (it.target / max) * 100),
    hit: it.value >= it.target,
  }
}

const labelTarget = computed(() => t('Target'))
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px;">
    <div
      v-for="(it, i) in items"
      :key="i"
    >
      <div class="row between" style="margin-bottom: 6px;">
        <span style="font-size: 13px; font-weight: 600;">{{ it.label }}</span>
        <span class="row" style="gap: 8px; font-size: 12px;">
          <span class="mono" style="font-weight: 700;">{{ fmtAbbr(it.value) }}</span>
          <span class="tertiary mono">/ {{ fmtAbbr(it.target) }}</span>
          <span
            :class="cx('badge', metrics(it).hit ? 't-success' : 't-warning')"
          >
            {{ Math.round((it.value / Math.max(1, it.target)) * 100) }}%
          </span>
        </span>
      </div>
      <div style="position: relative; height: 14px; background: var(--chart-track); border-radius: 99px;">
        <div
          :style="{
            position: 'absolute',
            inset: 0,
            width: `${shown ? metrics(it).vp : 0}%`,
            background: it.color || (metrics(it).hit ? 'var(--success)' : 'var(--primary)'),
            borderRadius: '99px',
            transition: `width .7s cubic-bezier(.2,.8,.2,1) ${i * 0.05}s`,
          }"
        />
        <div
          :title="labelTarget"
          :style="{
            position: 'absolute',
            top: '-3px',
            bottom: '-3px',
            left: `${metrics(it).tp}%`,
            width: '3px',
            borderRadius: '2px',
            background: 'var(--text)',
            opacity: 0.55,
          }"
        />
      </div>
    </div>
  </div>
</template>

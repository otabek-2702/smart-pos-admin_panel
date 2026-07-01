<script setup lang="ts">
// ============================================================
// ALPHA POS - TimeField primitive
// Ported verbatim from .tmp-handoff-v3/pos-admin-panel/project/app/ui.jsx (lines 117-126)
// Compact HH:MM input (mono, themed) using native <input type="time">
// ============================================================
import DesignIcon from './DesignIcon.vue'
import { cx } from './utils'

interface Props {
  value?: string
  disabled?: boolean
  size?: 'sm'
  icon?: string
  step?: number
}

const props = withDefaults(defineProps<Props>(), {
  value: '',
  step: 300,
})

const emit = defineEmits<{
  (e: 'update:value', v: string): void
}>()

const klass = computed(() =>
  cx(
    'control',
    'control--time',
    props.size === 'sm' && 'control--sm',
    props.disabled && 'is-disabled',
  ),
)

function onInput(ev: Event) {
  emit('update:value', (ev.target as HTMLInputElement).value)
}
</script>

<template>
  <div :class="klass">
    <DesignIcon
      v-if="icon"
      :name="icon"
      :size="16"
    />
    <input
      type="time"
      :value="value || ''"
      :disabled="disabled"
      :step="step"
      @input="onInput"
    >
  </div>
</template>

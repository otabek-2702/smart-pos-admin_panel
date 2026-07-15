<script setup lang="ts">
// ============================================================
// ALPHA POS - TimeField primitive
// Ported verbatim from .tmp-handoff-v3/pos-admin-panel/project/app/ui.jsx (lines 117-126)
// Compact HH:MM input (mono, themed) using native <input type="time">
// ============================================================
import DesignIcon from './DesignIcon.vue'
import { fieldContextKey } from './fieldContext'
import { cx } from './utils'

interface Props {
  value?: string
  disabled?: boolean
  size?: 'sm'
  icon?: string
  step?: number
  label?: string
  error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  value: '',
  step: 300,
})

const emit = defineEmits<{
  (e: 'update:value', v: string): void
}>()

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const field = inject(fieldContextKey, null)
const ariaLabel = computed(() => props.label || (attrs['aria-label'] as string | undefined))
const describedBy = computed(() => {
  const ids = [attrs['aria-describedby'], field?.descriptionId.value]
  return ids.filter(Boolean).join(' ') || undefined
})

const klass = computed(() =>
  cx(
    'control',
    'control--time',
    props.size === 'sm' && 'control--sm',
    (props.error || field?.invalid.value) && 'is-error',
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
      v-bind="$attrs"
      type="time"
      :value="value || ''"
      :disabled="disabled"
      :step="step"
      :aria-label="ariaLabel"
      :aria-labelledby="ariaLabel ? undefined : field?.labelId"
      :aria-describedby="describedBy"
      :aria-invalid="props.error || field?.invalid.value ? 'true' : undefined"
      @input="onInput"
    >
  </div>
</template>

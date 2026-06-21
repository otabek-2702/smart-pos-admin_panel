<script setup lang="ts">
import DesignIcon from './DesignIcon.vue'
import { cx } from './utils'

interface Props {
  modelValue?: string | number | null
  icon?: string
  error?: boolean | string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

defineOptions({ inheritAttrs: false })

const klass = computed(() =>
  cx('control', props.error && 'is-error', props.disabled && 'is-disabled'),
)

function onInput(ev: Event) {
  emit('update:modelValue', (ev.target as HTMLInputElement).value)
}
</script>

<template>
  <div :class="klass">
    <DesignIcon
      v-if="icon"
      :name="icon"
      :size="18"
    />
    <input
      :value="modelValue ?? ''"
      :disabled="disabled"
      v-bind="$attrs"
      @input="onInput"
    >
  </div>
</template>

<script setup lang="ts">
import DesignIcon from './DesignIcon.vue'
import { cx } from './utils'

interface Props {
  modelValue?: boolean
  indeterminate?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  indeterminate: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'change', v: boolean): void
}>()

const klass = computed(() =>
  cx(
    'checkbox',
    props.modelValue && 'is-checked',
    props.indeterminate && 'is-indeterminate',
  ),
)

function toggle(ev: MouseEvent) {
  ev.stopPropagation()
  if (props.disabled)
    return
  const next = !props.modelValue
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <div
    :class="klass"
    role="checkbox"
    :aria-checked="modelValue"
    :aria-disabled="disabled"
    tabindex="0"
    @click="toggle"
  >
    <span
      v-if="indeterminate"
      class="checkbox__bar"
    />
    <DesignIcon
      v-else-if="modelValue"
      name="check"
      :size="13"
      :weight="2.4"
    />
  </div>
</template>

<style scoped>
.checkbox__bar {
  display: block;
  width: 9px;
  height: 2px;
  background: currentColor;
  border-radius: 2px;
}
</style>

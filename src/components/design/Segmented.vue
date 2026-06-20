<script setup lang="ts">
import DesignIcon from './DesignIcon.vue'
import { cx } from './utils'

interface SegOption {
  value: string
  label: string
  icon?: string
}
type SegOptionLike = string | SegOption

interface Props {
  modelValue?: string | number | null
  options: SegOptionLike[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: string): void
}>()

const normalized = computed<SegOption[]>(() =>
  props.options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o,
  ),
)

function select(v: string) {
  emit('update:modelValue', v)
  emit('change', v)
}
</script>

<template>
  <div
    class="seg"
    role="tablist"
  >
    <button
      v-for="o in normalized"
      :key="o.value"
      type="button"
      :class="cx('seg__btn', modelValue === o.value && 'is-active')"
      role="tab"
      :aria-selected="modelValue === o.value"
      @click="select(o.value)"
    >
      <DesignIcon
        v-if="o.icon"
        :name="o.icon"
        :size="15"
      />
      {{ o.label }}
    </button>
  </div>
</template>

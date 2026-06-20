<script setup lang="ts">
import DesignIcon from './DesignIcon.vue'
import { cx } from './utils'

interface OptionObj {
  value: string
  label: string
}
type OptionLike = string | OptionObj

interface Props {
  modelValue?: string | number | null
  options: OptionLike[]
  placeholder?: string
  icon?: string
  disabled?: boolean
  error?: boolean | string
  size?: 'sm'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: string): void
}>()

defineOptions({ inheritAttrs: false })

const klass = computed(() =>
  cx(
    'control control--select',
    props.size === 'sm' && 'control--sm',
    props.error && 'is-error',
    props.disabled && 'is-disabled',
  ),
)

const normalized = computed<OptionObj[]>(() =>
  props.options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o,
  ),
)

const selectColor = computed(() =>
  props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined
    ? 'var(--text)'
    : 'var(--text-tertiary)',
)

function onChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value
  emit('update:modelValue', v)
  emit('change', v)
}
</script>

<template>
  <div :class="klass">
    <DesignIcon
      v-if="icon"
      :name="icon"
      :size="18"
    />
    <select
      :value="modelValue ?? ''"
      :disabled="disabled"
      :style="{ color: selectColor }"
      v-bind="$attrs"
      @change="onChange"
    >
      <option
        v-if="placeholder !== undefined"
        value=""
      >
        {{ placeholder }}
      </option>
      <option
        v-for="o in normalized"
        :key="o.value"
        :value="o.value"
        style="color: var(--text);"
      >
        {{ o.label }}
      </option>
    </select>
    <DesignIcon
      name="chevdown"
      :size="18"
      class="chev"
    />
  </div>
</template>

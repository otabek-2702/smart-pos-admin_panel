<script setup lang="ts">
import DesignIcon from './DesignIcon.vue'
import { cx } from './utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft'
type Size = 'sm' | 'lg'

interface Props {
  variant?: Variant
  size?: Size
  icon?: string
  iconRight?: string
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  type: 'button',
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'click', ev: MouseEvent): void
}>()

defineOptions({ inheritAttrs: false })

const iconSize = computed(() => (props.size === 'sm' ? 16 : 18))
const klass = computed(() =>
  cx(
    'btn',
    `btn--${props.variant}`,
    props.size && `btn--${props.size}`,
    props.loading && 'is-loading',
  ),
)

function onClick(ev: MouseEvent) {
  if (props.disabled || props.loading)
    return
  emit('click', ev)
}
</script>

<template>
  <button
    :class="klass"
    :type="type"
    :disabled="disabled || loading"
    v-bind="$attrs"
    @click="onClick"
  >
    <DesignIcon
      v-if="icon"
      :name="icon"
      :size="iconSize"
    />
    <slot />
    <DesignIcon
      v-if="iconRight"
      :name="iconRight"
      :size="iconSize"
    />
  </button>
</template>

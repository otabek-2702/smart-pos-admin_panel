<script setup lang="ts">
import DesignIcon from './DesignIcon.vue'
import { fieldContextKey } from './fieldContext'
import { designId } from './ids'
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

const attrs = useAttrs()
const field = inject(fieldContextKey, null)

const errorId = designId('input-error')

const describedBy = computed(() => {
  const ids = [attrs['aria-describedby'], field?.descriptionId.value]
  if (typeof props.error === 'string' && props.error && !field?.descriptionId.value)
    ids.push(errorId)
  return ids.filter(Boolean).join(' ') || undefined
})

const invalid = computed(() => !!props.error || !!field?.invalid.value)
const accessibleLabel = computed(() => {
  if (attrs['aria-label']) return String(attrs['aria-label'])
  if (field?.labelId) return undefined
  return attrs.placeholder ? String(attrs.placeholder) : undefined
})

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
      v-bind="$attrs"
      :value="modelValue ?? ''"
      :disabled="disabled"
      :aria-label="accessibleLabel"
      :aria-labelledby="attrs['aria-label'] ? undefined : field?.labelId"
      :aria-describedby="describedBy"
      :aria-invalid="invalid ? 'true' : undefined"
      @input="onInput"
    >
    <span
      v-if="typeof error === 'string' && error && !field?.descriptionId.value"
      :id="errorId"
      class="visually-hidden"
    >{{ error }}</span>
  </div>
</template>

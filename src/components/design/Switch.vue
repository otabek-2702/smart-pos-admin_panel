<script setup lang="ts">
import { cx } from './utils'

interface Props {
  modelValue?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'change', v: boolean): void
}>()

const klass = computed(() => cx('switch', props.modelValue && 'is-on'))

function toggle(ev?: Event) {
  ev?.stopPropagation()
  if (props.disabled)
    return
  const next = !props.modelValue
  emit('update:modelValue', next)
  emit('change', next)
}

// Make `<label>Switch + text</label>` work like a native input+label pair.
// Switch root is a div (not a real <input>), so browsers don't associate it
// with a wrapping <label>. Wire the click ourselves so clicking anywhere in
// the label (e.g. the label text span) also toggles the switch.
const rootEl = ref<HTMLElement | null>(null)
onMounted(() => {
  const label = rootEl.value?.closest('label') as HTMLLabelElement | null
  if (!label || (label as any).__swWired) return
  ;(label as any).__swWired = true
  label.addEventListener('click', (e) => {
    const target = e.target as Node | null
    if (rootEl.value && target && rootEl.value.contains(target)) return
    toggle()
  })
})
</script>

<template>
  <div
    ref="rootEl"
    :class="klass"
    role="switch"
    :aria-checked="modelValue"
    :aria-disabled="disabled"
    tabindex="0"
    @click="toggle"
    @keydown.space.prevent="toggle"
    @keydown.enter.prevent="toggle"
  />
</template>

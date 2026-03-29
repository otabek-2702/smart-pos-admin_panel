<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: number | null
  label?: string
  placeholder?: string
  density?: 'default' | 'comfortable' | 'compact'
  hideDetails?: boolean | 'auto'
  suffix?: string
  disabled?: boolean
  readonly?: boolean
}>(), {
  label: '',
  placeholder: '',
  density: 'compact',
  hideDetails: false,
  suffix: '',
  disabled: false,
  readonly: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

// Format number with space as thousands separator: 1234567 → "1 234 567"
function formatWithSpaces(val: number | null): string {
  if (val === null || val === undefined) return ''
  if (val === 0) return '0'
  const num = Math.trunc(val)
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Parse formatted string back to number: "1 234 567" → 1234567
function parseSpaces(val: string): number {
  const cleaned = val.replace(/\D/g, '')
  return Number(cleaned) || 0
}

const displayValue = ref(formatWithSpaces(props.modelValue))
const isFocused = ref(false)

// Sync from parent
watch(() => props.modelValue, newVal => {
  if (!isFocused.value) {
    displayValue.value = formatWithSpaces(newVal)
  }
})

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const cursorPos = input.selectionStart ?? 0

  // Count spaces before cursor in old value
  const oldVal = input.value
  const spacesBefore = (oldVal.slice(0, cursorPos).match(/\s/g) || []).length

  // Strip non-digit chars
  const cleaned = oldVal.replace(/\D/g, '')
  const num = Number(cleaned) || 0
  const formatted = cleaned === '' ? '' : formatWithSpaces(num)

  displayValue.value = formatted
  emit('update:modelValue', num)

  // Restore cursor position, accounting for space changes
  nextTick(() => {
    const newSpacesBefore = (formatted.slice(0, cursorPos).match(/\s/g) || []).length
    const adjustedPos = cursorPos + (newSpacesBefore - spacesBefore)
    input.setSelectionRange(adjustedPos, adjustedPos)
  })
}

function onFocus() {
  isFocused.value = true
  // If value is 0, clear input for easier typing
  if (props.modelValue === 0) {
    displayValue.value = ''
  }
}

function onBlur() {
  isFocused.value = false
  const num = parseSpaces(displayValue.value)
  displayValue.value = formatWithSpaces(num)
  emit('update:modelValue', num)
}

// Handle paste — clean and format
function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const pasted = e.clipboardData?.getData('text') ?? ''
  const cleaned = pasted.replace(/\D/g, '')
  const num = Number(cleaned) || 0
  displayValue.value = formatWithSpaces(num)
  emit('update:modelValue', num)
}

// Prevent non-numeric keys (allow navigation, backspace, delete, dot)
function onKeydown(e: KeyboardEvent) {
  const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End']
  if (allowed.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return // allow Ctrl+A, Ctrl+C, etc.
  if (!/^\d$/.test(e.key)) {
    e.preventDefault()
  }
}
</script>

<template>
  <VTextField
    :model-value="displayValue"
    :label="props.label"
    :placeholder="props.placeholder"
    :density="props.density"
    :hide-details="props.hideDetails"
    :suffix="props.suffix"
    :disabled="props.disabled"
    :readonly="props.readonly"
    inputmode="numeric"
    @input="onInput"
    @focus="onFocus"
    @blur="onBlur"
    @paste="onPaste"
    @keydown="onKeydown"
  />
</template>

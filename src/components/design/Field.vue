<script setup lang="ts">
interface Props {
  label?: string
  error?: string
  hint?: string
}

defineProps<Props>()
</script>

<template>
  <label class="field">
    <span
      v-if="label"
      class="field__label"
    >{{ label }}</span>
    <slot />
    <span
      v-if="error"
      class="field__error"
    >{{ error }}</span>
    <span
      v-else-if="hint"
      class="field__hint"
    >{{ hint }}</span>
  </label>
</template>

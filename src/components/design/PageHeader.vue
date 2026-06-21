<script setup lang="ts">
/* ============================================================
   Alpha POS — PageHeader
   Ports PageHeader({title, subtitle, actions}) from
   .tmp-alpha-design/alpha-design-source/App.shell.jsx verbatim.

   Styling is provided by design-shell.css (.page__head,
   .page__title, .page__subtitle, .page__head-actions).
   ============================================================ */

interface Props {
  title: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="page__head">
    <div style="min-width: 0;">
      <h1 class="page__title">
        {{ title }}
      </h1>
      <div
        v-if="subtitle"
        class="page__subtitle"
      >
        {{ subtitle }}
      </div>
    </div>
    <div
      v-if="$slots.actions"
      class="page__head-actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

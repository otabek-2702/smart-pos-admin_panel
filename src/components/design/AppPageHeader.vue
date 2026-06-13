<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="page__head">
    <div class="page__head-text">
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

<style scoped>
.page__head {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-4);
  margin-block-end: var(--sp-6);
  flex-wrap: wrap;
}
.page__head-text {
  min-width: 0;
}
.page__title {
  font-size: var(--fs-h1);
  line-height: var(--lh-h1);
  font-weight: var(--fw-bold);
  letter-spacing: -0.02em;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
}
.page__subtitle {
  color: rgb(var(--v-theme-text-secondary));
  font-size: var(--fs-sm);
  margin-top: 4px;
}
.page__head-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
</style>

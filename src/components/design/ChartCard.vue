<script setup lang="ts">
interface Props {
  eyebrow?: string
  insight?: string
  title?: string
  sub?: string
}

defineProps<Props>()
</script>

<template>
  <div class="card">
    <div class="card__head">
      <div class="card__head-text">
        <div
          v-if="eyebrow"
          class="card__eyebrow"
        >
          {{ eyebrow }}
        </div>
        <h3
          v-if="insight"
          class="card__insight"
        >
          {{ insight }}
        </h3>
        <h3
          v-else-if="title"
          class="card__title"
        >
          {{ title }}
        </h3>
        <div
          v-if="sub"
          class="card__sub"
        >
          {{ sub }}
        </div>
      </div>
      <div
        v-if="$slots.actions"
        class="card__actions"
      >
        <slot name="actions" />
      </div>
    </div>
    <div class="card__body">
      <slot />
      <div
        v-if="$slots.legend"
        class="card__legend"
      >
        <slot name="legend" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-xs);
  display: flex;
  flex-direction: column;
}
.card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
}
.card__head-text {
  min-width: 0;
}
.card__eyebrow {
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-secondary));
  font-weight: var(--fw-medium);
  margin-bottom: 3px;
}
.card__title {
  font-size: var(--fs-h3);
  font-weight: var(--fw-semibold);
  margin: 0;
  letter-spacing: -0.01em;
}
.card__insight {
  font-size: var(--fs-h2);
  line-height: var(--lh-h2);
  font-weight: var(--fw-bold);
  letter-spacing: -0.02em;
  margin: 0;
}
.card__sub {
  font-size: var(--fs-sm);
  color: rgb(var(--v-theme-text-secondary));
  margin-top: 3px;
}
.card__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.card__body {
  padding: 0 var(--sp-5) var(--sp-5);
}
.card__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-4);
  margin-top: var(--sp-4);
  padding-top: var(--sp-4);
  border-top: 1px solid rgb(var(--v-theme-border));
}
</style>

<script setup lang="ts">
/**
 * DashSection — small dashboard section header with an uppercase eyebrow,
 * optional larger title, and an actions slot. Port of
 * `.tmp-handoff-v3/.../pages/dash/Shared.jsx` `DashSection`.
 *
 * Source has DUPLICATE `fontSize` and `letterSpacing` inline styles on the
 * eyebrow `<h2>`. In React/JSX the second occurrence wins, so the resolved
 * styles are `font-size: 12px` and `letter-spacing: 0.06em`. Ported verbatim.
 */
interface Props {
  eyebrow: string
  title?: string
  tight?: boolean
}

const props = defineProps<Props>()

const rowStyle = computed(() => ({
  gap: '12px',
  margin: props.tight ? '0 0 12px' : '4px 0 14px',
}))
</script>

<template>
  <div class="row between wrap" :style="rowStyle">
    <div>
      <h2
        style="
          font-size: 12px;
          font-weight: 700;
          margin: 0;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-tertiary);
        "
      >
        {{ eyebrow }}
      </h2>
      <div
        v-if="title"
        style="font-size: var(--fs-h2); font-weight: 700; letter-spacing: -0.01em; margin-top: 3px;"
      >
        {{ title }}
      </div>
    </div>
    <slot name="actions" />
  </div>
</template>

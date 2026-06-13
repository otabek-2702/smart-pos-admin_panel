<script setup lang="ts">
const { t } = useI18n({ useScope: 'global' })

const counter = ref(0)
const route = useRoute()
const ts = new Date().toISOString()

function inc() {
  counter.value++
}
</script>

<template>
  <div style="background: lime; color: black; padding: 30px; min-height: 600px; font-family: sans-serif;">
    <h1 style="font-size: 32px; font-weight: 800; margin: 0 0 20px;">
      ISOLATION TEST — DASHBOARD PAGE
    </h1>
    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
      <p style="margin: 0 0 10px;"><strong>Route name:</strong> {{ route.name }}</p>
      <p style="margin: 0 0 10px;"><strong>Route path:</strong> {{ route.path }}</p>
      <p style="margin: 0 0 10px;"><strong>Rendered at:</strong> {{ ts }}</p>
      <p style="margin: 0 0 10px;"><strong>i18n test:</strong> {{ t('Dashboard') }}</p>
      <p style="margin: 0 0 10px;"><strong>Counter:</strong> {{ counter }}</p>
      <button
        style="background: #3A5BDB; color: white; border: 0; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;"
        @click="inc"
      >
        +1 (proves reactivity)
      </button>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

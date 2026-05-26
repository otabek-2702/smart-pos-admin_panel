<script setup lang="ts">
const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div
    class="d-flex flex-column align-center justify-center text-center"
    style="min-block-size:100vh;"
  >
    <VIcon
      icon="bx-lock-alt"
      size="96"
      color="error"
      class="mb-4"
    />
    <div class="text-h3 mb-2">
      401
    </div>
    <div class="text-h6 mb-1">
      {{ t('You are not authorized') }}
    </div>
    <div class="text-body-2 text-disabled mb-6">
      {{ t("You don't have permission to access this page.") }}
    </div>
    <VBtn
      to="/"
      prepend-icon="bx-home"
    >
      {{ t('Back to Home') }}
    </VBtn>
  </div>
</template>

<route lang="yaml">
meta:
  layout: blank
  action: read
  subject: Auth
</route>

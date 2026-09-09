<script setup lang="ts">
const route = useRoute()
const router = useRouter()

// Keep existing bookmarks while the shared editor lives outside the hidden HR area.
router.replace({ name: 'expense-categories', query: route.query, hash: route.hash })
</script>

<template>
  <div />
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
  anyPermission:
    - expense.category.view
    - expense.category.manage
</route>

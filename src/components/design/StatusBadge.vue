<script setup lang="ts">
import Badge from './Badge.vue'

interface Props {
  value: string
  dot?: boolean
}

const props = defineProps<Props>()

const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral'> = {
  ACTIVE: 'success',
  COMPLETED: 'success',
  READY: 'success',
  PAID: 'success',
  PREPARING: 'warning',
  PENDING: 'warning',
  INACTIVE: 'neutral',
  CANCELLED: 'error',
  CANCELED: 'error',
  UNPAID: 'error',
  CASHIER: 'info',
  USER: 'neutral',
  MANAGER: 'primary',
  ADMIN: 'primary',
  HALL: 'neutral',
  DELIVERY: 'info',
  PICKUP: 'primary',
}

const tone = computed(() => STATUS_TONE[props.value?.toUpperCase?.()] ?? 'neutral')
</script>

<template>
  <Badge
    :tone="tone"
    :dot="dot"
  >
    {{ value }}
  </Badge>
</template>

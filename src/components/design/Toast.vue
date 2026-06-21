<script setup lang="ts">
import DesignIcon from './DesignIcon.vue'
import { useToastStore } from './useToast'
import { cx } from './utils'

const store = useToastStore()

const ICON_FOR: Record<string, string> = {
  success: 'checkcircle',
  error: 'alert',
  info: 'info',
  warning: 'alert',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-host">
      <TransitionGroup name="toast">
        <div
          v-for="t in store.items"
          :key="t.id"
          :class="cx('toast', `t-${t.tone}`)"
          role="status"
        >
          <div class="toast__icon">
            <DesignIcon
              :name="ICON_FOR[t.tone] || 'info'"
              :size="20"
            />
          </div>
          <div style="flex: 1; min-width: 0;">
            <div class="toast__title">
              {{ t.title }}
            </div>
            <div
              v-if="t.msg"
              class="toast__msg"
            >
              {{ t.msg }}
            </div>
          </div>
          <div
            class="toast__x"
            @click="store.remove(t.id)"
          >
            <DesignIcon
              name="close"
              :size="16"
            />
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>

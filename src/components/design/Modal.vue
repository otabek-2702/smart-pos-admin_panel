<script setup lang="ts">
import IconAction from './IconAction.vue'

interface Props {
  open: boolean
  title?: string
  subtitle?: string
  width?: number | string
  closeOnBackdrop?: boolean
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  closeOnBackdrop: true,
  closeOnEsc: true,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:open', v: boolean): void
}>()

const { t } = useI18n({ useScope: 'global' })

function close() {
  emit('close')
  emit('update:open', false)
}

function onBackdropDown(ev: MouseEvent) {
  if (!props.closeOnBackdrop)
    return
  if (ev.target === ev.currentTarget)
    close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && props.closeOnEsc)
    close()
}

const maxWidthStyle = computed(() => {
  if (props.width === undefined)
    return undefined
  return {
    maxWidth:
      typeof props.width === 'number' ? `${props.width}px` : props.width,
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="overlay"
        @mousedown="onBackdropDown"
      >
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          :style="maxWidthStyle"
        >
          <div class="modal__head">
            <div style="flex: 1; min-width: 0;">
              <h3
                v-if="title"
                class="modal__title"
              >
                {{ title }}
              </h3>
              <div
                v-if="subtitle"
                class="modal__sub"
              >
                {{ subtitle }}
              </div>
            </div>
            <IconAction
              icon="close"
              :title="t('Close')"
              @click="close"
            />
          </div>
          <div class="modal__body">
            <slot />
          </div>
          <div
            v-if="$slots.footer"
            class="modal__foot"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

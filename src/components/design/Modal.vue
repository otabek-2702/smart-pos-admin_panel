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

// Unique id for aria-labelledby so screen readers announce the modal's title
// instead of generically "dialog". Falls back to aria-label when no title prop.
let _modalId = 0
const titleId = `modal-title-${++_modalId}`

const modalRef = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

function focusableIn(el: HTMLElement): HTMLElement[] {
  return Array.from(
    el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(n => n.offsetParent !== null || n.tagName === 'TEXTAREA')
}

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

// Focus trap: Tab/Shift-Tab cycle within the modal, never escape to background.
// Escape closes when closeOnEsc.
function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape' && props.closeOnEsc) {
    close()
    return
  }
  if (e.key !== 'Tab' || !modalRef.value) return
  const items = focusableIn(modalRef.value)
  if (!items.length) {
    e.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const activeEl = document.activeElement as HTMLElement | null
  if (e.shiftKey && activeEl === first) {
    e.preventDefault(); last.focus()
  }
  else if (!e.shiftKey && activeEl === last) {
    e.preventDefault(); first.focus()
  }
}

const maxWidthStyle = computed(() => {
  if (props.width === undefined)
    return undefined
  return {
    maxWidth:
      typeof props.width === 'number' ? `${props.width}px` : props.width,
  }
})

// On open: cache previously-focused element + move focus into the modal.
// On close: restore focus to whatever opened it (a button, a row, etc.).
watch(() => props.open, async (open) => {
  if (open) {
    previouslyFocused = document.activeElement as HTMLElement | null
    await nextTick()
    if (modalRef.value) {
      const items = focusableIn(modalRef.value)
      ;(items[0] || modalRef.value).focus()
    }
  }
  else if (previouslyFocused) {
    previouslyFocused.focus()
    previouslyFocused = null
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
          ref="modalRef"
          class="modal"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          :aria-label="title ? undefined : t('Dialog')"
          tabindex="-1"
          :style="maxWidthStyle"
        >
          <div class="modal__head">
            <div style="flex: 1; min-width: 0;">
              <h3
                v-if="title"
                :id="titleId"
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

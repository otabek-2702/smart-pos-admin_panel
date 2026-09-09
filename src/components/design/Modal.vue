<script setup lang="ts">
import IconAction from './IconAction.vue'
import { designId } from './ids'

interface Props {
  open: boolean
  title?: string
  subtitle?: string
  width?: number | string
  fullscreen?: boolean
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
const modalId = designId('modal')
const titleId = `${modalId}-title`
const subtitleId = `${modalId}-subtitle`

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
  if (!props.open || e.defaultPrevented)
    return
  if (e.key === 'Escape' && props.closeOnEsc) {
    close()
    return
  }
  trapFocus(e)
}

function trapFocus(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !modalRef.value)
    return
  const items = focusableIn(modalRef.value)
  if (!items.length) {
    e.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const activeEl = document.activeElement as HTMLElement | null
  if (!activeEl || !modalRef.value.contains(activeEl)) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  }
  else if (e.shiftKey && (activeEl === first || activeEl === modalRef.value)) {
    e.preventDefault(); last.focus()
  }
  else if (!e.shiftKey && activeEl === last) {
    e.preventDefault(); first.focus()
  }
}

const maxWidthStyle = computed(() => {
  if (props.fullscreen || props.width === undefined)
    return undefined
  return {
    maxWidth:
      typeof props.width === 'number' ? `${props.width}px` : props.width,
  }
})

// On open: cache previously-focused element + move focus into the modal.
// On close: restore focus to whatever opened it (a button, a row, etc.).
watch(() => props.open, async open => {
  if (open) {
    previouslyFocused = document.activeElement as HTMLElement | null
    await nextTick()
    if (modalRef.value) {
      const preferred = modalRef.value.querySelector<HTMLElement>('[autofocus]:not([disabled])')

      const items = focusableIn(modalRef.value)

      ;(preferred || items[0] || modalRef.value).focus()
    }
  }
  else if (previouslyFocused) {
    previouslyFocused.focus()
    previouslyFocused = null
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (previouslyFocused) {
    previouslyFocused.focus()
    previouslyFocused = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="overlay"
        :class="{ 'overlay--fullscreen': fullscreen }"
        @mousedown="onBackdropDown"
      >
        <div
          ref="modalRef"
          class="modal"
          :class="{ 'modal--fullscreen': fullscreen }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          :aria-label="title ? undefined : t('Dialog')"
          :aria-describedby="subtitle ? subtitleId : undefined"
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
                :id="subtitleId"
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
:global(html:has(.overlay--fullscreen)) {
  overflow: hidden;
}

.overlay--fullscreen {
  padding: 0;
  place-items: stretch;
}

.modal--fullscreen {
  width: 100%;
  max-width: none;
  height: 100vh;
  height: 100dvh;
  max-height: none;
  border: 0;
  border-radius: 0;
  animation: none;
}

.modal--fullscreen .modal__head,
.modal--fullscreen .modal__foot {
  flex-shrink: 0;
  border-radius: 0;
}

.modal--fullscreen .modal__head,
.modal--fullscreen .modal__body,
.modal--fullscreen .modal__foot {
  padding-inline: max(var(--sp-5), env(safe-area-inset-left)) max(var(--sp-5), env(safe-area-inset-right));
}

.modal--fullscreen .modal__head {
  padding-top: max(var(--sp-4), env(safe-area-inset-top));
}

.modal--fullscreen .modal__title,
.modal--fullscreen .modal__sub {
  overflow-wrap: anywhere;
}

.modal--fullscreen .modal__body {
  flex: 1;
  overscroll-behavior: contain;
}

.modal--fullscreen .modal__foot {
  padding-bottom: max(var(--sp-4), env(safe-area-inset-bottom));
}

@media (max-width: 620px) {
  .modal--fullscreen .modal__head,
  .modal--fullscreen .modal__body,
  .modal--fullscreen .modal__foot {
    padding-inline: max(var(--sp-4), env(safe-area-inset-left)) max(var(--sp-4), env(safe-area-inset-right));
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import DesignIcon from './DesignIcon.vue'
import { cx } from './utils'

interface OptionObj {
  value: string
  label: string
}
type OptionLike = string | OptionObj

interface Props {
  modelValue?: string | number | null
  options: OptionLike[]
  placeholder?: string
  icon?: string
  disabled?: boolean
  error?: boolean | string
  size?: 'sm'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: string): void
}>()

defineOptions({ inheritAttrs: false })

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const menuStyle = ref<Record<string, string>>({})

const klass = computed(() =>
  cx(
    'control control--select',
    props.size === 'sm' && 'control--sm',
    props.error && 'is-error',
    props.disabled && 'is-disabled',
    open.value && 'is-open',
  ),
)

const normalized = computed<OptionObj[]>(() =>
  props.options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o,
  ),
)

const currentLabel = computed(() => {
  const v = props.modelValue
  if (v === '' || v === null || v === undefined)
    return props.placeholder ?? ''
  const hit = normalized.value.find(o => String(o.value) === String(v))
  return hit ? hit.label : String(v)
})

const hasValue = computed(() =>
  props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined,
)

function recalcMenu() {
  const el = root.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  const below = vh - r.bottom
  const above = r.top
  const wantUp = below < 240 && above > below
  menuStyle.value = {
    position: 'fixed',
    left: `${r.left}px`,
    width: `${r.width}px`,
    [wantUp ? 'bottom' : 'top']: wantUp ? `${vh - r.top + 4}px` : `${r.bottom + 4}px`,
    zIndex: '1000',
  }
}

function toggle() {
  if (props.disabled) return
  if (!open.value) {
    recalcMenu()
    open.value = true
  }
  else {
    open.value = false
  }
}

function pick(v: string) {
  emit('update:modelValue', v)
  emit('change', v)
  open.value = false
}

function clearVal() {
  emit('update:modelValue', '')
  emit('change', '')
  open.value = false
}

function onKey(ev: KeyboardEvent) {
  if (ev.key === 'Escape') open.value = false
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault()
    toggle()
  }
}

onClickOutside(root, () => { open.value = false })

onMounted(() => {
  window.addEventListener('scroll', () => { if (open.value) recalcMenu() }, true)
  window.addEventListener('resize', () => { if (open.value) recalcMenu() })
})
</script>

<template>
  <div
    ref="root"
    :class="klass"
    tabindex="0"
    role="combobox"
    :aria-expanded="open"
    @click="toggle"
    @keydown="onKey"
  >
    <DesignIcon
      v-if="icon"
      :name="icon"
      :size="18"
      class="ic"
    />
    <span
      class="select__label"
      :style="{ color: hasValue ? 'var(--text)' : 'var(--text-tertiary)' }"
    >
      {{ currentLabel }}
    </span>
    <DesignIcon
      name="chevdown"
      :size="18"
      class="chev"
      :style="{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }"
    />

    <Teleport to="body">
      <div
        v-if="open"
        class="select__menu"
        :style="menuStyle"
        @click.stop
      >
        <div
          v-if="placeholder !== undefined"
          class="select__opt"
          :class="{ 'is-active': !hasValue }"
          @click="clearVal"
        >
          <span>{{ placeholder }}</span>
        </div>
        <div
          v-for="o in normalized"
          :key="o.value"
          class="select__opt"
          :class="{ 'is-active': String(o.value) === String(modelValue) }"
          @click="pick(o.value)"
        >
          <span>{{ o.label }}</span>
          <DesignIcon
            v-if="String(o.value) === String(modelValue)"
            name="check"
            :size="16"
            class="select__opt-check"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.select__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-body);
}
.control--select.is-open { border-color: var(--primary); box-shadow: var(--shadow-focus); }
.control--select:focus { outline: none; }
</style>

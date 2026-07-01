<script setup lang="ts">
/**
 * Gear popover with business-day-start time + week-start day Select.
 * Ported from .tmp-handoff-v3/pos-admin-panel/project/app/shell.jsx
 * (SettingsMenu, lines 192-233).
 *
 * Persists to localStorage keys `alphapos-daystart` and `alphapos-weekstart`
 * (same keys used by the source).
 *
 * Note: TimeField is not yet ported — a native `<input type="time">` is used
 * as a placeholder until TimeField.vue lands. Swap when available.
 *
 * Click-outside (mousedown) + Escape close the popover.
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { cx } from './utils'
import DesignIcon from './DesignIcon.vue'
import Select from './Select.vue'

const { t } = useI18n({ useScope: 'global' })

const root = ref<HTMLElement | null>(null)
const open = ref(false)

function readLs(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback
  }
  catch {
    return fallback
  }
}

function writeLs(key: string, val: string) {
  try {
    localStorage.setItem(key, val)
  }
  catch { /* noop */ }
}

const dayStart = ref<string>(readLs('alphapos-daystart', '06:00'))
const weekStart = ref<string>(readLs('alphapos-weekstart', 'mon'))

watch(dayStart, v => writeLs('alphapos-daystart', v))
watch(weekStart, v => writeLs('alphapos-weekstart', v))

const weekOptions = computed(() => [
  { value: 'mon', label: t('Monday') },
  { value: 'sun', label: t('Sunday') },
])

function toggle() {
  open.value = !open.value
}

function onMouseDown(e: MouseEvent) {
  if (!open.value)
    return
  const el = root.value
  if (el && !el.contains(e.target as Node))
    open.value = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape')
    open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onMouseDown)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" style="position: relative;">
    <button
      :class="cx('iconbtn', open && 'is-active')"
      :title="t('Settings')"
      @click="toggle"
    >
      <DesignIcon name="gear" :size="18" />
    </button>
    <div
      v-if="open"
      class="card setmenu"
    >
      <div class="setmenu__title">
        {{ t('Settings') }}
      </div>

      <div class="setmenu__row">
        <div class="setmenu__main">
          <div class="setmenu__label">
            {{ t('Business day starts at') }}
          </div>
          <div class="setmenu__hint">
            {{ t('Sales after midnight count toward the previous day until this time.') }}
          </div>
        </div>
        <div style="width: 110px; flex: 0 0 110px;">
          <input
            v-model="dayStart"
            type="time"
            class="control control--sm setmenu__time"
          >
        </div>
      </div>

      <div class="hr" style="margin: 4px 0;" />

      <div class="setmenu__row">
        <div class="setmenu__main">
          <div class="setmenu__label">
            {{ t('Week starts on') }}
          </div>
          <div class="setmenu__hint">
            {{ t('Used in weekly reports and the date picker.') }}
          </div>
        </div>
        <div style="width: 130px; flex: 0 0 130px;">
          <Select
            v-model="weekStart"
            size="sm"
            :options="weekOptions"
          />
        </div>
      </div>
    </div>
  </div>
</template>

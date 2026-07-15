<script setup lang="ts">
/**
 * Operating-hours settings popover.
 *  - Business day starts at  (business_day_start, the overnight cutover)
 *  - Working hours           (business_open .. business_close)
 *
 * All three are owned by the backend (AppSettings, GET/PUT /app-settings) and
 * managed through useBusinessDay — the single source that the date picker +
 * every dashboard/orders query read. Changing a value persists immediately.
 *
 * (Removed: "Week starts on" — unused. Icon swapped gear → sliders.)
 *
 * Click-outside (mousedown) + Escape close the popover.
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { cx } from './utils'
import DesignIcon from './DesignIcon.vue'
import { designId } from './ids'
import { useBusinessDay } from '@/composables/useBusinessDay'
import { useNotify } from '@/composables/useNotify'

const { t } = useI18n({ useScope: 'global' })
const biz = useBusinessDay()
const { notify } = useNotify()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const saving = ref(false)
const menuId = designId('operating-hours')

// Local mirrors so typing doesn't fire a PUT on every keystroke mid-edit;
// commit on change. Kept in sync when the composable hydrates from the backend.
const dayStart = ref<string>(biz.start.value)
const workOpen = ref<string>(biz.open.value)
const workClose = ref<string>(biz.close.value)

watch(biz.start, v => (dayStart.value = v))
watch(biz.open, v => (workOpen.value = v))
watch(biz.close, v => (workClose.value = v))

async function commit() {
  if (saving.value) return
  saving.value = true
  try {
    await biz.save({
      business_day_start: dayStart.value,
      business_open: workOpen.value,
      business_close: workClose.value,
    })
    notify(t('Settings saved'), 'success')
  }
  catch {
    dayStart.value = biz.start.value
    workOpen.value = biz.open.value
    workClose.value = biz.close.value
    notify(t('Request failed. Please try again.'), 'error')
  }
  finally {
    saving.value = false
  }
}

function toggle() {
  open.value = !open.value
}

function onMouseDown(e: MouseEvent) {
  if (!open.value) return
  const el = root.value
  if (el && !el.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
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
      :title="t('Operating hours')"
      :aria-label="t('Operating hours')"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click="toggle"
    >
      <DesignIcon name="sliders" :size="18" />
    </button>
    <div
      v-if="open"
      :id="menuId"
      class="card setmenu"
      role="dialog"
      :aria-label="t('Operating hours')"
      :aria-busy="saving"
    >
      <div class="setmenu__title">
        {{ t('Operating hours') }}
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
            :disabled="saving"
            :aria-label="t('Business day starts at')"
            @change="commit"
          >
        </div>
      </div>

      <div class="hr" style="margin: 4px 0;" />

      <div class="setmenu__row">
        <div class="setmenu__main">
          <div class="setmenu__label">
            {{ t('Working hours') }}
          </div>
          <div class="setmenu__hint">
            {{ t('The open window used by the “Working hours” time filter.') }}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; width: 190px; flex: 0 0 190px;">
          <input
            v-model="workOpen"
            type="time"
            class="control control--sm setmenu__time"
            :disabled="saving"
            :aria-label="`${t('Working hours')} ${t('From')}`"
            @change="commit"
          >
          <span style="color: var(--text-tertiary);">–</span>
          <input
            v-model="workClose"
            type="time"
            class="control control--sm setmenu__time"
            :disabled="saving"
            :aria-label="`${t('Working hours')} ${t('To')}`"
            @change="commit"
          >
        </div>
      </div>
    </div>
  </div>
</template>

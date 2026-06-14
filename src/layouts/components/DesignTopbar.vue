<script setup lang="ts">
import { useTheme } from 'vuetify'

/* ============================================================
   Alpha POS — Design Topbar
   Ports Topbar + DateRange + DATE_PRESETS from the design bundle
   (.tmp-design-bundle/project/app/shell.jsx).
   ============================================================ */

const props = withDefaults(
  defineProps<{ dateRange?: string }>(),
  { dateRange: '14d' },
)

const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'update:dateRange', value: string): void
}>()

const dateRange = computed({
  get: () => props.dateRange,
  set: v => emit('update:dateRange', v),
})

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })

/* ---------- Date presets (verbatim from bundle) ----------
   Hard-coded date strings — we can't call `new Date()` here. */
interface DatePreset {
  value: string
  label: string
  range: string
}

const DATE_PRESETS: DatePreset[] = [
  { value: 'today', label: 'Today',        range: '13 Jun 2026' },
  { value: '7d',    label: 'Last 7 days',  range: '7–13 Jun 2026' },
  { value: '14d',   label: 'Last 14 days', range: '31 May – 13 Jun 2026' },
  { value: 'month', label: 'This month',   range: '1–13 Jun 2026' },
  { value: 'prev',  label: 'Last month',   range: '1–31 May 2026' },
]

/* ---------- Navigation labels (mirror sidebar NAV) ---------- */
const NAV_LABELS: Record<string, string> = {
  '/design': 'Design System',
  '/dashboard': 'Dashboard',
  '/analytics': 'Analytics',
  '/analytics/shift-handover': 'Analytics',
  '/shift-analytics': 'Analytics',
  '/shifts-analytics': 'Analytics',
  '/ai-assistant': 'AI Assistant',
  '/shifts': 'Shifts',
  '/users': 'Users',
  '/categories': 'Categories',
  '/products': 'Products',
  '/orders': 'Orders',
  '/places': 'Places & Tables',
  '/discounts': 'Discounts',
  '/cashbox': 'Cash Register',
  '/treasury': 'Treasury',
  '/loyalty': 'Loyalty',
  '/hr-employees': 'Employees',
  '/hr-departments': 'Departments',
  '/hr-salaries': 'Salaries',
}

const currentNavLabel = computed(() => {
  const p = route.path
  // exact match first
  if (NAV_LABELS[p])
    return NAV_LABELS[p]
  // longest-prefix match
  const hit = Object.keys(NAV_LABELS)
    .sort((a, b) => b.length - a.length)
    .find(k => p === k || p.startsWith(`${k}/`))
  return hit ? NAV_LABELS[hit] : ''
})

/* ---------- showDate: only on dashboard / analytics / orders / shifts ---------- */
const DATE_ROUTES = ['/dashboard', '/analytics', '/orders', '/shifts-analytics', '/shift-analytics']
const showDate = computed(() =>
  DATE_ROUTES.some(prefix => route.path === prefix || route.path.startsWith(`${prefix}/`)),
)

/* ---------- Theme ---------- */
const theme = ref(document.documentElement.getAttribute('data-theme') || 'light')
const vuetifyTheme = useTheme()

// Keep <html data-theme> in sync on first mount so the bundle CSS rules apply.
onMounted(() => {
  document.documentElement.setAttribute('data-theme', theme.value)
})

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  vuetifyTheme.global.name.value = theme.value
  document.documentElement.setAttribute('data-theme', theme.value)
  localStorage.setItem('alphapos-theme', theme.value)
}

/* ---------- Avatar initials ---------- */
const initials = computed(() => {
  try {
    const raw = localStorage.getItem('userData')
    if (!raw)
      return 'RL'
    const u = JSON.parse(raw) as { first_name?: string; last_name?: string }
    const a = (u.first_name || '').charAt(0)
    const b = (u.last_name || '').charAt(0)
    const out = (a + b).toUpperCase()
    return out || 'RL'
  }
  catch {
    return 'RL'
  }
})

const userName = computed(() => {
  try {
    const raw = localStorage.getItem('userData')
    if (!raw)
      return 'Reese Lewis'
    const u = JSON.parse(raw) as { first_name?: string; last_name?: string }
    return `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Reese Lewis'
  }
  catch {
    return 'Reese Lewis'
  }
})

/* ---------- DateRange dropdown ---------- */
const dateOpen = ref(false)
const dateRoot = ref<HTMLElement | null>(null)

const currentPreset = computed<DatePreset>(() =>
  DATE_PRESETS.find(p => p.value === dateRange.value) || DATE_PRESETS[2],
)

function pickPreset(v: string) {
  dateRange.value = v
  dateOpen.value = false
}

function onDocMousedown(e: MouseEvent) {
  if (!dateRoot.value)
    return
  if (!dateRoot.value.contains(e.target as Node))
    dateOpen.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMousedown)
})
</script>

<template>
  <header class="topbar">
    <button
      class="iconbtn"
      :title="t('Toggle sidebar')"
      @click="$emit('toggle-sidebar')"
    >
      <!-- layout icon -->
      <svg
        class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      >
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M3.5 9h17M9 9v10.5" />
      </svg>
    </button>

    <div class="topbar__crumbs">
      <span>{{ t('Alpha POS') }}</span>
      <!-- chevright icon -->
      <svg
        class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
      <b>{{ currentNavLabel ? t(currentNavLabel) : '' }}</b>
    </div>

    <div class="topbar__spacer" />

    <!-- DateRange -->
    <div
      v-if="showDate"
      ref="dateRoot"
      style="position: relative;"
    >
      <button
        class="btn btn--secondary"
        style="gap: 10px;"
        @click="dateOpen = !dateOpen"
      >
        <!-- calendar icon -->
        <svg
          class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
        >
          <rect x="4" y="5.5" width="16" height="15" rx="2" />
          <path d="M4 10h16M8 3.5v4M16 3.5v4" />
        </svg>
        <span style="display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1;">
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 600;">
            {{ t(currentPreset.label) }}
          </span>
          <span style="font-size: 13px;">{{ currentPreset.range }}</span>
        </span>
        <!-- chevdown icon -->
        <svg
          class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
          style="color: var(--text-tertiary);"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        v-if="dateOpen"
        class="card"
        style="position: absolute; right: 0; top: calc(100% + 6px); width: 240px; z-index: 40; box-shadow: var(--shadow-lg); padding: 6px;"
      >
        <div
          v-for="p in DATE_PRESETS"
          :key="p.value"
          class="nav-item"
          :class="{ 'is-active': p.value === currentPreset.value }"
          style="border-radius: 8px;"
          @click="pickPreset(p.value)"
        >
          <span style="flex: 1;">{{ t(p.label) }}</span>
          <span style="font-size: 12px; color: var(--text-tertiary);">
            {{ p.range.length > 14 ? '' : p.range }}
          </span>
          <!-- check icon -->
          <svg
            v-if="p.value === currentPreset.value"
            class="ic" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
          >
            <path d="m5 12 5 5 9-11" />
          </svg>
        </div>
        <div class="hr" style="margin: 6px 0;" />
        <div
          class="nav-item"
          style="border-radius: 8px; color: var(--text-secondary);"
          @click="dateOpen = false"
        >
          <svg
            class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
          >
            <rect x="4" y="5.5" width="16" height="15" rx="2" />
            <path d="M4 10h16M8 3.5v4M16 3.5v4" />
          </svg>
          <span>{{ t('Custom range…') }}</span>
        </div>
      </div>
    </div>

    <button
      class="iconbtn"
      :title="t('Toggle theme')"
      @click="toggleTheme"
    >
      <!-- sun icon (when dark) -->
      <svg
        v-if="theme === 'dark'"
        class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5 3.5 3.5M20.5 20.5 19 19M19 5l1.5-1.5M3.5 20.5 5 19" />
      </svg>
      <!-- moon icon (when light) -->
      <svg
        v-else
        class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      </svg>
    </button>

    <button
      class="iconbtn"
      :title="t('Notifications')"
    >
      <!-- bell icon -->
      <svg
        class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
      <span class="iconbtn__dot" />
    </button>

    <div class="avatar" :title="userName">
      {{ initials }}
    </div>
  </header>
</template>

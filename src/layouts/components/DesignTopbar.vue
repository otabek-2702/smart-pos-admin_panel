<script setup lang="ts">
import { useTheme } from 'vuetify'
import axios from '@/plugins/axios'
import DesignIcon from '@/components/design/DesignIcon.vue'
import { initialAbility } from '@/plugins/casl/ability'
import { useAppAbility } from '@/plugins/casl/useAppAbility'

/* ============================================================
   Alpha POS — Design Topbar
   Ports Topbar() + inline DateRange + DATE_PRESETS from
   .tmp-alpha-design/alpha-design-source/App.shell.jsx verbatim.

   Additions kept from prior version:
   - Language switcher button (uz/ru/en) — not in source
   - Avatar dropdown w/ Logout — source had bare avatar div
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
const router = useRouter()
const ability = useAppAbility()
const { t, locale } = useI18n({ useScope: 'global' })

/* ---------- Language switcher (uz/ru/en) ---------- */
interface Lang { code: string; label: string }
const LANGS: Lang[] = [
  { code: 'uz', label: 'O\'zbekcha' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]
const langOpen = ref(false)
const langRoot = ref<HTMLElement | null>(null)
const currentLangCode = computed(() => String(locale.value).toUpperCase())

function pickLang(code: string) {
  locale.value = code
  localStorage.setItem('appLocale', code)
  langOpen.value = false
}

/* ---------- Avatar dropdown ---------- */
const avatarOpen = ref(false)
const avatarRoot = ref<HTMLElement | null>(null)
const userData = computed(() => {
  try {
    const raw = localStorage.getItem('userData')
    return raw ? JSON.parse(raw) : {}
  }
  catch { return {} }
})
const userEmail = computed(() => userData.value?.email || '')
const userRole = computed(() => userData.value?.role || '')

async function logout() {
  try { await axios.post('/auth-logout') }
  catch { /* noop */ }
  localStorage.removeItem('userData')
  localStorage.removeItem('accessToken')
  localStorage.removeItem('userAbilities')
  ability.update(initialAbility)
  avatarOpen.value = false
  router.push('/login')
}

/* ---------- Date presets (locale-aware) ----------
   Source DATE_PRESETS values are hardcoded English strings; here we keep
   the same value/label keys but compute the range text from `new Date()`
   so month abbreviations follow the active i18n locale. */
interface DatePreset {
  value: string
  label: string
  range: string
}

const DATE_PRESETS = computed<DatePreset[]>(() => {
  const loc = String(locale.value || 'en')
  const fmtDM = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' })
  const fmtDMY = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtD = new Intl.DateTimeFormat(loc, { day: 'numeric' })

  const today = new Date()
  const addDays = (d: Date, n: number) => {
    const x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
  }
  const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
  const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

  const last7Start = addDays(today, -6)
  const last14Start = addDays(today, -13)
  const thisMonthStart = monthStart(today)
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthEnd = monthEnd(prevMonth)

  const sameMonth = (a: Date, b: Date) => a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const rangeStr = (a: Date, b: Date) =>
    sameMonth(a, b) ? `${fmtD.format(a)}–${fmtDM.format(b)} ${b.getFullYear()}` : `${fmtDM.format(a)} – ${fmtDM.format(b)} ${b.getFullYear()}`

  return [
    { value: 'today', label: 'Today', range: fmtDMY.format(today) },
    { value: '7d', label: 'Last 7 days', range: rangeStr(last7Start, today) },
    { value: '14d', label: 'Last 14 days', range: rangeStr(last14Start, today) },
    { value: 'month', label: 'This month', range: rangeStr(thisMonthStart, today) },
    { value: 'prev', label: 'Last month', range: rangeStr(prevMonth, prevMonthEnd) },
  ]
})

/* ---------- Breadcrumb label (mirror sidebar NAV) ---------- */
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
  if (NAV_LABELS[p])
    return NAV_LABELS[p]
  const hit = Object.keys(NAV_LABELS)
    .sort((a, b) => b.length - a.length)
    .find(k => p === k || p.startsWith(`${k}/`))
  return hit ? NAV_LABELS[hit] : ''
})

/* ---------- showDate: only on dashboard / analytics / orders / shifts ----------
   Source: `route === "dashboard" || "analytics" || "orders" || "shifts"` */
const DATE_ROUTES = ['/dashboard', '/analytics', '/orders', '/shifts-analytics', '/shift-analytics']
const showDate = computed(() =>
  DATE_ROUTES.some(prefix => route.path === prefix || route.path.startsWith(`${prefix}/`)),
)

/* ---------- Theme (mirrors source onToggleTheme) ---------- */
const theme = ref(document.documentElement.getAttribute('data-theme') || 'light')
const vuetifyTheme = useTheme()

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
      return '?'
    const u = JSON.parse(raw) as { first_name?: string; last_name?: string }
    const a = (u.first_name || '').charAt(0)
    const b = (u.last_name || '').charAt(0)
    const out = (a + b).toUpperCase()
    return out || '?'
  }
  catch {
    return '?'
  }
})

const userName = computed(() => {
  try {
    const raw = localStorage.getItem('userData')
    if (!raw)
      return t('Unknown')
    const u = JSON.parse(raw) as { first_name?: string; last_name?: string }
    return `${u.first_name || ''} ${u.last_name || ''}`.trim() || t('Unknown')
  }
  catch {
    return t('Unknown')
  }
})

/* ---------- DateRange dropdown ---------- */
const dateOpen = ref(false)
const dateRoot = ref<HTMLElement | null>(null)

const currentPreset = computed<DatePreset>(() =>
  DATE_PRESETS.value.find(p => p.value === dateRange.value) || DATE_PRESETS.value[2],
)

function pickPreset(v: string) {
  dateRange.value = v
  dateOpen.value = false
}

function onDocMousedown(e: MouseEvent) {
  const target = e.target as Node
  if (dateRoot.value && !dateRoot.value.contains(target))
    dateOpen.value = false
  if (langRoot.value && !langRoot.value.contains(target))
    langOpen.value = false
  if (avatarRoot.value && !avatarRoot.value.contains(target))
    avatarOpen.value = false
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
      <DesignIcon name="layout" :size="18" />
    </button>

    <div class="topbar__crumbs">
      <span>{{ t('Alpha POS') }}</span>
      <DesignIcon name="chevright" :size="14" />
      <b>{{ currentNavLabel ? t(currentNavLabel) : '' }}</b>
    </div>

    <div class="topbar__spacer" />

    <!-- DateRange (only on dashboard / analytics / orders / shifts) -->
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
        <DesignIcon name="calendar" :size="18" />
        <span style="display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1;">
          <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 600;">
            {{ t(currentPreset.label) }}
          </span>
          <span style="font-size: 13px;">{{ currentPreset.range }}</span>
        </span>
        <DesignIcon name="chevdown" :size="16" style="color: var(--text-tertiary);" />
      </button>

      <div
        v-if="dateOpen"
        class="card topbar-dd topbar-dd--date"
        style="position: absolute; right: 0; left: auto; top: calc(100% + 6px); width: 240px; max-width: calc(100vw - 16px); z-index: 40; box-shadow: var(--shadow-lg); padding: 6px;"
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
          <DesignIcon
            v-if="p.value === currentPreset.value"
            name="check"
            :size="16"
          />
        </div>
        <div class="hr" style="margin: 6px 0;" />
        <div
          class="nav-item"
          style="border-radius: 8px; color: var(--text-secondary);"
          @click="dateOpen = false"
        >
          <DesignIcon name="calendar" :size="18" />
          <span>{{ t('Custom range…') }}</span>
        </div>
      </div>
    </div>

    <!-- Theme toggle (sun when dark, moon when light) -->
    <button
      class="iconbtn"
      :title="t('Toggle theme')"
      @click="toggleTheme"
    >
      <DesignIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="18" />
    </button>

    <!-- Notifications (kept from source) -->
    <button
      class="iconbtn"
      :title="t('Notifications')"
    >
      <DesignIcon name="bell" :size="18" />
      <span class="iconbtn__dot" />
    </button>

    <!-- Language switcher (preserved from prior version, not in source) -->
    <div
      ref="langRoot"
      style="position: relative;"
    >
      <button
        class="iconbtn"
        :title="t('Language')"
        style="inline-size:auto;padding:0 10px;font-weight:600;font-size:12px;letter-spacing:.04em;"
        @click="langOpen = !langOpen"
      >
        {{ currentLangCode }}
      </button>
      <div
        v-if="langOpen"
        class="card topbar-dd topbar-dd--lang"
        style="position: absolute; right: 0; left: auto; top: calc(100% + 6px); width: 170px; max-width: calc(100vw - 16px); z-index: 40; box-shadow: var(--shadow-lg); padding: 6px;"
      >
        <div
          v-for="l in LANGS"
          :key="l.code"
          class="nav-item"
          :class="{ 'is-active': l.code === locale }"
          style="border-radius: 8px;"
          @click="pickLang(l.code)"
        >
          <span style="flex: 1;">{{ l.label }}</span>
          <DesignIcon
            v-if="l.code === locale"
            name="check"
            :size="16"
          />
        </div>
      </div>
    </div>

    <!-- Avatar w/ dropdown (account + logout) -->
    <div
      ref="avatarRoot"
      style="position: relative;"
    >
      <div
        class="avatar"
        style="cursor:pointer;"
        :title="userName"
        @click="avatarOpen = !avatarOpen"
      >
        {{ initials }}
      </div>
      <div
        v-if="avatarOpen"
        class="card topbar-dd topbar-dd--avatar"
        style="position: absolute; right: 0; left: auto; top: calc(100% + 8px); width: 240px; max-width: calc(100vw - 16px); z-index: 40; box-shadow: var(--shadow-lg); padding: 8px;"
      >
        <div style="padding: 10px 12px;">
          <div style="font-weight:var(--fw-semibold);font-size:var(--fs-body);color:var(--text);">
            {{ userName }}
          </div>
          <div
            v-if="userRole"
            style="font-size:var(--fs-label);color:var(--text-tertiary);margin-top:2px;text-transform:uppercase;letter-spacing:var(--tracking-label);"
          >
            {{ userRole }}
          </div>
          <div
            v-if="userEmail"
            style="font-size:var(--fs-label);color:var(--text-secondary);margin-top:4px;"
          >
            {{ userEmail }}
          </div>
        </div>
        <div class="hr" style="margin: 6px 0;" />
        <div
          class="nav-item"
          style="border-radius:8px;color:var(--error);"
          @click="logout"
        >
          <svg
            class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
          >
            <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          </svg>
          <span>{{ t('Logout') }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* Keep topbar dropdowns inside the viewport on narrow screens. */
@media (max-width: 600px) {
  .topbar-dd {
    right: 8px !important;
    left: 8px !important;
    width: auto !important;
    max-width: none !important;
  }
}
</style>

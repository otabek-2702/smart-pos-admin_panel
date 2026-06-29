<script setup lang="ts">
import { useTheme } from 'vuetify'
import { storeToRefs } from 'pinia'
import AnomalyBell from '@/components/design/AnomalyBell.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import SettingsMenu from '@/components/design/SettingsMenu.vue'
import { useAIAssistantStore } from '@/stores/aiAssistant'

/* ============================================================
   Alpha POS — Design Topbar (v3, decision #5)
   - DateRange hard-locked off (showDate = false)
   - SettingsMenu rendered between (where) DateRange (would be)
     and the theme toggle iconbtn
   - DROPPED: language switcher (NavBarI18n + langRoot)
   - DROPPED: avatar dropdown (UserProfile / avatarRoot)
   - KEPT: bare <div class="avatar">{{ initials }}</div>
     (no click, no dropdown), initials computed from
     localStorage.userData.first_name[0] + last_name[0]
   ============================================================ */

const props = withDefaults(
  defineProps<{ dateRange?: string }>(),
  { dateRange: '14d' },
)

defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'update:dateRange', value: string): void
}>()

const route = useRoute()
const router = useRouter()
const { t } = useI18n({ useScope: 'global' })

/* ---------- AI thinking pill (cross-page indicator) ---------- */
const aiStore = useAIAssistantStore()
const { generating: aiGenerating } = storeToRefs(aiStore)
const showAiPill = computed(() => !!aiGenerating.value && !route.path.startsWith('/ai-assistant'))
function goAi() {
  router.push('/ai-assistant')
}

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

/* ---------- showDate hard-locked off (decision #5 v3) ---------- */
const showDate = computed(() => false)

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

/* ---------- Avatar initials (bare div, no dropdown) ---------- */
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

// Silence unused-prop warning (props.dateRange is reserved for future use).
void props
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

    <!-- AI thinking pill (shown when generation is running on another page) -->
    <button
      v-if="showAiPill"
      class="ai-pill"
      :title="t('AI is generating a reply — click to view')"
      @click="goAi"
    >
      <span class="typing"><span /><span /><span /></span>
      {{ t('AI is thinking…') }}
    </button>

    <!-- DateRange would render here when showDate === true (currently hard-locked off) -->
    <template v-if="showDate" />

    <!-- Anomaly bell — polls /ai/anomalies, opens dropdown w/ ack buttons. -->
    <AnomalyBell />

    <!-- Settings menu (gear popover) — decision #5 v3 -->
    <SettingsMenu />

    <!-- Theme toggle (sun when dark, moon when light) -->
    <button
      class="iconbtn"
      :title="t('Toggle theme')"
      @click="toggleTheme"
    >
      <DesignIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="18" />
    </button>

    <!-- Bare avatar (no dropdown, no click) — decision #5 v3 -->
    <div class="avatar">
      {{ initials }}
    </div>
  </header>
</template>

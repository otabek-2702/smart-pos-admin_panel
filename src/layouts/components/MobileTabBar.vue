<script setup lang="ts">
import DesignIcon from '@/components/design/DesignIcon.vue'

/* ============================================================
   Alpha POS — Mobile bottom tab bar
   1:1 port of MobileTabBar() from
   .tmp-mobile-design/pos-admin-panel/project/app/shell.jsx
   ============================================================ */

const props = defineProps<{ drawerOpen?: boolean }>()
const emit = defineEmits<{
  (e: 'more'): void
}>()

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const route = useRoute()

interface Tab {
  id: string
  label: string
  icon: string
  to?: string
}

const TAB_ITEMS: Tab[] = [
  { id: 'dashboard', label: 'Home', icon: 'dashboard', to: '/' },
  { id: 'orders', label: 'Orders', icon: 'receipt', to: '/orders' },
  { id: 'shifts', label: 'Shifts', icon: 'clock', to: '/shifts-analytics' },
  { id: 'ai', label: 'AI', icon: 'ai', to: '/ai-assistant' },
  { id: '__more', label: 'Menu', icon: 'menu' },
]

function isActive(tab: Tab): boolean {
  if (tab.id === '__more') return !!props.drawerOpen
  if (!tab.to) return false
  return route.path === tab.to || route.path.startsWith(`${tab.to}/`)
}

function onTap(e: MouseEvent, tab: Tab) {
  if (tab.id === '__more') {
    emit('more')
    return
  }
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1)
    return // honor modifier / middle clicks (router-link anchor opens new tab)
  e.preventDefault()
  if (tab.to && !isActive(tab))
    router.push(tab.to)
}
</script>

<template>
  <nav
    class="mobile-tabbar"
    :aria-label="t('Navigation')"
  >
    <template
      v-for="tab in TAB_ITEMS"
      :key="tab.id"
    >
      <button
        v-if="tab.id === '__more'"
        type="button"
        class="mtab"
        :class="{ 'is-active': isActive(tab) }"
        aria-controls="primary-navigation"
        :aria-expanded="!!drawerOpen"
        @click="onTap($event, tab)"
      >
        <span class="mtab__icon"><DesignIcon :name="tab.icon" :size="22" /></span>
        <span class="mtab__label">{{ t(tab.label) }}</span>
      </button>
      <a
        v-else-if="tab.to"
        :href="tab.to"
        class="mtab"
        :class="{ 'is-active': isActive(tab) }"
        :aria-current="isActive(tab) ? 'page' : undefined"
        @click="onTap($event, tab)"
      >
        <span class="mtab__icon"><DesignIcon :name="tab.icon" :size="22" /></span>
        <span class="mtab__label">{{ t(tab.label) }}</span>
      </a>
    </template>
  </nav>
</template>

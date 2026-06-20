<script setup lang="ts">
import DesignIcon from '@/components/design/DesignIcon.vue'

/* ============================================================
   Alpha POS — Design Sidebar
   Ports Sidebar() + NAV from
   .tmp-alpha-design/alpha-design-source/App.shell.jsx verbatim.
   ============================================================ */

interface NavSection { type: 'section'; label: string }
interface NavItem {
  type: 'item'
  id: string
  label: string
  icon: string
  to: string
  badge?: string
}
type NavEntry = NavSection | NavItem

defineProps<{ collapsed?: boolean }>()

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const route = useRoute()

/* NAV array — mirrors source App.shell.jsx NAV verbatim.
   Source ids are mapped to existing Vue routes via `to`. */
const NAV: NavEntry[] = [
  { type: 'item', id: 'design', label: 'Design System', icon: 'sliders', to: '/design' },
  { type: 'item', id: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
  { type: 'item', id: 'analytics', label: 'Analytics', icon: 'chart', to: '/analytics' },
  { type: 'item', id: 'ai', label: 'AI Assistant', icon: 'ai', to: '/ai-assistant' },
  { type: 'item', id: 'shifts', label: 'Shifts', icon: 'clock', to: '/shifts-analytics', badge: '2' },
  { type: 'section', label: 'Management' },
  { type: 'item', id: 'users', label: 'Users', icon: 'users', to: '/users' },
  { type: 'item', id: 'categories', label: 'Categories', icon: 'grid', to: '/categories' },
  { type: 'item', id: 'products', label: 'Products', icon: 'box', to: '/products', badge: '316' },
  { type: 'item', id: 'orders', label: 'Orders', icon: 'receipt', to: '/orders', badge: '5' },
  { type: 'item', id: 'places', label: 'Places & Tables', icon: 'table', to: '/places' },
  { type: 'item', id: 'discounts', label: 'Discounts', icon: 'tag', to: '/discounts' },
  { type: 'item', id: 'cash', label: 'Cash Register', icon: 'register', to: '/cashbox/categories' },
  { type: 'item', id: 'treasury', label: 'Treasury', icon: 'store', to: '/treasury' },
  { type: 'item', id: 'loyalty', label: 'Loyalty', icon: 'gift', to: '/loyalty' },
  { type: 'section', label: 'HR' },
  { type: 'item', id: 'employees', label: 'Employees', icon: 'employee', to: '/hr-employees' },
  { type: 'item', id: 'departments', label: 'Departments', icon: 'dept', to: '/hr-departments' },
  { type: 'item', id: 'salaries', label: 'Salaries', icon: 'coins', to: '/hr-salaries' },
]

function isItem(n: NavEntry): n is NavItem {
  return n.type === 'item'
}

function isActive(item: NavItem): boolean {
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

function go(item: NavItem) {
  if (!isActive(item))
    router.push(item.to)
}
</script>

<template>
  <aside class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="sidebar__brand">
      <div class="sidebar__logo">
        <DesignIcon name="store" :size="19" :weight="2" />
      </div>
      <div v-if="!collapsed" class="sidebar__name">
        {{ t('Alpha POS') }}
      </div>
    </div>

    <nav class="sidebar__nav">
      <template v-for="(n, i) in NAV" :key="i">
        <template v-if="n.type === 'section'">
          <div v-if="!collapsed" class="nav-section">
            {{ t(n.label) }}
          </div>
          <div v-else class="hr" style="margin: 10px 8px;" />
        </template>
        <template v-else-if="isItem(n)">
          <div
            class="nav-item"
            :class="{ 'is-active': isActive(n) }"
            :title="collapsed ? t(n.label) : ''"
            @click="go(n)"
          >
            <span class="nav-item__icon">
              <DesignIcon :name="n.icon" :size="20" />
            </span>
            <span v-if="!collapsed" style="flex:1;">{{ t(n.label) }}</span>
            <span v-if="!collapsed && n.badge" class="nav-item__badge">{{ n.badge }}</span>
          </div>
        </template>
      </template>
    </nav>
  </aside>
</template>

<style scoped lang="scss">
// Styling lives in src/styles/design-shell.css (global).
// Local-only tweak: keep inline SVGs visually centered inside the nav-item__icon slot.
.nav-item__icon :deep(svg) {
  display: block;
}
</style>

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

defineProps<{ collapsed?: boolean, open?: boolean }>()
const emit = defineEmits<{ (e: 'nav-go'): void, (e: 'close'): void }>()

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const route = useRoute()

/* NAV array — mirrors source App.shell.jsx NAV verbatim.
   Source ids are mapped to existing Vue routes via `to`. */
const NAV: NavEntry[] = [
  { type: 'item', id: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
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
  { type: 'item', id: 'sessions', label: 'Sessions', icon: 'lock', to: '/sessions' },
  { type: 'section', label: 'HR' },
  { type: 'item', id: 'employees', label: 'Employees', icon: 'employee', to: '/hr-employees' },
  { type: 'item', id: 'departments', label: 'Departments', icon: 'dept', to: '/hr-departments' },
  { type: 'item', id: 'salaries', label: 'Salaries', icon: 'coins', to: '/hr-salaries' },
  { type: 'item', id: 'hr-cash', label: 'HR Cash', icon: 'wallet', to: '/hr-cash' },
  { type: 'item', id: 'hr-documents', label: 'HR Documents', icon: 'receipt', to: '/hr-documents' },
  { type: 'item', id: 'hr-events', label: 'Events', icon: 'flag', to: '/hr-events' },
  { type: 'item', id: 'hr-expense-categories', label: 'Expense Categories', icon: 'grid', to: '/hr-expense-categories' },
  { type: 'item', id: 'hr-goals', label: 'Goals', icon: 'target', to: '/hr-goals' },
  { type: 'item', id: 'hr-leave-balances', label: 'Leave Balances', icon: 'clock', to: '/hr-leave-balances' },
  { type: 'item', id: 'hr-leave-types', label: 'Leave Types', icon: 'clock', to: '/hr-leave-types' },
  { type: 'item', id: 'hr-reviews', label: 'Reviews', icon: 'star', to: '/hr-reviews' },
  { type: 'item', id: 'shift-templates', label: 'Shift Templates', icon: 'clock', to: '/shift-templates' },
  { type: 'section', label: 'Stock' },
  { type: 'item', id: 'stock-alerts', label: 'Stock Alerts', icon: 'alert', to: '/stock/alerts' },
  { type: 'item', id: 'stock-receiving', label: 'Receiving', icon: 'inbox', to: '/stock/receiving' },
  { type: 'item', id: 'stock-adjustments', label: 'Adjustments', icon: 'sliders', to: '/stock/adjustments' },
  { type: 'item', id: 'stock-reservations', label: 'Reservations', icon: 'lock', to: '/stock/reservations' },
  { type: 'section', label: 'Settings' },
  { type: 'item', id: 'qr-codes', label: 'QR Codes', icon: 'grid', to: '/qr-codes' },
  { type: 'section', label: 'Notifications' },
  { type: 'item', id: 'notification-queue', label: 'Notification Queue', icon: 'inbox', to: '/notification-queue' },
  { type: 'item', id: 'notification-settings', label: 'Notification Settings', icon: 'sliders', to: '/notification-settings' },
  { type: 'item', id: 'notification-templates', label: 'Notification Templates', icon: 'copy', to: '/notification-templates' },
  { type: 'item', id: 'notification-types', label: 'Notification Types', icon: 'bell', to: '/notification-types' },
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
  emit('nav-go')
}
</script>

<template>
  <aside class="sidebar" :class="{ 'is-collapsed': collapsed, 'is-open': open }">
    <div class="sidebar__brand">
      <div class="sidebar__logo">
        <DesignIcon name="store" :size="19" :weight="2" />
      </div>
      <div v-if="!collapsed" class="sidebar__name">
        {{ t('Alpha POS') }}
      </div>
      <button
        class="sidebar__close"
        :title="t('Close')"
        @click="emit('close')"
      >
        <DesignIcon name="close" :size="18" />
      </button>
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

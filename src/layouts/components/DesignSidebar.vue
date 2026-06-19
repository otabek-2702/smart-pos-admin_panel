<script setup lang="ts">
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
  { type: 'section', label: 'HR' },
  { type: 'item', id: 'employees', label: 'Employees', icon: 'employee', to: '/hr-employees' },
  { type: 'item', id: 'departments', label: 'Departments', icon: 'dept', to: '/hr-departments' },
  { type: 'item', id: 'salaries', label: 'Salaries', icon: 'coins', to: '/hr-salaries' },
]

function isItem(n: NavEntry): n is NavItem {
  return n.type === 'item'
}

function isActive(item: NavItem): boolean {
  return route.path === item.to || route.path.startsWith(item.to + '/')
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
        <svg
          class="ic"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 9.5 5.5 5h13L20 9.5M4 9.5h16M4 9.5v9.5h16V9.5M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M9 19v-5h4v5" />
        </svg>
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
              <!-- dashboard -->
              <svg
                v-if="n.icon === 'dashboard'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z" />
              </svg>
              <!-- ai -->
              <svg
                v-else-if="n.icon === 'ai'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="4.5" y="7" width="15" height="12" rx="3" />
                <path d="M12 7V4M9 12h.01M15 12h.01M9.5 16h5" />
                <path d="M2.5 12.5v2M21.5 12.5v2" />
              </svg>
              <!-- clock -->
              <svg
                v-else-if="n.icon === 'clock'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
              <!-- users -->
              <svg
                v-else-if="n.icon === 'users'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.2a3 3 0 0 1 0 5.6M21 19a5 5 0 0 0-3.5-4.8" />
              </svg>
              <!-- grid -->
              <svg
                v-else-if="n.icon === 'grid'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="4" y="4" width="7" height="7" rx="1.6" />
                <rect x="13" y="4" width="7" height="7" rx="1.6" />
                <rect x="4" y="13" width="7" height="7" rx="1.6" />
                <rect x="13" y="13" width="7" height="7" rx="1.6" />
              </svg>
              <!-- box -->
              <svg
                v-else-if="n.icon === 'box'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
                <path d="m4 7 8 4 8-4M12 11v10" />
              </svg>
              <!-- receipt -->
              <svg
                v-else-if="n.icon === 'receipt'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M6 3.5h12v17l-2.2-1.5-2.3 1.5-2.2-1.5L9 20.5l-2.3-1.5L4.5 20.5V3.5H6Z" />
                <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
              </svg>
              <!-- table -->
              <svg
                v-else-if="n.icon === 'table'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
                <path d="M3.5 9.5h17M9 9.5v10M15 9.5v10" />
              </svg>
              <!-- tag -->
              <svg
                v-else-if="n.icon === 'tag'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 4h7l9 9-7 7-9-9V4Z" />
                <circle cx="8" cy="8" r="1.4" />
              </svg>
              <!-- register -->
              <svg
                v-else-if="n.icon === 'register'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3.5" y="9" width="17" height="11" rx="2" />
                <path d="M7 9V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V9M8 13h3M14 13h2M8 16.5h8" />
              </svg>
              <!-- store -->
              <svg
                v-else-if="n.icon === 'store'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 9.5 5.5 5h13L20 9.5M4 9.5h16M4 9.5v9.5h16V9.5M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0M9 19v-5h4v5" />
              </svg>
              <!-- gift -->
              <svg
                v-else-if="n.icon === 'gift'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="4" y="9" width="16" height="11" rx="1.6" />
                <path d="M3 9h18M12 9v11M12 9c-1-3-3.5-4-4.5-3s0 3 4.5 3Zm0 0c1-3 3.5-4 4.5-3s0 3-4.5 3Z" />
              </svg>
              <!-- employee -->
              <svg
                v-else-if="n.icon === 'employee'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="8" r="3.4" />
                <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
              </svg>
              <!-- dept -->
              <svg
                v-else-if="n.icon === 'dept'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3.5" y="8" width="7" height="12" rx="1.4" />
                <rect x="13.5" y="4" width="7" height="16" rx="1.4" />
                <path d="M5.5 12h3M5.5 15.5h3M15.5 8h3M15.5 11.5h3M15.5 15h3" />
              </svg>
              <!-- coins -->
              <svg
                v-else-if="n.icon === 'coins'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <ellipse cx="9" cy="7" rx="5.5" ry="2.8" />
                <path d="M3.5 7v5c0 1.5 2.5 2.8 5.5 2.8M14.5 11.5c2.8.3 5 1.4 5 2.8 0 1.6-2.7 2.9-6 2.9s-6-1.3-6-2.9M3.5 12c0 1.5 2.5 2.8 5.5 2.8" />
              </svg>
              <!-- chart -->
              <svg
                v-else-if="n.icon === 'chart'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 4v16h16" />
                <path d="M8 15l3-4 3 2 4-6" />
              </svg>
              <!-- sliders -->
              <svg
                v-else-if="n.icon === 'sliders'"
                class="ic"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
                <circle cx="16" cy="8" r="2.2" />
                <circle cx="8" cy="16" r="2.2" />
              </svg>
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
// Most styling lives in src/styles/design-shell.css (global).
// Local-only tweak: keep inline SVGs visually centered inside the nav-item__icon slot.
.nav-item__icon :deep(svg) {
  display: block;
}
</style>

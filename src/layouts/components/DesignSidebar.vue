<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useMediaQuery } from '@vueuse/core'
import DesignIcon from '@/components/design/DesignIcon.vue'
import { routeLabelForPath } from '@/navigation/routeLabels'
import { useNavCountsStore } from '@/stores/navCounts'
import { useUserAccess } from '@/composables/useUserAccess'

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
  anyPermission?: string[]
}
type NavEntry = NavSection | NavItem

const props = defineProps<{ collapsed?: boolean; open?: boolean }>()
const emit = defineEmits<{ (e: 'navGo'): void; (e: 'close'): void }>()

const WAREHOUSE_WORKSPACE_PERMISSIONS = [
  'stock.catalog.view',
  'stock.level.view',
  'stock.batch.view',
  'stock.supplier.view',
  'stock.purchase.view',
  'stock.receiving.create',
  'stock.receiving.update_draft',
  'stock.receiving.complete',
  'stock.transfer.view',
  'stock.transfer.create',
  'stock.count.view',
  'stock.count.create',
  'stock.count.record',
  'stock.adjustment.request',
]

const OPERATIONAL_AUDIT_PERMISSIONS = [
  'attendance.view',
  'discipline.rule.view',
  'discipline.case.view',
  'prep.audit.view',
]

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const route = useRoute()
const { isWarehouse, hasAnyPermission } = useUserAccess()
const isMobile = useMediaQuery('(max-width: 768px)')
const drawerHidden = computed(() => isMobile.value && !props.open)
const closeButton = ref<HTMLButtonElement | null>(null)

function focusClose() {
  closeButton.value?.focus()
}

defineExpose({ focusClose })

const navStore = useNavCountsStore()
const { counts } = storeToRefs(navStore)

onMounted(() => {
  if (!isWarehouse.value)
    navStore.start()
})
onBeforeUnmount(() => navStore.stop())

function badgeFor(id: string): string | undefined {
  if (id === 'shifts' && counts.value.shifts !== null && counts.value.shifts > 0)
    return String(counts.value.shifts)
  if (id === 'orders' && counts.value.orders !== null && counts.value.orders > 0)
    return String(counts.value.orders)
  return undefined
}

/* NAV array — mirrors source App.shell.jsx NAV verbatim.
   Source ids are mapped to existing Vue routes via `to`. */
const NAV: NavEntry[] = [
  { type: 'item', id: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/' },
  { type: 'item', id: 'ai', label: 'AI Assistant', icon: 'ai', to: '/ai-assistant' },
  { type: 'item', id: 'shifts', label: 'Shifts', icon: 'clock', to: '/shifts-analytics' },
  { type: 'section', label: 'Management' },
  { type: 'item', id: 'users', label: 'Users', icon: 'users', to: '/users' },
  { type: 'item', id: 'categories', label: 'Categories', icon: 'grid', to: '/categories' },
  { type: 'item', id: 'products', label: 'Products', icon: 'box', to: '/products' },
  { type: 'item', id: 'product-statistics', label: 'Product sales analytics', icon: 'trend', to: '/analytics/product-statistics' },
  { type: 'item', id: 'orders', label: 'Orders', icon: 'receipt', to: '/orders' },
  { type: 'item', id: 'places', label: 'Places & Tables', icon: 'table', to: '/places' },
  { type: 'item', id: 'discounts', label: 'Discounts', icon: 'tag', to: '/discounts' },
  { type: 'item', id: 'cash', label: 'Cashbox Expense Categories', icon: 'register', to: '/cashbox/categories' },
  { type: 'item', id: 'money-control', label: 'Money Control', icon: 'wallet', to: '/money-control', anyPermission: ['money.control.view'] },
  { type: 'item', id: 'treasury', label: 'Treasury', icon: 'store', to: '/treasury' },
  { type: 'item', id: 'loyalty', label: 'Loyalty', icon: 'gift', to: '/loyalty' },
  { type: 'item', id: 'sessions', label: 'Sessions', icon: 'lock', to: '/sessions' },
  { type: 'item', id: 'warehouse', label: 'Warehouse operations', icon: 'package', to: '/warehouse', anyPermission: WAREHOUSE_WORKSPACE_PERMISSIONS },
  { type: 'section', label: 'HR' },
  { type: 'item', id: 'operational-audit', label: 'Operational Audit', icon: 'flag', to: '/audit', anyPermission: OPERATIONAL_AUDIT_PERMISSIONS },
  { type: 'item', id: 'employees', label: 'Employees', icon: 'employee', to: '/hr-employees' },
  { type: 'item', id: 'departments', label: 'Departments', icon: 'dept', to: '/hr-departments' },
  { type: 'item', id: 'salaries', label: 'Salaries', icon: 'coins', to: '/hr-salaries' },
  { type: 'item', id: 'hr-cash', label: 'HR Cash', icon: 'wallet', to: '/hr-cash' },
  { type: 'item', id: 'hr-documents', label: 'HR Documents', icon: 'receipt', to: '/hr-documents' },
  { type: 'item', id: 'hr-events', label: 'Employment Events', icon: 'flag', to: '/hr-events' },
  { type: 'item', id: 'hr-expense-categories', label: 'Expense Categories', icon: 'grid', to: '/hr-expense-categories' },
  { type: 'item', id: 'hr-goals', label: 'Goals', icon: 'target', to: '/hr-goals' },
  { type: 'item', id: 'hr-leave-balances', label: 'Leave Balances', icon: 'clock', to: '/hr-leave-balances' },
  { type: 'item', id: 'hr-leave-types', label: 'Leave Types', icon: 'clock', to: '/hr-leave-types' },
  { type: 'item', id: 'hr-reviews', label: 'Performance Reviews', icon: 'star', to: '/hr-reviews' },
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

const WAREHOUSE_NAV: NavEntry[] = [
  { type: 'item', id: 'warehouse', label: 'Warehouse operations', icon: 'package', to: '/warehouse' },
  { type: 'section', label: 'Stock' },
  { type: 'item', id: 'stock-items', label: 'Stock Items', icon: 'box', to: '/stock/items', anyPermission: ['stock.catalog.view'] },
  { type: 'item', id: 'stock-levels', label: 'Stock Levels', icon: 'bars', to: '/stock/levels', anyPermission: ['stock.level.view'] },
  { type: 'item', id: 'stock-batches', label: 'Batches', icon: 'package', to: '/stock/batches', anyPermission: ['stock.batch.view'] },
  { type: 'item', id: 'stock-suppliers', label: 'Suppliers', icon: 'building', to: '/stock/suppliers', anyPermission: ['stock.supplier.view'] },
  { type: 'item', id: 'stock-purchase-orders', label: 'Purchase Orders', icon: 'receipt', to: '/stock/purchase-orders', anyPermission: ['stock.purchase.view'] },
  { type: 'item', id: 'stock-receiving', label: 'Receiving', icon: 'inbox', to: '/stock/receiving', anyPermission: ['stock.purchase.view'] },
  { type: 'item', id: 'stock-counts', label: 'Stock Counts', icon: 'list', to: '/stock/counts', anyPermission: ['stock.count.view'] },
  { type: 'item', id: 'stock-adjustment-requests', label: 'Stock adjustment requests', icon: 'sliders', to: '/stock/adjustment-requests', anyPermission: ['stock.adjustment.request'] },
  { type: 'item', id: 'stock-transfers', label: 'Transfers', icon: 'share', to: '/stock/transfers', anyPermission: ['stock.transfer.view'] },
  { type: 'section', label: 'HR' },
  { type: 'item', id: 'operational-audit', label: 'Operational Audit', icon: 'flag', to: '/audit', anyPermission: ['attendance.view', 'discipline.rule.view', 'discipline.case.view', 'prep.audit.view'] },
]

const visibleNav = computed<NavEntry[]>(() => {
  const source = isWarehouse.value ? WAREHOUSE_NAV : NAV
  const allowed = source.filter(entry => entry.type === 'section' || !entry.anyPermission?.length || hasAnyPermission(entry.anyPermission))

  return allowed.filter((entry, index) => {
    if (entry.type !== 'section')
      return true

    const next = allowed[index + 1]

    return !!next && next.type === 'item'
  })
})

function isItem(n: NavEntry): n is NavItem {
  return n.type === 'item'
}

function navLabel(item: NavItem): string {
  return routeLabelForPath(item.to) || item.label
}

function isActive(item: NavItem): boolean {
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

function onNavClick(e: MouseEvent, item: NavItem) {
  // Honor modifier / middle clicks — let the browser open in new tab/window via the anchor's href.
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1)
    return
  e.preventDefault()
  if (!isActive(item))
    router.push(item.to)
  emit('navGo')
}
</script>

<template>
  <aside
    id="primary-navigation"
    class="sidebar"
    :class="{ 'is-collapsed': collapsed, 'is-open': open }"
    :aria-hidden="drawerHidden ? 'true' : undefined"
    :inert="drawerHidden ? true : undefined"
  >
    <div class="sidebar__brand">
      <div class="sidebar__logo">
        <DesignIcon name="store" :size="19" :weight="2" />
      </div>
      <div v-if="!collapsed" class="sidebar__name">
        {{ t('Alpha POS') }}
      </div>
      <button
        ref="closeButton"
        class="sidebar__close"
        :title="t('Close')"
        :aria-label="t('Close')"
        @click="emit('close')"
      >
        <DesignIcon name="close" :size="18" />
      </button>
    </div>

    <nav
      class="sidebar__nav"
      :aria-label="t('Navigation')"
    >
      <template v-for="(n, i) in visibleNav" :key="i">
        <template v-if="n.type === 'section'">
          <div v-if="!collapsed" class="nav-section">
            {{ t(n.label) }}
          </div>
          <div v-else class="hr" style="margin: 10px 8px;" />
        </template>
        <template v-else-if="isItem(n)">
          <a
            :href="n.to"
            class="nav-item"
            :class="{ 'is-active': isActive(n) }"
            :title="collapsed ? t(navLabel(n)) : ''"
            :aria-current="isActive(n) ? 'page' : undefined"
            @click="onNavClick($event, n)"
          >
            <span class="nav-item__icon">
              <DesignIcon :name="n.icon" :size="20" />
            </span>
            <span v-if="!collapsed" style="flex:1;">{{ t(navLabel(n)) }}</span>
            <span v-if="!collapsed && (n.badge || badgeFor(n.id))" class="nav-item__badge">{{ badgeFor(n.id) ?? n.badge }}</span>
          </a>
        </template>
      </template>
    </nav>

    <!-- v3 #6 SidebarLiveWidget hidden per Jason: not needed in sidebar foot. -->
    <!-- <SidebarLiveWidget :collapsed="collapsed" @nav-go="onWidgetGo" /> -->
  </aside>
</template>

<style scoped lang="scss">
// Styling lives in src/styles/design-shell.css (global).
// Local-only tweak: keep inline SVGs visually centered inside the nav-item__icon slot.
.nav-item__icon :deep(svg) {
  display: block;
}
</style>

<script setup lang="ts">
/* ============================================================
   ALPHA POS — Dashboards hub (5 switchable dashboard views)
   1:1 port of .tmp-handoff-v3/.../pages/Dashboard.jsx
   Replaces the previous "Today's Snapshot" page per Jason's call
   (locked decision #7 v3). Tabbed shell, shared header, date range,
   refresh + export. Sub-dashboards live in src/pages/dash/*.vue
   and are lazy-loaded via defineAsyncComponent.
   ============================================================ */
import { defineAsyncComponent } from 'vue'
import AIBriefingCard from '@/components/design/AIBriefingCard.vue'
import { useAIPageContext } from '@/composables/useAIPageContext'
import Button from '@/components/design/Button.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import DateRangePicker, { type DateRangeValue } from '@/components/design/DateRangePicker.vue'
import { useToast } from '@/components/design/useToast'
import { fmtDateTime } from '@/components/design/utils/format'
import { cx } from '@/components/design/utils'
import { useDashboardData } from '@/composables/useDashboardData'

const { t } = useI18n({ useScope: 'global' })
const toast = useToast()
const { shared: sharedDash, loading: sharedLoading, fetchShared } = useDashboardData()

// ---------- View registry ----------
type ViewId = 'exec' | 'sales' | 'ops' | 'products' | 'staff'

interface DashView {
  id: ViewId
  labelKey: string
  subtitleKey: string
  icon: string
  comp: ReturnType<typeof defineAsyncComponent>
}

const DASH_VIEWS: DashView[] = [
  {
    id: 'exec',
    labelKey: 'Executive',
    subtitleKey: 'dash_subtitle_exec',
    icon: 'dashboard',
    comp: defineAsyncComponent(() => import('@/pages/dash/executive.vue')),
  },
  {
    id: 'sales',
    labelKey: 'Sales & Revenue',
    subtitleKey: 'dash_subtitle_sales',
    icon: 'trend',
    comp: defineAsyncComponent(() => import('@/pages/dash/sales.vue')),
  },
  {
    id: 'ops',
    labelKey: 'Operations',
    subtitleKey: 'dash_subtitle_ops',
    icon: 'clock',
    comp: defineAsyncComponent(() => import('@/pages/dash/operations.vue')),
  },
  {
    id: 'products',
    labelKey: 'Products',
    subtitleKey: 'dash_subtitle_products',
    icon: 'box',
    comp: defineAsyncComponent(() => import('@/pages/dash/products.vue')),
  },
  {
    id: 'staff',
    labelKey: 'Staff & Shifts',
    subtitleKey: 'dash_subtitle_staff',
    icon: 'users',
    comp: defineAsyncComponent(() => import('@/pages/dash/staff.vue')),
  },
]

// ---------- State ----------
const LS_KEY = 'alphapos-dashview'

function readStoredView(): ViewId {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v && DASH_VIEWS.some(x => x.id === v))
      return v as ViewId
  }
  catch {}
  return 'exec'
}

const view = ref<ViewId>(readStoredView())
const localLoading = ref(false)
const dateRange = ref<DateRangeValue>({ from: '', to: '', preset: '30d' })

// Loading flag the page exposes to the UI = either the hub-level shared
// fetch OR an in-flight manual refresh.
const loading = computed(() => localLoading.value || sharedLoading.value)

watch(view, (v) => {
  try { localStorage.setItem(LS_KEY, v) }
  catch {}
})

const current = computed(() => DASH_VIEWS.find(v => v.id === view.value) ?? DASH_VIEWS[0])

// ---------- Hub-level shared fetch ----------
// Hits GET /dashboard?from&to when a range is selected, falls back to
// /dashboard/today when no range provided. Shape verified against
// alpha_pos_server/admins/services/dashboard_service.py:get_range() /
// get_today() — same `{ success, data }` envelope. Stored into the
// shared composable so any sub-dashboard can opt in via
// `useDashboardData()` without re-fetching.
async function loadShared(): Promise<void> {
  await fetchShared({
    from: dateRange.value?.from ?? '',
    to: dateRange.value?.to ?? '',
    preset: dateRange.value?.preset,
    fromTime: dateRange.value?.fromTime,
    toTime: dateRange.value?.toTime,
  })
}

watch(
  () => [dateRange.value?.from, dateRange.value?.to, dateRange.value?.fromTime, dateRange.value?.toTime],
  () => { void loadShared() },
)

onMounted(() => { void loadShared() })

// Push the current dashboard context to the AI assistant so /ai/query knows
// which sub-dashboard + date range the user is looking at when they ask
// "Why did Wednesday dip?". Re-pushes on view / range change.
const aiCtx = useAIPageContext()
watch(
  () => [view.value, dateRange.value?.from, dateRange.value?.to],
  () => {
    const v = current.value
    aiCtx.set({
      route: '/dashboard',
      route_label: `${t(v.labelKey)} dashboard`,
      range_from: dateRange.value?.from || undefined,
      range_to: dateRange.value?.to || undefined,
      filters: { tab: v.id },
      visible_data_keys: v.id === 'sales'
        ? ['monthRevenue', 'grossMargin', 'revenue30', 'expense30', 'heatMatrix', 'channelDays']
        : v.id === 'products'
          ? ['menuItems', 'bestSellerName', 'units30d', 'menuRevenue', 'top_products', 'affinity']
          : v.id === 'staff'
            ? ['active_count', 'top_performer', 'leaderboard', 'accuracy']
            : v.id === 'ops'
              ? ['live_counts', 'funnel', 'ordersByHour']
              : ['revenue', 'orders', 'paid_orders', 'units_sold'],
    })
  },
  { immediate: true },
)
onUnmounted(() => { aiCtx.clear() })

// ---------- Actions ----------
function selectView(id: ViewId) {
  if (view.value === id)
    return
  view.value = id
}

async function refresh() {
  localLoading.value = true
  try {
    await loadShared()
    toast({
      tone: 'success',
      title: t('Dashboard refreshed'),
      msg: t('Updated {datetime}', { datetime: fmtDateTime(new Date()) }),
    })
  }
  catch {
    // Use vue-sonner directly so the user can retry from the failure toast.
    // The project's wrapper doesn't carry an action payload yet.
    const { toast: sonner } = await import('vue-sonner')
    sonner.error(t('Could not refresh dashboard'), {
      description: t('Check your connection and try again.'),
      action: {
        label: t('Retry'),
        onClick: () => { void refresh() },
      },
    })
  }
  finally {
    localLoading.value = false
  }
}

// CSV export of the current dashboard's headline metrics. Writes a UTF-8 BOM so
// Excel on Russian / Uzbek Windows opens the file with the correct encoding.
// One row per metric — keeps the file readable when copy-pasted into a chat.
function exportCsv() {
  const d = sharedDash.value as any
  if (!d) {
    toast({ tone: 'warning', title: t('Nothing to export yet'), msg: t('Wait for the dashboard to load first') })
    return
  }
  const rows: [string, unknown][] = [
    [t('Generated'), fmtDateTime(new Date())],
    [t('Range'), d.range ? `${d.range.from ?? ''} → ${d.range.to ?? ''}` : t('Today')],
    [t('View'), t(current.value.labelKey)],
    [t('Revenue'), d.revenue ?? d.today?.revenue ?? ''],
    [t('Orders'), d.orders ?? d.today?.orders ?? ''],
    [t('Paid orders'), d.paid_orders ?? d.today?.paid_orders ?? ''],
    [t('Cancelled orders'), d.cancelled ?? d.today?.cancelled ?? ''],
    [t('Units sold'), d.units_sold ?? d.today?.units_sold ?? ''],
  ]
  const breakdown = d.payment_breakdown ?? d.payment_breakdown_today ?? {}
  for (const [k, v] of Object.entries(breakdown))
    rows.push([`${t('Payment')} · ${k}`, v as any])
  const tops = d.top_products ?? d.top_products_today ?? []
  for (const tp of (tops as any[]).slice(0, 10))
    rows.push([`${t('Top product')} · ${tp.product_name ?? tp.name ?? ''}`, tp.revenue ?? tp.quantity ?? ''])
  const csv = `﻿${rows.map(r => `"${String(r[0]).replace(/"/g, '""')}","${String(r[1] ?? '').replace(/"/g, '""')}"`).join('\n')}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `dashboard-${stamp}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast({ tone: 'success', title: t('Exported'), msg: `dashboard-${stamp}.csv` })
}

// Suppress unused-warning when sub-dashboards opt out of the prop.
void sharedDash
</script>

<template>
  <div class="page">
    <div class="page__head">
      <div style="min-width: 0;">
        <h1 class="page__title">
          {{ t('Dashboards') }}
        </h1>
        <div class="page__subtitle">
          {{ t(current.subtitleKey) }}
        </div>
      </div>
      <div class="page__head-actions">
        <DateRangePicker
          v-model="dateRange"
          align="right"
          :placeholder="t('Last 30 days')"
        />
        <Button
          variant="secondary"
          icon="refresh"
          :loading="loading"
          @click="refresh"
        >
          {{ t('Refresh') }}
        </Button>
        <Button
          variant="primary"
          icon="download"
          :disabled="loading"
          @click="exportCsv"
        >
          {{ t('Export') }}
        </Button>
      </div>
    </div>

    <!-- Morning briefing — LLM-generated daily digest. Hides itself when dismissed/empty. -->
    <AIBriefingCard style="margin-bottom: var(--sp-3);" />

    <div
      class="dashtabs"
      style="margin-bottom: var(--sp-3);"
    >
      <button
        v-for="v in DASH_VIEWS"
        :key="v.id"
        type="button"
        :class="cx('dashtab', view === v.id && 'is-active')"
        @click="selectView(v.id)"
      >
        <DesignIcon
          :name="v.icon"
          :size="17"
        />
        <span>{{ t(v.labelKey) }}</span>
      </button>
    </div>

    <component
      :is="current.comp"
      :date-range="dateRange"
      :loading="loading"
    />
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

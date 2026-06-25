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
import Button from '@/components/design/Button.vue'
import DesignIcon from '@/components/design/DesignIcon.vue'
import DateRangePicker, { type DateRangeValue } from '@/components/design/DateRangePicker.vue'
import { useToast } from '@/components/design/useToast'
import { fmtDateTime } from '@/components/design/utils/format'
import { cx } from '@/components/design/utils'

const { t } = useI18n({ useScope: 'global' })
const toast = useToast()

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
const loading = ref(false)
const dateRange = ref<DateRangeValue>({ from: '', to: '', preset: '30d' })

watch(view, (v) => {
  try { localStorage.setItem(LS_KEY, v) }
  catch {}
})

const current = computed(() => DASH_VIEWS.find(v => v.id === view.value) ?? DASH_VIEWS[0])

// ---------- Actions ----------
function selectView(id: ViewId) {
  if (view.value === id)
    return
  view.value = id
}

function refresh() {
  loading.value = true
  // Sub-pages handle their own load; just flash the spinner briefly
  // and surface a confirmation toast.
  setTimeout(() => {
    loading.value = false
    toast({
      tone: 'success',
      title: t('Dashboard refreshed'),
      msg: t('Updated {datetime}', { datetime: fmtDateTime(new Date()) }),
    })
  }, 380)
}
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
        >
          {{ t('Export') }}
        </Button>
      </div>
    </div>

    <div
      class="dashtabs"
      style="margin-bottom: var(--sp-6);"
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

<script setup lang="ts">
/* ============================================================
   ALPHA POS — AnomalyBell
   Topbar icon button that polls /ai/anomalies (unacked) and shows
   a red dot + count badge. Click opens a dropdown listing the
   anomalies. Each row has Open (deep-link) + Acknowledge buttons.
   ============================================================ */
import axiosIns from '@/plugins/axios'
import DesignIcon from './DesignIcon.vue'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

interface Anomaly {
  id: number
  detector: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  fired_at: string
  message: string
  deep_link?: string
  ai_explanation?: string
}

const items = ref<Anomaly[]>([])
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

let pollTimer: number | null = null

async function load() {
  try {
    const res = await axiosIns.get('/ai/anomalies', { params: { unacked: 1 } })
    items.value = (res?.data?.data?.anomalies ?? []) as Anomaly[]
  }
  catch { /* keep prior list */ }
}

async function ack(id: number) {
  try {
    await axiosIns.post(`/ai/anomalies/${id}/ack`)
    items.value = items.value.filter(a => a.id !== id)
  }
  catch { /* noop */ }
}

function goAnomaly(a: Anomaly) {
  if (a.deep_link) router.push(a.deep_link)
  open.value = false
}

const count = computed(() => items.value.length)
const hasCritical = computed(() => items.value.some(a => a.severity === 'critical' || a.severity === 'high'))

function sevTone(s: Anomaly['severity']) {
  if (s === 'critical') return 'error'
  if (s === 'high') return 'warning'
  if (s === 'medium') return 'info'
  return 'neutral'
}

onClickOutside(rootRef, () => { open.value = false })

onMounted(() => {
  void load()
  pollTimer = window.setInterval(load, 90_000)  // every 90s
})

onBeforeUnmount(() => {
  if (pollTimer != null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div ref="rootRef" class="anom-root">
    <button
      class="iconbtn anom-trigger"
      :class="{ 'has-critical': hasCritical }"
      :title="count ? t('{n} new alerts', { n: count }) : t('No alerts')"
      @click="open = !open"
    >
      <DesignIcon name="bell" :size="18" />
      <span v-if="count" class="anom-badge">{{ count > 99 ? '99+' : count }}</span>
    </button>
    <Transition name="fade">
      <div v-if="open" class="anom-panel">
        <div class="anom-head">
          <span class="anom-title">{{ t('Alerts') }}</span>
          <span class="anom-count">{{ count }}</span>
        </div>
        <div v-if="!items.length" class="anom-empty">
          {{ t('Nothing flagged in the last cycle.') }}
        </div>
        <ul v-else class="anom-list">
          <li
            v-for="a in items"
            :key="a.id"
            class="anom-row"
            :class="`sev-${sevTone(a.severity)}`"
          >
            <span :class="['anom-dot', `dot-${sevTone(a.severity)}`]" />
            <div class="anom-body">
              <div class="anom-msg">
                {{ a.message }}
              </div>
              <div v-if="a.ai_explanation" class="anom-explain">
                {{ a.ai_explanation }}
              </div>
              <div class="anom-actions">
                <button
                  v-if="a.deep_link"
                  class="anom-chip"
                  @click="goAnomaly(a)"
                >
                  {{ t('Open') }}
                </button>
                <button
                  class="anom-chip anom-chip--ghost"
                  @click="ack(a.id)"
                >
                  {{ t('Acknowledge') }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.anom-root { position: relative; }
.anom-trigger { position: relative; }
.anom-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 99px;
  background: rgb(var(--v-theme-error));
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  display: grid;
  place-items: center;
  border: 2px solid var(--surface);
}
.anom-trigger.has-critical { color: rgb(var(--v-theme-error)); }
.anom-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: min(360px, 92vw);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 120;
  max-height: 70vh;
  overflow-y: auto;
}
.anom-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.anom-title { font-size: 13px; font-weight: 600; color: var(--text); }
.anom-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--surface-2);
  padding: 2px 8px;
  border-radius: 99px;
}
.anom-empty {
  padding: 22px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
}
.anom-list { margin: 0; padding: 6px; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.anom-row {
  display: flex;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 8px;
}
.anom-row:hover { background: var(--surface-2); }
.anom-dot {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
}
.dot-error { background: rgb(var(--v-theme-error)); }
.dot-warning { background: rgb(var(--v-theme-warning)); }
.dot-info { background: rgb(var(--v-theme-info)); }
.dot-neutral { background: var(--text-tertiary); }
.anom-body { flex: 1; min-width: 0; }
.anom-msg { font-size: 13px; font-weight: 500; color: var(--text); }
.anom-explain {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  line-height: 1.4;
}
.anom-actions { display: inline-flex; gap: 6px; margin-top: 6px; }
.anom-chip {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
}
.anom-chip:hover { background: var(--surface-2); color: var(--text); }
.anom-chip--ghost { border-color: transparent; }
.fade-enter-active, .fade-leave-active { transition: opacity .14s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

<script setup lang="ts">
/* ============================================================
   ALPHA POS — AIBriefingCard
   Pulls GET /api/admins/ai/briefing and renders the bullets the
   LLM composed overnight. Each bullet has a "Dig deeper" chip
   that seeds an AI assistant thread with the bullet's prompt.

   POST /api/admins/ai/briefing/dismiss collapses the card for
   the rest of the business day (BE caches per (user, date)).
   ============================================================ */
import axiosIns from '@/plugins/axios'
import DesignIcon from './DesignIcon.vue'
import { useAIAssistantStore } from '@/stores/aiAssistant'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const aiStore = useAIAssistantStore()

interface BriefingBullet {
  icon?: string
  title: string
  body: string
  deep_link?: string
  ai_seed_prompt?: string
}
interface BriefingPayload {
  id: number | null
  generated_at?: string
  valid_until?: string
  dismissed?: boolean
  bullets: BriefingBullet[]
}

const payload = ref<BriefingPayload | null>(null)
const loading = ref(true)
const dismissed = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await axiosIns.get('/ai/briefing')
    payload.value = res?.data?.data ?? null
    dismissed.value = !!payload.value?.dismissed
  }
  catch { payload.value = null }
  finally { loading.value = false }
}

async function dismiss() {
  dismissed.value = true
  try { await axiosIns.post('/ai/briefing/dismiss') }
  catch { /* best-effort */ }
}

function seedThread(bullet: BriefingBullet) {
  if (!bullet.ai_seed_prompt) {
    if (bullet.deep_link) router.push(bullet.deep_link)
    return
  }
  // Open AI assistant + pre-fill draft with the bullet's seed prompt.
  try {
    if (typeof (aiStore as any).newChat === 'function')
      (aiStore as any).newChat()
    if (typeof (aiStore as any).setDraft === 'function' && (aiStore as any).activeId)
      (aiStore as any).setDraft((aiStore as any).activeId, bullet.ai_seed_prompt)
  }
  catch { /* noop */ }
  router.push('/ai-assistant')
}

onMounted(load)

const show = computed(() => !dismissed.value && (payload.value?.bullets?.length ?? 0) > 0)
</script>

<template>
  <Transition name="briefing">
    <div v-if="show && payload" class="briefing card">
      <div class="briefing__head">
        <div class="briefing__head-text">
          <div class="briefing__eyebrow">
            <DesignIcon name="sparkle" :size="13" />
            {{ t('Morning briefing') }}
          </div>
          <h3 class="briefing__title">
            {{ t('Here is what changed') }}
          </h3>
        </div>
        <button
          class="briefing__dismiss"
          :title="t('Dismiss')"
          :aria-label="t('Dismiss')"
          @click="dismiss"
        >
          <DesignIcon name="close" :size="14" />
        </button>
      </div>
      <ul class="briefing__list">
        <li
          v-for="(b, i) in payload.bullets"
          :key="i"
          class="briefing__item"
        >
          <span class="briefing__icon">
            <DesignIcon :name="b.icon || 'sparkle'" :size="15" />
          </span>
          <div class="briefing__body">
            <div class="briefing__item-title">
              {{ b.title }}
            </div>
            <div class="briefing__item-text">
              {{ b.body }}
            </div>
            <div class="briefing__actions">
              <button
                v-if="b.ai_seed_prompt"
                class="briefing__chip briefing__chip--primary"
                @click="seedThread(b)"
              >
                <DesignIcon name="sparkle" :size="12" />
                {{ t('Dig deeper') }}
              </button>
              <RouterLink
                v-if="b.deep_link"
                :to="b.deep_link"
                class="briefing__chip"
              >
                {{ t('Open') }}
                <DesignIcon name="chevright" :size="12" />
              </RouterLink>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </Transition>
</template>

<style scoped>
.briefing {
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  background:
    linear-gradient(135deg, rgba(var(--v-theme-primary), 0.04), rgba(var(--v-theme-primary), 0) 60%),
    var(--surface);
}
.briefing__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}
.briefing__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--primary);
}
.briefing__title {
  margin: 4px 0 0;
  font-size: var(--fs-h3);
  font-weight: var(--fw-semibold);
  color: var(--text);
}
.briefing__dismiss {
  background: transparent;
  border: 0;
  padding: 6px;
  border-radius: 6px;
  color: var(--text-tertiary);
  cursor: pointer;
}
.briefing__dismiss:hover {
  background: var(--surface-2);
  color: var(--text);
}
.briefing__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.briefing__item {
  display: flex;
  gap: 12px;
}
.briefing__icon {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(var(--v-theme-primary), 0.1);
  color: var(--primary);
}
.briefing__body { flex: 1; min-width: 0; }
.briefing__item-title {
  font-weight: var(--fw-semibold);
  color: var(--text);
  font-size: 14px;
}
.briefing__item-text {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}
.briefing__actions {
  margin-top: 8px;
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}
.briefing__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  text-decoration: none;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.briefing__chip:hover {
  background: var(--surface-2);
  color: var(--text);
}
.briefing__chip--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.briefing__chip--primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
  color: #fff;
}
.briefing-enter-active,
.briefing-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.briefing-enter-from,
.briefing-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>

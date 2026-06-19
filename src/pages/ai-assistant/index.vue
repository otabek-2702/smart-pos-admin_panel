<script setup lang="ts">
import { stockApi as axios } from '@/plugins/axios'
import { getStoredUserData } from '@/utils/storage'

const { t, te, locale } = useI18n({ useScope: 'global' })
const { snackbar, snackbarMsg, snackbarColor, notify } = useNotify()

interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
  intent?: string
  suggestions?: string[]
  timestamp: number
}

interface Suggestion {
  query: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

interface QuickAction {
  id: string
  label: string
  icon: string
  query: string
}

const messages = ref<Message[]>([])
const input = ref('')
const sending = ref(false)
const chatContext = ref<any>(null)
const suggestions = ref<Suggestion[]>([])
const quickActions = ref<QuickAction[]>([])
const loadingMeta = ref(false)
const metaLoadFailed = ref(false)
const logRef = ref<HTMLElement | null>(null)
const userData = ref<any>(getStoredUserData())

// Confirmation modal for destructive clear-chat action.
const clearConfirmOpen = ref(false)

// Hard-coded fallback CTAs when backend quick-actions fail / are empty —
// gives the empty state at least 4 starting prompts in every locale.
const FALLBACK_QUICK_ACTIONS: QuickAction[] = [
  { id: 'fallback-low-stock', label: 'Show low stock', icon: 'warning', query: 'Show me low stock items' },
  { id: 'fallback-today-revenue', label: "Today's revenue", icon: 'chart', query: "What is today's revenue?" },
  { id: 'fallback-top-items', label: 'Top selling items', icon: 'fire', query: 'What are the top selling items?' },
  { id: 'fallback-pending-orders', label: 'Pending orders', icon: 'truck', query: 'Show pending orders' },
]

const effectiveQuickActions = computed<QuickAction[]>(() =>
  quickActions.value.length ? quickActions.value : FALLBACK_QUICK_ACTIONS,
)

const userInitial = computed(() => {
  const name = userData.value?.first_name || userData.value?.email || 'U'

  return String(name).charAt(0).toUpperCase()
})

const priorityTone: Record<string, string> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
}

const iconFor: Record<string, string> = {
  'warning': 'bx-error',
  'clock': 'bx-time',
  'chart': 'bx-bar-chart-alt-2',
  'fire': 'bx-trending-up',
  'truck': 'bx-package',
  'crystal-ball': 'bx-bulb',
}

// Build minimal user payload for AI requests so backend can address user
// by name and tailor permissions-aware responses.
function userPayload() {
  const u = userData.value || {}

  return {
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    role: u.role,
  }
}

// Helper to translate a string IF a matching i18n key exists, else return
// the raw string. Backend can return either a key OR a ready-to-display
// string — this lets us handle both without leaking raw keys.
function tr(s: string): string {
  return te(s) ? t(s) : s
}

function scrollToBottom() {
  nextTick(() => {
    const el = logRef.value
    if (el)
      el.scrollTop = el.scrollHeight
  })
}

async function loadMeta() {
  loadingMeta.value = true
  metaLoadFailed.value = false
  try {
    const params = { locale: locale.value }
    const [sRes, qRes] = await Promise.all([
      axios.get('/ai/suggestions/', { params }),
      axios.get('/ai/quick-actions/', { params }),
    ])

    suggestions.value = sRes.data?.suggestions ?? []
    quickActions.value = qRes.data?.actions ?? []
  }
  catch {
    suggestions.value = []
    quickActions.value = []
    metaLoadFailed.value = true
    notify(t('AI assistant unavailable'), 'error')
  }
  finally {
    loadingMeta.value = false
  }
}

// `text` is the payload sent to the backend (raw English query for
// backend matching). `displayedText` is what shows in the chat bubble —
// when caller passes the localized label, the user-bubble matches the
// button they clicked instead of the English backend string.
async function send(text?: string, displayedText?: string) {
  const query = (text ?? input.value).trim()
  if (!query || sending.value)
    return

  const bubbleText = (displayedText ?? text ?? input.value).trim() || query

  messages.value.push({
    id: Date.now(),
    role: 'user',
    text: bubbleText,
    timestamp: Date.now(),
  })
  input.value = ''
  sending.value = true
  scrollToBottom()

  try {
    const res = await axios.post('/ai/query/', {
      query,
      context: chatContext.value,
      locale: locale.value,
      user: userPayload(),
    })

    const d = res.data ?? {}

    chatContext.value = d.context ?? chatContext.value
    messages.value.push({
      id: Date.now() + 1,
      role: 'bot',
      text: d.response || t('No response'),
      intent: d.intent,
      suggestions: d.suggestions ?? [],
      timestamp: Date.now(),
    })
  }
  catch (e: any) {
    const code = e?.response?.data?.error
    const friendly = (code === 'llm_sdk_missing' || code === 'llm_key_missing')
      ? t('AI service unavailable')
      : (e?.response?.data?.message || (code ? tr('error_' + code) : '') || t('Request failed. Please try again.'))

    messages.value.push({
      id: Date.now() + 1,
      role: 'bot',
      text: friendly,
      timestamp: Date.now(),
    })
  }
  finally {
    sending.value = false
    scrollToBottom()
  }
}

function requestClearChat() {
  if (!messages.value.length)
    return
  clearConfirmOpen.value = true
}

function confirmClearChat() {
  messages.value = []
  chatContext.value = null
  clearConfirmOpen.value = false
}

function formatTime(ts: number) {
  const d = new Date(ts)

  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Translate intent enum (e.g. STOCK_QUERY → t('intent_STOCK_QUERY')).
// Falls back to raw value so unknown intents don't disappear.
function displayIntent(intent: string): string {
  return te('intent_' + intent) ? t('intent_' + intent) : intent
}

onMounted(() => {
  loadMeta()
})

// Reload localized suggestions/quick-actions when user switches language.
watch(locale, () => {
  loadMeta()
})
</script>

<template>
  <div class="ai-chat-page">
    <div class="card ai-chat-card">
      <!-- Header -->
      <div class="chat-header">
        <div class="chat-header__avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <line x1="12" y1="7" x2="12" y2="11" />
            <line x1="8" y1="16" x2="8" y2="16" />
            <line x1="16" y1="16" x2="16" y2="16" />
          </svg>
        </div>
        <div class="chat-header__text">
          <h2 class="chat-header__title">
            {{ t('AI Assistant') }}
          </h2>
          <div class="chat-header__sub">
            {{ t('Ask about stock, orders, and inventory') }}
          </div>
        </div>
        <button
          class="iconaction"
          :title="t('Clear chat')"
          :disabled="!messages.length"
          @click="requestClearChat"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>

      <div class="card__divider" />

      <!-- Chat log -->
      <div
        ref="logRef"
        class="chat-log"
      >
        <div
          v-if="!messages.length"
          class="empty-state"
        >
          <div class="empty-state__avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <line x1="12" y1="7" x2="12" y2="11" />
              <line x1="8" y1="16" x2="8" y2="16" />
              <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
          </div>
          <h3 class="empty-state__title">
            {{ t('How can I help you today?') }}
          </h3>
          <p class="empty-state__sub">
            {{ t('Ask anything about your stock, batches, or orders.') }}
          </p>

          <!-- Offline banner: shown when both lists empty AFTER a failed load attempt -->
          <div
            v-if="metaLoadFailed && !suggestions.length && !quickActions.length"
            class="ai-offline-banner"
            role="status"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{{ t('AI assistant unavailable') }}</span>
          </div>

          <!-- Quick actions (backend or fallback). BUG-1A/F44 fix: send localized
               label as the displayed bubble text so the user-bubble matches the
               button the user clicked, even when backend posted text is English. -->
          <div
            class="quick-actions"
          >
            <button
              v-for="qa in effectiveQuickActions"
              :key="qa.id"
              type="button"
              class="btn btn--secondary qa-btn"
              @click="send(qa.query, tr(qa.label))"
            >
              <VIcon
                :icon="iconFor[qa.icon] || 'bx-star'"
                size="16"
              />
              <span>{{ tr(qa.label) }}</span>
            </button>
          </div>

          <!-- Suggestion cards (only from backend) -->
          <div
            v-if="suggestions.length"
            class="suggestions"
          >
            <div class="suggestions__title">
              {{ t('Suggestions') }}
            </div>
            <button
              v-for="(s, i) in suggestions"
              :key="i"
              type="button"
              class="suggestion-card"
              @click="send(s.query, tr(s.query))"
            >
              <span
                class="badge"
                :class="`t-${priorityTone[s.priority] || 'neutral'}`"
              >{{ tr(s.priority) }}</span>
              <span class="suggestion-card__body">
                <span class="suggestion-card__query">{{ tr(s.query) }}</span>
                <span class="suggestion-card__reason">{{ tr(s.reason) }}</span>
              </span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="suggestion-card__chev">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        <template v-else>
          <div
            v-for="m in messages"
            :key="m.id"
            class="msg-row"
            :class="m.role === 'user' ? 'msg-row--user' : 'msg-row--bot'"
          >
            <div
              v-if="m.role === 'bot'"
              class="msg-avatar msg-avatar--bot"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <line x1="12" y1="7" x2="12" y2="11" />
              </svg>
            </div>

            <div class="msg-bubble-wrap">
              <div
                class="msg-bubble"
                :class="m.role === 'user' ? 'bubble-user' : 'bubble-bot'"
              >
                <div class="msg-text" v-text="m.text" />
              </div>
              <div
                class="msg-meta"
                :class="m.role === 'user' ? 'msg-meta--end' : 'msg-meta--start'"
              >
                <span
                  v-if="m.intent"
                  class="msg-intent"
                >{{ displayIntent(m.intent) }}</span>
                <span>{{ formatTime(m.timestamp) }}</span>
              </div>

              <!-- Bot-returned follow-up chips. BUG-1C fix: render and post
                   through tr() so chip text and the resulting user bubble
                   match the active locale. -->
              <div
                v-if="m.suggestions?.length"
                class="msg-suggestions"
              >
                <button
                  v-for="(sg, i) in m.suggestions"
                  :key="i"
                  type="button"
                  class="msg-suggestion-chip"
                  @click="send(sg, tr(sg))"
                >
                  {{ tr(sg) }}
                </button>
              </div>
            </div>

            <div
              v-if="m.role === 'user'"
              class="msg-avatar msg-avatar--user"
              aria-hidden="true"
            >
              {{ userInitial }}
            </div>
          </div>

          <div
            v-if="sending"
            class="msg-row msg-row--bot"
          >
            <div class="msg-avatar msg-avatar--bot" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <line x1="12" y1="7" x2="12" y2="11" />
              </svg>
            </div>
            <div class="msg-bubble bubble-bot typing">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
          </div>
        </template>
      </div>

      <div class="card__divider" />

      <!-- Input -->
      <form class="chat-input" @submit.prevent="() => send()">
        <div class="control chat-input__control">
          <input
            v-model="input"
            type="text"
            :placeholder="t('Type your message...')"
            :disabled="sending"
            autofocus
          >
          <button
            type="submit"
            class="btn btn--primary btn--sm chat-input__send"
            :class="{ 'is-loading': sending }"
            :disabled="sending || !input.trim()"
            :aria-label="t('Send')"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </form>
    </div>

    <!-- Clear-chat confirmation modal -->
    <div v-if="clearConfirmOpen" class="overlay" @mousedown.self="clearConfirmOpen = false">
      <div class="modal" style="max-width:440px;" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div style="flex:1;min-width:0;">
            <h3 class="modal__title">
              {{ t('Clear conversation?') }}
            </h3>
            <div class="modal__sub">
              {{ t('This action cannot be undone') }}
            </div>
          </div>
          <button class="iconaction" :title="t('Close')" @click="clearConfirmOpen = false">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="modal__body">
          <div class="row" style="gap:14px;align-items:flex-start;">
            <div class="kpi__icon t-error" style="width:44px;height:44px;flex:0 0 44px;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <p style="margin:0;font-weight:600;">
                {{ t('Clear this conversation?') }}
              </p>
              <p class="muted" style="margin:6px 0 0;font-size:14px;">
                {{ t('All messages in this session will be removed.') }}
              </p>
            </div>
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--ghost" @click="clearConfirmOpen = false">
            {{ t('Cancel') }}
          </button>
          <button class="btn btn--danger" @click="confirmClearChat">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" />
            </svg>
            {{ t('Clear') }}
          </button>
        </div>
      </div>
    </div>

    <VSnackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="3000"
    >
      {{ snackbarMsg }}
    </VSnackbar>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

<style scoped>
/* ============================================================
   AI ASSISTANT — design-shell tokens, no Vuetify color refs.
   ============================================================ */
.ai-chat-page {
  block-size: 100%;
  inline-size: 100%;
  min-block-size: calc(100vh - var(--topbar-h, 64px) - var(--sp-7, 32px) * 2);
  display: flex;
  flex-direction: column;
}

.ai-chat-card {
  flex: 1;
  min-block-size: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-4);
}

.chat-header__avatar {
  inline-size: 40px;
  block-size: 40px;
  border-radius: var(--r-md);
  background: var(--primary-weak);
  color: var(--primary);
  display: grid;
  place-items: center;
  flex: 0 0 40px;
}

.chat-header__text {
  flex: 1;
  min-inline-size: 0;
}

.chat-header__title {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: var(--fw-semibold);
  color: var(--text);
  line-height: 1.2;
}

.chat-header__sub {
  margin-top: 2px;
  font-size: var(--fs-sm);
  color: var(--text-secondary);
}

/* Log */
.chat-log {
  flex: 1;
  min-block-size: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
  padding: var(--sp-5);
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-block-size: 100%;
  text-align: center;
  gap: var(--sp-3);
}

.empty-state__avatar {
  inline-size: 80px;
  block-size: 80px;
  border-radius: 50%;
  background: var(--primary-weak);
  color: var(--primary);
  display: grid;
  place-items: center;
  margin-block-end: var(--sp-3);
}

.empty-state__title {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: var(--fw-semibold);
  color: var(--text);
}

.empty-state__sub {
  margin: 0 0 var(--sp-4);
  color: var(--text-secondary);
  font-size: var(--fs-sm);
}

.ai-offline-banner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: var(--r-md);
  background: var(--warning-weak);
  color: var(--warning-strong);
  border: 1px solid var(--warning-border);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  margin-block-end: var(--sp-3);
}

/* Quick-action chip row. BUG-3 fix: cap the row width, let chips flex-shrink,
   and force two-per-row on mobile so they never overflow the card edge. */
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--sp-2);
  inline-size: 100%;
  max-inline-size: 100%;
  margin-block-end: var(--sp-5);
}

.quick-actions .qa-btn {
  flex: 0 1 auto;
  max-inline-size: 100%;
  white-space: normal;
  text-align: center;
  gap: 6px;
  height: auto;
  min-height: 36px;
  padding: 6px 12px;
  font-size: var(--fs-sm);
  line-height: 1.25;
}

/* Suggestions */
.suggestions {
  inline-size: 100%;
  max-inline-size: 600px;
}

.suggestions__title {
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-block-end: var(--sp-2);
  text-align: start;
}

.suggestion-card {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  inline-size: 100%;
  padding: var(--sp-3);
  margin-block-end: var(--sp-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  cursor: pointer;
  text-align: start;
  transition: background-color .15s, border-color .15s;
  font: inherit;
  color: inherit;
}

.suggestion-card:hover {
  background: var(--surface-2);
  border-color: var(--primary-border);
}

.suggestion-card:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.suggestion-card__body {
  flex: 1;
  min-inline-size: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.suggestion-card__query {
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  color: var(--text);
}

.suggestion-card__reason {
  font-size: var(--fs-label);
  color: var(--text-secondary);
}

.suggestion-card__chev {
  flex: 0 0 18px;
  color: var(--text-tertiary);
}

/* Message rows */
.msg-row {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-end;
  margin-block-end: var(--sp-4);
}

.msg-row--user { justify-content: flex-end; }
.msg-row--bot  { justify-content: flex-start; }

.msg-avatar {
  inline-size: 36px;
  block-size: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
}

.msg-avatar--bot {
  background: var(--primary-weak);
  color: var(--primary);
}

.msg-avatar--user {
  background: var(--neutral-weak);
  color: var(--text);
  border: 1px solid var(--border);
}

.msg-bubble-wrap {
  max-inline-size: 70%;
  min-inline-size: 0;
}

.msg-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  word-break: break-word;
  white-space: pre-wrap;
  font-size: var(--fs-sm);
  line-height: 1.45;
}

.bubble-user {
  background: var(--primary);
  color: var(--on-primary);
  border-end-end-radius: 4px;
}

.bubble-bot {
  background: var(--surface-2);
  color: var(--text);
  border-end-start-radius: 4px;
}

.msg-meta {
  margin-top: 4px;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
  display: flex;
  gap: 8px;
}

.msg-meta--end   { justify-content: flex-end; }
.msg-meta--start { justify-content: flex-start; }

.msg-intent {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: var(--fw-semibold);
}

.msg-suggestions {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.msg-suggestion-chip {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  padding: 4px 12px;
  font-size: var(--fs-label);
  cursor: pointer;
  transition: background-color .15s, border-color .15s;
}

.msg-suggestion-chip:hover {
  background: var(--surface-2);
  border-color: var(--primary-border);
}

/* Typing dots */
.typing {
  display: inline-flex;
  gap: 4px;
}

.typing .dot {
  inline-size: 7px;
  block-size: 7px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: ai-blink 1.2s infinite ease-in-out;
}

.typing .dot:nth-child(2) { animation-delay: 0.2s; }
.typing .dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes ai-blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

/* Input row */
.chat-input {
  padding: var(--sp-4);
}

.chat-input__control {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding-inline-end: 6px;
}

.chat-input__control input {
  background: transparent;
  border: 0;
  outline: 0;
  flex: 1;
  min-inline-size: 0;
  font: inherit;
  color: var(--text);
}

.chat-input__control input::placeholder {
  color: var(--text-tertiary);
}

.chat-input__send {
  inline-size: 36px;
  height: 36px;
  padding: 0;
  display: grid;
  place-items: center;
  flex: 0 0 36px;
}

/* Responsive layout: stack quick-actions two-up on phone widths. */
@media (max-width: 720px) {
  .chat-log { padding: clamp(var(--sp-3), 3vw, var(--sp-5)); }
  .chat-header { padding: clamp(var(--sp-3), 3vw, var(--sp-4)); }
  .chat-input { padding: clamp(var(--sp-3), 3vw, var(--sp-4)); }
  .msg-bubble-wrap { max-inline-size: 82%; }
}

@media (max-width: 600px) {
  .quick-actions .qa-btn {
    flex: 1 1 calc(50% - 0.5rem);
  }
  .empty-state__avatar {
    inline-size: 64px;
    block-size: 64px;
  }
  .empty-state__title { font-size: var(--fs-lg); }
}

@media (max-width: 1100px) {
  .suggestions { max-inline-size: 100%; }
}
</style>

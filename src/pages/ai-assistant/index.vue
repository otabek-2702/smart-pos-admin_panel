<script setup lang="ts">
/* ============================================================
   ALPHA POS — AI Assistant page (1:1 design port)
   Empty-state shows quick-action chips + suggestion cards.
   Active thread shows user/ai bubbles; composer at the bottom.
   BUG FIX preserved: chips send TRANSLATED label as bubble text
   (t(qa.label)); suggestion sends te(s.query)?t(s.query):s.query;
   bot follow-up suggestion chips do the same.
   ============================================================ */
import { storeToRefs } from 'pinia'
import { useAiAssistantStore } from '@/stores/aiAssistant'

const { t, te } = useI18n({ useScope: 'global' })

// Hard-coded fallback CTAs when backend quick-actions fail / are empty —
// gives the empty state at least 4 starting prompts in every locale.
interface FallbackQA {
  id: string
  label: string
  icon: string
  query: string
}
const FALLBACK_QUICK_ACTIONS: FallbackQA[] = [
  { id: 'fallback-low-stock', label: 'Show low stock', icon: 'box', query: 'Show me low stock items' },
  { id: 'fallback-today-revenue', label: "Today's revenue", icon: 'wallet', query: "What is today's revenue?" },
  { id: 'fallback-top-items', label: 'Top selling items', icon: 'star', query: 'What are the top selling items?' },
  { id: 'fallback-pending-orders', label: 'Pending orders', icon: 'coins', query: 'Show pending orders' },
]

// ----- Store (held above the router so generation survives nav) ------------
const aiStore = useAiAssistantStore()
const { messages, input, sending, quickActions, suggestions, loadingMeta, metaLoadFailed } = storeToRefs(aiStore)

// Helper to translate a string IF a matching i18n key exists, else return
// the raw string. Backend can return either a key OR a ready-to-display
// string — this lets us handle both without leaking raw keys.
function tr(s: string): string {
  return te(s) ? t(s) : s
}

const effectiveQuickActions = computed(() =>
  quickActions.value.length ? quickActions.value : FALLBACK_QUICK_ACTIONS,
)

const priorityTone: Record<string, string> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
}

const scrollRef = ref<HTMLElement | null>(null)
const taRef = ref<HTMLTextAreaElement | null>(null)

// autoscroll on new content
function scrollToBottom() {
  nextTick(() => {
    const el = scrollRef.value
    if (el)
      el.scrollTop = el.scrollHeight
  })
}

watch([() => messages.value.length, () => messages.value[messages.value.length - 1]?.text], scrollToBottom)

// autosize textarea (matches React source useEffect)
watch(input, () => {
  nextTick(() => {
    const ta = taRef.value
    if (!ta)
      return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  })
})

// ----- Send handlers --------------------------------------------------------
function submit() {
  const txt = input.value.trim()
  if (!txt || sending.value)
    return
  aiStore.send(txt)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

// Chip / suggestion click handlers preserve bug fix: pass localized display
// text so the resulting user bubble matches the button the user tapped.
function sendQuickAction(qa: { label: string; query: string }) {
  aiStore.send(qa.query, tr(qa.label))
}

function sendSuggestion(s: { query: string }) {
  // Bug-1B preserved: te(s.query)?t(s.query):s.query
  const disp = te(s.query) ? t(s.query) : s.query
  aiStore.send(s.query, disp)
}

function sendFollowUp(sg: string) {
  aiStore.send(sg, tr(sg))
}

// ----- Markdown-lite renderer (verbatim port of React source) --------------
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function mdInline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}
interface MdBlock { t: 'p' | 'ul' | 'ol'; text?: string; items?: string[] }
function renderMarkdown(src: string): string {
  const lines = (src || '').split('\n')
  const blocks: MdBlock[] = []
  let list: string[] | null = null
  let listType: 'ul' | 'ol' | null = null
  const flush = () => {
    if (list && listType) {
      blocks.push({ t: listType, items: list })
      list = null
      listType = null
    }
  }
  lines.forEach((ln) => {
    const bullet = ln.match(/^\s*-\s+(.*)$/)
    const num = ln.match(/^\s*\d+\.\s+(.*)$/)
    if (bullet) {
      if (listType !== 'ul') {
        flush()
        list = []
        listType = 'ul'
      }
      list!.push(bullet[1])
    }
    else if (num) {
      if (listType !== 'ol') {
        flush()
        list = []
        listType = 'ol'
      }
      list!.push(num[1])
    }
    else {
      flush()
      if (ln.trim())
        blocks.push({ t: 'p', text: ln })
    }
  })
  flush()
  return blocks.map((b) => {
    if (b.t === 'p')
      return `<p>${mdInline(b.text || '')}</p>`
    const tag = b.t
    const items = (b.items || []).map(it => `<li>${mdInline(it)}</li>`).join('')
    return `<${tag}>${items}</${tag}>`
  }).join('')
}

// ----- Copy / regenerate helpers -------------------------------------------
const copiedId = ref<number | null>(null)
function copyMessage(m: { id: number; text: string }) {
  try {
    navigator.clipboard.writeText(m.text)
  }
  catch {}
  copiedId.value = m.id
  setTimeout(() => {
    if (copiedId.value === m.id)
      copiedId.value = null
  }, 1400)
}

function canRegenerate(idx: number): boolean {
  // last assistant message, not currently streaming, has a prior user msg
  if (sending.value)
    return false
  const m = messages.value[idx]
  if (!m || m.role !== 'bot')
    return false
  if (idx !== messages.value.length - 1)
    return false
  const prev = messages.value[idx - 1]
  return !!(prev && prev.role === 'user')
}

function regenerate(idx: number) {
  const prev = messages.value[idx - 1]
  if (!prev)
    return
  aiStore.send(prev.text)
}

// ----- Mount: load meta + initial scroll -----------------------------------
onMounted(() => {
  if (!quickActions.value.length && !suggestions.value.length && !loadingMeta.value)
    aiStore.loadMeta()
  scrollToBottom()
})
</script>

<template>
  <div class="aiwrap">
    <!-- thread -->
    <section class="aithread">
      <div class="aithread__head">
        <div class="row" style="gap:10px;min-width:0;">
          <div class="msg__avatar" style="flex:0 0 34px;width:34px;height:34px;">
            <svg
              width="17" height="17" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"
            >
              <path d="M12 3l1.8 5L19 9.8 14 12l-2 5-2-5-5-2.2L10 8l2-5Z" />
              <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
            </svg>
          </div>
          <div style="min-width:0;">
            <div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              {{ t('AI Assistant') }}
            </div>
            <div class="tertiary" style="font-size:12px;white-space:nowrap;">
              {{ sending ? t('Thinking…') : t('POS analyst · always-on') }}
            </div>
          </div>
        </div>
        <div class="row" style="gap:10px;">
          <button
            v-if="messages.length"
            class="iconaction"
            :title="t('Clear chat')"
            @click="aiStore.clearChat()"
          >
            <svg
              width="17" height="17" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round"
            >
              <path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>

      <div ref="scrollRef" class="aithread__scroll">
        <div class="aithread__inner">
          <!-- EMPTY STATE: quick-action chips + suggestion cards -->
          <template v-if="!messages.length">
            <div class="aiempty">
              <div class="aiempty__badge">
                <svg
                  width="26" height="26" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="1.7"
                  stroke-linecap="round" stroke-linejoin="round"
                >
                  <path d="M12 3l1.8 5L19 9.8 14 12l-2 5-2-5-5-2.2L10 8l2-5Z" />
                  <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
                </svg>
              </div>
              <h2 class="aiempty__title">
                {{ t('How can I help with your POS today?') }}
              </h2>
              <p class="aiempty__sub">
                {{ t('Ask about sales, products, payments, shifts or stock. I read from your live data.') }}
              </p>

              <!-- Offline banner -->
              <div
                v-if="metaLoadFailed && !suggestions.length && !quickActions.length"
                class="ai-offline-banner"
                role="status"
              >
                <svg
                  width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="1.7"
                  stroke-linecap="round" stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 11v5M12 8h.01" />
                </svg>
                <span>{{ t('AI assistant unavailable') }}</span>
              </div>

              <!-- Quick-action chips. BUG-1A fix preserved: send tr(qa.label)
                   as displayed bubble text so the user-bubble matches the
                   button the user clicked, even when posted text is English. -->
              <div class="aiempty__chips">
                <button
                  v-for="qa in effectiveQuickActions"
                  :key="qa.id || qa.label"
                  type="button"
                  class="promptchip"
                  @click="sendQuickAction(qa)"
                >
                  <svg
                    class="ic" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="1.7"
                    stroke-linecap="round" stroke-linejoin="round"
                  >
                    <!-- icon stub: use box outline by default; the design
                         system picks any of wallet/star/coins/box -->
                    <template v-if="qa.icon === 'wallet'">
                      <rect x="3.5" y="6" width="17" height="13" rx="2.5" />
                      <path d="M3.5 10h17M16 13.5h1.5" />
                      <path d="M17 6V4.5a1.5 1.5 0 0 0-2-1.4L5 6" />
                    </template>
                    <template v-else-if="qa.icon === 'star'">
                      <path d="m12 4 2.4 5 5.6.7-4 3.8 1 5.5L12 16l-5 3 1-5.5-4-3.8 5.6-.7L12 4Z" />
                    </template>
                    <template v-else-if="qa.icon === 'coins'">
                      <ellipse cx="9" cy="7" rx="5.5" ry="2.8" />
                      <path d="M3.5 7v5c0 1.5 2.5 2.8 5.5 2.8M14.5 11.5c2.8.3 5 1.4 5 2.8 0 1.6-2.7 2.9-6 2.9s-6-1.3-6-2.9M3.5 12c0 1.5 2.5 2.8 5.5 2.8" />
                    </template>
                    <template v-else>
                      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
                      <path d="m4 7 8 4 8-4M12 11v10" />
                    </template>
                  </svg>
                  <span>{{ tr(qa.label) }}</span>
                </button>
              </div>

              <!-- Suggestion cards (from backend). BUG-1B preserved:
                   te(s.query) ? t(s.query) : s.query for bubble text. -->
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
                  @click="sendSuggestion(s)"
                >
                  <span
                    class="badge"
                    :class="`t-${priorityTone[s.priority] || 'neutral'}`"
                  >{{ tr(s.priority) }}</span>
                  <span class="suggestion-card__body">
                    <span class="suggestion-card__query">{{ tr(s.query) }}</span>
                    <span class="suggestion-card__reason">{{ tr(s.reason) }}</span>
                  </span>
                  <svg
                    class="suggestion-card__chev" width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="1.7"
                    stroke-linecap="round" stroke-linejoin="round"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          </template>

          <!-- ACTIVE THREAD -->
          <template v-else>
            <template v-for="(m, i) in messages" :key="m.id">
              <div v-if="m.role === 'user'" class="msg msg--user">
                <div class="msg__bubble">
                  {{ m.text }}
                </div>
              </div>
              <div v-else class="msg msg--ai">
                <div class="msg__avatar">
                  <svg
                    width="17" height="17" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="1.7"
                    stroke-linecap="round" stroke-linejoin="round"
                  >
                    <path d="M12 3l1.8 5L19 9.8 14 12l-2 5-2-5-5-2.2L10 8l2-5Z" />
                    <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
                  </svg>
                </div>
                <div class="msg__col">
                  <div class="msg__bubble">
                    <div class="md" v-html="renderMarkdown(m.text)" />
                  </div>

                  <!-- Bot-returned follow-up chips. BUG-1C fix preserved:
                       render and post through tr() so chip text and the
                       resulting user bubble match the active locale. -->
                  <div
                    v-if="m.suggestions && m.suggestions.length"
                    class="msg-suggestions"
                  >
                    <button
                      v-for="(sg, j) in m.suggestions"
                      :key="j"
                      type="button"
                      class="msg-suggestion-chip"
                      @click="sendFollowUp(sg)"
                    >
                      {{ tr(sg) }}
                    </button>
                  </div>

                  <div class="msg__tools">
                    <button class="msg__tool" @click="copyMessage(m)">
                      <svg
                        width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="1.7"
                        stroke-linecap="round" stroke-linejoin="round"
                      >
                        <template v-if="copiedId === m.id">
                          <path d="m5 12 5 5 9-11" />
                        </template>
                        <template v-else>
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
                        </template>
                      </svg>
                      {{ copiedId === m.id ? t('Copied') : t('Copy') }}
                    </button>
                    <button
                      v-if="canRegenerate(i)"
                      class="msg__tool"
                      @click="regenerate(i)"
                    >
                      <svg
                        width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="1.7"
                        stroke-linecap="round" stroke-linejoin="round"
                      >
                        <path d="M20 11a8 8 0 0 0-14-5l-2 2M4 13a8 8 0 0 0 14 5l2-2" />
                        <path d="M4 5v3.5h3.5M20 19v-3.5h-3.5" />
                      </svg>
                      {{ t('Regenerate') }}
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <!-- Live typing bubble while awaiting reply -->
            <div v-if="sending" class="msg msg--ai">
              <div class="msg__avatar">
                <svg
                  width="17" height="17" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="1.7"
                  stroke-linecap="round" stroke-linejoin="round"
                >
                  <path d="M12 3l1.8 5L19 9.8 14 12l-2 5-2-5-5-2.2L10 8l2-5Z" />
                  <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
                </svg>
              </div>
              <div class="msg__col">
                <div class="msg__bubble">
                  <span class="typing"><span /><span /><span /></span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- composer -->
      <div class="composer">
        <div class="composer__inner">
          <div class="composer__box">
            <textarea
              ref="taRef"
              v-model="input"
              class="composer__ta"
              rows="1"
              :placeholder="t('Message the assistant…  (Enter to send, Shift+Enter for a new line)')"
              :disabled="sending"
              @keydown="onKey"
            />
            <button
              class="composer__send"
              :class="{ 'is-ready': input.trim() && !sending }"
              :disabled="!input.trim() || sending"
              :title="t('Send')"
              @click="submit"
            >
              <svg
                width="17" height="17" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="1.7"
                stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M4.5 12 20 4l-4.5 16-3.5-6.5L4.5 12Z" />
                <path d="M12 13.5 20 4" />
              </svg>
            </button>
          </div>
          <div class="composer__hint">
            <template v-if="sending">
              <span class="row" style="gap:6px;color:var(--primary);">
                <span class="typing"><span /><span /><span /></span>
                {{ t('Generating — you can leave this page, I\'ll keep working.') }}
              </span>
            </template>
            <template v-else>
              <span>{{ t('Alpha POS assistant · responses are illustrative in this prototype') }}</span>
            </template>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

<style scoped>
/* Page-level tweaks. All visual primitives (.aiwrap, .aithread, .aiempty,
   .promptchip, .composer, .msg__*, .md, .typing) come verbatim from
   design-shell.css. We only add the suggestion-card extras + chip-wrap
   responsive override (two-per-row at <600px) which were in the previous
   Vuetify build and remain a required visual rule. */

.suggestions {
  inline-size: 100%;
  max-inline-size: 520px;
  margin-block-start: var(--sp-5);
}

.suggestions__title {
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
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
  color: var(--text-tertiary);
}

.suggestion-card__chev {
  flex: 0 0 18px;
  color: var(--text-tertiary);
}

/* Bot follow-up chips */
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

/* Offline banner */
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

/* RESPONSIVE: chips wrap two-per-row at <600px (PRESERVED, per task spec). */
@media (max-width: 600px) {
  .aiempty__chips {
    grid-template-columns: 1fr 1fr;
  }
}
</style>

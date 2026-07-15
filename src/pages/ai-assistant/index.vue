<script setup lang="ts">
/* ============================================================
   ALPHA POS — AI Assistant page
   1:1 port of .tmp-alpha-design/alpha-design-source/AIChat.jsx.

   Layout: history sidebar (left, 300px) + thread (right) + composer.
   Generation runs in the Pinia store (src/stores/aiAssistant.ts),
   so it persists across page navigation.
   ============================================================ */
import { storeToRefs } from 'pinia'
import { useAIAssistantStore } from '@/stores/aiAssistant'
import DesignIcon from '@/components/design/DesignIcon.vue'
import Button from '@/components/design/Button.vue'
import Input from '@/components/design/Input.vue'
import MarkdownMessage from '@/components/design/MarkdownMessage.vue'
import { Fmt } from '@/components/design/utils/format'

const { t } = useI18n({ useScope: 'global' })

const store = useAIAssistantStore()
const { chats, activeId, generating, notify, permission, suggestions, loadingMeta } = storeToRefs(store)

const draft = ref('')
const draftRestoreLock = ref(false)
const query = ref('')
const scrollRef = ref<HTMLElement | null>(null)
const taRef = ref<HTMLTextAreaElement | null>(null)

const active = computed(() => chats.value.find(c => c.id === activeId.value) || null)
const messages = computed(() => active.value?.messages ?? [])
const isGenerating = computed(() => generating.value === activeId.value)

const filtered = computed(() => {
  const q = query.value.toLowerCase()

  return chats.value
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter(c => !q || c.title.toLowerCase().includes(q))
})

const SUGGESTIONS = [
  { icon: 'wallet', text: 'How were sales today?', i18n: 'How were sales today?' },
  { icon: 'star', text: 'What are my top products?', i18n: 'What are my top products?' },
  { icon: 'coins', text: 'Break down today\'s payments', i18n: 'Break down today\'s payments' },
  { icon: 'box', text: 'What is running low on stock?', i18n: 'What is running low on stock?' },
]

// Live, data-driven suggestions from the backend (/ai/suggestions/). These carry a
// human `reason` (e.g. "3 items below reorder level") and a priority the BE computes
// from real stock/PO state — far more actionable than the static prompt chips, so we
// surface them above the defaults whenever the server returns any.
function suggestionIcon(priority: string): string {
  if (priority === 'high') return 'alert'
  if (priority === 'medium') return 'clock'
  return 'trend'
}
const liveSuggestions = computed(() => (suggestions.value ?? []).slice(0, 4))

onMounted(() => {
  store.setChatVisible(true)
  // Fetch dynamic suggestions/quick-actions once; safe to call repeatedly (store guards).
  store.loadMeta()
  const onVis = () => store.setChatVisible(!document.hidden)

  document.addEventListener('visibilitychange', onVis)
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVis)
    store.setChatVisible(false)
  })
})

// Track whether user has manually scrolled up — if so, don't fight them by
// snapping back to bottom on every streamed token. Resume auto-scroll only
// when they scroll back near the bottom themselves.
const autoFollow = ref(true)
function onScroll() {
  const el = scrollRef.value
  if (!el) return
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  autoFollow.value = distFromBottom < 80 // within 80px counts as "at bottom"
}
watch(activeId, async () => {
  // Force-scroll on chat switch.
  autoFollow.value = true
  await nextTick()
  const el = scrollRef.value
  if (el) el.scrollTop = el.scrollHeight
})
watch([() => messages.value.length, () => messages.value[messages.value.length - 1]?.content], async () => {
  await nextTick()
  if (!autoFollow.value) return
  const el = scrollRef.value
  if (el) el.scrollTop = el.scrollHeight
})

// Themed "thinking" status messages cycled while AI is generating.
// Picked one per phase so user sees motion that maps to what the bot is doing.
const THINKING_STATUSES = [
  'thinking_fetching',     // Maʼlumotlar bazasidan olinmoqda…
  'thinking_calculating',  // Hisoblanmoqda…
  'thinking_analyzing',    // Tahlil qilinmoqda…
  'thinking_composing',    // Javob tayyorlanmoqda…
]
const thinkingIdx = ref(0)
let thinkingTimer: number | null = null
watch(isGenerating, (g) => {
  if (g) {
    thinkingIdx.value = 0
    if (thinkingTimer) window.clearInterval(thinkingTimer)
    thinkingTimer = window.setInterval(() => {
      thinkingIdx.value = (thinkingIdx.value + 1) % THINKING_STATUSES.length
    }, 1800)
  }
  else {
    if (thinkingTimer) { window.clearInterval(thinkingTimer); thinkingTimer = null }
  }
})
const thinkingLabel = computed(() => t(THINKING_STATUSES[thinkingIdx.value]))

watch(draft, async (v) => {
  if (!draftRestoreLock.value && activeId.value)
    store.setDraft(activeId.value, v)
  await nextTick()
  const ta = taRef.value

  if (!ta)
    return
  ta.style.height = 'auto'
  ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
})

watch(activeId, (id) => {
  draftRestoreLock.value = true
  const c = chats.value.find(x => x.id === id)
  draft.value = c?.draft ?? ''
  nextTick(() => { draftRestoreLock.value = false })
}, { immediate: true })

function submit() {
  const text = draft.value.trim()

  if (!text || isGenerating.value)
    return
  store.send(text)
  draft.value = ''
  if (activeId.value)
    store.setDraft(activeId.value, '')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function relTime(ts: number): string {
  const d = Date.now() - ts
  const m = Math.round(d / 60000)

  if (m < 1)
    return t('just now')
  if (m < 60)
    return `${m}${t('time_minute_short')} ${t('ago')}`
  const h = Math.round(m / 60)

  if (h < 24)
    return `${h}${t('time_hour_short')} ${t('ago')}`
  const days = Math.round(h / 24)

  if (days < 7)
    return `${days}${t('time_day_short')} ${t('ago')}`

  return Fmt.date(ts)
}

function previewOf(c: any): string {
  const last = c.messages[c.messages.length - 1]

  // Server-only chats aren't hydrated yet — fall back to the BE list preview
  // (last-message snippet) so the row shows real content, not "Empty conversation".
  if (!last)
    return c.preview ? c.preview.replace(/[*#\-]/g, '').slice(0, 48) : t('Empty conversation')

  return (last.role === 'assistant' ? last.content : last.content)
    .replace(/[*#\-]/g, '')
    .slice(0, 48)
}

// ---- markdown-lite (bold, bullets, numbered, paragraphs) ----
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function spaceifyNumbers(s: string): string {
  return s.replace(/(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?/g, (_m, intPart: string, dec?: string) => {
    const spaced = intPart.replace(/,/g, ' ')
    return dec ? `${spaced}.${dec}` : spaced
  })
}
function mdInline(s: string): string {
  return escapeHtml(spaceifyNumbers(s))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}
interface Block { t: 'p' | 'ul' | 'ol'; text?: string; items?: string[] }
function parseMd(text: string): Block[] {
  const lines = (text || '').split('\n')
  const blocks: Block[] = []
  let list: string[] | null = null
  let listType: 'ul' | 'ol' | null = null
  const flush = () => {
    if (list && listType) {
      blocks.push({ t: listType, items: list })
      list = null
      listType = null
    }
  }

  for (const ln of lines) {
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
  }
  flush()

  return blocks
}

const copied = ref<Record<string, boolean>>({})
function copyMsg(id: string, text: string) {
  try { navigator.clipboard.writeText(text) }
  catch { /* noop */ }
  copied.value = { ...copied.value, [id]: true }
  setTimeout(() => {
    copied.value = { ...copied.value, [id]: false }
  }, 1400)
}

function regen(idx: number) {
  const prev = messages.value[idx - 1]

  if (prev && prev.role === 'user')
    store.send(prev.content)
}

const notifyBlocked = computed(() => permission.value === 'denied')
const notifyOn = computed(() => notify.value && permission.value === 'granted')

const histOpen = ref(false)
function selectChat(id: string) {
  store.selectChat(id)
  histOpen.value = false
}

// ---- Inline rename (wires the store's renameChat, which had no UI before) ----
const renaming = ref(false)
const renameVal = ref('')
const renameRef = ref<HTMLInputElement | null>(null)
function startRename() {
  if (!active.value)
    return
  renameVal.value = active.value.title
  renaming.value = true
  nextTick(() => { renameRef.value?.focus(); renameRef.value?.select() })
}
function commitRename() {
  if (!renaming.value)
    return
  const v = renameVal.value.trim()

  if (active.value && v && v !== active.value.title)
    store.renameChat(active.value.id, v)
  renaming.value = false
}
function cancelRename() {
  renaming.value = false
}

// ---- Two-step delete confirm (prevents accidental loss of a conversation) ----
const confirmDelId = ref<string | null>(null)
let confirmTimer: number | null = null
function requestDelete(id: string) {
  if (confirmDelId.value === id) {
    store.deleteChat(id)
    confirmDelId.value = null
    if (confirmTimer) { window.clearTimeout(confirmTimer); confirmTimer = null }

    return
  }
  confirmDelId.value = id
  if (confirmTimer)
    window.clearTimeout(confirmTimer)
  confirmTimer = window.setTimeout(() => { confirmDelId.value = null }, 3200)
}

// ---- Jump to latest (shown when the user has scrolled up off the live tail) ----
const showJump = computed(() => !autoFollow.value && messages.value.length > 0)
function scrollToBottom() {
  autoFollow.value = true
  const el = scrollRef.value

  if (el)
    el.scrollTop = el.scrollHeight
}

// ---- Export the active conversation as a Markdown transcript ----
function exportChat() {
  const c = active.value

  if (!c || c.messages.length === 0)
    return
  const lines: string[] = [`# ${c.title}`, '']

  for (const m of c.messages) {
    lines.push(m.role === 'user' ? `**${t('You')}:**` : `**${t('AI Assistant')}:**`)
    lines.push(m.content, '')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safe = (c.title || 'chat').replace(/[^\wЀ-ӿ\s-]/g, '').trim().slice(0, 40) || 'chat'

  a.href = url
  a.download = `alpha-pos-${safe}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
  <div class="aiwrap" :class="{ 'hist-open': histOpen }">
    <div
      class="aihist-scrim"
      @click="histOpen = false"
    />
    <!-- ===== History sidebar ===== -->
    <aside class="aihist">
      <div class="aihist__top">
        <Button
          variant="primary"
          icon="plus"
          style="width: 100%;"
          @click="store.newChat()"
        >
          {{ t('New chat') }}
        </Button>
      </div>
      <div class="aihist__search">
        <Input
          v-model="query"
          icon="search"
          :placeholder="t('Search chats…')"
        />
      </div>
      <div class="aihist__list">
        <div class="aihist__label">
          {{ t('Recent') }}
        </div>
        <div
          v-if="filtered.length === 0"
          class="aihist__empty"
        >
          {{ t('No chats found') }}
        </div>
        <div
          v-for="c in filtered"
          :key="c.id"
          class="histitem"
          :class="{ 'is-active': c.id === activeId }"
          @click="selectChat(c.id)"
        >
          <div class="histitem__icon">
            <DesignIcon name="inbox" :size="15" />
          </div>
          <div class="histitem__main">
            <div class="histitem__title">
              {{ c.title }}
            </div>
            <div class="histitem__preview">
              {{ previewOf(c) }}
            </div>
          </div>
          <div class="histitem__meta">
            <span class="histitem__time">{{ relTime(c.updatedAt) }}</span>
            <span
              v-if="generating === c.id"
              class="histitem__live"
            >
              <span class="typing"><span /><span /><span /></span>
            </span>
          </div>
          <button
            class="histitem__del"
            :class="{ 'is-confirm': confirmDelId === c.id }"
            :title="confirmDelId === c.id ? t('Delete this chat?') : t('Delete chat')"
            @click.stop="requestDelete(c.id)"
          >
            <DesignIcon :name="confirmDelId === c.id ? 'check' : 'trash'" :size="15" />
          </button>
        </div>
      </div>
    </aside>

    <!-- ===== Thread ===== -->
    <section class="aithread">
      <div class="aithread__head">
        <div class="row" style="gap: 10px; min-width: 0;">
          <button
            class="aihist__toggle"
            :title="t('Show chats')"
            @click="histOpen = true"
          >
            <DesignIcon name="menu" :size="18" />
          </button>
          <div class="msg__avatar" style="flex: 0 0 34px; width: 34px; height: 34px;">
            <DesignIcon name="sparkle" :size="17" />
          </div>
          <div style="min-width: 0;">
            <input
              v-if="renaming"
              ref="renameRef"
              v-model="renameVal"
              class="aititle-edit"
              maxlength="80"
              @keydown.enter.prevent="commitRename"
              @keydown.esc.prevent="cancelRename"
              @blur="commitRename"
            >
            <div
              v-else
              class="aititle"
              :class="{ 'is-editable': !!active }"
              :title="active ? t('Rename chat') : ''"
              @dblclick="startRename"
            >
              <span class="aititle__text">{{ active ? active.title : t('AI Assistant') }}</span>
              <button
                v-if="active"
                class="aititle__edit"
                :title="t('Rename chat')"
                @click.stop="startRename"
              >
                <DesignIcon name="pencil" :size="13" />
              </button>
            </div>
            <div class="tertiary" style="font-size: 12px; white-space: nowrap;">
              {{ t('POS analyst · always-on') }}
            </div>
          </div>
        </div>
        <div class="row" style="gap: 8px;">
          <button
            v-if="active && messages.length > 0"
            class="iconbtn"
            :title="t('Export chat')"
            @click="exportChat"
          >
            <DesignIcon name="download" :size="16" />
          </button>
          <button
            class="notifbtn"
            :class="{ 'is-on': notifyOn, 'is-blocked': notifyBlocked }"
            :title="notifyBlocked
              ? t('Notifications blocked in browser settings')
              : (notifyOn ? t('Background notifications on') : t('Notify me when replies finish off-page'))"
            @click="store.toggleNotify()"
          >
            <DesignIcon :name="notifyOn ? 'bell' : 'belloff'" :size="16" />
            <span class="notifbtn__label">{{ notifyBlocked ? t('Blocked') : (notifyOn ? t('Notifications on') : t('Notify me')) }}</span>
          </button>
        </div>
      </div>

      <div ref="scrollRef" class="aithread__scroll" @scroll="onScroll">
        <div class="aithread__inner">
          <!-- ===== Empty state ===== -->
          <div
            v-if="!active || messages.length === 0"
            class="aiempty"
          >
            <div class="aiempty__badge">
              <DesignIcon name="sparkle" :size="26" />
            </div>
            <h2 class="aiempty__title">
              {{ t('How can I help with your POS today?') }}
            </h2>
            <p class="aiempty__sub">
              {{ t('Ask about sales, products, payments, shifts or stock. I read from your live data.') }}
            </p>
            <!-- Live, data-driven suggestions from the backend (real stock / PO signals) -->
            <div
              v-if="liveSuggestions.length"
              class="aiempty__live"
            >
              <div class="aiempty__livelabel">
                {{ t('Suggested for you') }}
              </div>
              <div class="aiempty__livegrid">
                <button
                  v-for="(s, i) in liveSuggestions"
                  :key="`live-${i}`"
                  class="livechip"
                  :class="`prio-${s.priority}`"
                  @click="store.send(s.query)"
                >
                  <span class="livechip__dot" />
                  <DesignIcon :name="suggestionIcon(s.priority)" :size="16" class="livechip__ic" />
                  <span class="livechip__body">
                    <span class="livechip__q">{{ s.query }}</span>
                    <span v-if="s.reason" class="livechip__reason">{{ s.reason }}</span>
                  </span>
                </button>
              </div>
            </div>

            <div v-else-if="loadingMeta" class="aiempty__live">
              <div class="aiempty__livegrid">
                <div v-for="n in 2" :key="`sk-${n}`" class="livechip is-skeleton">
                  <div class="sk-box" style="width: 16px; height: 16px; border-radius: 50%;" />
                  <div style="flex: 1;">
                    <div class="sk-box" style="width: 60%; height: 12px; border-radius: 4px;" />
                    <div class="sk-box" style="width: 40%; height: 10px; border-radius: 4px; margin-top: 6px;" />
                  </div>
                </div>
              </div>
            </div>

            <div class="aiempty__chips">
              <button
                v-for="s in SUGGESTIONS"
                :key="s.text"
                class="promptchip"
                @click="store.send(t(s.i18n))"
              >
                <DesignIcon :name="s.icon" :size="16" />
                <span>{{ t(s.i18n) }}</span>
              </button>
            </div>
          </div>

          <!-- ===== Messages ===== -->
          <template v-else>
            <template
              v-for="(m, i) in messages"
              :key="m.id"
            >
              <!-- user bubble -->
              <div
                v-if="m.role === 'user'"
                class="msg msg--user"
              >
                <div class="msg__bubble">
                  {{ m.content }}
                </div>
              </div>
              <!-- ai bubble -->
              <div
                v-else
                class="msg msg--ai"
              >
                <div class="msg__avatar">
                  <DesignIcon name="sparkle" :size="17" />
                </div>
                <div class="msg__col">
                  <div class="msg__bubble">
                    <template v-if="m.streaming && !m.content">
                      <span class="msg__thinking">
                        <DesignIcon name="sparkle" :size="15" />
                        {{ thinkingLabel }}
                      </span>
                    </template>
                    <template v-else>
                      <MarkdownMessage :content="m.content" :streaming="!!m.streaming" />
                    </template>
                    <span
                      v-if="m.streaming && m.content"
                      class="caret"
                    />
                  </div>
                  <div
                    v-if="!m.streaming"
                    class="msg__tools"
                  >
                    <button
                      class="msg__tool"
                      @click="copyMsg(m.id, m.content)"
                    >
                      <DesignIcon
                        :name="copied[m.id] ? 'check' : 'copy'"
                        :size="14"
                      />
                      {{ copied[m.id] ? t('Copied') : t('Copy') }}
                    </button>
                    <button
                      v-if="i === messages.length - 1 && !isGenerating"
                      class="msg__tool"
                      @click="regen(i)"
                    >
                      <DesignIcon name="retry" :size="14" />
                      {{ t('Regenerate') }}
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- Jump to latest — appears when the user has scrolled up off the live tail -->
      <Transition name="jumpfade">
        <button
          v-if="showJump"
          class="jumpbtn"
          :title="t('Jump to latest')"
          @click="scrollToBottom"
        >
          <DesignIcon name="arrowdown" :size="16" />
          <span>{{ isGenerating ? t('New messages') : t('Jump to latest') }}</span>
        </button>
      </Transition>

      <!-- ===== Composer ===== -->
      <div class="composer">
        <div class="composer__inner">
          <div class="composer__box">
            <textarea
              ref="taRef"
              v-model="draft"
              class="composer__ta"
              rows="1"
              :placeholder="t('Message the assistant…')"
              @keydown="onKey"
            />
            <button
              v-if="isGenerating"
              class="composer__send is-stop"
              :title="t('Stop generating')"
              @click="store.stop()"
            >
              <DesignIcon name="stop" :size="16" />
            </button>
            <button
              v-else
              class="composer__send"
              :class="{ 'is-ready': draft.trim() }"
              :disabled="!draft.trim()"
              :title="t('Send')"
              @click="submit"
            >
              <DesignIcon name="send" :size="17" />
            </button>
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
.aithread__head {
  flex-wrap: wrap;
  gap: 10px;
}
.aithread { position: relative; }
.msg__thinking {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
  color: var(--text-secondary);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}
.msg__thinking :deep(svg) {
  color: var(--primary);
  animation: ai-thinking-pulse 1.2s ease-in-out infinite;
}
@keyframes ai-thinking-pulse {
  50% { opacity: .45; transform: scale(.88); }
}

/* editable header title */
.aititle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 15px;
  min-width: 0;
}
.aititle__text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aititle__edit {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  border-radius: var(--r-xs);
  display: grid;
  place-items: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity .14s, color .14s, background .14s;
}
.aititle.is-editable:hover .aititle__edit { opacity: 1; }
.aititle__edit:hover { background: var(--surface-2); color: var(--text); }
.aititle-edit {
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
  background: var(--surface);
  border: 1.5px solid var(--primary);
  border-radius: var(--r-xs);
  padding: 3px 8px;
  outline: none;
  max-width: 260px;
  box-shadow: var(--shadow-focus);
}

/* header icon button (export) */
.iconbtn {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: var(--r-pill);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all .14s;
}
.iconbtn:hover { border-color: var(--text-tertiary); color: var(--text); }

/* keep the two-step delete-confirm button visible + error-tinted */
:deep(.histitem__del.is-confirm) {
  display: grid !important;
  opacity: 1 !important;
  background: var(--error-weak);
  color: var(--error);
}

/* live suggestions in empty state */
.aiempty__live { width: 100%; max-width: 520px; margin-bottom: var(--sp-5); }
.aiempty__livelabel {
  font-size: var(--fs-micro);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  color: var(--text-tertiary);
  text-align: left;
  margin-bottom: 10px;
}
.aiempty__livegrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.livechip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--r-md);
  cursor: pointer;
  text-align: left;
  transition: all .14s;
  box-shadow: var(--shadow-xs);
  position: relative;
}
.livechip:hover {
  border-color: var(--primary-border);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}
.livechip__dot {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-tertiary);
}
.livechip.prio-high .livechip__dot { background: var(--error); }
.livechip.prio-medium .livechip__dot { background: var(--warning, #f59e0b); }
.livechip.prio-low .livechip__dot { background: var(--primary); }
.livechip__ic { color: var(--text-tertiary); flex: 0 0 16px; margin-top: 1px; }
.livechip:hover .livechip__ic { color: var(--primary); }
.livechip__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-right: 8px; }
.livechip__q { font-size: var(--fs-sm); font-weight: var(--fw-semibold); color: var(--text); }
.livechip__reason { font-size: var(--fs-label); color: var(--text-tertiary); line-height: 1.35; }
.livechip.is-skeleton { cursor: default; pointer-events: none; }
.livechip.is-skeleton:hover { transform: none; border-color: var(--border); box-shadow: var(--shadow-xs); }
.sk-box { background: rgba(var(--v-theme-on-surface), 0.08); animation: sk-pulse 1.5s ease-in-out infinite; }
@keyframes sk-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* jump-to-latest floating button */
.jumpbtn {
  position: absolute;
  left: 50%;
  bottom: 104px;
  transform: translateX(-50%);
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--r-pill);
  border: 1px solid var(--primary-border);
  background: var(--primary);
  color: var(--on-primary);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  cursor: pointer;
  box-shadow: var(--shadow-md);
  transition: transform .14s, box-shadow .14s;
}
.jumpbtn:hover { box-shadow: var(--shadow-lg); }
.jumpfade-enter-active, .jumpfade-leave-active { transition: opacity .18s, transform .18s; }
.jumpfade-enter-from, .jumpfade-leave-to { opacity: 0; transform: translate(-50%, 8px); }

/* Always show delete button on touch / phone (no hover affordance) */
@media (hover: none), (max-width: 768px) {
  :deep(.histitem__del) {
    display: grid !important;
    opacity: 1 !important;
  }
}

@media (max-width: 768px) {
  .aithread__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .aiempty__chips,
  .aiempty__livegrid {
    grid-template-columns: 1fr;
  }

  /* Hide verbose notif label on phone — icon + tooltip remain */
  .notifbtn__label {
    display: none;
  }

  .notifbtn {
    flex: 0 0 auto;
  }
}
</style>

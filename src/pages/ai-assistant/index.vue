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
import { Fmt } from '@/components/design/utils/format'

const { t } = useI18n({ useScope: 'global' })

const store = useAIAssistantStore()
const { chats, activeId, generating, notify, permission } = storeToRefs(store)

const draft = ref('')
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

onMounted(() => {
  store.setChatVisible(true)
  const onVis = () => store.setChatVisible(!document.hidden)

  document.addEventListener('visibilitychange', onVis)
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVis)
    store.setChatVisible(false)
  })
})

watch([() => messages.value.length, () => messages.value[messages.value.length - 1]?.content, activeId], async () => {
  await nextTick()
  const el = scrollRef.value

  if (el)
    el.scrollTop = el.scrollHeight
})

watch(draft, async () => {
  await nextTick()
  const ta = taRef.value

  if (!ta)
    return
  ta.style.height = 'auto'
  ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
})

function submit() {
  const text = draft.value.trim()

  if (!text || isGenerating.value)
    return
  store.send(text)
  draft.value = ''
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

  if (!last)
    return t('Empty conversation')

  return (last.role === 'assistant' ? last.content : last.content)
    .replace(/[*#\-]/g, '')
    .slice(0, 48)
}

// ---- markdown-lite (bold, bullets, numbered, paragraphs) ----
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function mdInline(s: string): string {
  return escapeHtml(s)
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
</script>

<template>
  <div class="aiwrap">
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
          @click="store.selectChat(c.id)"
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
            :title="t('Delete chat')"
            @click.stop="store.deleteChat(c.id)"
          >
            <DesignIcon name="trash" :size="15" />
          </button>
        </div>
      </div>
    </aside>

    <!-- ===== Thread ===== -->
    <section class="aithread">
      <div class="aithread__head">
        <div class="row" style="gap: 10px; min-width: 0;">
          <div class="msg__avatar" style="flex: 0 0 34px; width: 34px; height: 34px;">
            <DesignIcon name="sparkle" :size="17" />
          </div>
          <div style="min-width: 0;">
            <div style="font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              {{ active ? active.title : t('AI Assistant') }}
            </div>
            <div class="tertiary" style="font-size: 12px; white-space: nowrap;">
              {{ isGenerating ? t('Thinking…') : t('POS analyst · always-on') }}
            </div>
          </div>
        </div>
        <div class="row" style="gap: 10px;">
          <button
            class="notifbtn"
            :class="{ 'is-on': notifyOn, 'is-blocked': notifyBlocked }"
            :title="notifyBlocked
              ? t('Notifications blocked in browser settings')
              : (notifyOn ? t('Background notifications on') : t('Notify me when replies finish off-page'))"
            @click="store.toggleNotify()"
          >
            <DesignIcon :name="notifyOn ? 'bell' : 'belloff'" :size="16" />
            <span>{{ notifyBlocked ? t('Blocked') : (notifyOn ? t('Notifications on') : t('Notify me')) }}</span>
          </button>
        </div>
      </div>

      <div ref="scrollRef" class="aithread__scroll">
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
                      <span class="typing"><span /><span /><span /></span>
                    </template>
                    <template v-else>
                      <div class="md">
                        <template
                          v-for="(b, bi) in parseMd(m.content)"
                          :key="bi"
                        >
                          <p
                            v-if="b.t === 'p'"
                            v-html="mdInline(b.text || '')"
                          />
                          <ul v-else-if="b.t === 'ul'">
                            <li
                              v-for="(it, j) in b.items || []"
                              :key="j"
                              v-html="mdInline(it)"
                            />
                          </ul>
                          <ol v-else>
                            <li
                              v-for="(it, j) in b.items || []"
                              :key="j"
                              v-html="mdInline(it)"
                            />
                          </ol>
                        </template>
                      </div>
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

      <!-- ===== Composer ===== -->
      <div class="composer">
        <div class="composer__inner">
          <div class="composer__box">
            <textarea
              ref="taRef"
              v-model="draft"
              class="composer__ta"
              rows="1"
              :placeholder="t('Message the assistant…  (Enter to send, Shift+Enter for a new line)')"
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
          <div class="composer__hint">
            <span
              v-if="isGenerating"
              class="row"
              style="gap: 6px; color: var(--primary); justify-content: center;"
            >
              <span class="typing"><span /><span /><span /></span>
              {{ t('Generating — you can leave this page, I will keep working.') }}
            </span>
            <span v-else>
              {{ t('Alpha POS assistant · powered by your live data') }}
            </span>
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

@media (max-width: 900px) {
  .aiwrap {
    display: block;
  }

  .aihist {
    inline-size: 100%;
    max-block-size: 220px;
    border-inline-end: none;
    border-block-end: 1px solid var(--border, rgba(0, 0, 0, 0.08));
  }

  .aithread__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .aiempty__chips {
    grid-template-columns: 1fr;
  }
}
</style>

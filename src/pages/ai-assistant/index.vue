<script setup lang="ts">
import axios from '@axios'

const { t } = useI18n({ useScope: 'global' })

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
const logRef = ref<HTMLElement | null>(null)
const userData = ref<any>({})

try {
  userData.value = JSON.parse(localStorage.getItem('userData') || '{}')
}
catch {}

const userInitial = computed(() => {
  const name = userData.value?.first_name || userData.value?.email || 'U'
  return String(name).charAt(0).toUpperCase()
})

const priorityColor: Record<string, string> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
}

const iconFor: Record<string, string> = {
  warning: 'bx-error',
  clock: 'bx-time',
  chart: 'bx-bar-chart-alt-2',
  fire: 'bx-trending-up',
  truck: 'bx-package',
  'crystal-ball': 'bx-bulb',
}

function scrollToBottom() {
  nextTick(() => {
    const el = logRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function loadMeta() {
  loadingMeta.value = true
  try {
    const [sRes, qRes] = await Promise.all([
      axios.get('/ai/suggestions/'),
      axios.get('/ai/quick-actions/'),
    ])
    suggestions.value = sRes.data?.suggestions ?? []
    quickActions.value = qRes.data?.actions ?? []
  }
  catch {
    suggestions.value = []
    quickActions.value = []
  }
  finally {
    loadingMeta.value = false
  }
}

async function send(text?: string) {
  const query = (text ?? input.value).trim()
  if (!query || sending.value) return

  messages.value.push({
    id: Date.now(),
    role: 'user',
    text: query,
    timestamp: Date.now(),
  })
  input.value = ''
  sending.value = true
  scrollToBottom()

  try {
    const res = await axios.post('/ai/query/', {
      query,
      context: chatContext.value,
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
    messages.value.push({
      id: Date.now() + 1,
      role: 'bot',
      text: e?.response?.data?.error || t('Request failed. Please try again.'),
      timestamp: Date.now(),
    })
  }
  finally {
    sending.value = false
    scrollToBottom()
  }
}

function clearChat() {
  messages.value = []
  chatContext.value = null
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadMeta()
})
</script>

<template>
  <div class="ai-chat-page">
    <VCard class="ai-chat-card d-flex flex-column">
      <div class="chat-header d-flex align-center pa-4">
        <VAvatar
          size="40"
          color="primary"
          variant="tonal"
        >
          <VIcon icon="bx-bot" size="22" />
        </VAvatar>
        <div class="ms-3 flex-grow-1">
          <div class="text-h6">
            {{ t('AI Assistant') }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ t('Ask about stock, orders, and inventory') }}
          </div>
        </div>
        <VBtn
          icon
          variant="text"
          size="small"
          :disabled="!messages.length"
          @click="clearChat"
        >
          <VIcon icon="bx-trash" size="20" />
          <VTooltip activator="parent" location="top">
            {{ t('Clear chat') }}
          </VTooltip>
        </VBtn>
      </div>

      <VDivider />

      <div ref="logRef" class="chat-log flex-grow-1 pa-4">
        <div
          v-if="!messages.length"
          class="empty-state d-flex flex-column align-center justify-center h-100 text-center"
        >
          <VAvatar size="80" color="primary" variant="tonal" class="mb-4">
            <VIcon icon="bx-bot" size="40" />
          </VAvatar>
          <div class="text-h5 mb-2">
            {{ t('How can I help you today?') }}
          </div>
          <div class="text-body-2 text-medium-emphasis mb-6">
            {{ t('Ask anything about your stock, batches, or orders.') }}
          </div>

          <div v-if="quickActions.length" class="quick-actions d-flex flex-wrap justify-center gap-2 mb-6">
            <VBtn
              v-for="qa in quickActions"
              :key="qa.id"
              variant="outlined"
              size="small"
              :prepend-icon="iconFor[qa.icon] || 'bx-star'"
              @click="send(qa.query)"
            >
              {{ t(qa.label) }}
            </VBtn>
          </div>

          <div v-if="suggestions.length" class="suggestions w-100" style="max-width: 600px;">
            <div class="text-overline text-medium-emphasis mb-2">
              {{ t('Suggestions') }}
            </div>
            <VCard
              v-for="(s, i) in suggestions"
              :key="i"
              class="mb-2 suggestion-card"
              variant="outlined"
              @click="send(s.query)"
            >
              <div class="d-flex align-center pa-3">
                <VChip
                  size="x-small"
                  :color="priorityColor[s.priority] || 'default'"
                  variant="tonal"
                  class="me-3"
                >
                  {{ t(s.priority) }}
                </VChip>
                <div class="flex-grow-1 text-start">
                  <div class="text-body-2 font-weight-medium">
                    {{ s.query }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ s.reason }}
                  </div>
                </div>
                <VIcon icon="bx-chevron-right" size="18" />
              </div>
            </VCard>
          </div>
        </div>

        <template v-else>
          <div
            v-for="m in messages"
            :key="m.id"
            class="msg-row d-flex mb-4"
            :class="m.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <VAvatar
              v-if="m.role === 'bot'"
              size="36"
              color="primary"
              variant="tonal"
              class="me-2 flex-shrink-0"
            >
              <VIcon icon="bx-bot" size="20" />
            </VAvatar>

            <div class="msg-bubble-wrap">
              <div
                class="msg-bubble"
                :class="m.role === 'user' ? 'bubble-user' : 'bubble-bot'"
              >
                <div class="msg-text" v-text="m.text" />
              </div>
              <div
                class="msg-meta text-caption text-medium-emphasis mt-1"
                :class="m.role === 'user' ? 'text-end' : 'text-start'"
              >
                <span v-if="m.intent" class="me-2">{{ m.intent }}</span>
                <span>{{ formatTime(m.timestamp) }}</span>
              </div>
              <div
                v-if="m.suggestions?.length"
                class="msg-suggestions mt-2 d-flex flex-wrap gap-2"
              >
                <VChip
                  v-for="(sg, i) in m.suggestions"
                  :key="i"
                  size="small"
                  variant="outlined"
                  class="cursor-pointer"
                  @click="send(sg)"
                >
                  {{ sg }}
                </VChip>
              </div>
            </div>

            <VAvatar
              v-if="m.role === 'user'"
              size="36"
              color="secondary"
              variant="tonal"
              class="ms-2 flex-shrink-0"
            >
              <span class="text-body-2 font-weight-medium">{{ userInitial }}</span>
            </VAvatar>
          </div>

          <div v-if="sending" class="msg-row d-flex justify-start mb-4">
            <VAvatar size="36" color="primary" variant="tonal" class="me-2">
              <VIcon icon="bx-bot" size="20" />
            </VAvatar>
            <div class="msg-bubble bubble-bot typing">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
          </div>
        </template>
      </div>

      <VDivider />

      <div class="chat-input pa-4">
        <VForm @submit.prevent="() => send()">
          <VTextField
            v-model="input"
            :placeholder="t('Type your message...')"
            variant="outlined"
            density="comfortable"
            hide-details
            :disabled="sending"
            autofocus
          >
            <template #append-inner>
              <VBtn
                color="primary"
                :loading="sending"
                :disabled="!input.trim()"
                size="small"
                icon
                @click="() => send()"
              >
                <VIcon icon="bx-send" size="18" />
              </VBtn>
            </template>
          </VTextField>
        </VForm>
      </div>
    </VCard>
  </div>
</template>

<route lang="yaml">
meta:
  action: manage
  subject: all
</route>

<style scoped lang="scss">
.ai-chat-page {
  block-size: calc(100vh - 10rem);
}

.ai-chat-card {
  block-size: 100%;
  overflow: hidden;
}

.chat-log {
  overflow-y: auto;
  scroll-behavior: smooth;
}

.empty-state {
  min-block-size: 100%;
}

.suggestion-card {
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background-color: rgba(var(--v-theme-primary), 0.06);
  }
}

.msg-row {
  align-items: flex-end;
}

.msg-bubble-wrap {
  max-inline-size: 70%;
}

.msg-bubble {
  padding: 0.625rem 0.875rem;
  border-radius: 14px;
  word-break: break-word;
  white-space: pre-wrap;
}

.bubble-user {
  background-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  border-end-end-radius: 4px;
}

.bubble-bot {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
  color: rgb(var(--v-theme-on-surface));
  border-end-start-radius: 4px;
}

.typing {
  display: inline-flex;
  gap: 4px;

  .dot {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background-color: rgba(var(--v-theme-on-surface), 0.4);
    animation: blink 1.2s infinite ease-in-out;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.gap-2 {
  gap: 0.5rem;
}
</style>

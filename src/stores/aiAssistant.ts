/* ============================================================
   ALPHA POS — AI Assistant store (Pinia, above-router)
   1:1 port of .tmp-alpha-design/alpha-design-source/aichat.jsx
   AIProvider. Generation runs in this store, so it keeps streaming
   when the user navigates to other pages. Browser notifications
   fire when a reply finishes and the user isn't watching the chat.
   ============================================================ */
import { defineStore } from 'pinia'
import { stockApi } from '@/plugins/axios'

const STORE_KEY = 'alphapos-ai-chats-v1'
const NOTIFY_KEY = 'alphapos-ai-notify-v1'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  streaming?: boolean
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
  draft?: string
}

export interface QuickAction { id: string; label: string; icon: string; query: string }
export interface Suggestion { query: string; reason: string; priority: 'high' | 'medium' | 'low' }

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
function nowTs(): number {
  return Date.now()
}

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORE_KEY)

    if (raw) {
      const p = JSON.parse(raw) as Chat[]

      if (p?.length) {
        // sanitize: no generation survives a reload, so clear stale streaming
        // flags and drop empty assistant placeholders left mid-flight.
        return p.map(c => ({
          ...c,
          messages: (c.messages || [])
            .filter(m => !(m.role === 'assistant' && m.streaming && !m.content))
            .map(m => m.streaming ? { ...m, streaming: false } : m),
        }))
      }
    }
  }
  catch { /* noop */ }

  return []
}

function loadNotify(): boolean {
  try { return localStorage.getItem(NOTIFY_KEY) === '1' }
  catch { return false }
}

export const useAIAssistantStore = defineStore('aiAssistant', () => {
  const chats = ref<Chat[]>(loadChats())
  const activeId = ref<string | null>(chats.value[0]?.id ?? null)
  const generating = ref<string | null>(null)
  const notify = ref<boolean>(loadNotify())
  const permission = ref<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  )

  // Keep the old quick-actions + suggestions metadata for the empty-state.
  const quickActions = ref<QuickAction[]>([])
  const suggestions = ref<Suggestion[]>([])
  const loadingMeta = ref(false)

  const chatVisible = ref(false)
  let stopRequested = false

  watch(chats, val => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(val.slice(0, 40))) }
    catch { /* noop */ }
  }, { deep: true })
  watch(notify, on => {
    try { localStorage.setItem(NOTIFY_KEY, on ? '1' : '0') }
    catch { /* noop */ }
  })

  function setChatVisible(v: boolean) {
    chatVisible.value = v
  }

  function fireNotification(_chatId: string, title: string, body: string) {
    const onPage = chatVisible.value && (typeof document === 'undefined' || !document.hidden)

    if (onPage)
      return
    if (notify.value && permission.value === 'granted' && typeof Notification !== 'undefined') {
      try {
        const n = new Notification(`Alpha POS · ${title}`, { body, tag: `ai-${_chatId}` })

        n.onclick = () => {
          try { window.focus() }
          catch { /* noop */ }
          window.dispatchEvent(new CustomEvent('ai-open-chat', { detail: _chatId }))
          n.close()
        }

        return
      }
      catch { /* noop */ }
    }
  }

  async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof Notification === 'undefined') {
      permission.value = 'unsupported'

      return 'unsupported'
    }
    if (Notification.permission === 'granted') {
      permission.value = 'granted'

      return 'granted'
    }
    const p = await Notification.requestPermission()

    permission.value = p

    return p
  }

  function toggleNotify() {
    notify.value = !notify.value
    if (notify.value)
      requestPermission()
  }

  function newChat(): string {
    const c: Chat = { id: uid(), title: 'New chat', messages: [], updatedAt: nowTs() }

    chats.value = [c, ...chats.value]
    activeId.value = c.id

    return c.id
  }

  function selectChat(id: string) {
    activeId.value = id
  }

  function deleteChat(id: string) {
    const next = chats.value.filter(c => c.id !== id)

    chats.value = next
    if (activeId.value === id)
      activeId.value = next[0]?.id ?? null
  }

  function renameChat(id: string, title: string) {
    chats.value = chats.value.map(c => c.id === id ? { ...c, title } : c)
  }

  function stop() {
    stopRequested = true
  }

  async function loadMeta() {
    loadingMeta.value = true
    try {
      const [sRes, qRes] = await Promise.all([
        stockApi.get('/ai/suggestions/'),
        stockApi.get('/ai/quick-actions/'),
      ])

      suggestions.value = sRes.data?.suggestions ?? []
      quickActions.value = qRes.data?.actions ?? []
    }
    catch {
      suggestions.value = []
      quickActions.value = []
    }
    finally { loadingMeta.value = false }
  }

  function streamWords(convoId: string, msgId: string, fullText: string) {
    const words = fullText.split(/(\s+)/)
    let i = 0

    stopRequested = false

    const step = () => {
      if (stopRequested) {
        finalize(convoId, msgId, false)

        return
      }
      i += 1
      const partial = words.slice(0, i).join('')

      chats.value = chats.value.map(c => c.id !== convoId
        ? c
        : ({
            ...c,
            messages: c.messages.map(m => m.id === msgId ? { ...m, content: partial } : m),
          }))
      if (i < words.length) {
        const tok = words[i] || ''
        const delay = /\n/.test(tok) ? 90 : 16 + Math.random() * 34

        window.setTimeout(step, delay)
      }
      else {
        finalize(convoId, msgId, true)
      }
    }

    step()
  }

  function finalize(convoId: string, msgId: string, complete: boolean) {
    chats.value = chats.value.map(c => c.id !== convoId
      ? c
      : ({
          ...c,
          updatedAt: nowTs(),
          messages: c.messages.map(m => m.id === msgId ? { ...m, streaming: false } : m),
        }))
    generating.value = null

    if (complete) {
      let title = 'AI reply ready'
      let body = ''
      const c = chats.value.find(x => x.id === convoId)

      if (c) {
        title = c.title
        const a = c.messages.find(m => m.id === msgId)

        body = a ? a.content.replace(/[*#]/g, '').slice(0, 90) : ''
      }
      setTimeout(() => fireNotification(convoId, title, body), 0)
    }
  }

  function getUserPayload() {
    try {
      const raw = localStorage.getItem('userData')

      if (!raw)
        return null
      const u = JSON.parse(raw)

      return { id: u.id, first_name: u.first_name, role: u.role }
    }
    catch { return null }
  }

  async function send(rawText: string, displayedText?: string) {
    const text = (rawText || '').trim()

    if (!text || generating.value)
      return

    let convoId = activeId.value
    let convoIdx = chats.value.findIndex(c => c.id === convoId)

    if (convoIdx === -1 || convoId === null) {
      const c: Chat = { id: uid(), title: 'New chat', messages: [], updatedAt: nowTs() }

      convoId = c.id
      chats.value = [c, ...chats.value]
      convoIdx = 0
    }

    const userVisible = displayedText ?? text
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: userVisible, ts: nowTs() }
    const aMsg: ChatMessage = { id: uid(), role: 'assistant', content: '', ts: nowTs(), streaming: true }

    chats.value = chats.value.map((c, i) => i !== convoIdx
      ? c
      : ({
          ...c,
          title: (c.title === 'New chat' || !c.messages.some(m => m.role === 'user'))
            ? (userVisible.length > 42 ? `${userVisible.slice(0, 42)}…` : userVisible)
            : c.title,
          messages: [...c.messages, userMsg, aMsg],
          updatedAt: nowTs(),
        }))
    activeId.value = convoId
    generating.value = convoId

    // Real BE call, then stream the result word-by-word for the typing UX.
    try {
      const locale = localStorage.getItem('appLocale') || 'uz'
      const user = getUserPayload()
      const res = await stockApi.post('/ai/query/', {
        query: text,
        context: null,
        locale,
        user,
      })
      const reply = res.data?.response || 'No response'

      streamWords(convoId!, aMsg.id, reply)
    }
    catch (e: any) {
      const code = e?.response?.data?.error
      const friendly = (code === 'llm_sdk_missing' || code === 'llm_key_missing')
        ? 'AI service unavailable. The LLM key is not configured.'
        : (e?.response?.data?.message || code || 'Request failed. Please try again.')

      chats.value = chats.value.map(c => c.id !== convoId
        ? c
        : ({
            ...c,
            messages: c.messages.map(m => m.id === aMsg.id ? { ...m, content: friendly, streaming: false } : m),
          }))
      generating.value = null
    }
  }

  function clearChat() {
    if (!activeId.value)
      return
    deleteChat(activeId.value)
  }

  function setDraft(id: string, text: string) {
    chats.value = chats.value.map(c => c.id === id ? { ...c, draft: text } : c)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('ai-open-chat', ((ev: CustomEvent) => {
      if (ev.detail) {
        activeId.value = ev.detail as string
        window.dispatchEvent(new CustomEvent('ai-goto-page'))
      }
    }) as EventListener)
  }

  return {
    chats,
    activeId,
    generating,
    notify,
    permission,
    quickActions,
    suggestions,
    loadingMeta,
    setChatVisible,
    requestPermission,
    toggleNotify,
    newChat,
    selectChat,
    deleteChat,
    renameChat,
    stop,
    send,
    clearChat,
    setDraft,
    loadMeta,
  }
})

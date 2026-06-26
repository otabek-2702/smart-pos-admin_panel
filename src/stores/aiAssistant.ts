/* ============================================================
   ALPHA POS — AI Assistant store (Pinia, above-router)
   1:1 port of .tmp-alpha-design/alpha-design-source/aichat.jsx
   AIProvider. Generation runs in this store, so it keeps streaming
   when the user navigates to other pages. Browser notifications
   fire when a reply finishes and the user isn't watching the chat.

   --- BE PERSISTENCE (added 2026-06) ---
   Server is the source of truth when reachable. localStorage cache
   stays as offline fallback. Each local Chat may carry a `serverId`
   linking it to a server-side conversation (POST /ai/chats/). The
   /ai/query/ call attaches `conversation_id` so the BE can persist
   the message under that conversation.

   BE endpoints (per Abrorbek, prefix /api/admins/stock/ via stockApi):
   - GET    /ai/chats/            → list  [{id, title, updated_at, message_count}]
   - GET    /ai/chats/{id}/       → detail { id, title, messages: [{id, role, content, ts}] }
   - POST   /ai/chats/            → create empty, returns { id }
   - PATCH  /ai/chats/{id}/       → rename { title }
   - DELETE /ai/chats/{id}/       → remove
   - POST   /ai/query/            → existing, now accepts { conversation_id?, ... }

   On unknown shapes / network errors we degrade silently to local-only.
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
  /** Server-side conversation id (string|number). undefined when chat is local-only. */
  serverId?: string | number
  title: string
  messages: ChatMessage[]
  updatedAt: number
  draft?: string
  /** Set when we know the server has more messages than we've hydrated. */
  needsHydration?: boolean
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

// --- BE shape coercion helpers (forgiving of unexpected payloads) ---

function toTs(v: any): number {
  if (typeof v === 'number')
    return v > 1e12 ? v : v * 1000 // accept seconds or ms
  if (typeof v === 'string') {
    const n = Date.parse(v)

    if (!Number.isNaN(n))
      return n
  }
  return nowTs()
}

interface RemoteChatSummary { id: string | number; title?: string; updated_at?: any; message_count?: number }
interface RemoteChatDetail { id: string | number; title?: string; messages?: any[] }

function coerceSummary(raw: any): RemoteChatSummary | null {
  if (!raw || (raw.id === undefined || raw.id === null))
    return null
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    updated_at: raw.updated_at ?? raw.updatedAt ?? null,
    message_count: typeof raw.message_count === 'number'
      ? raw.message_count
      : (typeof raw.messages_count === 'number' ? raw.messages_count : 0),
  }
}

function coerceMessage(raw: any): ChatMessage | null {
  if (!raw)
    return null
  const role: 'user' | 'assistant' = raw.role === 'user' ? 'user' : 'assistant'
  const content = typeof raw.content === 'string'
    ? raw.content
    : (typeof raw.text === 'string' ? raw.text : '')
  const id = raw.id !== undefined && raw.id !== null ? String(raw.id) : uid()

  return { id, role, content, ts: toTs(raw.ts ?? raw.created_at ?? raw.createdAt) }
}

function coerceDetail(raw: any): RemoteChatDetail | null {
  if (!raw || (raw.id === undefined || raw.id === null))
    return null
  const msgsRaw = Array.isArray(raw.messages) ? raw.messages : []

  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    messages: msgsRaw.map(coerceMessage).filter(Boolean),
  }
}

function pickArray(payload: any): any[] {
  if (Array.isArray(payload))
    return payload
  if (Array.isArray(payload?.results))
    return payload.results
  if (Array.isArray(payload?.chats))
    return payload.chats
  if (Array.isArray(payload?.data))
    return payload.data
  return []
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

  // Server sync state
  const remoteChats = ref<RemoteChatSummary[]>([])
  const remoteLoading = ref(false)
  const remoteError = ref<string | null>(null)
  let remoteListed = false // guard so we don't re-list on every visibility toggle

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
    if (v && !remoteListed) {
      remoteListed = true
      // fire and forget — local cache is shown immediately; server merges in.
      listRemote().catch(() => { /* graceful */ })
    }
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

  function deleteChat(id: string) {
    const c = chats.value.find(x => x.id === id)
    const next = chats.value.filter(x => x.id !== id)

    chats.value = next
    if (activeId.value === id)
      activeId.value = next[0]?.id ?? null

    // Best-effort remote delete; local removal already happened.
    if (c?.serverId !== undefined && c.serverId !== null)
      deleteRemote(c.serverId).catch(() => { /* graceful */ })
  }

  function renameChat(id: string, title: string) {
    const c = chats.value.find(x => x.id === id)

    chats.value = chats.value.map(x => x.id === id ? { ...x, title } : x)

    if (c?.serverId !== undefined && c.serverId !== null)
      renameRemote(c.serverId, title).catch(() => { /* graceful */ })
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

  // ----------------------------------------------------------------
  // Remote (server) sync
  // ----------------------------------------------------------------

  /** GET /ai/chats/ — list server conversations and merge into local chats[]. */
  async function listRemote(): Promise<RemoteChatSummary[]> {
    remoteLoading.value = true
    remoteError.value = null
    try {
      const res = await stockApi.get('/ai/chats/')
      const arr = pickArray(res.data).map(coerceSummary).filter(Boolean) as RemoteChatSummary[]

      remoteChats.value = arr
      mergeRemoteIntoLocal(arr)

      return arr
    }
    catch (e: any) {
      remoteError.value = e?.response?.data?.message || e?.message || 'failed'

      return []
    }
    finally {
      remoteLoading.value = false
    }
  }

  /** Merge server summaries into local chats[]. Server is source of truth for order/title. */
  function mergeRemoteIntoLocal(remote: RemoteChatSummary[]) {
    if (!remote.length)
      return

    const byServerId = new Map<string, Chat>()
    const localOnly: Chat[] = []

    for (const c of chats.value) {
      if (c.serverId !== undefined && c.serverId !== null)
        byServerId.set(String(c.serverId), c)
      else
        localOnly.push(c)
    }

    const merged: Chat[] = []

    for (const r of remote) {
      const key = String(r.id)
      const existing = byServerId.get(key)

      if (existing) {
        // Server title wins (unless empty); preserve local messages cache.
        merged.push({
          ...existing,
          title: r.title || existing.title,
          updatedAt: toTs(r.updated_at) || existing.updatedAt,
          needsHydration: (r.message_count ?? 0) > existing.messages.length,
        })
      }
      else {
        // Server-only chat — placeholder until user opens it (then hydrate).
        merged.push({
          id: uid(),
          serverId: r.id,
          title: r.title || 'Chat',
          messages: [],
          updatedAt: toTs(r.updated_at),
          needsHydration: (r.message_count ?? 0) > 0,
        })
      }
    }

    // Keep purely-local chats (no serverId) at the bottom — usually transient.
    chats.value = [...merged, ...localOnly]

    if (activeId.value && !chats.value.some(c => c.id === activeId.value))
      activeId.value = chats.value[0]?.id ?? null
  }

  /** GET /ai/chats/{id}/ — hydrate one chat's messages from server. */
  async function getRemote(serverId: string | number): Promise<RemoteChatDetail | null> {
    try {
      const res = await stockApi.get(`/ai/chats/${serverId}/`)
      const detail = coerceDetail(res.data)

      if (!detail)
        return null

      // Splice messages into the matching local chat (if any).
      chats.value = chats.value.map(c => {
        if (String(c.serverId) !== String(detail.id))
          return c
        return {
          ...c,
          title: detail.title || c.title,
          messages: detail.messages as ChatMessage[],
          needsHydration: false,
        }
      })

      return detail
    }
    catch {
      return null
    }
  }

  /** POST /ai/chats/ — create empty server conversation, return its id. */
  async function createRemote(title?: string): Promise<string | number | null> {
    try {
      const res = await stockApi.post('/ai/chats/', title ? { title } : {})
      const id = res.data?.id ?? res.data?.data?.id ?? null

      return id !== undefined && id !== null ? id : null
    }
    catch {
      return null
    }
  }

  /** PATCH /ai/chats/{id}/ */
  async function renameRemote(serverId: string | number, title: string): Promise<boolean> {
    try {
      await stockApi.patch(`/ai/chats/${serverId}/`, { title })

      return true
    }
    catch {
      return false
    }
  }

  /** DELETE /ai/chats/{id}/ */
  async function deleteRemote(serverId: string | number): Promise<boolean> {
    try {
      await stockApi.delete(`/ai/chats/${serverId}/`)

      return true
    }
    catch {
      return false
    }
  }

  function selectChat(id: string) {
    activeId.value = id

    // Lazy-hydrate from server if this chat has a serverId but no messages yet
    // (or the server-side message_count exceeds what we have cached).
    const c = chats.value.find(x => x.id === id)

    if (c && c.serverId !== undefined && c.serverId !== null && (c.messages.length === 0 || c.needsHydration))
      getRemote(c.serverId).catch(() => { /* graceful */ })
  }

  // ----------------------------------------------------------------
  // Streaming reply
  // ----------------------------------------------------------------

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

    // Ensure the active chat has a server-side conversation id before posting
    // the query — so the BE attaches the message to the right conversation.
    // Failure to create remote is non-fatal; we just send without conversation_id.
    let active = chats.value.find(c => c.id === convoId) || null
    let conversationId: string | number | undefined = active?.serverId

    if (active && (active.serverId === undefined || active.serverId === null)) {
      const newServerId = await createRemote(active.title)

      if (newServerId !== null) {
        conversationId = newServerId
        chats.value = chats.value.map(c => c.id !== convoId
          ? c
          : ({ ...c, serverId: newServerId }))
        active = chats.value.find(c => c.id === convoId) || null
      }
    }

    // Real BE call, then stream the result word-by-word for the typing UX.
    try {
      const locale = localStorage.getItem('appLocale') || 'uz'
      const user = getUserPayload()
      const payload: Record<string, any> = {
        query: text,
        context: null,
        locale,
        user,
      }

      if (conversationId !== undefined && conversationId !== null)
        payload.conversation_id = conversationId

      const res = await stockApi.post('/ai/query/', payload)
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
    remoteChats,
    remoteLoading,
    remoteError,
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
    listRemote,
    getRemote,
    createRemote,
    renameRemote,
    deleteRemote,
  }
})

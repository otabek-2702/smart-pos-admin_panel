/* ============================================================
   ALPHA POS — AI Assistant store (Pinia)
   MUST live above the router so generation keeps running on
   navigation. Pinia is registered in src/main.ts before the
   router, so any in-flight send() Promise continues even if the
   user leaves /ai-assistant; messages/sending/context survive.
   ============================================================ */
import { stockApi } from '@/plugins/axios'
import { getStoredUserData } from '@/utils/storage'

export interface Message {
  id: number
  role: 'user' | 'bot'
  text: string
  timestamp: number
  intent?: string
  suggestions?: string[]
}

export interface Suggestion {
  query: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface QuickAction {
  id: string
  label: string
  icon: string
  query: string
}

export const useAiAssistantStore = defineStore('aiAssistant', () => {
  // --- State ---------------------------------------------------------------
  const messages = ref<Message[]>([])
  const input = ref<string>('')
  const sending = ref<boolean>(false)
  const chatContext = ref<any>(null)
  const quickActions = ref<QuickAction[]>([])
  const suggestions = ref<Suggestion[]>([])
  const loadingMeta = ref<boolean>(false)
  const metaLoadFailed = ref<boolean>(false)

  // Build minimal user payload so backend can address user by name and
  // tailor permissions-aware responses. Re-read on every send so a relogin
  // mid-session picks up the new identity without a page reload.
  function userPayload() {
    const u: any = getStoredUserData() || {}

    return {
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
    }
  }

  function currentLocale(): string {
    try {
      return localStorage.getItem('appLocale') || 'uz'
    }
    catch {
      return 'uz'
    }
  }

  // --- Actions -------------------------------------------------------------

  // Fetch starter suggestions + quick-action buttons in parallel. Called on
  // page mount and again whenever the locale changes so labels re-localize.
  async function loadMeta() {
    loadingMeta.value = true
    metaLoadFailed.value = false
    try {
      const params = { locale: currentLocale() }
      const [sRes, qRes] = await Promise.all([
        stockApi.get('/ai/suggestions/', { params }),
        stockApi.get('/ai/quick-actions/', { params }),
      ])

      suggestions.value = sRes.data?.suggestions ?? []
      quickActions.value = qRes.data?.actions ?? []
    }
    catch {
      suggestions.value = []
      quickActions.value = []
      metaLoadFailed.value = true
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

    try {
      const res = await stockApi.post('/ai/query/', {
        query,
        context: chatContext.value,
        locale: currentLocale(),
        user: userPayload(),
      })

      const d = res.data ?? {}

      chatContext.value = d.context ?? chatContext.value

      // Refresh the empty-state suggestion list with whatever the backend
      // returns alongside the answer — keeps follow-ups in sync with the
      // current conversation thread.
      if (Array.isArray(d.suggestions))
        suggestions.value = d.suggestions as Suggestion[]

      messages.value.push({
        id: Date.now() + 1,
        role: 'bot',
        text: d.response || 'No response',
        intent: d.intent,
        suggestions: d.suggestions ?? [],
        timestamp: Date.now(),
      })
    }
    catch (e: any) {
      // Map backend error codes to friendly bubbles. The page layer can
      // re-translate via te()/t() if a matching key exists; raw English
      // strings here mean unknown locales still get something readable.
      const code = e?.response?.data?.error
      const status = e?.response?.status
      let friendly = e?.response?.data?.message || 'Request failed. Please try again.'

      if (code === 'llm_sdk_missing' || code === 'llm_key_missing')
        friendly = 'AI service unavailable'
      else if (status === 429)
        friendly = 'Too many requests. Please slow down.'
      else if (code)
        friendly = 'error_' + code

      messages.value.push({
        id: Date.now() + 1,
        role: 'bot',
        text: friendly,
        timestamp: Date.now(),
      })
    }
    finally {
      sending.value = false
    }
  }

  // Wipe the visible thread AND the rolling backend context so the next
  // query starts a fresh conversation (no stale entity/intent carryover).
  function clearChat() {
    messages.value = []
    chatContext.value = null
  }

  return {
    // state
    messages,
    input,
    sending,
    chatContext,
    quickActions,
    suggestions,
    loadingMeta,
    metaLoadFailed,
    // actions
    loadMeta,
    send,
    clearChat,
  }
})

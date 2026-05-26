import axios from 'axios'

// In dev, use relative paths so the Vite proxy (vite.config.ts) forwards to the backend
// without triggering CORS. In production, set VITE_API_HOST to the backend URL.
const API_HOST = import.meta.env.VITE_API_HOST ?? ''

// Endpoints that the backend dedupes via `Idempotency-Key`. POSTs to any of
// these paths get a fresh UUID per request — so a double-click / retry won't
// charge twice, perform inkassa twice, etc.
// Patterns match against the request `url` (already relative to baseURL).
const IDEMPOTENT_POST_PATTERNS: RegExp[] = [
  /^\/orders\/?$/, // POST /orders (create)
  /^\/orders\/\d+\/pay$/, // POST /orders/{id}/pay
  /^\/orders\/\d+\/cancel$/, // POST /orders/{id}/cancel
  /^\/inkassa\/perform$/, // POST /inkassa/perform
  /^\/loyalty\/accounts\/[^/]+\/redeem\/?$/, // POST /loyalty/accounts/{phone}/redeem/ (notificationsApi)
]

function isIdempotentPath(method: string | undefined, url: string | undefined): boolean {
  if (!url || (method || '').toUpperCase() !== 'POST')
    return false
  return IDEMPOTENT_POST_PATTERNS.some(p => p.test(url))
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()

  // Fallback for older browsers — not crypto-strong but unique enough for dedup.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}

function attachInterceptors(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.request.use(config => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${JSON.parse(token)}`
    }

    // Auto-attach Idempotency-Key on the four admin endpoints that honor it.
    // Caller can override by setting their own header.
    if (isIdempotentPath(config.method, config.url)) {
      config.headers = config.headers || {}
      if (!config.headers['Idempotency-Key'])
        config.headers['Idempotency-Key'] = newIdempotencyKey()
    }

    return config
  })

  instance.interceptors.response.use(
    response => response,
    error => {
      if (error.response?.status === 401) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('userData')
        localStorage.removeItem('userAbilities')
        if (window.location.pathname !== '/login')
          window.location.href = '/login'
      }

      return Promise.reject(error)
    },
  )

  return instance
}

const axiosIns = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins` }))

export const stockApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/stock` }))

export const hrApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/hr` }))

export const discountsApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/discounts` }))

export const notificationsApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/notifications` }))

export default axiosIns

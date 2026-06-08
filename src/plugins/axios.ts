import axios from 'axios'
import { getStoredToken } from '@/utils/storage'

// Runtime override > build-time VITE_API_HOST > empty (dev proxy / relative).
// Operator can change the backend URL from the Settings dialog without a rebuild;
// the choice is persisted in localStorage and re-applied to every request below.
function readRuntimeHost(): string {
  try {
    return (localStorage.getItem('apiHost') ?? '').trim().replace(/\/+$/, '')
  }
  catch {
    return ''
  }
}

const BUILD_HOST = (import.meta.env.VITE_API_HOST ?? '').replace(/\/+$/, '')
const API_HOST = readRuntimeHost() || BUILD_HOST

export function getCurrentApiHost(): string {
  return readRuntimeHost() || BUILD_HOST
}

export function setApiHost(host: string) {
  const cleaned = (host ?? '').trim().replace(/\/+$/, '')
  if (cleaned)
    localStorage.setItem('apiHost', cleaned)
  else
    localStorage.removeItem('apiHost')
}

// Endpoints that the backend dedupes via `Idempotency-Key`. POSTs to any of
// these paths get a fresh UUID per request — so a double-click / retry won't
// charge twice, perform inkassa twice, etc.
// Patterns match against the request `url` (already relative to baseURL).
const IDEMPOTENT_POST_PATTERNS: RegExp[] = [
  /^\/orders\/?$/, // POST /orders (create)
  /^\/orders\/\d+\/pay$/, // POST /orders/{id}/pay
  /^\/orders\/\d+\/cancel$/, // POST /orders/{id}/cancel
  /^\/inkassa\/perform$/, // POST /inkassa/perform
  /^\/treasury\/transfer$/, // POST /treasury/transfer
  /^\/treasury\/expense$/, // POST /treasury/expense
  /^\/suppliers\/\d+\/pay\/?$/, // POST /suppliers/{id}/pay/ (stockApi)
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

// Each axios instance is created once with the baseURL known at boot. To let
// the operator swap hosts at runtime we tag the instance with its trailing
// "/api/..." suffix and rewrite baseURL per-request from the current host.
function attachInterceptors(instance: ReturnType<typeof axios.create>, suffix = '') {
  instance.interceptors.request.use(config => {
    if (suffix) {
      const host = getCurrentApiHost()
      config.baseURL = `${host}${suffix}`
    }

    const token = getStoredToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
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

      // License kill switch — backend returns 503 with a `code` like
      // `license_unregistered` / `license_suspended` / `license_expired` on
      // EVERY business endpoint until /api/licensing/setup runs. Route the
      // user to the setup wizard so they can recover without bouncing
      // through "something went wrong" toasts on every page.
      const code: string | undefined = error.response?.data?.code
      if (error.response?.status === 503 && code && code.startsWith('license_')) {
        const onLicensingPage = window.location.pathname.startsWith('/licensing')
        if (!onLicensingPage)
          window.location.href = '/licensing/setup'
      }

      return Promise.reject(error)
    },
  )

  return instance
}

const axiosIns = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins` }), '/api/admins')

export const stockApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/stock` }), '/api/admins/stock')

export const hrApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/hr` }), '/api/admins/hr')

export const discountsApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/discounts` }), '/api/admins/discounts')

export const notificationsApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/notifications` }), '/api/admins/notifications')

export const cashboxApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/admins/cashbox` }), '/api/admins/cashbox')

export const fiscalApi = attachInterceptors(axios.create({ baseURL: `${API_HOST}/api/fiscalization` }), '/api/fiscalization')

// Licensing endpoints are allowlisted past the kill switch and don't
// require auth. No Bearer token, no idempotency. Plain axios so the
// 503 redirect doesn't loop while on the licensing pages themselves.
export const licensingApi = axios.create({ baseURL: `${API_HOST}/api/licensing` })

export default axiosIns

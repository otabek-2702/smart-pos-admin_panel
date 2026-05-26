import axios from '@axios'

// In dev, use relative paths so the Vite proxy (vite.config.ts) forwards to the backend
// without triggering CORS. In production, set VITE_API_HOST to the backend URL.
const API_HOST = import.meta.env.VITE_API_HOST ?? ''

function attachInterceptors(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.request.use(config => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${JSON.parse(token)}`
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

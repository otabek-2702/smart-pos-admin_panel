import axios from 'axios'

const axiosIns = axios.create({
  baseURL: 'http://127.0.0.1:8000',
})

// ℹ️ Add request interceptor to send the authorization header on each subsequent request after login
axiosIns.interceptors.request.use(config => {
  // Retrieve token from localStorage
  const token = localStorage.getItem('accessToken')

  // If token is found
  if (token) {
    // Get request headers and if headers is undefined assign blank object
    config.headers = config.headers || {}

    // Set authorization header
    // ℹ️ JSON.parse will convert token to string
    config.headers.Authorization = token ? `Bearer ${JSON.parse(token)}` : ''
  }

  // Return modified config
  return config
})

// ℹ️ Add response interceptor to handle 401 — clear auth and redirect to login
axiosIns.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('userData')
      localStorage.removeItem('userAbilities')

      // Redirect to login if not already there
      if (window.location.pathname !== '/login')
        window.location.href = '/login'
    }

    return Promise.reject(error)
  },
)

export default axiosIns

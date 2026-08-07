import axios from 'axios'

type AuthStore = {
  isAuthenticated: boolean
  token: string | null
  logout: () => void
}

let authStoreAccessor: (() => AuthStore) | null = null

export function injectAuthStore(accessor: () => AuthStore) {
  authStoreAccessor = accessor
}

const api = axios.create({
  baseURL: '/api/admin',
  timeout: 15000,
})

api.interceptors.request.use(
  (config) => {
    const store = authStoreAccessor?.()
    if (store?.token) {
      config.headers.Authorization = `Bearer ${store.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const store = authStoreAccessor?.()
      if (store) {
        store.logout()
      }
      if (window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login'
      }
    } else if (error.response?.status === 403) {
      const data = error.response.data
      const msg = data?.message || '无权限执行此操作'
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('admin-toast', {
          detail: { type: 'error', message: msg },
        })
        window.dispatchEvent(event)
      }
    }
    return Promise.reject(error)
  }
)

export default api

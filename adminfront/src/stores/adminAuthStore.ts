import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AdminUser } from '@/types'
import { injectAuthStore } from '@/lib/axios'

interface AdminAuthState {
  isAuthenticated: boolean
  token: string | null
  user: AdminUser | null
  login: (token: string, user: AdminUser) => void
  logout: () => void
  setUser: (user: AdminUser) => void
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      token: null,
      user: null,
      login: (token, user) => {
        set({ isAuthenticated: true, token, user })
      },
      logout: () => {
        set({ isAuthenticated: false, token: null, user: null })
      },
      setUser: (user) => {
        set({ user })
      },
    }),
    {
      name: 'growpocket_admin_auth',
    }
  )
)

injectAuthStore(() => useAdminAuthStore.getState())

import { create } from 'zustand'
import { api, type User } from '@/lib/api'

type AuthState = {
  user: User | null
  loading: boolean
  fetchMe: () => Promise<User | null>
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,
  fetchMe: async () => {
    try {
      const user = await api.get<User>('/auth/me')
      set({ user, loading: false })
      return user
    } catch {
      set({ user: null, loading: false })
      return null
    }
  },
  login: async (username, password) => {
    const user = await api.post<User>('/auth/login', { username, password })
    set({ user, loading: false })
    return user
  },
  logout: async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      set({ user: null })
      location.href = '/sign-in'
    }
  },
}))

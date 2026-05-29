interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

export const useAuthState = () => useState<AuthUser | null>('auth.user', () => null)

export function useAuth() {
  const user = useAuthState()

  async function fetchMe() {
    try {
      // useRequestFetch() forwards incoming request cookies during SSR.
      const fetch = useRequestFetch()
      const data = await fetch<AuthUser>('/api/auth/me')
      user.value = data
    }
    catch {
      user.value = null
    }
  }

  async function login(email: string, password: string) {
    const data = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = data.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return { user, fetchMe, login, logout }
}

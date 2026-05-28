export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchMe } = useAuth()

  if (user.value === null) {
    await fetchMe()
  }

  const isLoginPage = to.path === '/login'
  const authed = !!user.value

  if (!authed && !isLoginPage) {
    return navigateTo('/login')
  }
  if (authed && isLoginPage) {
    return navigateTo('/dashboard')
  }
})

import { authRepo } from '~/server/modules/auth/auth.repo'
import { getSessionToken } from '~/server/utils/http'

export default defineEventHandler(async (event) => {
  const token = getSessionToken(event)
  if (!token) {
    event.context.user = null
    return
  }
  const session = await authRepo.findValidSession(token)
  if (!session) {
    event.context.user = null
    return
  }
  event.context.user = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  }
})

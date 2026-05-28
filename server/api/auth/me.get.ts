import { authRepo } from '../../modules/auth/auth.repo'
import { requireAuth } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const actor = requireAuth(event)
  const user = await authRepo.findUserById(actor.id)
  if (!user) {
    return null
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    lastLoginAt: user.lastLoginAt,
  }
})

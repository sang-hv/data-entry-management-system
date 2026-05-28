import { logout } from '../../actions/auth/logout'
import {
  buildContext,
  clearSessionCookie,
  getSessionToken,
  toHttpError,
} from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    const ctx = buildContext(event)
    const token = getSessionToken(event)
    if (token) {
      await logout({ token }, ctx)
    }
    clearSessionCookie(event)
    return { ok: true }
  } catch (err) {
    toHttpError(err)
  }
})

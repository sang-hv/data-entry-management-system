import { login } from '../../actions/auth/login'
import { buildContext, setSessionCookie, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    const ctx = buildContext(event)
    const body = await readBody(event)
    const ipAddress = getRequestIP(event, { xForwardedFor: true })
    const userAgent = getHeader(event, 'user-agent')
    const result = await login({ ...body, ipAddress, userAgent }, ctx)
    setSessionCookie(event, result.token, result.expiresAt)
    return { user: result.user, expiresAt: result.expiresAt }
  } catch (err) {
    toHttpError(err)
  }
})

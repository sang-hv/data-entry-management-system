import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { UnauthorizedError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { authRepo } from '../../modules/auth/auth.repo'
import { verifyPassword } from '../../modules/auth/password'
import { generateSessionToken } from '../../modules/auth/session'

// Accept simple email like "admin@local" (no TLD required) for internal seed accounts.
// Pattern: <local>@<host> with at least one char on each side.
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+$/

export const LoginInput = z.object({
  email: z.string().regex(SIMPLE_EMAIL_RE, 'Invalid email').toLowerCase(),
  password: z.string().min(1),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
})
export type LoginInput = z.infer<typeof LoginInput>

export interface LoginOutput {
  token: string
  user: { id: string; email: string; name: string; role: string }
  expiresAt: Date
}

const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 7)

export async function login(
  rawInput: unknown,
  ctx: ActionContext,
): Promise<LoginOutput> {
  const input = LoginInput.parse(rawInput)

  const user = await authRepo.findUserByEmail(input.email)
  // Same error for missing user + wrong password to prevent enumeration.
  if (!user || !user.active) {
    throw new UnauthorizedError('Invalid credentials')
  }

  const ok = await verifyPassword(input.password, user.passwordHash)
  if (!ok) {
    throw new UnauthorizedError('Invalid credentials')
  }

  const token = generateSessionToken()
  const session = await authRepo.createSession({
    userId: user.id,
    token,
    ttlDays: TTL_DAYS,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })
  await authRepo.updateLastLoginAt(user.id)

  await auditRepo.write({
    actorId: user.id,
    source: ctx.source,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    before: null,
    after: { sessionId: session.id },
    requestId: ctx.requestId,
  })

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    expiresAt: session.expiresAt,
  }
}

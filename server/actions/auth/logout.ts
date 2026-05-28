import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { auditRepo } from '../../modules/audit/audit.repo'
import { authRepo } from '../../modules/auth/auth.repo'

export const LogoutInput = z.object({
  token: z.string().min(1),
})

export async function logout(
  rawInput: unknown,
  ctx: ActionContext,
): Promise<{ ok: true }> {
  const input = LogoutInput.parse(rawInput)
  await authRepo.deleteSession(input.token)

  if (ctx.actor) {
    await auditRepo.write({
      actorId: ctx.actor.id,
      source: ctx.source,
      action: 'auth.logout',
      entityType: 'User',
      entityId: ctx.actor.id,
      before: null,
      after: null,
      requestId: ctx.requestId,
    })
  }

  return { ok: true }
}

import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { styleRepo } from '../../modules/styles/style.repo'

export const UpdateStyleInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(5000).nullable().optional(),
    active: z.boolean().optional(),
  }),
})

export async function updateStyle(rawInput: unknown, ctx: ActionContext) {
  const input = UpdateStyleInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await styleRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Style', input.id)

  const updated = await styleRepo.update(input.id, input.patch)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'style.update',
    entityType: 'Style',
    entityId: updated.id,
    before: existing,
    after: updated,
    requestId: ctx.requestId,
  })

  return { style: updated }
}

import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { styleRepo } from '../../modules/styles/style.repo'

export const DeleteStyleInput = z.object({
  id: z.string().uuid(),
})

export async function deleteStyle(rawInput: unknown, ctx: ActionContext) {
  const input = DeleteStyleInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await styleRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Style', input.id)

  const refs = await styleRepo.countVariantOrders(input.id)
  if (refs > 0) {
    throw new ConflictError(
      `Style "${existing.code}" has ${refs} order(s) referencing its variant(s); cannot delete`,
      { references: refs },
    )
  }

  const deleted = await styleRepo.softDelete(input.id)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'style.delete',
    entityType: 'Style',
    entityId: deleted.id,
    before: existing,
    after: deleted,
    requestId: ctx.requestId,
  })

  return { ok: true as const }
}

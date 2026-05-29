import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { variantRepo } from '../../modules/styles/variant.repo'

export const DeleteStyleVariantInput = z.object({
  id: z.string().uuid(),
})

export async function deleteStyleVariant(rawInput: unknown, ctx: ActionContext) {
  const input = DeleteStyleVariantInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await variantRepo.findById(input.id)
  if (!existing) throw new NotFoundError('StyleVariant', input.id)

  const refs = await variantRepo.countOrders(input.id)
  if (refs > 0) {
    throw new ConflictError(
      `Variant "${existing.name}" is in use by ${refs} order(s); cannot delete`,
      { references: refs },
    )
  }

  const deleted = await variantRepo.softDelete(input.id)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'styleVariant.delete',
    entityType: 'StyleVariant',
    entityId: deleted.id,
    before: existing,
    after: deleted,
    requestId: ctx.requestId,
  })

  return { ok: true as const }
}

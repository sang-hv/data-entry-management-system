import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { sizeRepo } from '../../modules/sizes/size.repo'

export const DeleteSizeInput = z.object({
  id: z.string().uuid(),
})

export async function deleteSize(rawInput: unknown, ctx: ActionContext) {
  const input = DeleteSizeInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await sizeRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Size', input.id)

  const refs = await sizeRepo.countReferences(input.id)
  if (refs > 0) {
    throw new ConflictError(
      `Size "${existing.code}" is in use by ${refs} order item(s) or batch item(s); cannot delete`,
      { references: refs },
    )
  }

  const deleted = await sizeRepo.softDelete(input.id)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'size.delete',
    entityType: 'Size',
    entityId: deleted.id,
    before: existing,
    after: deleted,
    requestId: ctx.requestId,
  })

  return { ok: true as const }
}

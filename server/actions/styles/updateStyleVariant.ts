import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { variantRepo } from '../../modules/styles/variant.repo'

export const UpdateStyleVariantInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    color: z.string().max(64).nullable().optional(),
    imageUrl: z.string().max(2048).nullable().optional(),
    active: z.boolean().optional(),
  }),
})

export async function updateStyleVariant(rawInput: unknown, ctx: ActionContext) {
  const input = UpdateStyleVariantInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await variantRepo.findById(input.id)
  if (!existing) throw new NotFoundError('StyleVariant', input.id)

  // If renaming, check uniqueness within the style.
  if (input.patch.name && input.patch.name !== existing.name) {
    const dup = await variantRepo.findByStyleAndName(
      existing.styleId,
      input.patch.name,
    )
    if (dup) {
      throw new ConflictError(
        `Variant "${input.patch.name}" already exists for this style`,
      )
    }
  }

  const updated = await variantRepo.update(input.id, input.patch)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'styleVariant.update',
    entityType: 'StyleVariant',
    entityId: updated.id,
    before: existing,
    after: updated,
    requestId: ctx.requestId,
  })

  return { variant: updated }
}

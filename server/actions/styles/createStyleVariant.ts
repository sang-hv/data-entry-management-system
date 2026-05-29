import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, NotFoundError, ValidationError } from '../_base/errors'
import { withIdempotency } from '../_base/idempotency'
import { auditRepo } from '../../modules/audit/audit.repo'
import { styleRepo } from '../../modules/styles/style.repo'
import { variantRepo } from '../../modules/styles/variant.repo'

export const CreateStyleVariantInput = z.object({
  styleId: z.string().uuid(),
  name: z.string().min(1).max(255).trim(),
  color: z.string().max(64).optional(),
  imageUrl: z.string().max(2048).optional(),
})

export async function createStyleVariant(rawInput: unknown, ctx: ActionContext) {
  const input = CreateStyleVariantInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  return withIdempotency(ctx, 'styleVariant.create', async () => {
    const style = await styleRepo.findById(input.styleId)
    if (!style) throw new NotFoundError('Style', input.styleId)

    const existing = await variantRepo.findByStyleAndName(input.styleId, input.name)
    if (existing) {
      throw new ConflictError(
        `Variant "${input.name}" already exists for style "${style.code}"`,
      )
    }

    const variant = await variantRepo.create({
      styleId: input.styleId,
      name: input.name,
      color: input.color ?? null,
      imageUrl: input.imageUrl ?? null,
    })

    await auditRepo.write({
      actorId: ctx.actor!.id,
      source: ctx.source,
      action: 'styleVariant.create',
      entityType: 'StyleVariant',
      entityId: variant.id,
      before: null,
      after: variant,
      requestId: ctx.requestId,
    })

    return { variant }
  })
}

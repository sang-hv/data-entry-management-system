import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { sizeRepo } from '../../modules/sizes/size.repo'

export const UpdateSizeInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    label: z.string().min(1).max(64).optional(),
    order: z.number().int().min(0).max(10000).optional(),
    active: z.boolean().optional(),
  }),
})
export type UpdateSizeInput = z.infer<typeof UpdateSizeInput>

export async function updateSize(rawInput: unknown, ctx: ActionContext) {
  const input = UpdateSizeInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await sizeRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Size', input.id)

  const updated = await sizeRepo.update(input.id, input.patch)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'size.update',
    entityType: 'Size',
    entityId: updated.id,
    before: existing,
    after: updated,
    requestId: ctx.requestId,
  })

  return {
    size: {
      id: updated.id,
      code: updated.code,
      label: updated.label,
      order: updated.order,
      active: updated.active,
    },
  }
}

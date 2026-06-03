import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { batchRepo } from '../../modules/batches/batch.repo'

export const UpdateBatchInput = z.object({
  batchId: z.string().uuid(),
  patch: z.object({
    batchedAt: z.coerce.date().optional(),
    note: z.string().max(2000).nullable().optional(),
  }),
})
export type UpdateBatchInput = z.infer<typeof UpdateBatchInput>

export async function updateBatch(rawInput: unknown, ctx: ActionContext) {
  const input = UpdateBatchInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const batch = await batchRepo.findById(input.batchId)
  if (!batch) throw new NotFoundError('OrderBatch', input.batchId)

  const before = batch
  const updated = await batchRepo.updateMeta(input.batchId, {
    batchedAt: input.patch.batchedAt,
    note: input.patch.note,
  })

  await auditRepo.write({
    actorId: ctx.actor.id,
    source: ctx.source,
    action: 'batch.update',
    entityType: 'OrderBatch',
    entityId: input.batchId,
    before: { batchedAt: before.batchedAt, note: before.note },
    after: { batchedAt: updated.batchedAt, note: updated.note },
    requestId: ctx.requestId,
  })

  return { batch: updated }
}

import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { batchRepo } from '../../modules/batches/batch.repo'

export const DeleteBatchInput = z.object({
  batchId: z.string().uuid(),
})
export type DeleteBatchInput = z.infer<typeof DeleteBatchInput>

export async function deleteBatch(rawInput: unknown, ctx: ActionContext) {
  const input = DeleteBatchInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const batch = await batchRepo.findById(input.batchId)
  if (!batch) throw new NotFoundError('OrderBatch', input.batchId)

  await batchRepo.softDelete(input.batchId)

  await auditRepo.write({
    actorId: ctx.actor.id,
    source: ctx.source,
    action: 'batch.delete',
    entityType: 'OrderBatch',
    entityId: input.batchId,
    before: { batchNumber: batch.batchNumber, orderId: batch.orderId },
    after: { deletedAt: new Date() },
    requestId: ctx.requestId,
  })

  // TODO(M5): evaluateOrderAlerts(batch.orderId)

  return { success: true }
}

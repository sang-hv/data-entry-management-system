import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { batchRepo } from '../../modules/batches/batch.repo'
import { sizeRepo } from '../../modules/sizes/size.repo'
import { sumBatchQty } from '../../modules/orders/order.totals'
import { prisma } from '../../lib/prisma'

export const SetBatchItemsInput = z.object({
  batchId: z.string().uuid(),
  items: z.array(
    z.object({
      sizeId: z.string().uuid(),
      quantity: z.number().int().min(0),
    }),
  ),
})
export type SetBatchItemsInput = z.infer<typeof SetBatchItemsInput>

export async function setBatchItems(rawInput: unknown, ctx: ActionContext) {
  const input = SetBatchItemsInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const batch = await batchRepo.findById(input.batchId)
  if (!batch) throw new NotFoundError('OrderBatch', input.batchId)

  // Load parent order status to enforce CANCELLED guard
  const order = await prisma.order.findUnique({
    where: { id: batch.orderId },
    select: { status: true },
  })
  if (order?.status === 'CANCELLED') {
    throw new ValidationError('Cannot modify batches of a cancelled order')
  }

  if (input.items.length > 0) {
    const sizeIds = input.items.map((i) => i.sizeId)
    if (new Set(sizeIds).size !== sizeIds.length) {
      throw new ValidationError('Duplicate sizeId in batch items')
    }
    const sizes = await sizeRepo.findManyByIds(sizeIds)
    if (sizes.length !== sizeIds.length) {
      throw new ValidationError('Some sizeIds are invalid')
    }
  }

  const before = batch
  const updated = await batchRepo.replaceItems(input.batchId, input.items)

  await auditRepo.write({
    actorId: ctx.actor.id,
    source: ctx.source,
    action: 'batch.set_items',
    entityType: 'OrderBatch',
    entityId: input.batchId,
    before: { items: before.items },
    after: { items: updated?.items ?? [] },
    requestId: ctx.requestId,
  })

  // TODO(M5): evaluateOrderAlerts(batch.orderId)

  const total = sumBatchQty([updated!])
  return { batch: updated, total }
}

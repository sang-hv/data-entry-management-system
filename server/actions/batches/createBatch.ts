import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { batchRepo } from '../../modules/batches/batch.repo'
import { orderRepo } from '../../modules/orders/order.repo'
import { sizeRepo } from '../../modules/sizes/size.repo'
import { sumBatchQty } from '../../modules/orders/order.totals'
import { prisma } from '../../lib/prisma'

export const CreateBatchInput = z.object({
  orderId: z.string().uuid(),
  batchedAt: z.coerce.date().optional(),
  note: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        sizeId: z.string().uuid(),
        quantity: z.number().int().min(0),
      }),
    )
    .min(1, 'Batch must have at least one item'),
})
export type CreateBatchInput = z.infer<typeof CreateBatchInput>

export async function createBatch(rawInput: unknown, ctx: ActionContext) {
  const input = CreateBatchInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const order = await orderRepo.findById(input.orderId)
  if (!order) throw new NotFoundError('Order', input.orderId)
  if (order.status === 'CANCELLED') {
    throw new ValidationError('Cannot add batches to a cancelled order')
  }

  // Validate sizeIds — unique + all valid
  const sizeIds = input.items.map((i) => i.sizeId)
  if (new Set(sizeIds).size !== sizeIds.length) {
    throw new ValidationError('Duplicate sizeId in batch items')
  }
  const sizes = await sizeRepo.findManyByIds(sizeIds)
  if (sizes.length !== sizeIds.length) {
    throw new ValidationError('Some sizeIds are invalid')
  }

  // Create batch + items in a transaction (batchNumber is transactional)
  const batch = await prisma.$transaction(async (tx) => {
    const batchNumber = await batchRepo.nextBatchNumber(tx, input.orderId)
    return tx.orderBatch.create({
      data: {
        orderId: input.orderId,
        batchNumber,
        batchedAt: input.batchedAt ?? new Date(),
        note: input.note ?? null,
        items: {
          create: input.items.map((i) => ({
            sizeId: i.sizeId,
            quantity: i.quantity,
          })),
        },
      },
      include: {
        items: { include: { size: true }, orderBy: { size: { order: 'asc' } } },
      },
    })
  })

  const total = sumBatchQty([batch])

  await auditRepo.write({
    actorId: ctx.actor.id,
    source: ctx.source,
    action: 'batch.create',
    entityType: 'OrderBatch',
    entityId: batch.id,
    before: null,
    after: batch,
    requestId: ctx.requestId,
  })

  // TODO(M5): evaluateOrderAlerts(input.orderId)

  return { batch, total }
}

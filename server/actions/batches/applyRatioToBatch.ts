import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { batchRepo } from '../../modules/batches/batch.repo'
import { orderRepo } from '../../modules/orders/order.repo'
import { sumBatchQty } from '../../modules/orders/order.totals'
import { prisma } from '../../lib/prisma'

export const ApplyRatioToBatchInput = z.object({
  orderId: z.string().uuid(),
  multiplier: z.number().int().min(1).max(100000),
  /** If provided, update this existing batch instead of creating a new one. */
  batchNumber: z.number().int().min(1).optional(),
  batchedAt: z.coerce.date().optional(),
  note: z.string().max(2000).optional(),
})
export type ApplyRatioToBatchInput = z.infer<typeof ApplyRatioToBatchInput>

export async function applyRatioToBatch(rawInput: unknown, ctx: ActionContext) {
  const input = ApplyRatioToBatchInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const order = await orderRepo.findById(input.orderId)
  if (!order) throw new NotFoundError('Order', input.orderId)
  if (order.status === 'CANCELLED') {
    throw new ValidationError('Cannot add batches to a cancelled order')
  }

  // Only items with ratio > 0 are used
  const ratioItems = order.items.filter((i) => i.ratio > 0)
  if (ratioItems.length === 0) {
    throw new ValidationError('Order has no items with ratio — cannot generate batch quantities')
  }

  // Compute qty = ratio * multiplier for each size
  const computedItems = ratioItems.map((i) => ({
    sizeId: i.sizeId,
    quantity: i.ratio * input.multiplier,
  }))

  let batch
  let actionName: string

  if (input.batchNumber !== undefined) {
    // Update existing batch
    const existing = await batchRepo.findByOrderAndNumber(input.orderId, input.batchNumber)
    if (!existing) throw new NotFoundError(`Batch #${input.batchNumber} on Order`, input.orderId)

    const before = existing
    batch = await prisma.$transaction(async (tx) => {
      // Replace items
      await tx.batchItem.deleteMany({ where: { batchId: existing.id } })
      await tx.batchItem.createMany({
        data: computedItems.map((i) => ({ batchId: existing.id, ...i })),
      })
      // Update metadata if provided
      return tx.orderBatch.update({
        where: { id: existing.id },
        data: {
          ...(input.batchedAt !== undefined ? { batchedAt: input.batchedAt } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
        },
        include: {
          items: { include: { size: true }, orderBy: { size: { order: 'asc' } } },
        },
      })
    })

    actionName = 'batch.apply_ratio_update'
    await auditRepo.write({
      actorId: ctx.actor.id,
      source: ctx.source,
      action: actionName,
      entityType: 'OrderBatch',
      entityId: batch.id,
      before,
      after: batch,
      requestId: ctx.requestId,
    })
  }
  else {
    // Create new batch
    batch = await prisma.$transaction(async (tx) => {
      const batchNumber = await batchRepo.nextBatchNumber(tx, input.orderId)
      return tx.orderBatch.create({
        data: {
          orderId: input.orderId,
          batchNumber,
          batchedAt: input.batchedAt ?? new Date(),
          note: input.note ?? null,
          items: {
            create: computedItems,
          },
        },
        include: {
          items: { include: { size: true }, orderBy: { size: { order: 'asc' } } },
        },
      })
    })

    actionName = 'batch.apply_ratio_create'
    await auditRepo.write({
      actorId: ctx.actor.id,
      source: ctx.source,
      action: actionName,
      entityType: 'OrderBatch',
      entityId: batch.id,
      before: null,
      after: batch,
      requestId: ctx.requestId,
    })
  }

  const total = sumBatchQty([batch])

  // TODO(M5): evaluateOrderAlerts(input.orderId)

  return {
    batch,
    items: batch.items,
    total,
  }
}

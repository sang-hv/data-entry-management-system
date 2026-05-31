import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import {
  NotFoundError,
  OptimisticLockError,
  ValidationError,
} from '../_base/errors'
import { prisma } from '../../lib/prisma'
import { auditRepo } from '../../modules/audit/audit.repo'
import { orderRepo } from '../../modules/orders/order.repo'

export const CancelOrderInput = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(0),
  reason: z.string().max(2000).optional(),
})

export async function cancelOrder(rawInput: unknown, ctx: ActionContext) {
  const input = CancelOrderInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await orderRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Order', input.id)
  if (existing.status === 'CANCELLED') {
    throw new ValidationError('Order is already cancelled')
  }
  if (existing.status === 'COMPLETED') {
    throw new ValidationError('Cannot cancel a completed order')
  }

  const updated = await orderRepo.updateWithVersion(input.id, input.version, {
    status: 'CANCELLED',
  })
  if (!updated) throw new OptimisticLockError()

  // Write OrderUpdate history entry
  await prisma.orderUpdate.create({
    data: {
      orderId: input.id,
      fromStatus: existing.status,
      toStatus: 'CANCELLED',
      note: input.reason ?? null,
      createdById: ctx.actor!.id,
      source: ctx.source,
    },
  })

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'order.cancel',
    entityType: 'Order',
    entityId: updated.id,
    before: existing,
    after: updated,
    requestId: ctx.requestId,
  })

  return { order: updated }
}

import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { prisma } from '../../lib/prisma'
import { auditRepo } from '../../modules/audit/audit.repo'
import { orderRepo } from '../../modules/orders/order.repo'
import { sizeRepo } from '../../modules/sizes/size.repo'
import { evaluateOrderAlerts } from '../../modules/alerts/alert-engine'

export const SetOrderItemsInput = z.object({
  orderId: z.string().uuid(),
  items: z.array(
    z.object({
      sizeId: z.string().uuid(),
      ratio: z.number().int().min(0).default(0),
    }),
  ),
})

export async function setOrderItems(rawInput: unknown, ctx: ActionContext) {
  const input = SetOrderItemsInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const order = await orderRepo.findById(input.orderId)
  if (!order) throw new NotFoundError('Order', input.orderId)
  if (order.status === 'CANCELLED') {
    throw new ValidationError('Cannot set items on a cancelled order')
  }

  if (input.items.length > 0) {
    const sizeIds = input.items.map((i) => i.sizeId)
    if (new Set(sizeIds).size !== sizeIds.length) {
      throw new ValidationError('Duplicate sizeId in items')
    }
    const sizes = await sizeRepo.findManyByIds(sizeIds)
    if (sizes.length !== sizeIds.length) {
      throw new ValidationError('Some sizeIds are invalid')
    }
  }

  const before = order.items
  const newItems = await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: input.orderId } })
    if (input.items.length === 0) return []
    await tx.orderItem.createMany({
      data: input.items.map((i) => ({
        orderId: input.orderId,
        sizeId: i.sizeId,
        ratio: i.ratio,
      })),
    })
    return tx.orderItem.findMany({
      where: { orderId: input.orderId },
      include: { size: true },
    })
  })

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'order.set_items',
    entityType: 'Order',
    entityId: input.orderId,
    before: { items: before },
    after: { items: newItems },
    requestId: ctx.requestId,
  })

  evaluateOrderAlerts(input.orderId).catch(() => {})
  return { items: newItems }
}

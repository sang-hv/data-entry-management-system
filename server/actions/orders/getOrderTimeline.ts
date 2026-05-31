import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError } from '../_base/errors'
import { prisma } from '../../lib/prisma'
import { orderRepo } from '../../modules/orders/order.repo'

export const GetOrderTimelineInput = z.object({
  orderId: z.string().uuid(),
  limit: z.number().int().min(1).max(500).default(100),
})

export async function getOrderTimeline(rawInput: unknown, _ctx: ActionContext) {
  const input = GetOrderTimelineInput.parse(rawInput)

  const order = await orderRepo.findById(input.orderId)
  if (!order) throw new NotFoundError('Order', input.orderId)

  const updates = await prisma.orderUpdate.findMany({
    where: { orderId: input.orderId },
    orderBy: { createdAt: 'desc' },
    take: input.limit,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  })

  return { items: updates }
}

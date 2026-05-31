import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError } from '../_base/errors'
import { orderRepo } from '../../modules/orders/order.repo'

export const GetOrderByIdInput = z.object({
  id: z.string().uuid(),
})

export async function getOrderById(rawInput: unknown, _ctx: ActionContext) {
  const input = GetOrderByIdInput.parse(rawInput)
  const order = await orderRepo.findById(input.id)
  if (!order) throw new NotFoundError('Order', input.id)
  return { order }
}

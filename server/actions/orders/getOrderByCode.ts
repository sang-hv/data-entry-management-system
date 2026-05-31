import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError } from '../_base/errors'
import { orderRepo } from '../../modules/orders/order.repo'

export const GetOrderByCodeInput = z.object({
  code: z.string().min(3).max(32),
})

export async function getOrderByCode(rawInput: unknown, _ctx: ActionContext) {
  const input = GetOrderByCodeInput.parse(rawInput)
  const order = await orderRepo.findByCode(input.code)
  if (!order) throw new NotFoundError('Order', input.code)
  return { order }
}

import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { orderRepo } from '../../modules/orders/order.repo'

export const DeleteOrderInput = z.object({
  id: z.string().uuid(),
})

export async function deleteOrder(rawInput: unknown, ctx: ActionContext) {
  const input = DeleteOrderInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await orderRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Order', input.id)

  const deleted = await orderRepo.softDelete(input.id)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'order.delete',
    entityType: 'Order',
    entityId: deleted.id,
    before: existing,
    after: deleted,
    requestId: ctx.requestId,
  })

  return { ok: true as const }
}

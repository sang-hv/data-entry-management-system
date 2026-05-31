import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import {
  NotFoundError,
  OptimisticLockError,
  ValidationError,
} from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { orderRepo } from '../../modules/orders/order.repo'
import { variantRepo } from '../../modules/styles/variant.repo'

export const UpdateOrderInput = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(0),
  patch: z.object({
    styleVariantId: z.string().uuid().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    orderedAt: z.coerce.date().nullable().optional(),
    expectedAt: z.coerce.date().nullable().optional(),
    notes: z.string().max(10000).nullable().optional(),
  }),
})

export async function updateOrder(rawInput: unknown, ctx: ActionContext) {
  const input = UpdateOrderInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await orderRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Order', input.id)

  if (existing.status === 'CANCELLED') {
    throw new ValidationError('Cannot update a cancelled order')
  }

  if (input.patch.styleVariantId && input.patch.styleVariantId !== existing.styleVariantId) {
    const variant = await variantRepo.findById(input.patch.styleVariantId)
    if (!variant || variant.deletedAt) {
      throw new NotFoundError('StyleVariant', input.patch.styleVariantId)
    }
  }

  const newOrderedAt = input.patch.orderedAt !== undefined
    ? input.patch.orderedAt
    : existing.orderedAt
  const newExpectedAt = input.patch.expectedAt !== undefined
    ? input.patch.expectedAt
    : existing.expectedAt
  if (newExpectedAt && newOrderedAt && newExpectedAt < newOrderedAt) {
    throw new ValidationError('expectedAt must be after orderedAt')
  }

  const updated = await orderRepo.updateWithVersion(input.id, input.version, input.patch)
  if (!updated) throw new OptimisticLockError()

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'order.update',
    entityType: 'Order',
    entityId: updated.id,
    before: existing,
    after: updated,
    requestId: ctx.requestId,
  })

  return { order: updated }
}

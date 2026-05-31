import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { prisma } from '../../lib/prisma'
import { auditRepo } from '../../modules/audit/audit.repo'
import { orderTaskRepo } from '../../modules/order-tasks/orderTask.repo'
import { recomputeOrderStatusAndProgress } from '../../modules/order-tasks/recompute'

export const UpdateOrderTaskProgressInput = z.object({
  orderTaskId: z.string().uuid(),
  progressPct: z.number().int().min(0).max(100),
  notes: z.string().max(2000).optional(),
})

export async function updateOrderTaskProgress(rawInput: unknown, ctx: ActionContext) {
  const input = UpdateOrderTaskProgressInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const before = await orderTaskRepo.findById(input.orderTaskId)
  if (!before) throw new NotFoundError('OrderTask', input.orderTaskId)
  if (before.order.status === 'CANCELLED') {
    throw new ValidationError('Cannot update task on a cancelled order')
  }

  const startedAt = before.startedAt ?? (input.progressPct > 0 ? new Date() : null)
  const completedAt = input.progressPct >= 100
    ? (before.completedAt ?? new Date())
    : null

  const updated = await orderTaskRepo.update(input.orderTaskId, {
    progressPct: input.progressPct,
    notes: input.notes ?? before.notes,
    startedAt,
    completedAt,
  })

  const recomputed = await recomputeOrderStatusAndProgress(before.orderId)

  // Write OrderUpdate history if status changed.
  if (recomputed?.changed && recomputed.status !== before.order.status) {
    await prisma.orderUpdate.create({
      data: {
        orderId: before.orderId,
        fromStatus: before.order.status,
        toStatus: recomputed.status,
        note: `Task "${before.nameSnapshot}" → ${input.progressPct}%`,
        createdById: ctx.actor!.id,
        source: ctx.source,
      },
    })
  }

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'order.update_task_progress',
    entityType: 'OrderTask',
    entityId: updated.id,
    before: { progressPct: before.progressPct, orderStatus: before.order.status },
    after: {
      progressPct: updated.progressPct,
      orderStatus: recomputed?.status,
      orderProgressPct: recomputed?.progressPct,
    },
    requestId: ctx.requestId,
  })

  return {
    task: updated,
    order: {
      status: recomputed?.status ?? before.order.status,
      progressPct: recomputed?.progressPct ?? before.order.progressPct,
    },
  }
}

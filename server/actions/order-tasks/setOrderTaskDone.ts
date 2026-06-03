import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { prisma } from '../../lib/prisma'
import { auditRepo } from '../../modules/audit/audit.repo'
import { orderTaskRepo } from '../../modules/order-tasks/orderTask.repo'
import { recomputeOrderStatusAndProgress } from '../../modules/order-tasks/recompute'
import { evaluateOrderAlerts } from '../../modules/alerts/alert-engine'

export const SetOrderTaskDoneInput = z.object({
  orderTaskId: z.string().uuid(),
  done: z.boolean(),
  notes: z.string().max(2000).optional(),
})

export async function setOrderTaskDone(rawInput: unknown, ctx: ActionContext) {
  const input = SetOrderTaskDoneInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const before = await orderTaskRepo.findById(input.orderTaskId)
  if (!before) throw new NotFoundError('OrderTask', input.orderTaskId)
  if (before.order.status === 'CANCELLED') {
    throw new ValidationError('Cannot update task on a cancelled order')
  }

  const completedAt = input.done ? (before.completedAt ?? new Date()) : null

  const updated = await orderTaskRepo.update(input.orderTaskId, {
    done: input.done,
    notes: input.notes ?? before.notes,
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
        note: `Task "${before.nameSnapshot}" → ${input.done ? 'Hoàn thành' : 'Chưa xong'}`,
        createdById: ctx.actor!.id,
        source: ctx.source,
      },
    })
  }

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'order.set_task_done',
    entityType: 'OrderTask',
    entityId: updated.id,
    before: { done: before.done, orderStatus: before.order.status },
    after: {
      done: updated.done,
      orderStatus: recomputed?.status,
      orderProgressPct: recomputed?.progressPct,
    },
    requestId: ctx.requestId,
  })

  // Evaluate alerts (fire-and-forget — don't block response)
  evaluateOrderAlerts(before.orderId).catch(() => {})

  return {
    task: updated,
    order: {
      status: recomputed?.status ?? before.order.status,
      progressPct: recomputed?.progressPct ?? before.order.progressPct,
    },
  }
}

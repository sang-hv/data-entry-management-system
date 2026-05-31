import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { prisma } from '../../lib/prisma'
import { auditRepo } from '../../modules/audit/audit.repo'
import { orderRepo } from '../../modules/orders/order.repo'
import { recomputeOrderStatusAndProgress } from '../../modules/order-tasks/recompute'
import { taskRepo } from '../../modules/tasks/task.repo'

export const PickTasksForOrderInput = z.object({
  orderId: z.string().uuid(),
  // taskIds in the order they should appear (mảng có thể chứa cùng 1 taskId nhiều lần)
  taskIds: z.array(z.string().uuid()).min(1),
})

export async function pickTasksForOrder(rawInput: unknown, ctx: ActionContext) {
  const input = PickTasksForOrderInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const order = await orderRepo.findById(input.orderId)
  if (!order) throw new NotFoundError('Order', input.orderId)
  if (order.status === 'CANCELLED') {
    throw new ValidationError('Cannot pick tasks for a cancelled order')
  }

  // Validate all taskIds resolve (deduped lookup since same task may repeat).
  const uniqueIds = [...new Set(input.taskIds)]
  const tasks = await taskRepo.findManyByIds(uniqueIds)
  if (tasks.length !== uniqueIds.length) {
    throw new ValidationError('Some taskIds are invalid or inactive')
  }
  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  // Position increments by 10 to leave gaps for future reorder.
  const created = await prisma.$transaction(async (tx) => {
    // Find current max position for this order.
    const lastPos = await tx.orderTask.findFirst({
      where: { orderId: input.orderId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    let nextPos = (lastPos?.position ?? 0) + 10

    const rows = []
    for (const taskId of input.taskIds) {
      const task = taskMap.get(taskId)!
      const row = await tx.orderTask.create({
        data: {
          orderId: input.orderId,
          taskId: task.id,
          nameSnapshot: task.name,
          descriptionSnapshot: task.description,
          position: nextPos,
          progressPct: 0,
        },
      })
      rows.push(row)
      nextPos += 10
    }
    return rows
  })

  const recomputed = await recomputeOrderStatusAndProgress(input.orderId)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'order.pick_tasks',
    entityType: 'Order',
    entityId: input.orderId,
    before: { status: order.status, progressPct: order.progressPct },
    after: { status: recomputed?.status, progressPct: recomputed?.progressPct, picked: created.length },
    requestId: ctx.requestId,
  })

  return { tasks: created }
}

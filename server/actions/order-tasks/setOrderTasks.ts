import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { prisma } from '../../lib/prisma'
import { auditRepo } from '../../modules/audit/audit.repo'
import { orderRepo } from '../../modules/orders/order.repo'
import { recomputeOrderStatusAndProgress } from '../../modules/order-tasks/recompute'
import { taskRepo } from '../../modules/tasks/task.repo'

export const SetOrderTasksInput = z.object({
  orderId: z.string().uuid(),
  items: z.array(
    z.object({
      // id present → update existing OrderTask; absent → create new
      id: z.string().uuid().optional(),
      taskId: z.string().uuid().nullable(),
      nameSnapshot: z.string().min(1).max(255),
      descriptionSnapshot: z.string().max(5000).nullable().optional(),
      progressPct: z.number().int().min(0).max(100).default(0),
      notes: z.string().max(2000).nullable().optional(),
    }),
  ),
})

export async function setOrderTasks(rawInput: unknown, ctx: ActionContext) {
  const input = SetOrderTasksInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const order = await orderRepo.findById(input.orderId)
  if (!order) throw new NotFoundError('Order', input.orderId)
  if (order.status === 'CANCELLED') {
    throw new ValidationError('Cannot set tasks on a cancelled order')
  }

  // Validate referenced taskIds.
  const taskIds = [...new Set(input.items.map((i) => i.taskId).filter((x): x is string => !!x))]
  if (taskIds.length > 0) {
    const tasks = await taskRepo.findManyByIds(taskIds)
    if (tasks.length !== taskIds.length) {
      throw new ValidationError('Some taskIds are invalid or inactive')
    }
  }

  const before = await prisma.orderTask.findMany({
    where: { orderId: input.orderId },
  })
  const beforeIds = new Set(before.map((b) => b.id))
  const incomingIds = new Set(
    input.items.map((i) => i.id).filter((x): x is string => !!x),
  )

  // Position assigned by item index × 10.
  await prisma.$transaction(async (tx) => {
    // Delete OrderTasks not in incoming list.
    const idsToDelete = [...beforeIds].filter((id) => !incomingIds.has(id))
    if (idsToDelete.length > 0) {
      await tx.orderTask.deleteMany({
        where: { id: { in: idsToDelete } },
      })
    }

    // Upsert each item with new position.
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i]!
      const position = (i + 1) * 10

      if (item.id && beforeIds.has(item.id)) {
        // Update existing.
        const beforeTask = before.find((b) => b.id === item.id)!
        const startedAt = beforeTask.startedAt
          ?? (item.progressPct > 0 ? new Date() : null)
        const completedAt = item.progressPct >= 100
          ? (beforeTask.completedAt ?? new Date())
          : null
        await tx.orderTask.update({
          where: { id: item.id },
          data: {
            taskId: item.taskId,
            nameSnapshot: item.nameSnapshot,
            descriptionSnapshot: item.descriptionSnapshot ?? null,
            progressPct: item.progressPct,
            notes: item.notes ?? null,
            position,
            startedAt,
            completedAt,
          },
        })
      }
      else {
        // Create new.
        const startedAt = item.progressPct > 0 ? new Date() : null
        const completedAt = item.progressPct >= 100 ? new Date() : null
        await tx.orderTask.create({
          data: {
            orderId: input.orderId,
            taskId: item.taskId,
            nameSnapshot: item.nameSnapshot,
            descriptionSnapshot: item.descriptionSnapshot ?? null,
            progressPct: item.progressPct,
            notes: item.notes ?? null,
            position,
            startedAt,
            completedAt,
          },
        })
      }
    }
  })

  const recomputed = await recomputeOrderStatusAndProgress(input.orderId)
  const after = await prisma.orderTask.findMany({
    where: { orderId: input.orderId },
    orderBy: { position: 'asc' },
  })

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'order.set_tasks',
    entityType: 'Order',
    entityId: input.orderId,
    before: { tasks: before, status: order.status, progressPct: order.progressPct },
    after: { tasks: after, status: recomputed?.status, progressPct: recomputed?.progressPct },
    requestId: ctx.requestId,
  })

  return { tasks: after }
}

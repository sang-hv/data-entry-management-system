import { prisma } from '../../lib/prisma'
import {
  computeOrderProgress,
  computeOrderStatus,
} from '../orders/order.progress'

/**
 * Recompute Order.status (auto-derived) and Order.progressPct (cache)
 * from current OrderTask list.
 *
 * Skips if order is CANCELLED — terminal state, never auto-changes.
 *
 * Returns the resulting `{ status, progressPct }` (no DB write if order
 * is CANCELLED or no change needed).
 */
export async function recomputeOrderStatusAndProgress(orderId: string): Promise<{
  status: string
  progressPct: number
  changed: boolean
} | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return null
  if (order.status === 'CANCELLED') {
    return { status: order.status, progressPct: order.progressPct, changed: false }
  }

  const tasks = await prisma.orderTask.findMany({
    where: { orderId },
    select: { done: true },
  })
  const newStatus = computeOrderStatus(tasks)
  const newProgress = computeOrderProgress(tasks)

  const statusChanged = newStatus !== order.status
  const progressChanged = newProgress !== order.progressPct
  if (!statusChanged && !progressChanged) {
    return { status: order.status, progressPct: order.progressPct, changed: false }
  }

  // When transitioning to COMPLETED, set actualAt; when leaving COMPLETED, clear.
  let actualAt: Date | null | undefined = undefined
  if (statusChanged) {
    if (newStatus === 'COMPLETED') actualAt = new Date()
    else if (order.status === 'COMPLETED') actualAt = null
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: newStatus,
      progressPct: newProgress,
      ...(actualAt !== undefined ? { actualAt } : {}),
    },
  })

  return { status: newStatus, progressPct: newProgress, changed: true }
}

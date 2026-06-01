import type { OrderStatus } from '@prisma/client'

export interface OrderTaskMinimal {
  done: boolean
}

/**
 * Compute order status from current task done flags.
 * - DRAFT: no tasks picked yet.
 * - COMPLETED: every task is done.
 * - ACTIVE: has tasks, not all done.
 *
 * CANCELLED is never auto-derived — only set via cancelOrder action.
 */
export function computeOrderStatus(tasks: OrderTaskMinimal[]): OrderStatus {
  if (tasks.length === 0) return 'DRAFT'
  if (tasks.every((t) => t.done)) return 'COMPLETED'
  return 'ACTIVE'
}

/**
 * Compute completion ratio as a percentage of done tasks (rounded).
 * = round(doneCount / total * 100). Returns 0 if no tasks.
 */
export function computeOrderProgress(tasks: OrderTaskMinimal[]): number {
  if (tasks.length === 0) return 0
  const done = tasks.filter((t) => t.done).length
  return Math.round((done / tasks.length) * 100)
}

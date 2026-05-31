import type { OrderStatus } from '@prisma/client'

export interface OrderTaskMinimal {
  progressPct: number
}

/**
 * Compute order status from current task progress list.
 * - DRAFT: no tasks picked yet.
 * - COMPLETED: all tasks at 100%.
 * - ACTIVE: has tasks, not all complete.
 *
 * CANCELLED is never auto-derived — only set via cancelOrder action.
 */
export function computeOrderStatus(tasks: OrderTaskMinimal[]): OrderStatus {
  if (tasks.length === 0) return 'DRAFT'
  if (tasks.every((t) => t.progressPct >= 100)) return 'COMPLETED'
  return 'ACTIVE'
}

/**
 * Compute average progress across all tasks (rounded to nearest int).
 * Returns 0 if no tasks.
 */
export function computeOrderProgress(tasks: OrderTaskMinimal[]): number {
  if (tasks.length === 0) return 0
  const sum = tasks.reduce((acc, t) => acc + t.progressPct, 0)
  return Math.round(sum / tasks.length)
}

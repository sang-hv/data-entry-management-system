import { prisma } from '../../lib/prisma'
import { overdueRule } from './rules/overdue.rule'
import { dueSoon3dRule } from './rules/due-soon-3d.rule'
import { dueSoon7dRule } from './rules/due-soon-7d.rule'
import { missingDeadlineRule } from './rules/missing-deadline.rule'
import { noItemsRule } from './rules/no-items.rule'
import { noTasksRule } from './rules/no-tasks.rule'
import { staleOrderRule } from './rules/stale-order.rule'
import type { AlertRule } from './rules/_types'

const rules: AlertRule[] = [
  overdueRule,
  dueSoon3dRule,
  dueSoon7dRule,
  missingDeadlineRule,
  noItemsRule,
  noTasksRule,
  staleOrderRule,
]

export { rules }

/**
 * Run all alert rules for a single order and upsert / resolve alerts in DB.
 * Safe to call after every mutation — idempotent.
 */
export async function evaluateOrderAlerts(orderId: string, now = new Date()) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    include: {
      items: true,
      tasks: { select: { done: true } },
    },
  })
  if (!order) return

  // Build snapshot (no batch data needed for current rules)
  const snapshot = {
    id: order.id,
    status: order.status,
    expectedAt: order.expectedAt,
    orderedAt: order.orderedAt,
    actualAt: order.actualAt,
    updatedAt: order.updatedAt,
    items: order.items.map((i) => ({ sizeId: i.sizeId, ratio: i.ratio })),
    tasks: order.tasks.map((t) => ({ done: t.done })),
  }

  const matched = rules
    .map((r) => ({ rule: r, result: r.evaluate(snapshot, now) }))
    .filter((x): x is { rule: AlertRule; result: NonNullable<ReturnType<AlertRule['evaluate']>> } => x.result !== null)

  await prisma.$transaction(async (tx) => {
    // Upsert matched alerts (create or update message/snapshot)
    for (const { rule, result } of matched) {
      await tx.alert.upsert({
        where: {
          uniq_open_alert: { orderId, ruleCode: rule.code, status: 'OPEN' },
        },
        create: {
          orderId,
          ruleCode: rule.code,
          severity: rule.severity,
          message: result.message,
          dataSnapshot: result.dataSnapshot,
          status: 'OPEN',
        },
        update: {
          message: result.message,
          dataSnapshot: result.dataSnapshot,
          severity: rule.severity,
        },
      })
    }

    // Resolve open alerts for rules that no longer fire
    const matchedCodes = matched.map((m) => m.rule.code)
    await tx.alert.updateMany({
      where: {
        orderId,
        status: 'OPEN',
        ruleCode: { notIn: matchedCodes },
      },
      data: { status: 'RESOLVED', resolvedAt: now },
    })
  })
}

import type { ActionContext } from '../_base/context'
import { ValidationError } from '../_base/errors'
import { prisma } from '../../lib/prisma'

const MS_7D = 7 * 86400_000

export async function getDashboardStats(_rawInput: unknown, ctx: ActionContext) {
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const now = new Date()
  const in7d = new Date(now.getTime() + MS_7D)

  const [running, overdue, dueSoon, openAlerts, recentOrders] = await Promise.all([
    // Đơn đang chạy (ACTIVE)
    prisma.order.count({ where: { status: 'ACTIVE', deletedAt: null } }),

    // Đơn trễ deadline
    prisma.order.count({
      where: {
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        expectedAt: { lt: now },
      },
    }),

    // Sắp tới hạn trong 7 ngày (nhưng chưa trễ)
    prisma.order.count({
      where: {
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        expectedAt: { gte: now, lte: in7d },
      },
    }),

    // Open alerts
    prisma.alert.count({ where: { status: 'OPEN' } }),

    // 5 đơn cần chú ý: ACTIVE + sắp trễ hoặc có open alert
    prisma.order.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { expectedAt: { lte: in7d } },
          { alerts: { some: { status: 'OPEN', severity: { in: ['CRITICAL', 'WARN'] } } } },
        ],
      },
      orderBy: { expectedAt: 'asc' },
      take: 10,
      include: {
        styleVariant: { include: { style: true } },
        alerts: { where: { status: 'OPEN' }, orderBy: { severity: 'asc' }, take: 3 },
        _count: { select: { tasks: true } },
      },
    }),
  ])

  return {
    stats: { running, overdue, dueSoon, openAlerts },
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      progressPct: o.progressPct,
      expectedAt: o.expectedAt,
      styleCode: o.styleVariant.style.code,
      variantName: o.styleVariant.name,
      imageUrl: o.styleVariant.imageUrl,
      openAlertCount: o.alerts.length,
      topAlerts: o.alerts.map((a) => ({ severity: a.severity, ruleCode: a.ruleCode, message: a.message })),
    })),
  }
}

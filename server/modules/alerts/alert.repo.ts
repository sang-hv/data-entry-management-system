import type { AlertSeverity, AlertStatus, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export interface AlertListFilter {
  orderId?: string
  severity?: AlertSeverity[]
  status?: AlertStatus[]
  page?: number
  pageSize?: number
}

export const alertRepo = {
  async listActive(filter: AlertListFilter = {}) {
    const statuses: AlertStatus[] = filter.status?.length ? filter.status : ['OPEN']
    const where: Prisma.AlertWhereInput = { status: { in: statuses } }
    if (filter.orderId) where.orderId = filter.orderId
    if (filter.severity?.length) where.severity = { in: filter.severity }

    const page = filter.page ?? 1
    const pageSize = filter.pageSize ?? 50
    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { triggeredAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { order: { select: { code: true, styleVariant: { include: { style: true } } } } },
      }),
      prisma.alert.count({ where }),
    ])
    return { items, total, page, pageSize }
  },

  async findById(id: string) {
    return prisma.alert.findUnique({ where: { id } })
  },

  async dismiss(id: string, reason?: string) {
    return prisma.alert.update({
      where: { id },
      data: { status: 'DISMISSED', resolvedAt: new Date(), dismissedReason: reason ?? null },
    })
  },

  /** Count open alerts per orderId (for order detail badge) */
  async countOpenByOrder(orderId: string) {
    return prisma.alert.count({ where: { orderId, status: 'OPEN' } })
  },
}

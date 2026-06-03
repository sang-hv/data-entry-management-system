import type { OrderStatus, Prisma, Priority } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export interface OrderListFilter {
  q?: string
  status?: OrderStatus[]
  priority?: Priority[]
  styleVariantId?: string
  ownerId?: string
  orderedFrom?: Date
  orderedTo?: Date
  dueBefore?: Date
  dueAfter?: Date
  /** Nếu true: chỉ lấy đơn có expectedAt < now và status không phải COMPLETED/CANCELLED */
  overdue?: boolean
}

export interface OrderListPagination {
  page?: number
  pageSize?: number
  sort?: 'expectedAt' | 'orderedAt' | 'createdAt' | 'updatedAt' | 'priority'
  sortDir?: 'asc' | 'desc'
}

const orderInclude = {
  styleVariant: { include: { style: true } },
  items: { include: { size: true } },
  tasks: { orderBy: { position: 'asc' } as const },
  batches: { where: { deletedAt: null }, include: { items: true } },
  owner: { select: { id: true, email: true, name: true } },
} satisfies Prisma.OrderInclude

export const orderRepo = {
  async findById(id: string) {
    return prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: orderInclude,
    })
  },

  async findByCode(code: string) {
    return prisma.order.findFirst({
      where: { code, deletedAt: null },
      include: orderInclude,
    })
  },

  async list(filter: OrderListFilter = {}, pagination: OrderListPagination = {}) {
    const where: Prisma.OrderWhereInput = { deletedAt: null }

    if (filter.q && filter.q.trim()) {
      const q = filter.q.trim()
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { styleVariant: { name: { contains: q, mode: 'insensitive' } } },
        { styleVariant: { style: { code: { contains: q, mode: 'insensitive' } } } },
        { styleVariant: { style: { name: { contains: q, mode: 'insensitive' } } } },
      ]
    }
    if (filter.status?.length) where.status = { in: filter.status }
    if (filter.priority?.length) where.priority = { in: filter.priority }
    if (filter.styleVariantId) where.styleVariantId = filter.styleVariantId
    if (filter.ownerId) where.ownerId = filter.ownerId
    if (filter.overdue) {
      where.expectedAt = { lt: new Date() }
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] }
    }
    if (filter.orderedFrom || filter.orderedTo) {
      where.orderedAt = {}
      if (filter.orderedFrom) where.orderedAt.gte = filter.orderedFrom
      if (filter.orderedTo) where.orderedAt.lte = filter.orderedTo
    }
    if (filter.dueBefore || filter.dueAfter) {
      where.expectedAt = {}
      if (filter.dueAfter) where.expectedAt.gte = filter.dueAfter
      if (filter.dueBefore) where.expectedAt.lte = filter.dueBefore
    }

    const sort = pagination.sort ?? 'orderedAt'
    const sortDir = pagination.sortDir ?? 'desc'
    const page = pagination.page ?? 1
    const pageSize = pagination.pageSize ?? 20

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: [{ [sort]: sortDir }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          styleVariant: { include: { style: true } },
          owner: { select: { id: true, email: true, name: true } },
          _count: {
            select: { tasks: true, items: true, batches: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ])
    return { items, total, page, pageSize }
  },

  async create(data: {
    code: string
    styleVariantId: string
    ownerId: string
    orderedAt: Date | null
    expectedAt: Date | null
    priority: Priority
    notes: string | null
  }) {
    return prisma.order.create({ data })
  },

  /**
   * Update order. Implements optimistic locking via the `version` field:
   * the update only succeeds if the row's current version matches
   * `expectedVersion`. Returns null if mismatch or row missing.
   */
  async updateWithVersion(
    id: string,
    expectedVersion: number,
    patch: Prisma.OrderUpdateInput,
  ) {
    const result = await prisma.order.updateMany({
      where: { id, version: expectedVersion, deletedAt: null },
      data: { ...patch, version: { increment: 1 } },
    })
    if (result.count === 0) return null
    return prisma.order.findUnique({ where: { id } })
  },

  /**
   * Bypass-version update — used by internal recompute (status/progress
   * cache) to avoid bumping version every time a task progress changes.
   */
  async updateInternal(id: string, patch: Prisma.OrderUpdateInput) {
    return prisma.order.update({ where: { id }, data: patch })
  },

  async softDelete(id: string) {
    return prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  },
}

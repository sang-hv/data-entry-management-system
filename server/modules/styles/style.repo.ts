import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export interface StyleListOptions {
  q?: string
  activeOnly?: boolean
  limit?: number
  offset?: number
}

export const styleRepo = {
  async findById(id: string) {
    return prisma.style.findFirst({
      where: { id, deletedAt: null },
      include: {
        variants: {
          where: { deletedAt: null },
          orderBy: [{ name: 'asc' }],
        },
      },
    })
  },

  async findByCode(code: string) {
    return prisma.style.findFirst({ where: { code, deletedAt: null } })
  },

  async list(opts: StyleListOptions = {}) {
    const where: Prisma.StyleWhereInput = { deletedAt: null }
    if (opts.activeOnly !== false) where.active = true
    if (opts.q && opts.q.trim()) {
      const q = opts.q.trim()
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.style.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
        include: {
          variants: {
            where: { deletedAt: null },
            orderBy: [{ name: 'asc' }],
            take: 1, // first variant for thumbnail
          },
          _count: {
            select: {
              variants: { where: { deletedAt: null } },
            },
          },
        },
      }),
      prisma.style.count({ where }),
    ])
    return { items, total }
  },

  async create(data: { code: string, name: string, description?: string | null }) {
    return prisma.style.create({ data })
  },

  async update(
    id: string,
    patch: Partial<{ name: string, description: string | null, active: boolean }>,
  ) {
    return prisma.style.update({ where: { id }, data: patch })
  },

  async softDelete(id: string) {
    return prisma.style.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    })
  },

  async countVariantOrders(styleId: string) {
    // Count orders that reference any variant of this style (excluding soft-deleted).
    return prisma.order.count({
      where: {
        deletedAt: null,
        styleVariant: { styleId },
      },
    })
  },
}

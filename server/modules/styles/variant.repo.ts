import { prisma } from '../../lib/prisma'

export const variantRepo = {
  async findById(id: string) {
    return prisma.styleVariant.findFirst({
      where: { id, deletedAt: null },
      include: { style: true },
    })
  },

  async findByStyleAndName(styleId: string, name: string) {
    return prisma.styleVariant.findFirst({
      where: { styleId, name, deletedAt: null },
    })
  },

  async listByStyle(styleId: string, activeOnly = true) {
    const where = activeOnly
      ? { styleId, deletedAt: null, active: true }
      : { styleId, deletedAt: null }
    return prisma.styleVariant.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    })
  },

  async create(data: {
    styleId: string
    name: string
    color?: string | null
    imageUrl?: string | null
  }) {
    return prisma.styleVariant.create({ data })
  },

  async update(
    id: string,
    patch: Partial<{
      name: string
      color: string | null
      imageUrl: string | null
      active: boolean
    }>,
  ) {
    return prisma.styleVariant.update({ where: { id }, data: patch })
  },

  async softDelete(id: string) {
    return prisma.styleVariant.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    })
  },

  async countOrders(variantId: string) {
    return prisma.order.count({
      where: { styleVariantId: variantId, deletedAt: null },
    })
  },
}

import { prisma } from '../../lib/prisma'

export interface SizeListOptions {
  activeOnly?: boolean
}

export const sizeRepo = {
  async findById(id: string) {
    return prisma.size.findFirst({ where: { id, deletedAt: null } })
  },

  async findByCode(code: string) {
    return prisma.size.findFirst({ where: { code, deletedAt: null } })
  },

  async findManyByIds(ids: string[]) {
    return prisma.size.findMany({
      where: { id: { in: ids }, deletedAt: null },
    })
  },

  async list(opts: SizeListOptions = {}) {
    const where = opts.activeOnly === false
      ? { deletedAt: null }
      : { deletedAt: null, active: true }
    return prisma.size.findMany({
      where,
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
    })
  },

  async create(data: { code: string, label: string, order: number }) {
    return prisma.size.create({ data })
  },

  async update(id: string, patch: Partial<{ label: string, order: number, active: boolean }>) {
    return prisma.size.update({ where: { id }, data: patch })
  },

  async softDelete(id: string) {
    return prisma.size.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    })
  },

  async countReferences(id: string) {
    const [orderItems, batchItems] = await Promise.all([
      prisma.orderItem.count({ where: { sizeId: id } }),
      prisma.batchItem.count({ where: { sizeId: id } }),
    ])
    return orderItems + batchItems
  },
}

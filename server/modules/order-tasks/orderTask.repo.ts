import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export const orderTaskRepo = {
  async findById(id: string) {
    return prisma.orderTask.findUnique({
      where: { id },
      include: { order: true, task: true },
    })
  },

  async listByOrder(orderId: string) {
    return prisma.orderTask.findMany({
      where: { orderId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
  },

  async update(
    id: string,
    patch: Prisma.OrderTaskUpdateInput,
  ) {
    return prisma.orderTask.update({ where: { id }, data: patch })
  },
}

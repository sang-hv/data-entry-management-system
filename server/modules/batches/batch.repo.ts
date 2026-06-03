import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../../lib/prisma'

const batchInclude = {
  items: {
    include: { size: true },
    orderBy: { size: { order: 'asc' } } as const,
  },
} satisfies Prisma.OrderBatchInclude

export const batchRepo = {
  async findById(id: string) {
    return prisma.orderBatch.findFirst({
      where: { id, deletedAt: null },
      include: batchInclude,
    })
  },

  async findByOrderAndNumber(orderId: string, batchNumber: number) {
    return prisma.orderBatch.findFirst({
      where: { orderId, batchNumber, deletedAt: null },
      include: batchInclude,
    })
  },

  async listByOrder(orderId: string) {
    return prisma.orderBatch.findMany({
      where: { orderId, deletedAt: null },
      include: batchInclude,
      orderBy: { batchNumber: 'asc' },
    })
  },

  /**
   * Get next available batchNumber for an order.
   * Counts ALL batches (including soft-deleted) to avoid reuse and unique violations.
   * Must be called within a transaction to be safe under concurrent requests.
   */
  async nextBatchNumber(
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    orderId: string,
  ): Promise<number> {
    const agg = await tx.orderBatch.aggregate({
      where: { orderId },
      _max: { batchNumber: true },
    })
    return (agg._max.batchNumber ?? 0) + 1
  },

  async createWithItems(data: {
    orderId: string
    batchNumber: number
    batchedAt?: Date
    note?: string | null
    items: Array<{ sizeId: string; quantity: number }>
  }) {
    return prisma.orderBatch.create({
      data: {
        orderId: data.orderId,
        batchNumber: data.batchNumber,
        batchedAt: data.batchedAt ?? new Date(),
        note: data.note ?? null,
        items: {
          create: data.items.map((i) => ({
            sizeId: i.sizeId,
            quantity: i.quantity,
          })),
        },
      },
      include: batchInclude,
    })
  },

  async updateMeta(
    id: string,
    patch: { batchedAt?: Date; note?: string | null },
  ) {
    return prisma.orderBatch.update({
      where: { id },
      data: {
        ...(patch.batchedAt !== undefined ? { batchedAt: patch.batchedAt } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
      },
      include: batchInclude,
    })
  },

  /**
   * Replace all BatchItems for a batch in a single transaction.
   */
  async replaceItems(
    batchId: string,
    items: Array<{ sizeId: string; quantity: number }>,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.batchItem.deleteMany({ where: { batchId } })
      if (items.length > 0) {
        await tx.batchItem.createMany({
          data: items.map((i) => ({ batchId, sizeId: i.sizeId, quantity: i.quantity })),
        })
      }
      return tx.orderBatch.findUnique({
        where: { id: batchId },
        include: batchInclude,
      })
    })
  },

  async softDelete(id: string) {
    return prisma.orderBatch.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  },
}

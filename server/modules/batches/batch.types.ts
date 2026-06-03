import type { BatchItem, OrderBatch, Size } from '@prisma/client'

export type BatchItemWithSize = BatchItem & { size: Size }

export type BatchWithItems = OrderBatch & {
  items: BatchItemWithSize[]
}

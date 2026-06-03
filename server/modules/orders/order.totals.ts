/**
 * Computed totals helpers for orders — nothing is stored in DB (Rule #9).
 * All functions work on in-memory batch/item data already loaded.
 */

export interface BatchLike {
  deletedAt: Date | string | null
  items: Array<{ sizeId: string; quantity: number }>
}

/**
 * Sum qty across all non-deleted batches of an order.
 */
export function sumBatchQty(batches: BatchLike[]): number {
  return batches
    .filter((b) => !b.deletedAt)
    .flatMap((b) => b.items)
    .reduce((sum, i) => sum + i.quantity, 0)
}

/**
 * Sum qty per size (sizeId → total quantity) across all non-deleted batches.
 */
export function sumBatchItemsBySize(batches: BatchLike[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const batch of batches) {
    if (batch.deletedAt) continue
    for (const item of batch.items) {
      result[item.sizeId] = (result[item.sizeId] ?? 0) + item.quantity
    }
  }
  return result
}

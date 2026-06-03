import { describe, expect, it } from 'vitest'
import { sumBatchItemsBySize, sumBatchQty } from '~/server/modules/orders/order.totals'

const makeItem = (sizeId: string, quantity: number) => ({ sizeId, quantity })

const makeBatch = (
  items: Array<{ sizeId: string; quantity: number }>,
  deleted = false,
) => ({
  deletedAt: deleted ? new Date() : null,
  items,
})

describe('order.totals', () => {
  describe('sumBatchQty', () => {
    it('returns 0 for empty batches array', () => {
      expect(sumBatchQty([])).toBe(0)
    })

    it('sums items across a single batch', () => {
      const batch = makeBatch([
        makeItem('s1', 24),
        makeItem('s2', 24),
        makeItem('s3', 16),
        makeItem('s4', 8),
        makeItem('s5', 8),
      ])
      expect(sumBatchQty([batch])).toBe(80)
    })

    it('sums across multiple batches', () => {
      const b1 = makeBatch([makeItem('s1', 24), makeItem('s2', 24), makeItem('s3', 16), makeItem('s4', 8), makeItem('s5', 8)])
      const b2 = makeBatch([makeItem('s1', 30), makeItem('s2', 30), makeItem('s3', 20), makeItem('s4', 10), makeItem('s5', 10)])
      expect(sumBatchQty([b1, b2])).toBe(180)
    })

    it('excludes soft-deleted batches', () => {
      const active = makeBatch([makeItem('s1', 80)])
      const deleted = makeBatch([makeItem('s1', 100)], true)
      expect(sumBatchQty([active, deleted])).toBe(80)
    })
  })

  describe('sumBatchItemsBySize', () => {
    it('returns empty object for no batches', () => {
      expect(sumBatchItemsBySize([])).toEqual({})
    })

    it('aggregates qty by sizeId across batches', () => {
      const b1 = makeBatch([makeItem('s1', 24), makeItem('s2', 16)])
      const b2 = makeBatch([makeItem('s1', 6), makeItem('s2', 4)])
      expect(sumBatchItemsBySize([b1, b2])).toEqual({ s1: 30, s2: 20 })
    })

    it('excludes soft-deleted batches', () => {
      const active = makeBatch([makeItem('s1', 80)])
      const deleted = makeBatch([makeItem('s1', 100)], true)
      expect(sumBatchItemsBySize([active, deleted])).toEqual({ s1: 80 })
    })
  })
})

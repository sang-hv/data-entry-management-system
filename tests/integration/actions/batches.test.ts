import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { applyRatioToBatch } from '~/server/actions/batches/applyRatioToBatch'
import { createBatch } from '~/server/actions/batches/createBatch'
import { deleteBatch } from '~/server/actions/batches/deleteBatch'
import { setBatchItems } from '~/server/actions/batches/setBatchItems'
import { updateBatch } from '~/server/actions/batches/updateBatch'
import { createOrder } from '~/server/actions/orders/createOrder'
import { setOrderItems } from '~/server/actions/orders/setOrderItems'
import { prisma } from '~/server/lib/prisma'
import { ensureTestAdmin, resetDb } from '../../helpers/db'

const baseCtx: ActionContext = { actor: null, source: 'ui', requestId: 'req-test' }

async function setupOrderWithItems() {
  const u = await ensureTestAdmin()
  const ctx: ActionContext = {
    ...baseCtx,
    actor: { id: u.id, email: u.email, role: u.role },
  }
  const style = await prisma.style.create({ data: { code: 'AO083', name: 'Áo polo' } })
  const variant = await prisma.styleVariant.create({ data: { styleId: style.id, name: 'TRANG KE XANH' } })
  const sizes = await Promise.all([
    prisma.size.create({ data: { code: 'S', label: 'Áo S', order: 10 } }),
    prisma.size.create({ data: { code: 'M', label: 'Áo M', order: 20 } }),
    prisma.size.create({ data: { code: 'L', label: 'Áo L', order: 30 } }),
    prisma.size.create({ data: { code: 'XL', label: 'Áo XL', order: 40 } }),
    prisma.size.create({ data: { code: 'XXL', label: 'Áo XXL', order: 50 } }),
  ])
  const [S, M, L, XL, XXL] = sizes as [typeof sizes[0], typeof sizes[0], typeof sizes[0], typeof sizes[0], typeof sizes[0]]

  const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
  await setOrderItems(
    {
      orderId: order.id,
      items: [
        { sizeId: S.id, ratio: 3 },
        { sizeId: M.id, ratio: 3 },
        { sizeId: L.id, ratio: 2 },
        { sizeId: XL.id, ratio: 1 },
        { sizeId: XXL.id, ratio: 1 },
      ],
    },
    ctx,
  )
  return { ctx, orderId: order.id, sizes: { S, M, L, XL, XXL } }
}

describe('batches actions', () => {
  beforeEach(async () => {
    await resetDb()
  })

  // ─── applyRatioToBatch ──────────────────────────────────────────────────────

  describe('applyRatioToBatch', () => {
    it('creates batch #1 with correct qty (multiplier=8) → total 80', async () => {
      const { ctx, orderId } = await setupOrderWithItems()
      const result = await applyRatioToBatch({ orderId, multiplier: 8 }, ctx)

      expect(result.batch.batchNumber).toBe(1)
      expect(result.total).toBe(80)

      const qtys = result.items.map((i) => i.quantity).sort((a, b) => b - a)
      expect(qtys).toEqual([24, 24, 16, 8, 8])
    })

    it('creates batch #2 with multiplier=10 → total 100', async () => {
      const { ctx, orderId } = await setupOrderWithItems()
      await applyRatioToBatch({ orderId, multiplier: 8 }, ctx)
      const result = await applyRatioToBatch({ orderId, multiplier: 10 }, ctx)

      expect(result.batch.batchNumber).toBe(2)
      expect(result.total).toBe(100)
    })

    it('updates existing batch (batchNumber=1) instead of creating new', async () => {
      const { ctx, orderId } = await setupOrderWithItems()
      await applyRatioToBatch({ orderId, multiplier: 8 }, ctx)
      await applyRatioToBatch({ orderId, multiplier: 5, batchNumber: 1 }, ctx)

      const all = await prisma.orderBatch.findMany({ where: { orderId } })
      expect(all).toHaveLength(1)
      expect(all[0]!.batchNumber).toBe(1)

      const items = await prisma.batchItem.findMany({ where: { batchId: all[0]!.id } })
      const total = items.reduce((s, i) => s + i.quantity, 0)
      expect(total).toBe(50) // (3+3+2+1+1) * 5
    })

    it('throws ValidationError for order with no ratio items', async () => {
      const u = await ensureTestAdmin()
      const ctx: ActionContext = { ...baseCtx, actor: { id: u.id, email: u.email, role: u.role } }
      const style = await prisma.style.create({ data: { code: 'AO000', name: 'Test' } })
      const variant = await prisma.styleVariant.create({ data: { styleId: style.id, name: 'V1' } })
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      // No items set → no ratios

      await expect(
        applyRatioToBatch({ orderId: order.id, multiplier: 8 }, ctx),
      ).rejects.toThrow(/no items with ratio/i)
    })

    it('throws ValidationError for cancelled order', async () => {
      const { ctx, orderId } = await setupOrderWithItems()
      await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } })

      await expect(
        applyRatioToBatch({ orderId, multiplier: 8 }, ctx),
      ).rejects.toThrow(/cancelled/i)
    })

    it('writes an audit log entry', async () => {
      const { ctx, orderId } = await setupOrderWithItems()
      await applyRatioToBatch({ orderId, multiplier: 8 }, ctx)

      const log = await prisma.auditLog.findFirst({
        where: { action: 'batch.apply_ratio_create', entityType: 'OrderBatch' },
      })
      expect(log).not.toBeNull()
      expect(log!.actorId).toBe(ctx.actor!.id)
    })
  })

  // ─── createBatch ────────────────────────────────────────────────────────────

  describe('createBatch', () => {
    it('creates batch with manual qty, batchNumber increments', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()

      const r1 = await createBatch({
        orderId,
        items: [
          { sizeId: sizes.S.id, quantity: 10 },
          { sizeId: sizes.M.id, quantity: 10 },
        ],
      }, ctx)
      expect(r1.batch.batchNumber).toBe(1)
      expect(r1.total).toBe(20)

      const r2 = await createBatch({
        orderId,
        items: [{ sizeId: sizes.L.id, quantity: 5 }],
      }, ctx)
      expect(r2.batch.batchNumber).toBe(2)
    })

    it('throws on duplicate sizeId in items', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      await expect(
        createBatch({
          orderId,
          items: [
            { sizeId: sizes.S.id, quantity: 10 },
            { sizeId: sizes.S.id, quantity: 5 },
          ],
        }, ctx),
      ).rejects.toThrow(/duplicate/i)
    })

    it('throws on cancelled order', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } })
      await expect(
        createBatch({ orderId, items: [{ sizeId: sizes.S.id, quantity: 1 }] }, ctx),
      ).rejects.toThrow(/cancelled/i)
    })

    it('writes audit log entry', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      await createBatch({ orderId, items: [{ sizeId: sizes.S.id, quantity: 1 }] }, ctx)

      const log = await prisma.auditLog.findFirst({ where: { action: 'batch.create' } })
      expect(log).not.toBeNull()
    })
  })

  // ─── setBatchItems ──────────────────────────────────────────────────────────

  describe('setBatchItems', () => {
    it('replaces items in batch', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      const { batch } = await createBatch({
        orderId,
        items: [{ sizeId: sizes.S.id, quantity: 10 }],
      }, ctx)

      const result = await setBatchItems({
        batchId: batch.id,
        items: [
          { sizeId: sizes.M.id, quantity: 30 },
          { sizeId: sizes.L.id, quantity: 20 },
        ],
      }, ctx)

      expect(result.total).toBe(50)
      expect(result.batch?.items).toHaveLength(2)
    })

    it('throws on duplicate sizeId', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      const { batch } = await createBatch({ orderId, items: [{ sizeId: sizes.S.id, quantity: 1 }] }, ctx)

      await expect(
        setBatchItems({
          batchId: batch.id,
          items: [
            { sizeId: sizes.M.id, quantity: 1 },
            { sizeId: sizes.M.id, quantity: 2 },
          ],
        }, ctx),
      ).rejects.toThrow(/duplicate/i)
    })
  })

  // ─── updateBatch ────────────────────────────────────────────────────────────

  describe('updateBatch', () => {
    it('updates note and batchedAt', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      const { batch } = await createBatch({ orderId, items: [{ sizeId: sizes.S.id, quantity: 1 }] }, ctx)

      const newDate = new Date('2026-06-01')
      const result = await updateBatch({
        batchId: batch.id,
        patch: { note: 'Test note', batchedAt: newDate },
      }, ctx)

      expect(result.batch.note).toBe('Test note')
      expect(new Date(result.batch.batchedAt).toDateString()).toBe(newDate.toDateString())
    })

    it('writes audit log', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      const { batch } = await createBatch({ orderId, items: [{ sizeId: sizes.S.id, quantity: 1 }] }, ctx)
      await updateBatch({ batchId: batch.id, patch: { note: 'x' } }, ctx)

      const log = await prisma.auditLog.findFirst({ where: { action: 'batch.update' } })
      expect(log).not.toBeNull()
    })
  })

  // ─── deleteBatch ────────────────────────────────────────────────────────────

  describe('deleteBatch', () => {
    it('soft-deletes batch (row persists with deletedAt set)', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      const { batch } = await createBatch({ orderId, items: [{ sizeId: sizes.S.id, quantity: 1 }] }, ctx)

      await deleteBatch({ batchId: batch.id }, ctx)

      // findById (which filters deletedAt=null) returns null
      const { batchRepo } = await import('~/server/modules/batches/batch.repo')
      expect(await batchRepo.findById(batch.id)).toBeNull()

      // but raw row still exists
      const raw = await prisma.orderBatch.findUnique({ where: { id: batch.id } })
      expect(raw).not.toBeNull()
      expect(raw!.deletedAt).not.toBeNull()
    })

    it('batchNumber is not reused after soft-delete', async () => {
      const { ctx, orderId, sizes } = await setupOrderWithItems()
      const { batch: b1 } = await createBatch({ orderId, items: [{ sizeId: sizes.S.id, quantity: 1 }] }, ctx)
      await deleteBatch({ batchId: b1.id }, ctx)

      const { batch: b2 } = await createBatch({ orderId, items: [{ sizeId: sizes.M.id, quantity: 1 }] }, ctx)
      expect(b2.batchNumber).toBe(2) // not 1
    })

    it('order total excludes deleted batches', async () => {
      const { ctx, orderId } = await setupOrderWithItems()
      const { batch: b1 } = await applyRatioToBatch({ orderId, multiplier: 8 }, ctx) // total 80
      const { batch: b2 } = await applyRatioToBatch({ orderId, multiplier: 10 }, ctx) // total 100
      // total order = 180
      await deleteBatch({ batchId: b2.id }, ctx)

      const order = await prisma.orderBatch.findMany({ where: { orderId, deletedAt: null }, include: { items: true } })
      const { sumBatchQty } = await import('~/server/modules/orders/order.totals')
      expect(sumBatchQty(order)).toBe(80)
      // keep b1 referenced to avoid unused-var lint
      expect(b1.batchNumber).toBe(1)
    })
  })

  // ─── happy path (acceptance criteria) ────────────────────────────────────

  describe('full happy path', () => {
    it('ratio [3,3,2,1,1] × 8 → batch total 80; × 10 → 100; order total = 180', async () => {
      const { ctx, orderId } = await setupOrderWithItems()

      const r1 = await applyRatioToBatch({ orderId, multiplier: 8 }, ctx)
      expect(r1.total).toBe(80)
      expect(r1.batch.batchNumber).toBe(1)

      const r2 = await applyRatioToBatch({ orderId, multiplier: 10 }, ctx)
      expect(r2.total).toBe(100)
      expect(r2.batch.batchNumber).toBe(2)

      const allBatches = await prisma.orderBatch.findMany({
        where: { orderId, deletedAt: null },
        include: { items: true },
      })
      const { sumBatchQty } = await import('~/server/modules/orders/order.totals')
      expect(sumBatchQty(allBatches)).toBe(180)
    })
  })
})

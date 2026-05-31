import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { cancelOrder } from '~/server/actions/orders/cancelOrder'
import { createOrder } from '~/server/actions/orders/createOrder'
import { deleteOrder } from '~/server/actions/orders/deleteOrder'
import { getOrderByCode } from '~/server/actions/orders/getOrderByCode'
import { getOrderById } from '~/server/actions/orders/getOrderById'
import { getOrderTimeline } from '~/server/actions/orders/getOrderTimeline'
import { searchOrders } from '~/server/actions/orders/searchOrders'
import { setOrderItems } from '~/server/actions/orders/setOrderItems'
import { updateOrder } from '~/server/actions/orders/updateOrder'
import { prisma } from '~/server/lib/prisma'
import { ensureTestAdmin, resetDb } from '../../helpers/db'

const baseCtx: ActionContext = { actor: null, source: 'ui', requestId: 'req-test' }

async function setupFixtures() {
  const u = await ensureTestAdmin()
  const ctx: ActionContext = {
    ...baseCtx,
    actor: { id: u.id, email: u.email, role: u.role },
  }
  const style = await prisma.style.create({
    data: { code: 'AO083', name: 'Áo polo' },
  })
  const variant = await prisma.styleVariant.create({
    data: { styleId: style.id, name: 'TRANG KE XANH' },
  })
  const sizes = await Promise.all([
    prisma.size.create({ data: { code: 'S', label: 'Áo S', order: 10 } }),
    prisma.size.create({ data: { code: 'M', label: 'Áo M', order: 20 } }),
    prisma.size.create({ data: { code: 'L', label: 'Áo L', order: 30 } }),
  ])
  return { ctx, variant, sizes }
}

describe('orders actions', () => {
  beforeEach(async () => {
    await resetDb()
  })

  describe('createOrder', () => {
    it('creates order with auto-generated code, status=DRAFT, progressPct=0', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder(
        {
          styleVariantId: variant.id,
          orderedAt: new Date('2026-05-15'),
          expectedAt: new Date('2026-06-15'),
        },
        ctx,
      )
      expect(r.order.code).toMatch(/^TN-\d{8}-\d{4}$/)
      expect(r.order.status).toBe('DRAFT')
      expect(r.order.progressPct).toBe(0)
    })

    it('accepts user-provided code', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder(
        { code: 'TN150501', styleVariantId: variant.id },
        ctx,
      )
      expect(r.order.code).toBe('TN150501')
    })

    it('rejects duplicate code', async () => {
      const { ctx, variant } = await setupFixtures()
      await createOrder({ code: 'TN150501', styleVariantId: variant.id }, ctx)
      await expect(
        createOrder({ code: 'TN150501', styleVariantId: variant.id }, ctx),
      ).rejects.toThrow(/already exists/i)
    })

    it('rejects when styleVariantId does not exist', async () => {
      const { ctx } = await setupFixtures()
      await expect(
        createOrder(
          { styleVariantId: '00000000-0000-0000-0000-000000000000' },
          ctx,
        ),
      ).rejects.toThrow(/not found/i)
    })

    it('rejects when expectedAt < orderedAt', async () => {
      const { ctx, variant } = await setupFixtures()
      await expect(
        createOrder(
          {
            styleVariantId: variant.id,
            orderedAt: new Date('2026-06-15'),
            expectedAt: new Date('2026-05-15'),
          },
          ctx,
        ),
      ).rejects.toThrow(/after/i)
    })

    it('creates order with items (size + ratio)', async () => {
      const { ctx, variant, sizes } = await setupFixtures()
      const r = await createOrder(
        {
          styleVariantId: variant.id,
          items: [
            { sizeId: sizes[0]!.id, ratio: 3 },
            { sizeId: sizes[1]!.id, ratio: 3 },
            { sizeId: sizes[2]!.id, ratio: 2 },
          ],
        },
        ctx,
      )
      const items = await prisma.orderItem.findMany({
        where: { orderId: r.order.id },
      })
      expect(items).toHaveLength(3)
    })

    it('rejects duplicate sizeId in items', async () => {
      const { ctx, variant, sizes } = await setupFixtures()
      await expect(
        createOrder(
          {
            styleVariantId: variant.id,
            items: [
              { sizeId: sizes[0]!.id, ratio: 3 },
              { sizeId: sizes[0]!.id, ratio: 5 },
            ],
          },
          ctx,
        ),
      ).rejects.toThrow(/duplicate/i)
    })

    it('writes audit log', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: r.order.id, action: 'order.create' },
      })
      expect(audit).not.toBeNull()
    })
  })

  describe('updateOrder', () => {
    it('updates priority and notes', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)
      const updated = await updateOrder(
        {
          id: r.order.id,
          version: 0,
          patch: { priority: 'URGENT', notes: 'Khẩn' },
        },
        ctx,
      )
      expect(updated.order.priority).toBe('URGENT')
      expect(updated.order.notes).toBe('Khẩn')
      expect(updated.order.version).toBe(1)
    })

    it('throws OptimisticLockError on stale version', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)
      await updateOrder(
        { id: r.order.id, version: 0, patch: { priority: 'HIGH' } },
        ctx,
      )
      await expect(
        updateOrder(
          { id: r.order.id, version: 0, patch: { priority: 'URGENT' } },
          ctx,
        ),
      ).rejects.toThrow(/STALE_VERSION|modified/i)
    })

    it('rejects update on cancelled order', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)
      await cancelOrder({ id: r.order.id, version: 0 }, ctx)
      await expect(
        updateOrder(
          { id: r.order.id, version: 1, patch: { priority: 'HIGH' } },
          ctx,
        ),
      ).rejects.toThrow(/cancelled/i)
    })
  })

  describe('cancelOrder', () => {
    it('sets status to CANCELLED and writes OrderUpdate entry', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)
      const cancelled = await cancelOrder(
        { id: r.order.id, version: 0, reason: 'Khách hủy' },
        ctx,
      )
      expect(cancelled.order.status).toBe('CANCELLED')

      const updates = await prisma.orderUpdate.findMany({
        where: { orderId: r.order.id },
      })
      expect(updates).toHaveLength(1)
      expect(updates[0]!.toStatus).toBe('CANCELLED')
      expect(updates[0]!.note).toBe('Khách hủy')
    })

    it('rejects double cancel', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)
      await cancelOrder({ id: r.order.id, version: 0 }, ctx)
      await expect(
        cancelOrder({ id: r.order.id, version: 1 }, ctx),
      ).rejects.toThrow(/already cancelled/i)
    })
  })

  describe('setOrderItems', () => {
    it('replaces items wholesale', async () => {
      const { ctx, variant, sizes } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)

      await setOrderItems(
        {
          orderId: r.order.id,
          items: [
            { sizeId: sizes[0]!.id, ratio: 3 },
            { sizeId: sizes[1]!.id, ratio: 5 },
          ],
        },
        ctx,
      )

      const items1 = await prisma.orderItem.findMany({
        where: { orderId: r.order.id },
      })
      expect(items1).toHaveLength(2)

      // Replace with different list
      await setOrderItems(
        {
          orderId: r.order.id,
          items: [{ sizeId: sizes[2]!.id, ratio: 7 }],
        },
        ctx,
      )

      const items2 = await prisma.orderItem.findMany({
        where: { orderId: r.order.id },
      })
      expect(items2).toHaveLength(1)
      expect(items2[0]!.sizeId).toBe(sizes[2]!.id)
    })

    it('clears items when given empty array', async () => {
      const { ctx, variant, sizes } = await setupFixtures()
      const r = await createOrder(
        {
          styleVariantId: variant.id,
          items: [{ sizeId: sizes[0]!.id, ratio: 3 }],
        },
        ctx,
      )
      await setOrderItems({ orderId: r.order.id, items: [] }, ctx)
      const items = await prisma.orderItem.findMany({
        where: { orderId: r.order.id },
      })
      expect(items).toHaveLength(0)
    })
  })

  describe('deleteOrder + getOrderById/byCode', () => {
    it('soft deletes', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)
      await deleteOrder({ id: r.order.id }, ctx)

      const row = await prisma.order.findUnique({ where: { id: r.order.id } })
      expect(row!.deletedAt).not.toBeNull()

      await expect(getOrderById({ id: r.order.id }, ctx)).rejects.toThrow(
        /not found/i,
      )
    })

    it('getOrderByCode returns full order with relations', async () => {
      const { ctx, variant, sizes } = await setupFixtures()
      const r = await createOrder(
        {
          code: 'TN150501',
          styleVariantId: variant.id,
          items: [{ sizeId: sizes[0]!.id, ratio: 3 }],
        },
        ctx,
      )
      const got = await getOrderByCode({ code: 'TN150501' }, ctx)
      expect(got.order.id).toBe(r.order.id)
      expect(got.order.items).toHaveLength(1)
      expect(got.order.styleVariant.style.code).toBe('AO083')
    })
  })

  describe('searchOrders', () => {
    it('returns orders matching free-text q', async () => {
      const { ctx, variant } = await setupFixtures()
      await createOrder({ code: 'TN150501', styleVariantId: variant.id }, ctx)
      await createOrder({ code: 'TN150502', styleVariantId: variant.id }, ctx)

      const all = await searchOrders({}, ctx)
      expect(all.items).toHaveLength(2)
      expect(all.total).toBe(2)

      const qResult = await searchOrders({ q: 'TN150501' }, ctx)
      expect(qResult.items).toHaveLength(1)
      expect(qResult.items[0]!.code).toBe('TN150501')

      const qStyle = await searchOrders({ q: 'AO083' }, ctx)
      expect(qStyle.items).toHaveLength(2)
    })

    it('filters by status', async () => {
      const { ctx, variant } = await setupFixtures()
      const r1 = await createOrder(
        { code: 'TN001', styleVariantId: variant.id },
        ctx,
      )
      await createOrder({ code: 'TN002', styleVariantId: variant.id }, ctx)
      await cancelOrder({ id: r1.order.id, version: 0 }, ctx)

      const drafts = await searchOrders({ status: ['DRAFT'] }, ctx)
      expect(drafts.items.map((o) => o.code)).toEqual(['TN002'])

      const cancelled = await searchOrders({ status: ['CANCELLED'] }, ctx)
      expect(cancelled.items.map((o) => o.code)).toEqual(['TN001'])
    })

    it('paginates', async () => {
      const { ctx, variant } = await setupFixtures()
      for (let i = 1; i <= 5; i++) {
        await createOrder(
          {
            code: `TN${String(i).padStart(3, '0')}`,
            styleVariantId: variant.id,
          },
          ctx,
        )
      }
      const page1 = await searchOrders({ page: 1, pageSize: 2 }, ctx)
      expect(page1.items).toHaveLength(2)
      expect(page1.total).toBe(5)
    })
  })

  describe('getOrderTimeline', () => {
    it('returns OrderUpdate entries for an order', async () => {
      const { ctx, variant } = await setupFixtures()
      const r = await createOrder({ styleVariantId: variant.id }, ctx)
      await cancelOrder({ id: r.order.id, version: 0, reason: 'test' }, ctx)

      const tl = await getOrderTimeline({ orderId: r.order.id }, ctx)
      expect(tl.items).toHaveLength(1)
      expect(tl.items[0]!.toStatus).toBe('CANCELLED')
    })
  })
})

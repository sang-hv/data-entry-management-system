import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { dismissAlert } from '~/server/actions/alerts/dismissAlert'
import { getActiveAlerts } from '~/server/actions/alerts/getActiveAlerts'
import { createOrder } from '~/server/actions/orders/createOrder'
import { updateOrder } from '~/server/actions/orders/updateOrder'
import { evaluateOrderAlerts } from '~/server/modules/alerts/alert-engine'
import { prisma } from '~/server/lib/prisma'
import { ensureTestAdmin, resetDb } from '../../helpers/db'

const baseCtx: ActionContext = { actor: null, source: 'ui', requestId: 'req-test' }

async function setupFixtures() {
  const u = await ensureTestAdmin()
  const ctx: ActionContext = { ...baseCtx, actor: { id: u.id, email: u.email, role: u.role } }
  const style = await prisma.style.create({ data: { code: 'AO083', name: 'Áo polo' } })
  const variant = await prisma.styleVariant.create({ data: { styleId: style.id, name: 'TRANG KE XANH' } })
  return { ctx, variant }
}

describe('alert engine + actions', () => {
  beforeEach(async () => { await resetDb() })

  describe('evaluateOrderAlerts', () => {
    it('creates MISSING_DEADLINE alert for ACTIVE order without expectedAt', async () => {
      const { ctx, variant } = await setupFixtures()
      // Create order then manually set it to ACTIVE + no deadline
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({ where: { id: order.id }, data: { status: 'ACTIVE', expectedAt: null } })

      await evaluateOrderAlerts(order.id)

      const alert = await prisma.alert.findFirst({ where: { orderId: order.id, ruleCode: 'MISSING_DEADLINE' } })
      expect(alert).not.toBeNull()
      expect(alert!.status).toBe('OPEN')
      expect(alert!.severity).toBe('WARN')
    })

    it('creates OVERDUE alert when expectedAt is in the past', async () => {
      const { ctx, variant } = await setupFixtures()
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'ACTIVE', expectedAt: new Date('2026-01-01') },
      })

      await evaluateOrderAlerts(order.id)

      const alert = await prisma.alert.findFirst({ where: { orderId: order.id, ruleCode: 'OVERDUE' } })
      expect(alert).not.toBeNull()
      expect(alert!.severity).toBe('CRITICAL')
    })

    it('resolves OVERDUE alert when order is completed', async () => {
      const { ctx, variant } = await setupFixtures()
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'ACTIVE', expectedAt: new Date('2026-01-01') },
      })
      await evaluateOrderAlerts(order.id)

      // Now mark as COMPLETED
      await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })
      await evaluateOrderAlerts(order.id)

      const alert = await prisma.alert.findFirst({ where: { orderId: order.id, ruleCode: 'OVERDUE' } })
      expect(alert!.status).toBe('RESOLVED')
    })

    it('resolves MISSING_DEADLINE when expectedAt is set', async () => {
      const { ctx, variant } = await setupFixtures()
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({ where: { id: order.id }, data: { status: 'ACTIVE', expectedAt: null } })
      await evaluateOrderAlerts(order.id)

      // Update order — add deadline (fire-and-forget won't wait in test, so evaluate manually)
      await updateOrder({ id: order.id, version: 0, patch: { expectedAt: new Date('2026-12-31') } }, ctx)
      await evaluateOrderAlerts(order.id) // explicit re-evaluate to confirm resolution

      const alert = await prisma.alert.findFirst({ where: { orderId: order.id, ruleCode: 'MISSING_DEADLINE' } })
      expect(alert!.status).toBe('RESOLVED')
    })

    it('is idempotent — running twice does not create duplicate alerts', async () => {
      const { ctx, variant } = await setupFixtures()
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({ where: { id: order.id }, data: { status: 'ACTIVE' } })

      // Run twice sequentially to avoid deadlocks
      await evaluateOrderAlerts(order.id)
      await evaluateOrderAlerts(order.id)

      const count = await prisma.alert.count({ where: { orderId: order.id, ruleCode: 'MISSING_DEADLINE', status: 'OPEN' } })
      expect(count).toBe(1)
    })
  })

  describe('getActiveAlerts', () => {
    it('returns open alerts with order info', async () => {
      const { ctx, variant } = await setupFixtures()
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({ where: { id: order.id }, data: { status: 'ACTIVE' } })
      await evaluateOrderAlerts(order.id)

      const result = await getActiveAlerts({}, ctx)
      expect(result.items.length).toBeGreaterThan(0)
      expect(result.items[0]!.order).toBeDefined()
    })

    it('filters by orderId', async () => {
      const { ctx, variant } = await setupFixtures()
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({ where: { id: order.id }, data: { status: 'ACTIVE' } })
      await evaluateOrderAlerts(order.id)

      const result = await getActiveAlerts({ orderId: order.id }, ctx)
      expect(result.items.every((a) => a.orderId === order.id)).toBe(true)
    })
  })

  describe('dismissAlert', () => {
    it('dismisses open alert with reason', async () => {
      const { ctx, variant } = await setupFixtures()
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({ where: { id: order.id }, data: { status: 'ACTIVE' } })
      await evaluateOrderAlerts(order.id)

      const alert = await prisma.alert.findFirst({ where: { orderId: order.id, status: 'OPEN' } })
      const result = await dismissAlert({ alertId: alert!.id, reason: 'Đã xử lý' }, ctx)

      expect(result.alert.status).toBe('DISMISSED')
      expect(result.alert.dismissedReason).toBe('Đã xử lý')
    })

    it('throws when trying to dismiss already-dismissed alert', async () => {
      const { ctx, variant } = await setupFixtures()
      const { order } = await createOrder({ styleVariantId: variant.id }, ctx)
      await prisma.order.update({ where: { id: order.id }, data: { status: 'ACTIVE' } })
      await evaluateOrderAlerts(order.id)

      const alert = await prisma.alert.findFirst({ where: { orderId: order.id, status: 'OPEN' } })
      await dismissAlert({ alertId: alert!.id }, ctx)

      await expect(dismissAlert({ alertId: alert!.id }, ctx)).rejects.toThrow(/already/i)
    })
  })
})

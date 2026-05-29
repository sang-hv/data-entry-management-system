import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { createSize } from '~/server/actions/sizes/createSize'
import { deleteSize } from '~/server/actions/sizes/deleteSize'
import { listSizes } from '~/server/actions/sizes/listSizes'
import { updateSize } from '~/server/actions/sizes/updateSize'
import { prisma } from '~/server/lib/prisma'
import { ensureTestAdmin, resetDb } from '../../helpers/db'

const baseCtx: ActionContext = {
  actor: null,
  source: 'ui',
  requestId: 'req-test',
}

describe('sizes actions', () => {
  let ctx: ActionContext

  beforeEach(async () => {
    await resetDb()
    const u = await ensureTestAdmin()
    ctx = { ...baseCtx, actor: { id: u.id, email: u.email, role: u.role } }
  })

  describe('createSize', () => {
    it('creates a size with code, label, order', async () => {
      const r = await createSize(
        { code: 'XS', label: 'Áo XS', order: 5 },
        ctx,
      )
      expect(r.size.code).toBe('XS')
      expect(r.size.label).toBe('Áo XS')
      expect(r.size.order).toBe(5)
      expect(r.size.active).toBe(true)
    })

    it('writes audit log on create', async () => {
      await createSize({ code: 'XS', label: 'Áo XS', order: 5 }, ctx)
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'size.create' },
      })
      expect(audit).not.toBeNull()
      expect(audit!.source).toBe('ui')
    })

    it('rejects duplicate code', async () => {
      await createSize({ code: 'XS', label: 'Áo XS', order: 5 }, ctx)
      await expect(
        createSize({ code: 'XS', label: 'Different', order: 7 }, ctx),
      ).rejects.toThrow(/already exists|Conflict|CONFLICT/i)
    })

    it('rejects empty code', async () => {
      await expect(
        createSize({ code: '', label: 'X', order: 1 }, ctx),
      ).rejects.toThrow()
    })
  })

  describe('updateSize', () => {
    it('updates label and order', async () => {
      const created = await createSize(
        { code: 'M', label: 'M old', order: 20 },
        ctx,
      )
      const updated = await updateSize(
        { id: created.size.id, patch: { label: 'M new', order: 25 } },
        ctx,
      )
      expect(updated.size.label).toBe('M new')
      expect(updated.size.order).toBe(25)
    })

    it('cannot change code', async () => {
      const created = await createSize(
        { code: 'M', label: 'M', order: 20 },
        ctx,
      )
      // patch.code is not in the whitelist; if user passes it, it's silently ignored.
      await updateSize(
        // @ts-expect-error - intentionally pass extra field
        { id: created.size.id, patch: { code: 'L', label: 'still M' } },
        ctx,
      )
      const reloaded = await prisma.size.findUnique({
        where: { id: created.size.id },
      })
      expect(reloaded!.code).toBe('M')
    })

    it('throws NotFound for missing id', async () => {
      await expect(
        updateSize(
          { id: '00000000-0000-0000-0000-000000000000', patch: { label: 'x' } },
          ctx,
        ),
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('deleteSize', () => {
    it('soft deletes (sets deletedAt)', async () => {
      const created = await createSize(
        { code: 'M', label: 'M', order: 20 },
        ctx,
      )
      await deleteSize({ id: created.size.id }, ctx)
      const row = await prisma.size.findUnique({
        where: { id: created.size.id },
      })
      expect(row).not.toBeNull()
      expect(row!.deletedAt).not.toBeNull()
    })

    it('rejects delete when size is referenced by an order item', async () => {
      const size = await createSize(
        { code: 'M', label: 'M', order: 20 },
        ctx,
      )
      // create a style/variant/order to reference the size
      const style = await prisma.style.create({
        data: { code: 'TEST', name: 'Test' },
      })
      const variant = await prisma.styleVariant.create({
        data: { styleId: style.id, name: 'V1' },
      })
      const order = await prisma.order.create({
        data: {
          code: 'TN-TEST-0001',
          styleVariantId: variant.id,
          ownerId: ctx.actor!.id,
        },
      })
      await prisma.orderItem.create({
        data: { orderId: order.id, sizeId: size.size.id, ratio: 3 },
      })

      await expect(
        deleteSize({ id: size.size.id }, ctx),
      ).rejects.toThrow(/in use|referenced|conflict/i)
    })
  })

  describe('listSizes', () => {
    it('returns active sizes ordered by order', async () => {
      await createSize({ code: 'L', label: 'L', order: 30 }, ctx)
      await createSize({ code: 'S', label: 'S', order: 10 }, ctx)
      await createSize({ code: 'M', label: 'M', order: 20 }, ctx)

      const list = await listSizes({}, ctx)
      expect(list.items.map((s) => s.code)).toEqual(['S', 'M', 'L'])
    })

    it('excludes soft-deleted sizes by default', async () => {
      const s = await createSize({ code: 'L', label: 'L', order: 30 }, ctx)
      await deleteSize({ id: s.size.id }, ctx)
      const list = await listSizes({}, ctx)
      expect(list.items.find((x) => x.code === 'L')).toBeUndefined()
    })

    it('includes inactive when activeOnly=false', async () => {
      const s = await createSize({ code: 'L', label: 'L', order: 30 }, ctx)
      await updateSize({ id: s.size.id, patch: { active: false } }, ctx)

      const onlyActive = await listSizes({}, ctx)
      expect(onlyActive.items.find((x) => x.code === 'L')).toBeUndefined()

      const all = await listSizes({ activeOnly: false }, ctx)
      expect(all.items.find((x) => x.code === 'L')).toBeDefined()
    })
  })
})

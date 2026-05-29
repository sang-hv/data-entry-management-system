import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { createStyle } from '~/server/actions/styles/createStyle'
import { createStyleVariant } from '~/server/actions/styles/createStyleVariant'
import { deleteStyleVariant } from '~/server/actions/styles/deleteStyleVariant'
import { updateStyleVariant } from '~/server/actions/styles/updateStyleVariant'
import { prisma } from '~/server/lib/prisma'
import { ensureTestAdmin, resetDb } from '../../helpers/db'

const baseCtx: ActionContext = { actor: null, source: 'ui', requestId: 'req-test' }

describe('style variants actions', () => {
  let ctx: ActionContext
  let styleId: string

  beforeEach(async () => {
    await resetDb()
    const u = await ensureTestAdmin()
    ctx = { ...baseCtx, actor: { id: u.id, email: u.email, role: u.role } }
    const s = await createStyle({ code: 'AO083', name: 'Áo polo' }, ctx)
    styleId = s.style.id
  })

  describe('createStyleVariant', () => {
    it('creates a variant under a style', async () => {
      const r = await createStyleVariant(
        { styleId, name: 'TRANG KE XANH', color: 'BLUE' },
        ctx,
      )
      expect(r.variant.styleId).toBe(styleId)
      expect(r.variant.name).toBe('TRANG KE XANH')
      expect(r.variant.color).toBe('BLUE')
    })

    it('rejects when style does not exist', async () => {
      await expect(
        createStyleVariant(
          { styleId: '00000000-0000-0000-0000-000000000000', name: 'X' },
          ctx,
        ),
      ).rejects.toThrow(/not found/i)
    })

    it('rejects duplicate variant name within same style', async () => {
      await createStyleVariant({ styleId, name: 'TRANG KE XANH' }, ctx)
      await expect(
        createStyleVariant({ styleId, name: 'TRANG KE XANH' }, ctx),
      ).rejects.toThrow(/already exists/i)
    })

    it('allows same name across different styles', async () => {
      const s2 = await createStyle({ code: 'BO042', name: 'Quần' }, ctx)
      await createStyleVariant({ styleId, name: 'XANH' }, ctx)
      // should not throw
      const r = await createStyleVariant({ styleId: s2.style.id, name: 'XANH' }, ctx)
      expect(r.variant.styleId).toBe(s2.style.id)
    })
  })

  describe('updateStyleVariant', () => {
    it('updates color and imageUrl', async () => {
      const r = await createStyleVariant({ styleId, name: 'BLUE' }, ctx)
      const u = await updateStyleVariant(
        { id: r.variant.id, patch: { color: 'navy', imageUrl: '/uploads/x.jpg' } },
        ctx,
      )
      expect(u.variant.color).toBe('navy')
      expect(u.variant.imageUrl).toBe('/uploads/x.jpg')
    })

    it('renames variant when no conflict', async () => {
      const r = await createStyleVariant({ styleId, name: 'BLUE' }, ctx)
      const u = await updateStyleVariant(
        { id: r.variant.id, patch: { name: 'TRANG KE XANH' } },
        ctx,
      )
      expect(u.variant.name).toBe('TRANG KE XANH')
    })

    it('rejects rename to existing variant name in same style', async () => {
      await createStyleVariant({ styleId, name: 'BLUE' }, ctx)
      const r2 = await createStyleVariant({ styleId, name: 'RED' }, ctx)
      await expect(
        updateStyleVariant({ id: r2.variant.id, patch: { name: 'BLUE' } }, ctx),
      ).rejects.toThrow(/already exists/i)
    })
  })

  describe('deleteStyleVariant', () => {
    it('soft deletes when no orders reference it', async () => {
      const r = await createStyleVariant({ styleId, name: 'BLUE' }, ctx)
      await deleteStyleVariant({ id: r.variant.id }, ctx)
      const reloaded = await prisma.styleVariant.findUnique({
        where: { id: r.variant.id },
      })
      expect(reloaded!.deletedAt).not.toBeNull()
    })

    it('rejects delete when an order references it', async () => {
      const r = await createStyleVariant({ styleId, name: 'BLUE' }, ctx)
      await prisma.order.create({
        data: {
          code: 'TN-TEST-0001',
          styleVariantId: r.variant.id,
          ownerId: ctx.actor!.id,
        },
      })
      await expect(
        deleteStyleVariant({ id: r.variant.id }, ctx),
      ).rejects.toThrow(/in use/i)
    })
  })
})

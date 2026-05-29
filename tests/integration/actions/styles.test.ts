import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { createStyle } from '~/server/actions/styles/createStyle'
import { deleteStyle } from '~/server/actions/styles/deleteStyle'
import { getStyleById } from '~/server/actions/styles/getStyleById'
import { listStyles } from '~/server/actions/styles/listStyles'
import { updateStyle } from '~/server/actions/styles/updateStyle'
import { prisma } from '~/server/lib/prisma'
import { ensureTestAdmin, resetDb } from '../../helpers/db'

const baseCtx: ActionContext = {
  actor: null,
  source: 'ui',
  requestId: 'req-test',
}

describe('styles actions', () => {
  let ctx: ActionContext

  beforeEach(async () => {
    await resetDb()
    const u = await ensureTestAdmin()
    ctx = { ...baseCtx, actor: { id: u.id, email: u.email, role: u.role } }
  })

  describe('createStyle', () => {
    it('creates with code, name, description', async () => {
      const r = await createStyle(
        { code: 'AO083', name: 'Áo polo cổ bẻ', description: 'Mẫu A' },
        ctx,
      )
      expect(r.style.code).toBe('AO083')
      expect(r.style.name).toBe('Áo polo cổ bẻ')
      expect(r.style.description).toBe('Mẫu A')
      expect(r.style.active).toBe(true)
    })

    it('rejects duplicate code (case-sensitive)', async () => {
      await createStyle({ code: 'AO083', name: 'A' }, ctx)
      await expect(
        createStyle({ code: 'AO083', name: 'B' }, ctx),
      ).rejects.toThrow(/already exists/i)
    })

    it('writes audit log', async () => {
      const r = await createStyle({ code: 'AO083', name: 'X' }, ctx)
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: r.style.id, action: 'style.create' },
      })
      expect(audit).not.toBeNull()
    })
  })

  describe('updateStyle', () => {
    it('updates name and description', async () => {
      const r = await createStyle({ code: 'AO083', name: 'Old' }, ctx)
      const u = await updateStyle(
        { id: r.style.id, patch: { name: 'New', description: 'desc' } },
        ctx,
      )
      expect(u.style.name).toBe('New')
      expect(u.style.description).toBe('desc')
    })

    it('cannot change code', async () => {
      const r = await createStyle({ code: 'AO083', name: 'X' }, ctx)
      await updateStyle(
        // @ts-expect-error - extra field silently ignored
        { id: r.style.id, patch: { code: 'AO999', name: 'Y' } },
        ctx,
      )
      const reloaded = await prisma.style.findUnique({ where: { id: r.style.id } })
      expect(reloaded!.code).toBe('AO083')
    })

    it('throws NotFound for missing id', async () => {
      await expect(
        updateStyle(
          { id: '00000000-0000-0000-0000-000000000000', patch: { name: 'x' } },
          ctx,
        ),
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('deleteStyle', () => {
    it('soft deletes when no orders reference it', async () => {
      const r = await createStyle({ code: 'AO083', name: 'X' }, ctx)
      await deleteStyle({ id: r.style.id }, ctx)
      const reloaded = await prisma.style.findUnique({
        where: { id: r.style.id },
      })
      expect(reloaded!.deletedAt).not.toBeNull()
    })

    it('rejects delete when an order references its variant', async () => {
      const r = await createStyle({ code: 'AO083', name: 'X' }, ctx)
      const variant = await prisma.styleVariant.create({
        data: { styleId: r.style.id, name: 'BLUE' },
      })
      await prisma.order.create({
        data: {
          code: 'TN-TEST-0001',
          styleVariantId: variant.id,
          ownerId: ctx.actor!.id,
        },
      })

      await expect(deleteStyle({ id: r.style.id }, ctx)).rejects.toThrow(
        /referencing|in use|cannot delete/i,
      )
    })
  })

  describe('listStyles', () => {
    it('returns active styles ordered by updatedAt desc', async () => {
      await createStyle({ code: 'AO001', name: 'A' }, ctx)
      await createStyle({ code: 'AO002', name: 'B' }, ctx)
      const list = await listStyles({}, ctx)
      expect(list.items.map((s) => s.code)).toEqual(['AO002', 'AO001'])
      expect(list.total).toBe(2)
    })

    it('filters by q (case-insensitive)', async () => {
      await createStyle({ code: 'AO083', name: 'Áo polo' }, ctx)
      await createStyle({ code: 'BO042', name: 'Quần jean' }, ctx)
      const list = await listStyles({ q: 'POLO' }, ctx)
      expect(list.items.map((s) => s.code)).toEqual(['AO083'])
    })

    it('excludes soft-deleted by default', async () => {
      const r = await createStyle({ code: 'AO083', name: 'X' }, ctx)
      await deleteStyle({ id: r.style.id }, ctx)
      const list = await listStyles({}, ctx)
      expect(list.items).toHaveLength(0)
    })

    it('includes variant count and thumbnail', async () => {
      const r = await createStyle({ code: 'AO083', name: 'X' }, ctx)
      await prisma.styleVariant.create({
        data: {
          styleId: r.style.id,
          name: 'BLUE',
          imageUrl: '/uploads/blue.jpg',
        },
      })
      await prisma.styleVariant.create({
        data: { styleId: r.style.id, name: 'RED', imageUrl: '/uploads/red.jpg' },
      })

      const list = await listStyles({}, ctx)
      expect(list.items[0]!.variantCount).toBe(2)
      expect(list.items[0]!.thumbnailUrl).toBeTruthy()
    })
  })

  describe('getStyleById', () => {
    it('returns style with variants', async () => {
      const r = await createStyle({ code: 'AO083', name: 'X' }, ctx)
      await prisma.styleVariant.create({
        data: { styleId: r.style.id, name: 'BLUE' },
      })

      const got = await getStyleById({ id: r.style.id }, ctx)
      expect(got.style.code).toBe('AO083')
      expect(got.style.variants).toHaveLength(1)
    })

    it('throws NotFound for missing id', async () => {
      await expect(
        getStyleById({ id: '00000000-0000-0000-0000-000000000000' }, ctx),
      ).rejects.toThrow(/not found/i)
    })
  })
})

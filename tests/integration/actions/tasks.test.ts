import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { createTask } from '~/server/actions/tasks/createTask'
import { deleteTask } from '~/server/actions/tasks/deleteTask'
import { listTasks } from '~/server/actions/tasks/listTasks'
import { updateTask } from '~/server/actions/tasks/updateTask'
import { prisma } from '~/server/lib/prisma'
import { ensureTestAdmin, resetDb } from '../../helpers/db'

const baseCtx: ActionContext = { actor: null, source: 'ui', requestId: 'req-test' }

describe('tasks actions', () => {
  let ctx: ActionContext

  beforeEach(async () => {
    await resetDb()
    const u = await ensureTestAdmin()
    ctx = { ...baseCtx, actor: { id: u.id, email: u.email, role: u.role } }
  })

  describe('createTask', () => {
    it('creates task with code, name, description', async () => {
      const r = await createTask(
        { code: 'CUT', name: 'Cắt vải', description: 'Cắt theo rập' },
        ctx,
      )
      expect(r.task.code).toBe('CUT')
      expect(r.task.name).toBe('Cắt vải')
      expect(r.task.active).toBe(true)
    })

    it('creates task without code (code optional)', async () => {
      const r = await createTask({ name: 'Ad-hoc task' }, ctx)
      expect(r.task.code).toBeNull()
      expect(r.task.name).toBe('Ad-hoc task')
    })

    it('rejects duplicate code', async () => {
      await createTask({ code: 'CUT', name: 'Cắt' }, ctx)
      await expect(
        createTask({ code: 'CUT', name: 'Cắt 2' }, ctx),
      ).rejects.toThrow(/already exists/i)
    })

    it('writes audit log', async () => {
      const r = await createTask({ name: 'X' }, ctx)
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: r.task.id, action: 'task.create' },
      })
      expect(audit).not.toBeNull()
    })
  })

  describe('updateTask', () => {
    it('updates name and description', async () => {
      const r = await createTask({ name: 'Old' }, ctx)
      const u = await updateTask(
        { id: r.task.id, patch: { name: 'New', description: 'desc' } },
        ctx,
      )
      expect(u.task.name).toBe('New')
      expect(u.task.description).toBe('desc')
    })

    it('throws NotFound for missing id', async () => {
      await expect(
        updateTask(
          { id: '00000000-0000-0000-0000-000000000000', patch: { name: 'x' } },
          ctx,
        ),
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('deleteTask', () => {
    it('soft deletes when no order uses it', async () => {
      const r = await createTask({ name: 'X' }, ctx)
      await deleteTask({ id: r.task.id }, ctx)
      const reloaded = await prisma.task.findUnique({ where: { id: r.task.id } })
      expect(reloaded!.deletedAt).not.toBeNull()
    })

    it('rejects delete when an order references it', async () => {
      const t = await createTask({ name: 'CUT' }, ctx)
      // Create style/variant/order to reference the task
      const style = await prisma.style.create({ data: { code: 'TEST', name: 'Test' } })
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
      await prisma.orderTask.create({
        data: {
          orderId: order.id,
          taskId: t.task.id,
          nameSnapshot: 'CUT',
          position: 10,
        },
      })

      await expect(deleteTask({ id: t.task.id }, ctx)).rejects.toThrow(/in use/i)
    })
  })

  describe('listTasks', () => {
    it('returns active tasks (default), sorted by name asc', async () => {
      await createTask({ name: 'May' }, ctx)
      await createTask({ name: 'Cắt vải' }, ctx)
      await createTask({ name: 'Ủi' }, ctx)
      const list = await listTasks({}, ctx)
      expect(list.items.map((t) => t.name)).toEqual(['Cắt vải', 'May', 'Ủi'])
    })

    it('filters by q (case-insensitive)', async () => {
      await createTask({ code: 'CUT', name: 'Cắt vải' }, ctx)
      await createTask({ code: 'SEW', name: 'May' }, ctx)
      const list = await listTasks({ q: 'cut' }, ctx)
      expect(list.items.map((t) => t.code)).toEqual(['CUT'])
    })

    it('excludes soft-deleted by default', async () => {
      const r = await createTask({ name: 'X' }, ctx)
      await deleteTask({ id: r.task.id }, ctx)
      const list = await listTasks({}, ctx)
      expect(list.items).toHaveLength(0)
    })

    it('includes inactive when activeOnly=false', async () => {
      const r = await createTask({ name: 'X' }, ctx)
      await updateTask({ id: r.task.id, patch: { active: false } }, ctx)

      const onlyActive = await listTasks({}, ctx)
      expect(onlyActive.items).toHaveLength(0)

      const all = await listTasks({ activeOnly: false }, ctx)
      expect(all.items).toHaveLength(1)
    })
  })
})

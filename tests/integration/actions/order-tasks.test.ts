import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { pickTasksForOrder } from '~/server/actions/order-tasks/pickTasksForOrder'
import { setOrderTasks } from '~/server/actions/order-tasks/setOrderTasks'
import { setOrderTaskDone } from '~/server/actions/order-tasks/setOrderTaskDone'
import { cancelOrder } from '~/server/actions/orders/cancelOrder'
import { createOrder } from '~/server/actions/orders/createOrder'
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
  const tasks = await Promise.all([
    prisma.task.create({ data: { code: 'CUT', name: 'Cắt vải' } }),
    prisma.task.create({ data: { code: 'SEW', name: 'May' } }),
    prisma.task.create({ data: { code: 'IRON', name: 'Ủi' } }),
    prisma.task.create({ data: { code: 'PACK', name: 'Đóng gói' } }),
  ])
  return { ctx, variant, tasks }
}

describe('order-tasks actions', () => {
  beforeEach(async () => {
    await resetDb()
  })

  describe('pickTasksForOrder', () => {
    it('snapshots task names + transitions order DRAFT → ACTIVE', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      const initial = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(initial!.status).toBe('DRAFT')
      expect(initial!.progressPct).toBe(0)

      await pickTasksForOrder(
        {
          orderId: order.order.id,
          taskIds: tasks.map((t) => t.id),
        },
        ctx,
      )

      const after = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(after!.status).toBe('ACTIVE')
      expect(after!.progressPct).toBe(0)

      const orderTasks = await prisma.orderTask.findMany({
        where: { orderId: order.order.id },
        orderBy: { position: 'asc' },
      })
      expect(orderTasks).toHaveLength(4)
      expect(orderTasks.map((t) => t.nameSnapshot)).toEqual([
        'Cắt vải', 'May', 'Ủi', 'Đóng gói',
      ])
      expect(orderTasks.map((t) => t.position)).toEqual([10, 20, 30, 40])
    })

    it('preserves snapshot when master task name changes later', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      await pickTasksForOrder(
        { orderId: order.order.id, taskIds: [tasks[0]!.id] },
        ctx,
      )

      // Change master task name
      await prisma.task.update({
        where: { id: tasks[0]!.id },
        data: { name: 'Cắt mảnh' },
      })

      const orderTask = await prisma.orderTask.findFirst({
        where: { orderId: order.order.id },
      })
      expect(orderTask!.nameSnapshot).toBe('Cắt vải') // unchanged
    })

    it('allows same task picked multiple times', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      await pickTasksForOrder(
        {
          orderId: order.order.id,
          taskIds: [tasks[2]!.id, tasks[1]!.id, tasks[2]!.id], // Ủi → May → Ủi
        },
        ctx,
      )
      const orderTasks = await prisma.orderTask.findMany({
        where: { orderId: order.order.id },
        orderBy: { position: 'asc' },
      })
      expect(orderTasks).toHaveLength(3)
      expect(orderTasks.map((t) => t.nameSnapshot)).toEqual(['Ủi', 'May', 'Ủi'])
    })

    it('rejects on cancelled order', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      await cancelOrder({ id: order.order.id, version: 0 }, ctx)
      await expect(
        pickTasksForOrder(
          { orderId: order.order.id, taskIds: [tasks[0]!.id] },
          ctx,
        ),
      ).rejects.toThrow(/cancelled/i)
    })

    it('rejects when taskId does not exist', async () => {
      const { ctx, variant } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      await expect(
        pickTasksForOrder(
          {
            orderId: order.order.id,
            taskIds: ['00000000-0000-0000-0000-000000000000'],
          },
          ctx,
        ),
      ).rejects.toThrow(/invalid|inactive/i)
    })
  })

  describe('setOrderTaskDone + auto-derive', () => {
    it('marks task done and recomputes order.progressPct', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      const picked = await pickTasksForOrder(
        { orderId: order.order.id, taskIds: tasks.map((t) => t.id) },
        ctx,
      )

      // Mark task[0] done
      await setOrderTaskDone(
        { orderTaskId: picked.tasks[0]!.id, done: true },
        ctx,
      )
      let o = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(o!.progressPct).toBe(25) // 1/4 done = 25
      expect(o!.status).toBe('ACTIVE')
      const t0 = await prisma.orderTask.findUnique({ where: { id: picked.tasks[0]!.id } })
      expect(t0!.completedAt).not.toBeNull()

      // Mark task[1] done
      await setOrderTaskDone(
        { orderTaskId: picked.tasks[1]!.id, done: true },
        ctx,
      )
      o = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(o!.progressPct).toBe(50) // 2/4 done = 50
    })

    it('transitions ACTIVE → COMPLETED when all tasks are done', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      const picked = await pickTasksForOrder(
        { orderId: order.order.id, taskIds: tasks.slice(0, 2).map((t) => t.id) },
        ctx,
      )

      await setOrderTaskDone(
        { orderTaskId: picked.tasks[0]!.id, done: true },
        ctx,
      )
      let o = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(o!.status).toBe('ACTIVE')
      expect(o!.actualAt).toBeNull()

      await setOrderTaskDone(
        { orderTaskId: picked.tasks[1]!.id, done: true },
        ctx,
      )
      o = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(o!.status).toBe('COMPLETED')
      expect(o!.progressPct).toBe(100)
      expect(o!.actualAt).not.toBeNull()

      // OrderUpdate history entry written
      const updates = await prisma.orderUpdate.findMany({
        where: { orderId: order.order.id, toStatus: 'COMPLETED' },
      })
      expect(updates).toHaveLength(1)
    })

    it('reverts COMPLETED → ACTIVE when a task is un-done', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      const picked = await pickTasksForOrder(
        { orderId: order.order.id, taskIds: tasks.slice(0, 2).map((t) => t.id) },
        ctx,
      )
      await setOrderTaskDone(
        { orderTaskId: picked.tasks[0]!.id, done: true },
        ctx,
      )
      await setOrderTaskDone(
        { orderTaskId: picked.tasks[1]!.id, done: true },
        ctx,
      )
      let o = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(o!.status).toBe('COMPLETED')
      expect(o!.actualAt).not.toBeNull()

      // Revert
      await setOrderTaskDone(
        { orderTaskId: picked.tasks[0]!.id, done: false },
        ctx,
      )
      o = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(o!.status).toBe('ACTIVE')
      expect(o!.progressPct).toBe(50)
      expect(o!.actualAt).toBeNull()
    })

    it('rejects update on cancelled order', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      const picked = await pickTasksForOrder(
        { orderId: order.order.id, taskIds: [tasks[0]!.id] },
        ctx,
      )
      await cancelOrder({ id: order.order.id, version: 0 }, ctx)

      await expect(
        setOrderTaskDone(
          { orderTaskId: picked.tasks[0]!.id, done: true },
          ctx,
        ),
      ).rejects.toThrow(/cancelled/i)
    })

    it('clears completedAt when task is un-done', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      const picked = await pickTasksForOrder(
        { orderId: order.order.id, taskIds: [tasks[0]!.id] },
        ctx,
      )

      await setOrderTaskDone(
        { orderTaskId: picked.tasks[0]!.id, done: true },
        ctx,
      )
      const afterDone = await prisma.orderTask.findUnique({
        where: { id: picked.tasks[0]!.id },
      })
      expect(afterDone!.done).toBe(true)
      expect(afterDone!.completedAt).not.toBeNull()

      await setOrderTaskDone(
        { orderTaskId: picked.tasks[0]!.id, done: false },
        ctx,
      )
      const afterUndone = await prisma.orderTask.findUnique({
        where: { id: picked.tasks[0]!.id },
      })
      expect(afterUndone!.done).toBe(false)
      expect(afterUndone!.completedAt).toBeNull()
    })

    it('saves per-order-task notes', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      const picked = await pickTasksForOrder(
        { orderId: order.order.id, taskIds: [tasks[0]!.id] },
        ctx,
      )

      await setOrderTaskDone(
        { orderTaskId: picked.tasks[0]!.id, done: false, notes: 'Ủi nhiệt thấp vì vải mỏng' },
        ctx,
      )
      const after = await prisma.orderTask.findUnique({
        where: { id: picked.tasks[0]!.id },
      })
      expect(after!.notes).toBe('Ủi nhiệt thấp vì vải mỏng')
    })
  })

  describe('setOrderTasks (replace + reorder)', () => {
    it('replaces task list completely', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      await pickTasksForOrder(
        { orderId: order.order.id, taskIds: tasks.slice(0, 2).map((t) => t.id) },
        ctx,
      )

      // Replace with last 2 tasks (no id → all new)
      await setOrderTasks(
        {
          orderId: order.order.id,
          items: [
            { taskId: tasks[2]!.id, nameSnapshot: 'Ủi', done: false },
            { taskId: tasks[3]!.id, nameSnapshot: 'Đóng gói', done: false },
          ],
        },
        ctx,
      )

      const orderTasks = await prisma.orderTask.findMany({
        where: { orderId: order.order.id },
        orderBy: { position: 'asc' },
      })
      expect(orderTasks).toHaveLength(2)
      expect(orderTasks.map((t) => t.nameSnapshot)).toEqual(['Ủi', 'Đóng gói'])
      expect(orderTasks.map((t) => t.position)).toEqual([10, 20])
    })

    it('clears tasks when given empty array → status returns to DRAFT', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      await pickTasksForOrder(
        { orderId: order.order.id, taskIds: [tasks[0]!.id] },
        ctx,
      )

      await setOrderTasks({ orderId: order.order.id, items: [] }, ctx)
      const o = await prisma.order.findUnique({ where: { id: order.order.id } })
      expect(o!.status).toBe('DRAFT')
      expect(o!.progressPct).toBe(0)
    })

    it('reorders by index — keeps existing rows by id', async () => {
      const { ctx, variant, tasks } = await setupFixtures()
      const order = await createOrder({ styleVariantId: variant.id }, ctx)
      const picked = await pickTasksForOrder(
        { orderId: order.order.id, taskIds: tasks.slice(0, 3).map((t) => t.id) },
        ctx,
      )
      // Mark task[1] done
      await setOrderTaskDone(
        { orderTaskId: picked.tasks[1]!.id, done: true },
        ctx,
      )

      // Reorder: 1, 2, 0 (move first to last)
      await setOrderTasks(
        {
          orderId: order.order.id,
          items: [
            {
              id: picked.tasks[1]!.id,
              taskId: tasks[1]!.id,
              nameSnapshot: 'May',
              done: true,
            },
            {
              id: picked.tasks[2]!.id,
              taskId: tasks[2]!.id,
              nameSnapshot: 'Ủi',
              done: false,
            },
            {
              id: picked.tasks[0]!.id,
              taskId: tasks[0]!.id,
              nameSnapshot: 'Cắt vải',
              done: false,
            },
          ],
        },
        ctx,
      )

      const orderTasks = await prisma.orderTask.findMany({
        where: { orderId: order.order.id },
        orderBy: { position: 'asc' },
      })
      expect(orderTasks.map((t) => t.nameSnapshot)).toEqual(['May', 'Ủi', 'Cắt vải'])
      // done state preserved on task that we moved
      expect(orderTasks[0]!.done).toBe(true)
    })
  })
})

import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export interface TaskListOptions {
  q?: string
  activeOnly?: boolean
}

export const taskRepo = {
  async findById(id: string) {
    return prisma.task.findFirst({ where: { id, deletedAt: null } })
  },

  async findByCode(code: string) {
    return prisma.task.findFirst({ where: { code, deletedAt: null } })
  },

  async findManyByIds(ids: string[]) {
    return prisma.task.findMany({
      where: { id: { in: ids }, deletedAt: null },
    })
  },

  async list(opts: TaskListOptions = {}) {
    const where: Prisma.TaskWhereInput = { deletedAt: null }
    if (opts.activeOnly !== false) where.active = true
    if (opts.q && opts.q.trim()) {
      const q = opts.q.trim()
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    }
    return prisma.task.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    })
  },

  async create(data: { code?: string | null, name: string, description?: string | null }) {
    return prisma.task.create({ data })
  },

  async update(
    id: string,
    patch: Partial<{
      name: string
      description: string | null
      active: boolean
    }>,
  ) {
    return prisma.task.update({ where: { id }, data: patch })
  },

  async softDelete(id: string) {
    return prisma.task.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    })
  },

  async countOrderUsages(taskId: string) {
    return prisma.orderTask.count({ where: { taskId } })
  },
}

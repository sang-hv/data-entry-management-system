import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export interface AuditWriteInput {
  actorId: string | null
  source: string
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  requestId: string | null
}

export const auditRepo = {
  async write(input: AuditWriteInput) {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        source: input.source,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before as Prisma.InputJsonValue,
        after: input.after as Prisma.InputJsonValue,
        requestId: input.requestId,
      },
    })
  },

  async listForEntity(entityType: string, entityId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },
}

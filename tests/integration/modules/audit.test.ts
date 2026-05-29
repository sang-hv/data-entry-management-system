import { beforeEach, describe, expect, it } from 'vitest'
import { auditRepo } from '~/server/modules/audit/audit.repo'
import { prisma } from '~/server/lib/prisma'
import { resetDb } from '../../helpers/db'

describe('auditRepo', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('writes an audit entry with all fields', async () => {
    await auditRepo.write({
      actorId: null,
      source: 'system',
      action: 'test.create',
      entityType: 'TestEntity',
      entityId: 'entity-1',
      before: null,
      after: { name: 'foo' },
      requestId: 'req-1',
    })

    const entries = await prisma.auditLog.findMany()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      source: 'system',
      action: 'test.create',
      entityType: 'TestEntity',
      entityId: 'entity-1',
      requestId: 'req-1',
    })
    expect(entries[0]!.after).toEqual({ name: 'foo' })
  })

  it('lists audit entries for an entity (newest first)', async () => {
    await auditRepo.write({
      actorId: null,
      source: 'system',
      action: 'test.create',
      entityType: 'TestEntity',
      entityId: 'entity-2',
      before: null,
      after: { v: 1 },
      requestId: 'r1',
    })
    await new Promise((r) => setTimeout(r, 5))
    await auditRepo.write({
      actorId: null,
      source: 'system',
      action: 'test.update',
      entityType: 'TestEntity',
      entityId: 'entity-2',
      before: { v: 1 },
      after: { v: 2 },
      requestId: 'r2',
    })

    const entries = await auditRepo.listForEntity('TestEntity', 'entity-2')
    expect(entries).toHaveLength(2)
    expect(entries[0]!.action).toBe('test.update')
    expect(entries[1]!.action).toBe('test.create')
  })
})

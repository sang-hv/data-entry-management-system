import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { withIdempotency } from '~/server/actions/_base/idempotency'
import { prisma } from '~/server/lib/prisma'

const makeCtx = (key?: string): ActionContext => ({
  actor: { id: 'test-actor', email: 'test@local', role: 'ADMIN' },
  source: 'ui',
  requestId: 'req-test',
  idempotencyKey: key,
})

describe('withIdempotency', () => {
  beforeEach(async () => {
    await prisma.idempotencyKey.deleteMany()
  })

  it('runs function when no idempotency key', async () => {
    let calls = 0
    const result = await withIdempotency(makeCtx(), 'test.action', async () => {
      calls++
      return { value: 42 }
    })
    expect(calls).toBe(1)
    expect(result).toEqual({ value: 42 })
  })

  it('runs once and caches result for same key', async () => {
    const key = 'test-key-1'
    let calls = 0
    const fn = async () => {
      calls++
      return { value: 'first' }
    }

    const r1 = await withIdempotency(makeCtx(key), 'test.action', fn)
    const r2 = await withIdempotency(makeCtx(key), 'test.action', fn)

    expect(calls).toBe(1)
    expect(r1).toEqual({ value: 'first' })
    expect(r2).toEqual({ value: 'first' })
  })

  it('throws if same key used for different action', async () => {
    const key = 'test-key-2'
    await withIdempotency(makeCtx(key), 'action.a', async () => ({ ok: true }))

    await expect(
      withIdempotency(makeCtx(key), 'action.b', async () => ({ ok: true })),
    ).rejects.toThrow(/previously used for action/)
  })
})

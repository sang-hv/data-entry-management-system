import { prisma } from '../../lib/prisma'
import type { ActionContext } from './context'

const TTL_HOURS = 24

export async function withIdempotency<T>(
  ctx: ActionContext,
  actionName: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!ctx.idempotencyKey) return fn()

  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: ctx.idempotencyKey },
  })

  if (existing) {
    if (existing.action !== actionName) {
      throw new Error(
        `Idempotency key "${ctx.idempotencyKey}" was previously used for action "${existing.action}", cannot reuse for "${actionName}"`,
      )
    }
    return existing.responseJson as T
  }

  const result = await fn()
  await prisma.idempotencyKey.create({
    data: {
      key: ctx.idempotencyKey,
      action: actionName,
      responseHash: '',
      responseJson: result as object,
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000),
    },
  })
  return result
}

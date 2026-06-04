import { randomUUID } from 'node:crypto'
import type { Role } from '@prisma/client'
import type { ActionContext, Actor } from '../server/actions/_base/context.js'
import { prisma } from '../server/lib/prisma.js'

let _actor: Actor | null = null

async function getAiActor(): Promise<Actor> {
  if (_actor) return _actor
  const actorId = process.env['AI_ACTOR_ID']
  if (!actorId) throw new Error('AI_ACTOR_ID env var not set — run pnpm seed first')
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, email: true, role: true, active: true },
  })
  if (!user) throw new Error(`AI actor ${actorId} not found in DB — run pnpm seed`)
  if (!user.active) throw new Error(`AI actor ${actorId} is inactive`)
  _actor = { id: user.id, email: user.email, role: user.role as Role }
  return _actor
}

export async function makeMcpContext(idempotencyKey?: string): Promise<ActionContext> {
  const actor = await getAiActor()
  return {
    actor,
    source: 'mcp',
    requestId: randomUUID(),
    idempotencyKey,
  }
}

import type { Role } from '@prisma/client'

export type ActionSource = 'ui' | 'api' | 'mcp' | 'system'

export interface Actor {
  id: string
  email: string
  role: Role
}

export interface ActionContext {
  actor: Actor | null
  source: ActionSource
  requestId: string
  idempotencyKey?: string
}

export function systemContext(requestId: string): ActionContext {
  return { actor: null, source: 'system', requestId }
}

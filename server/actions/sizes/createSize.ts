import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, ValidationError } from '../_base/errors'
import { withIdempotency } from '../_base/idempotency'
import { auditRepo } from '../../modules/audit/audit.repo'
import { sizeRepo } from '../../modules/sizes/size.repo'

export const CreateSizeInput = z.object({
  code: z.string().min(1).max(16).regex(/^[A-Za-z0-9-]+$/, 'Code must be alphanumeric'),
  label: z.string().min(1).max(64),
  order: z.number().int().min(0).max(10000).default(0),
})
export type CreateSizeInput = z.infer<typeof CreateSizeInput>

export interface CreateSizeOutput {
  size: {
    id: string
    code: string
    label: string
    order: number
    active: boolean
  }
}

export async function createSize(
  rawInput: unknown,
  ctx: ActionContext,
): Promise<CreateSizeOutput> {
  const input = CreateSizeInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  return withIdempotency(ctx, 'size.create', async () => {
    const existing = await sizeRepo.findByCode(input.code)
    if (existing) {
      throw new ConflictError(`Size with code "${input.code}" already exists`)
    }

    const size = await sizeRepo.create({
      code: input.code,
      label: input.label,
      order: input.order,
    })

    await auditRepo.write({
      actorId: ctx.actor!.id,
      source: ctx.source,
      action: 'size.create',
      entityType: 'Size',
      entityId: size.id,
      before: null,
      after: size,
      requestId: ctx.requestId,
    })

    return {
      size: {
        id: size.id,
        code: size.code,
        label: size.label,
        order: size.order,
        active: size.active,
      },
    }
  })
}

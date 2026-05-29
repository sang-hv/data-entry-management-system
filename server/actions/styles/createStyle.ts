import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, ValidationError } from '../_base/errors'
import { withIdempotency } from '../_base/idempotency'
import { auditRepo } from '../../modules/audit/audit.repo'
import { styleRepo } from '../../modules/styles/style.repo'

export const CreateStyleInput = z.object({
  code: z.string().min(1).max(64).trim(),
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).optional(),
})
export type CreateStyleInput = z.infer<typeof CreateStyleInput>

export async function createStyle(rawInput: unknown, ctx: ActionContext) {
  const input = CreateStyleInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  return withIdempotency(ctx, 'style.create', async () => {
    const existing = await styleRepo.findByCode(input.code)
    if (existing) {
      throw new ConflictError(`Style code "${input.code}" already exists`)
    }

    const style = await styleRepo.create({
      code: input.code,
      name: input.name,
      description: input.description ?? null,
    })

    await auditRepo.write({
      actorId: ctx.actor!.id,
      source: ctx.source,
      action: 'style.create',
      entityType: 'Style',
      entityId: style.id,
      before: null,
      after: style,
      requestId: ctx.requestId,
    })

    return { style }
  })
}

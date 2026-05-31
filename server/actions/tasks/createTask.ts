import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, ValidationError } from '../_base/errors'
import { withIdempotency } from '../_base/idempotency'
import { auditRepo } from '../../modules/audit/audit.repo'
import { taskRepo } from '../../modules/tasks/task.repo'

export const CreateTaskInput = z.object({
  code: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).optional(),
})
export type CreateTaskInput = z.infer<typeof CreateTaskInput>

export async function createTask(rawInput: unknown, ctx: ActionContext) {
  const input = CreateTaskInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  return withIdempotency(ctx, 'task.create', async () => {
    if (input.code) {
      const existing = await taskRepo.findByCode(input.code)
      if (existing) {
        throw new ConflictError(`Task code "${input.code}" already exists`)
      }
    }

    const task = await taskRepo.create({
      code: input.code ?? null,
      name: input.name,
      description: input.description ?? null,
    })

    await auditRepo.write({
      actorId: ctx.actor!.id,
      source: ctx.source,
      action: 'task.create',
      entityType: 'Task',
      entityId: task.id,
      before: null,
      after: task,
      requestId: ctx.requestId,
    })

    return { task }
  })
}

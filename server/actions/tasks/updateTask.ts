import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { taskRepo } from '../../modules/tasks/task.repo'

export const UpdateTaskInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(5000).nullable().optional(),
    active: z.boolean().optional(),
  }),
})

export async function updateTask(rawInput: unknown, ctx: ActionContext) {
  const input = UpdateTaskInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await taskRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Task', input.id)

  const updated = await taskRepo.update(input.id, input.patch)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'task.update',
    entityType: 'Task',
    entityId: updated.id,
    before: existing,
    after: updated,
    requestId: ctx.requestId,
  })

  return { task: updated }
}

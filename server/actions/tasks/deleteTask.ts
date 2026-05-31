import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { taskRepo } from '../../modules/tasks/task.repo'

export const DeleteTaskInput = z.object({
  id: z.string().uuid(),
})

export async function deleteTask(rawInput: unknown, ctx: ActionContext) {
  const input = DeleteTaskInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const existing = await taskRepo.findById(input.id)
  if (!existing) throw new NotFoundError('Task', input.id)

  const refs = await taskRepo.countOrderUsages(input.id)
  if (refs > 0) {
    throw new ConflictError(
      `Task "${existing.name}" is in use by ${refs} order(s); cannot delete`,
      { references: refs },
    )
  }

  const deleted = await taskRepo.softDelete(input.id)

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'task.delete',
    entityType: 'Task',
    entityId: deleted.id,
    before: existing,
    after: deleted,
    requestId: ctx.requestId,
  })

  return { ok: true as const }
}

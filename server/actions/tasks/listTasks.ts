import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { taskRepo } from '../../modules/tasks/task.repo'

export const ListTasksInput = z.object({
  q: z.string().optional(),
  activeOnly: z.boolean().default(true),
})

export async function listTasks(rawInput: unknown, _ctx: ActionContext) {
  const input = ListTasksInput.parse(rawInput ?? {})
  const items = await taskRepo.list(input)
  return {
    items: items.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      active: t.active,
    })),
  }
}

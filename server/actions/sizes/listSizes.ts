import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { sizeRepo } from '../../modules/sizes/size.repo'

export const ListSizesInput = z.object({
  activeOnly: z.boolean().default(true),
})

export interface ListSizesOutput {
  items: Array<{
    id: string
    code: string
    label: string
    order: number
    active: boolean
  }>
}

export async function listSizes(
  rawInput: unknown,
  _ctx: ActionContext,
): Promise<ListSizesOutput> {
  const input = ListSizesInput.parse(rawInput ?? {})
  const sizes = await sizeRepo.list({ activeOnly: input.activeOnly })
  return {
    items: sizes.map((s) => ({
      id: s.id,
      code: s.code,
      label: s.label,
      order: s.order,
      active: s.active,
    })),
  }
}

import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError } from '../_base/errors'
import { styleRepo } from '../../modules/styles/style.repo'

export const GetStyleByIdInput = z.object({
  id: z.string().uuid(),
})

export async function getStyleById(rawInput: unknown, _ctx: ActionContext) {
  const input = GetStyleByIdInput.parse(rawInput)
  const style = await styleRepo.findById(input.id)
  if (!style) throw new NotFoundError('Style', input.id)
  return { style }
}

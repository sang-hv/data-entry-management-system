import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { styleRepo } from '../../modules/styles/style.repo'

export const ListStylesInput = z.object({
  q: z.string().optional(),
  activeOnly: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

export async function listStyles(rawInput: unknown, _ctx: ActionContext) {
  const input = ListStylesInput.parse(rawInput ?? {})
  const { items, total } = await styleRepo.list(input)
  return {
    items: items.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      active: s.active,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      variantCount: s._count?.variants ?? 0,
      thumbnailUrl: s.variants[0]?.imageUrl ?? null,
    })),
    total,
  }
}

import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { orderRepo } from '../../modules/orders/order.repo'

export const SearchOrdersInput = z.object({
  q: z.string().optional(),
  status: z
    .array(z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']))
    .optional(),
  priority: z.array(z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT'])).optional(),
  styleVariantId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  orderedFrom: z.coerce.date().optional(),
  orderedTo: z.coerce.date().optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  overdue: z.coerce.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['expectedAt', 'orderedAt', 'createdAt', 'priority', 'updatedAt'])
    .default('orderedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

export async function searchOrders(rawInput: unknown, _ctx: ActionContext) {
  const input = SearchOrdersInput.parse(rawInput ?? {})
  const { items, total, page, pageSize } = await orderRepo.list(
    {
      q: input.q,
      status: input.status,
      priority: input.priority,
      styleVariantId: input.styleVariantId,
      ownerId: input.ownerId,
      orderedFrom: input.orderedFrom,
      orderedTo: input.orderedTo,
      dueBefore: input.dueBefore,
      dueAfter: input.dueAfter,
      overdue: input.overdue,
    },
    {
      page: input.page,
      pageSize: input.pageSize,
      sort: input.sort,
      sortDir: input.sortDir,
    },
  )

  return {
    items: items.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      priority: o.priority,
      version: o.version,
      progressPct: o.progressPct,
      orderedAt: o.orderedAt,
      expectedAt: o.expectedAt,
      actualAt: o.actualAt,
      styleCode: o.styleVariant.style.code,
      styleName: o.styleVariant.style.name,
      variantName: o.styleVariant.name,
      thumbnailUrl: o.styleVariant.imageUrl,
      ownerName: o.owner.name,
      taskCount: o._count.tasks,
      itemCount: o._count.items,
      batchCount: o._count.batches,
      updatedAt: o.updatedAt,
    })),
    total,
    page,
    pageSize,
  }
}

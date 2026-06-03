import { searchOrders } from '../../actions/orders/searchOrders'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const query = getQuery(event)

    const arr = (val: unknown): string[] | undefined => {
      if (Array.isArray(val)) return val.map(String)
      if (typeof val === 'string') return val.split(',').filter(Boolean)
      return undefined
    }

    return await searchOrders(
      {
        q: typeof query.q === 'string' ? query.q : undefined,
        status: arr(query.status) as never,
        priority: arr(query.priority) as never,
        styleVariantId: typeof query.styleVariantId === 'string' ? query.styleVariantId : undefined,
        ownerId: typeof query.ownerId === 'string' ? query.ownerId : undefined,
        orderedFrom: query.orderedFrom ? new Date(String(query.orderedFrom)) : undefined,
        orderedTo: query.orderedTo ? new Date(String(query.orderedTo)) : undefined,
        dueBefore: query.dueBefore ? new Date(String(query.dueBefore)) : undefined,
        dueAfter: query.dueAfter ? new Date(String(query.dueAfter)) : undefined,
        overdue: query.overdue === 'true' ? true : undefined,
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
        sort: typeof query.sort === 'string' ? query.sort : undefined,
        sortDir: typeof query.sortDir === 'string' ? query.sortDir : undefined,
      },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

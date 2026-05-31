import { getOrderTimeline } from '../../../actions/orders/getOrderTimeline'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const orderId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const query = getQuery(event)
    return await getOrderTimeline(
      { orderId, limit: query.limit ? Number(query.limit) : undefined },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

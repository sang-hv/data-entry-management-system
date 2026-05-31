import { cancelOrder } from '../../../actions/orders/cancelOrder'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await cancelOrder({ id, version: body?.version, reason: body?.reason }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

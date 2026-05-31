import { getOrderById } from '../../actions/orders/getOrderById'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    return await getOrderById({ id }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

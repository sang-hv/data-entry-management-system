import { deleteOrder } from '../../actions/orders/deleteOrder'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    return await deleteOrder({ id }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

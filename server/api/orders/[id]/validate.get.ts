import { validateOrderDataCompleteness } from '../../../actions/dashboard/validateOrderDataCompleteness'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const orderId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    return await validateOrderDataCompleteness({ orderId }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

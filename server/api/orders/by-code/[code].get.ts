import { getOrderByCode } from '../../../actions/orders/getOrderByCode'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const code = getRouterParam(event, 'code')
    const ctx = buildContext(event)
    return await getOrderByCode({ code }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

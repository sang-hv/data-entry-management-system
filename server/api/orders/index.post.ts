import { createOrder } from '../../actions/orders/createOrder'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await createOrder(body, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

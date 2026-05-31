import { updateOrder } from '../../actions/orders/updateOrder'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await updateOrder({ id, version: body?.version, patch: body?.patch ?? {} }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

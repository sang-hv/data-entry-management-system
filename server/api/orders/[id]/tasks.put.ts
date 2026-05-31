import { setOrderTasks } from '../../../actions/order-tasks/setOrderTasks'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const orderId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await setOrderTasks(
      { orderId, items: body?.items ?? [] },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

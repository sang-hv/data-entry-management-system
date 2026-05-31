import { pickTasksForOrder } from '../../../actions/order-tasks/pickTasksForOrder'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const orderId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await pickTasksForOrder(
      { orderId, taskIds: body?.taskIds ?? [] },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

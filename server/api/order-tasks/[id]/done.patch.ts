import { setOrderTaskDone } from '../../../actions/order-tasks/setOrderTaskDone'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const orderTaskId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await setOrderTaskDone(
      {
        orderTaskId,
        done: body?.done,
        notes: body?.notes,
      },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

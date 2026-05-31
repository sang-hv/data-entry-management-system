import { updateOrderTaskProgress } from '../../../actions/order-tasks/updateOrderTaskProgress'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const orderTaskId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await updateOrderTaskProgress(
      {
        orderTaskId,
        progressPct: body?.progressPct,
        notes: body?.notes,
      },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

import { applyRatioToBatch } from '../../../actions/batches/applyRatioToBatch'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const orderId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await applyRatioToBatch({ orderId, ...body }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

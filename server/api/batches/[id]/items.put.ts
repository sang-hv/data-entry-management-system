import { setBatchItems } from '../../../actions/batches/setBatchItems'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const batchId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await setBatchItems({ batchId, items: body?.items ?? [] }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

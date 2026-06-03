import { updateBatch } from '../../actions/batches/updateBatch'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const batchId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await updateBatch({ batchId, ...body }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

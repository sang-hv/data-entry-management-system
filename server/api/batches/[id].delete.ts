import { deleteBatch } from '../../actions/batches/deleteBatch'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const batchId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    return await deleteBatch({ batchId }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

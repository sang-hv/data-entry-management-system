import { listSizes } from '../../actions/sizes/listSizes'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const query = getQuery(event)
    const activeOnly = query.activeOnly !== 'false'
    return await listSizes({ activeOnly }, ctx)
  } catch (err) {
    toHttpError(err)
  }
})

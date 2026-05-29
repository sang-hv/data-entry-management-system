import { listStyles } from '../../actions/styles/listStyles'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const query = getQuery(event)
    return await listStyles(
      {
        q: typeof query.q === 'string' ? query.q : undefined,
        activeOnly: query.activeOnly !== 'false',
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

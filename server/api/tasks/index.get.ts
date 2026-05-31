import { listTasks } from '../../actions/tasks/listTasks'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const query = getQuery(event)
    return await listTasks(
      {
        q: typeof query.q === 'string' ? query.q : undefined,
        activeOnly: query.activeOnly !== 'false',
      },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

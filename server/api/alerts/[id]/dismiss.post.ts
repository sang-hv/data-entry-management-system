import { dismissAlert } from '../../../actions/alerts/dismissAlert'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const alertId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await dismissAlert({ alertId, reason: body?.reason }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

import { getDashboardStats } from '../../actions/dashboard/getDashboardStats'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    return await getDashboardStats(null, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

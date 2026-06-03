import { getActiveAlerts } from '../../actions/alerts/getActiveAlerts'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const query = getQuery(event)
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',').filter(Boolean) : undefined
    return await getActiveAlerts(
      {
        orderId: typeof query.orderId === 'string' ? query.orderId : undefined,
        severity: arr(query.severity),
        status: arr(query.status),
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})

import { deleteSize } from '../../actions/sizes/deleteSize'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    return await deleteSize({ id }, ctx)
  } catch (err) {
    toHttpError(err)
  }
})

import { deleteStyleVariant } from '../../actions/styles/deleteStyleVariant'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    return await deleteStyleVariant({ id }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

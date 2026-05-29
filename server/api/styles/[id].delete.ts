import { deleteStyle } from '../../actions/styles/deleteStyle'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    return await deleteStyle({ id }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

import { updateStyleVariant } from '../../actions/styles/updateStyleVariant'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await updateStyleVariant({ id, patch: body?.patch ?? body }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

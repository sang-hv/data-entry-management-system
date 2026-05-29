import { createStyleVariant } from '../../../actions/styles/createStyleVariant'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const styleId = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await createStyleVariant({ ...body, styleId }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

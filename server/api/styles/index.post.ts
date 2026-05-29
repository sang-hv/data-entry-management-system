import { createStyle } from '../../actions/styles/createStyle'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await createStyle(body, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

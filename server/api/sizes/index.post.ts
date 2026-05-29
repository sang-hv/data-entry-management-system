import { createSize } from '../../actions/sizes/createSize'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await createSize(body, ctx)
  } catch (err) {
    toHttpError(err)
  }
})

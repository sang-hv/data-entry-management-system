import { createTask } from '../../actions/tasks/createTask'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const ctx = buildContext(event)
    const body = await readBody(event)
    return await createTask(body, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

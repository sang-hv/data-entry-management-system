import { deleteTask } from '../../actions/tasks/deleteTask'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const id = getRouterParam(event, 'id')
    const ctx = buildContext(event)
    return await deleteTask({ id }, ctx)
  }
  catch (err) {
    toHttpError(err)
  }
})

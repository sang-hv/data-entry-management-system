import { ActionError } from '~/server/actions/_base/errors'
import { logger } from '~/server/lib/logger'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, ctx) => {
    const requestId = ctx.event?.context?.requestId as string | undefined
    if (error instanceof ActionError) {
      logger.warn(
        { requestId, code: error.code, message: error.message },
        'Action error',
      )
    } else {
      logger.error({ requestId, err: error }, 'Unhandled error')
    }
  })
})

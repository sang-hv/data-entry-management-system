import { logger } from '~/server/lib/logger'

export default defineNitroPlugin(() => {
  logger.info({ event: 'app.boot' }, 'Application booting')
})

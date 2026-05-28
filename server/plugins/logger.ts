import { logger } from '../lib/logger'

export default defineNitroPlugin(() => {
  logger.info({ event: 'app.boot' }, 'Application booting')
})

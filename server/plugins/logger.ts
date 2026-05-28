import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ['password', '*.password', '*.passwordHash', 'authorization', 'cookie'],
    censor: '[REDACTED]',
  },
})

export default defineNitroPlugin(() => {
  logger.info({ event: 'app.boot' }, 'Application booting')
})

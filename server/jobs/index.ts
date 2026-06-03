import { runAlertEvaluator } from './alert-evaluator.job'
import { logger } from '../lib/logger'

type Job = { name: string; intervalMs: number; fn: () => Promise<void> }

const jobs: Job[] = [
  { name: 'alert-evaluator', intervalMs: 10 * 60 * 1000, fn: runAlertEvaluator },
]

const timers: ReturnType<typeof setInterval>[] = []

export function startJobs() {
  for (const job of jobs) {
    logger.info({ job: job.name, intervalMs: job.intervalMs }, 'job: scheduled')
    const t = setInterval(async () => {
      logger.info({ job: job.name }, 'job: running')
      try {
        await job.fn()
      }
      catch (err) {
        logger.error({ err, job: job.name }, 'job: unhandled error')
      }
    }, job.intervalMs)
    timers.push(t)
  }
}

export function stopJobs() {
  for (const t of timers) clearInterval(t)
  timers.length = 0
}

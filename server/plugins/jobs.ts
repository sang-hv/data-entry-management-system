import { startJobs } from '../jobs/index'

export default defineNitroPlugin(() => {
  // Only run cron jobs in server context, not during build or test
  if (process.env.NODE_ENV !== 'test') {
    startJobs()
  }
})

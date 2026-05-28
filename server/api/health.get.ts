import { prisma } from '../lib/prisma'

export default defineEventHandler(async () => {
  let dbReachable = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbReachable = true
  } catch {
    dbReachable = false
  }
  return {
    status: dbReachable ? 'ok' : 'degraded',
    dbReachable,
    time: new Date().toISOString(),
  }
})

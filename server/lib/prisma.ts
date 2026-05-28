import { PrismaClient } from '@prisma/client'

// Singleton Prisma client. Used by all server-side modules and tests.
// Nuxt auto-import of `defineNitroPlugin` is not available outside Nuxt
// runtime (e.g. when vitest imports this), so we keep this file pure.

declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma
}

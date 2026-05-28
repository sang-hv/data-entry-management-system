import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma
}

export default defineNitroPlugin(() => {
  // Singleton initialized on import. Plugin ensures it loads at boot.
})

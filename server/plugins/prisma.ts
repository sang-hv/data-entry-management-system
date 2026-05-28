import { prisma } from '../lib/prisma'

// Nitro plugin: re-export ensures the singleton client is initialized at
// server boot. Tests import from `~/server/lib/prisma` directly to avoid
// requiring Nuxt's `defineNitroPlugin` auto-import.
export default defineNitroPlugin(async (nitroApp) => {
  // Touch the prisma client so it's instantiated immediately on boot.
  void prisma

  nitroApp.hooks.hook('close', async () => {
    await prisma.$disconnect()
  })
})

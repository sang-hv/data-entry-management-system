import { prisma } from '~/server/lib/prisma'

/**
 * Reset all business data tables in correct FK order.
 * Keeps schema; nukes rows.
 *
 * NOTE: This wipes the dev database. Run `pnpm seed` after testing to
 * restore admin user + default sizes.
 */
export async function resetDb() {
  // Cross-cutting / leaf tables first.
  await prisma.idempotencyKey.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.session.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.orderUpdate.deleteMany()
  // Order children.
  await prisma.batchItem.deleteMany()
  await prisma.orderBatch.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  // Style children.
  await prisma.styleVariant.deleteMany()
  await prisma.style.deleteMany()
  // Master data.
  await prisma.size.deleteMany()
  await prisma.orderCodeCounter.deleteMany()
  // Users last (referenced by ownedOrders, sessions, audit, etc.).
  await prisma.user.deleteMany()
}

/**
 * Ensure an admin user exists with the canonical id used in test contexts.
 * Returns the user.
 */
export async function ensureTestAdmin() {
  return prisma.user.upsert({
    where: { email: 'admin@local' },
    create: {
      email: 'admin@local',
      name: 'Admin',
      passwordHash: '$2b$12$dummyhash.for.test.purposes.only.x.x.x.x.x.x.x.x',
      role: 'ADMIN',
    },
    update: {},
  })
}

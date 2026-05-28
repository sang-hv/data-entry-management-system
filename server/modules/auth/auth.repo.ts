import { prisma } from '../../lib/prisma'
import { hashToken } from './session'

export const authRepo = {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  },

  async updateLastLoginAt(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })
  },

  async createSession(input: {
    userId: string
    token: string
    ttlDays: number
    ipAddress?: string
    userAgent?: string
  }) {
    const expiresAt = new Date(Date.now() + input.ttlDays * 86400_000)
    return prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash: hashToken(input.token),
        expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    })
  },

  async findValidSession(token: string) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    })
    if (!session) return null
    if (session.expiresAt <= new Date()) return null
    if (!session.user.active) return null
    return session
  },

  async deleteSession(token: string) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  },

  async deleteExpiredSessions() {
    const r = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return r.count
  },
}

import { beforeEach, describe, expect, it } from 'vitest'
import { authRepo } from '~/server/modules/auth/auth.repo'
import { hashPassword } from '~/server/modules/auth/password'
import { generateSessionToken, hashToken } from '~/server/modules/auth/session'
import { prisma } from '~/server/lib/prisma'

describe('session', () => {
  let userId: string

  beforeEach(async () => {
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    const u = await prisma.user.create({
      data: {
        email: 'sess@local',
        name: 'Session Test',
        passwordHash: await hashPassword('TestPass123'),
        role: 'ADMIN',
      },
    })
    userId = u.id
  })

  it('generateSessionToken returns 43+ chars URL-safe string', () => {
    const t = generateSessionToken()
    expect(t.length).toBeGreaterThanOrEqual(43)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('hashToken is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })

  it('createSession + findValidSession round-trip', async () => {
    const token = generateSessionToken()
    const session = await authRepo.createSession({
      userId,
      token,
      ttlDays: 7,
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    })
    expect(session.userId).toBe(userId)

    const found = await authRepo.findValidSession(token)
    expect(found).not.toBeNull()
    expect(found!.userId).toBe(userId)
  })

  it('findValidSession returns null for expired session', async () => {
    const token = generateSessionToken()
    await authRepo.createSession({ userId, token, ttlDays: 7 })

    await prisma.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const found = await authRepo.findValidSession(token)
    expect(found).toBeNull()
  })

  it('deleteSession removes by token', async () => {
    const token = generateSessionToken()
    await authRepo.createSession({ userId, token, ttlDays: 7 })
    await authRepo.deleteSession(token)
    expect(await authRepo.findValidSession(token)).toBeNull()
  })
})

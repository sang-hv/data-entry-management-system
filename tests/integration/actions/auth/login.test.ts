import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { login } from '~/server/actions/auth/login'
import { logout } from '~/server/actions/auth/logout'
import { authRepo } from '~/server/modules/auth/auth.repo'
import { hashPassword } from '~/server/modules/auth/password'
import { prisma } from '~/server/lib/prisma'
import { resetDb } from '../../../helpers/db'

const ctx: ActionContext = {
  actor: null,
  source: 'ui',
  requestId: 'req-test',
}

describe('login action', () => {
  beforeEach(async () => {
    await resetDb()
    await prisma.user.create({
      data: {
        email: 'admin@local',
        name: 'Admin',
        passwordHash: await hashPassword('Secret123Pass'),
        role: 'ADMIN',
      },
    })
  })

  it('issues a session token on correct credentials', async () => {
    const result = await login(
      { email: 'admin@local', password: 'Secret123Pass' },
      ctx,
    )
    expect(result.token).toBeTruthy()
    expect(result.user.email).toBe('admin@local')

    const valid = await authRepo.findValidSession(result.token)
    expect(valid).not.toBeNull()
  })

  it('rejects wrong password', async () => {
    await expect(
      login({ email: 'admin@local', password: 'WrongPass1' }, ctx),
    ).rejects.toThrow(/Invalid credentials/)
  })

  it('rejects non-existent email with same error to prevent enumeration', async () => {
    await expect(
      login({ email: 'noone@local', password: 'AnyPass123' }, ctx),
    ).rejects.toThrow(/Invalid credentials/)
  })

  it('rejects login for inactive user', async () => {
    await prisma.user.updateMany({ data: { active: false } })
    await expect(
      login({ email: 'admin@local', password: 'Secret123Pass' }, ctx),
    ).rejects.toThrow(/Invalid credentials/)
  })

  it('logout deletes the session', async () => {
    const { token } = await login(
      { email: 'admin@local', password: 'Secret123Pass' },
      ctx,
    )
    await logout({ token }, ctx)
    expect(await authRepo.findValidSession(token)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '~/server/modules/auth/password'

describe('password', () => {
  it('hashes and verifies password', async () => {
    const hash = await hashPassword('Secure123Pass')
    expect(hash).not.toBe('Secure123Pass')
    expect(hash.length).toBeGreaterThan(20)

    expect(await verifyPassword('Secure123Pass', hash)).toBe(true)
    expect(await verifyPassword('WrongPass123', hash)).toBe(false)
  })

  it('rejects passwords below 10 chars', () => {
    const r = validatePasswordStrength('Short1')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/10/)
  })

  it('rejects passwords without digit', () => {
    const r = validatePasswordStrength('NoDigitsHere')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/digit|số/i)
  })

  it('rejects passwords without letter', () => {
    const r = validatePasswordStrength('1234567890')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/letter|chữ/i)
  })

  it('accepts strong password', () => {
    const r = validatePasswordStrength('Secure123Pass')
    expect(r.ok).toBe(true)
  })
})

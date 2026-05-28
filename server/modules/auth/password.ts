import bcrypt from 'bcrypt'

const COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export interface PasswordCheckResult {
  ok: boolean
  reason?: string
}

export function validatePasswordStrength(plain: string): PasswordCheckResult {
  if (plain.length < 10) {
    return { ok: false, reason: 'Password must be at least 10 characters' }
  }
  if (!/\d/.test(plain)) {
    return { ok: false, reason: 'Password must contain at least one digit' }
  }
  if (!/[a-zA-Z]/.test(plain)) {
    return { ok: false, reason: 'Password must contain at least one letter' }
  }
  return { ok: true }
}

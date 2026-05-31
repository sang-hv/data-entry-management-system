import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const DEFAULT_SIZES = [
  { code: 'S', label: 'Áo S', order: 10 },
  { code: 'M', label: 'Áo M', order: 20 },
  { code: 'L', label: 'Áo L', order: 30 },
  { code: 'XL', label: 'Áo XL', order: 40 },
  { code: 'XXL', label: 'Áo XXL', order: 50 },
]

const DEFAULT_TASKS = [
  { code: 'CUT', name: 'Cắt vải', description: 'Cắt theo rập' },
  { code: 'SEW', name: 'May', description: 'Ráp các chi tiết áo' },
  { code: 'IRON', name: 'Ủi', description: 'Ủi nhiệt định hình' },
  { code: 'PACK', name: 'Đóng gói', description: 'Bao bì + đếm số lượng' },
  { code: 'SHIP', name: 'Đang giao hàng', description: 'Đang vận chuyển đến khách' },
  { code: 'DELIVERED', name: 'Đã giao hàng', description: 'Khách đã nhận' },
]

function generateRandomPassword(): string {
  // Ensure ≥10 chars with at least one letter and one digit.
  const random = randomBytes(12).toString('base64url').slice(0, 14)
  return `${random}A1`
}

function validateFixedPassword(pw: string): string | null {
  if (pw.length < 10) return 'Password must be at least 10 characters'
  if (!/\d/.test(pw)) return 'Password must contain at least one digit'
  if (!/[a-zA-Z]/.test(pw)) return 'Password must contain at least one letter'
  return null
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@local'
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator'
  const fixedPassword = process.env.SEED_ADMIN_PASSWORD?.trim()

  // Sizes: idempotent upsert.
  for (const s of DEFAULT_SIZES) {
    await prisma.size.upsert({
      where: { code: s.code },
      create: s,
      update: {},
    })
  }
  console.log(`✓ Seeded ${DEFAULT_SIZES.length} default sizes`)

  // Tasks: idempotent upsert by code.
  for (const t of DEFAULT_TASKS) {
    await prisma.task.upsert({
      where: { code: t.code },
      create: t,
      update: {},
    })
  }
  console.log(`✓ Seeded ${DEFAULT_TASKS.length} default tasks`)

  // Admin handling differs based on whether SEED_ADMIN_PASSWORD is set.
  if (fixedPassword) {
    const invalid = validateFixedPassword(fixedPassword)
    if (invalid) {
      console.error(`✗ SEED_ADMIN_PASSWORD invalid: ${invalid}`)
      process.exit(1)
    }

    // Always upsert: create if not exists, reset password if exists.
    const passwordHash = await bcrypt.hash(fixedPassword, 12)
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        passwordHash,
        role: 'ADMIN',
        active: true,
      },
      update: {
        passwordHash,
        active: true,
      },
    })
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✓ Admin user upserted (password reset from SEED_ADMIN_PASSWORD)')
    console.log(`  Email:    ${email}`)
    console.log(`  Password: <from SEED_ADMIN_PASSWORD env>`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return
  }

  // No fixed password: only create if not exists, generate random.
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✓ Admin ${email} already exists, skipping`)
    return
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'ADMIN',
      active: true,
    },
  })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✓ Admin user created (random password)')
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log('  ⚠️  Lưu lại password này — không thể xem lại sau!')
  console.log('  💡 Đặt SEED_ADMIN_PASSWORD trong .env.local để dùng password cố định.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

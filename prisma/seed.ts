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

function generatePassword(): string {
  // Ensure ≥10 chars with at least one letter and one digit (matches strength rules).
  const random = randomBytes(12).toString('base64url').slice(0, 14)
  return `${random}A1`
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@local'
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator'

  // Sizes: idempotent upsert.
  for (const s of DEFAULT_SIZES) {
    await prisma.size.upsert({
      where: { code: s.code },
      create: s,
      update: {},
    })
  }
  console.log(`✓ Seeded ${DEFAULT_SIZES.length} default sizes`)

  // Admin: create only if not exists.
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✓ Admin ${email} already exists, skipping`)
    return
  }

  const password = generatePassword()
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
  console.log('✓ Admin user created')
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log('  ⚠️  Lưu lại password này — không thể xem lại sau!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

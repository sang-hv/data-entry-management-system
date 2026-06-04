import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// ─── Master data ──────────────────────────────────────────────────────────────

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
  { code: 'SHIP', name: 'Giao hàng', description: 'Đang vận chuyển đến khách' },
]

// ─── Sample demo data (chỉ dùng khi --sample) ────────────────────────────────

const SAMPLE_STYLES = [
  {
    code: 'AO083',
    name: 'Áo polo cổ bẻ',
    description: 'Áo polo nam cổ bẻ, vải CVC 65/35',
    variants: [
      { name: 'TRANG KE XANH', color: 'TRẮNG KẺ XANH' },
      { name: 'TRANG KE DO', color: 'TRẮNG KẺ ĐỎ' },
      { name: 'XANH NAVY', color: 'XANH NAVY' },
    ],
  },
  {
    code: 'AO084',
    name: 'Áo thun cổ tròn',
    description: 'Áo thun nam cổ tròn, vải cotton 100%',
    variants: [
      { name: 'TRANG TRON', color: 'TRẮNG TRƠN' },
      { name: 'DEN TRON', color: 'ĐEN TRƠN' },
    ],
  },
  {
    code: 'AO085',
    name: 'Áo sơ mi tay ngắn',
    description: 'Áo sơ mi nam tay ngắn, vải kate',
    variants: [
      { name: 'XANH NHAT', color: 'XANH NHẠT' },
      { name: 'TRANG TRON', color: 'TRẮNG TRƠN' },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRandomPassword(): string {
  const random = randomBytes(12).toString('base64url').slice(0, 14)
  return `${random}A1`
}

function validateFixedPassword(pw: string): string | null {
  if (pw.length < 10) return 'Password must be at least 10 characters'
  if (!/\d/.test(pw)) return 'Password must contain at least one digit'
  if (!/[a-zA-Z]/.test(pw)) return 'Password must contain at least one letter'
  return null
}

// ─── Admin seeder ─────────────────────────────────────────────────────────────

async function seedAdmin(): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@local'
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator'
  const fixedPassword = process.env.SEED_ADMIN_PASSWORD?.trim()

  if (fixedPassword) {
    const invalid = validateFixedPassword(fixedPassword)
    if (invalid) {
      console.error(`✗ SEED_ADMIN_PASSWORD invalid: ${invalid}`)
      process.exit(1)
    }
    const passwordHash = await bcrypt.hash(fixedPassword, 12)
    const admin = await prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash, role: 'ADMIN', active: true },
      update: { passwordHash, active: true },
    })
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✓ Admin upserted (password from SEED_ADMIN_PASSWORD)')
    console.log(`  Email:    ${email}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return admin.id
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✓ Admin ${email} already exists, skipping`)
    return existing.id
  }

  const password = generateRandomPassword()
  const passwordHash = await bcrypt.hash(password, 12)
  const admin = await prisma.user.create({
    data: { email, name, passwordHash, role: 'ADMIN', active: true },
  })
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✓ Admin created (random password)')
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log('  ⚠️  Lưu lại password này — không thể xem lại!')
  console.log('  💡 Set SEED_ADMIN_PASSWORD trong .env.local để dùng password cố định.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  return admin.id
}

// ─── Sample data seeder ───────────────────────────────────────────────────────

async function seedSampleData(adminId: string) {
  const sizes = await prisma.size.findMany({ orderBy: { order: 'asc' } })
  const tasks = await prisma.task.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } })
  const [S, M, L, XL, XXL] = sizes
  const [CUT, SEW, IRON, PACK] = tasks

  if (!S || !M || !L || !XL || !XXL || !CUT || !SEW || !IRON || !PACK) {
    console.warn('⚠  Không đủ sizes/tasks để seed sample data, bỏ qua.')
    return
  }

  // Upsert styles + variants
  const styleVariantMap: Record<string, Record<string, string>> = {}
  for (const s of SAMPLE_STYLES) {
    const style = await prisma.style.upsert({
      where: { code: s.code },
      create: { code: s.code, name: s.name, description: s.description },
      update: {},
    })
    styleVariantMap[s.code] = {}
    for (const v of s.variants) {
      const variant = await prisma.styleVariant.upsert({
        where: { styleId_name: { styleId: style.id, name: v.name } },
        create: { styleId: style.id, name: v.name, color: v.color },
        update: {},
      })
      styleVariantMap[s.code]![v.name] = variant.id
    }
  }
  console.log(`✓ Seeded ${SAMPLE_STYLES.length} sample styles với variants`)

  // Helper: create order if not exists (idempotent by code)
  async function upsertOrder(params: {
    code: string
    styleVariantId: string
    orderedAt: Date
    expectedAt: Date
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    notes?: string
    items: Array<{ sizeId: string; ratio: number }>
    orderTasks: Array<{ taskId: string; nameSnapshot: string; descriptionSnapshot?: string; position: number; done: boolean }>
  }) {
    const existing = await prisma.order.findFirst({ where: { code: params.code } })
    if (existing) return existing

    const hasTasks = params.orderTasks.length > 0
    const allDone = hasTasks && params.orderTasks.every((t) => t.done)
    const status = allDone ? 'COMPLETED' : hasTasks ? 'ACTIVE' : 'DRAFT'
    const doneTasks = params.orderTasks.filter((t) => t.done).length
    const progressPct = hasTasks ? Math.round((doneTasks / params.orderTasks.length) * 100) : 0

    return prisma.order.create({
      data: {
        code: params.code,
        styleVariantId: params.styleVariantId,
        ownerId: adminId,
        orderedAt: params.orderedAt,
        expectedAt: params.expectedAt,
        priority: params.priority,
        notes: params.notes ?? null,
        status,
        progressPct,
        items: { create: params.items.map((i) => ({ sizeId: i.sizeId, ratio: i.ratio })) },
        tasks: {
          create: params.orderTasks.map((t) => ({
            taskId: t.taskId,
            nameSnapshot: t.nameSnapshot,
            descriptionSnapshot: t.descriptionSnapshot ?? null,
            position: t.position,
            done: t.done,
            completedAt: t.done ? new Date() : null,
          })),
        },
      },
    })
  }

  const v = styleVariantMap
  await upsertOrder({
    code: 'TN150501',
    styleVariantId: v['AO083']!['TRANG KE XANH']!,
    orderedAt: new Date('2026-05-15'),
    expectedAt: new Date('2026-06-30'),
    priority: 'HIGH',
    notes: 'Khách yêu cầu giao trước 30/6.',
    items: [
      { sizeId: S.id, ratio: 3 }, { sizeId: M.id, ratio: 3 },
      { sizeId: L.id, ratio: 2 }, { sizeId: XL.id, ratio: 1 }, { sizeId: XXL.id, ratio: 1 },
    ],
    orderTasks: [
      { taskId: CUT.id, nameSnapshot: CUT.name, position: 10, done: true },
      { taskId: SEW.id, nameSnapshot: SEW.name, position: 20, done: true },
      { taskId: IRON.id, nameSnapshot: IRON.name, position: 30, done: false },
      { taskId: PACK.id, nameSnapshot: PACK.name, position: 40, done: false },
    ],
  })

  await upsertOrder({
    code: 'TN150502',
    styleVariantId: v['AO083']!['TRANG KE DO']!,
    orderedAt: new Date('2026-05-15'),
    expectedAt: new Date('2026-07-15'),
    priority: 'NORMAL',
    items: [
      { sizeId: S.id, ratio: 2 }, { sizeId: M.id, ratio: 3 },
      { sizeId: L.id, ratio: 3 }, { sizeId: XL.id, ratio: 1 }, { sizeId: XXL.id, ratio: 1 },
    ],
    orderTasks: [
      { taskId: CUT.id, nameSnapshot: CUT.name, position: 10, done: true },
      { taskId: SEW.id, nameSnapshot: SEW.name, position: 20, done: false },
      { taskId: IRON.id, nameSnapshot: IRON.name, position: 30, done: false },
      { taskId: PACK.id, nameSnapshot: PACK.name, position: 40, done: false },
    ],
  })

  await upsertOrder({
    code: 'TN150503',
    styleVariantId: v['AO083']!['XANH NAVY']!,
    orderedAt: new Date('2026-04-10'),
    expectedAt: new Date('2026-05-10'),
    priority: 'URGENT',
    notes: 'Đã giao xong.',
    items: [
      { sizeId: S.id, ratio: 1 }, { sizeId: M.id, ratio: 2 },
      { sizeId: L.id, ratio: 2 }, { sizeId: XL.id, ratio: 1 },
    ],
    orderTasks: [
      { taskId: CUT.id, nameSnapshot: CUT.name, position: 10, done: true },
      { taskId: SEW.id, nameSnapshot: SEW.name, position: 20, done: true },
      { taskId: IRON.id, nameSnapshot: IRON.name, position: 30, done: true },
      { taskId: PACK.id, nameSnapshot: PACK.name, position: 40, done: true },
    ],
  })

  await upsertOrder({
    code: 'TN150504',
    styleVariantId: v['AO084']!['TRANG TRON']!,
    orderedAt: new Date('2026-06-01'),
    expectedAt: new Date('2026-07-31'),
    priority: 'NORMAL',
    items: [
      { sizeId: S.id, ratio: 2 }, { sizeId: M.id, ratio: 3 },
      { sizeId: L.id, ratio: 3 }, { sizeId: XL.id, ratio: 2 },
    ],
    orderTasks: [],
  })

  await upsertOrder({
    code: 'TN150505',
    styleVariantId: v['AO085']!['XANH NHAT']!,
    orderedAt: new Date('2026-06-02'),
    expectedAt: new Date('2026-08-01'),
    priority: 'HIGH',
    notes: 'Chưa chốt đợt nhập.',
    items: [
      { sizeId: S.id, ratio: 3 }, { sizeId: M.id, ratio: 4 },
      { sizeId: L.id, ratio: 4 }, { sizeId: XL.id, ratio: 2 }, { sizeId: XXL.id, ratio: 1 },
    ],
    orderTasks: [
      { taskId: CUT.id, nameSnapshot: CUT.name, position: 10, done: false },
      { taskId: SEW.id, nameSnapshot: SEW.name, position: 20, done: false },
      { taskId: IRON.id, nameSnapshot: IRON.name, position: 30, done: false },
      { taskId: PACK.id, nameSnapshot: PACK.name, position: 40, done: false },
    ],
  })

  console.log('✓ Seeded 5 sample orders (TN150501–TN150505)')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const withSample = process.argv.includes('--sample')

  for (const s of DEFAULT_SIZES) {
    await prisma.size.upsert({ where: { code: s.code }, create: s, update: {} })
  }
  console.log(`✓ Seeded ${DEFAULT_SIZES.length} default sizes`)

  for (const t of DEFAULT_TASKS) {
    await prisma.task.upsert({ where: { code: t.code }, create: t, update: {} })
  }
  console.log(`✓ Seeded ${DEFAULT_TASKS.length} default tasks`)

  const adminId = await seedAdmin()

  if (withSample) {
    await seedSampleData(adminId)
  }
  else {
    console.log('ℹ  Bỏ qua sample data. Chạy `pnpm seed -- --sample` để seed thêm styles + orders mẫu.')
  }

  await seedAiActor()
}

// ─── AI Actor (dùng cho MCP server) ──────────────────────────────────────────
async function seedAiActor() {
  const AI_ACTOR_EMAIL = 'ai-agent@system.local'

  const aiActor = await prisma.user.upsert({
    where: { email: AI_ACTOR_EMAIL },
    update: {},
    create: {
      email: AI_ACTOR_EMAIL,
      name: 'AI Agent',
      passwordHash: '__NOT_USABLE__', // không thể login qua UI
      role: 'EDITOR',
      active: true,
    },
  })

  console.log(`✅ AI Actor: ${aiActor.id}  ← copy vào AI_ACTOR_ID trong mcp-server/.env`)
  return aiActor.id
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

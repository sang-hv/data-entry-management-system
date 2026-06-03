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
  { code: 'SHIP', name: 'Giao hàng', description: 'Đang vận chuyển đến khách' },
]

// ─── Sample demo data (styles, variants, orders, batches) ────────────────────

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

// ─── Sample demo data seeder ─────────────────────────────────────────────────

async function seedSampleData(adminId: string) {
  // Get sizes + tasks seeded above
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
    batches: Array<{ batchNumber: number; batchedAt: Date; note?: string; items: Array<{ sizeId: string; quantity: number }> }>
  }) {
    const existing = await prisma.order.findFirst({ where: { code: params.code } })
    if (existing) return existing

    // Derive status from tasks
    let status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' = 'DRAFT'
    const hasTasks = params.orderTasks.length > 0
    const allDone = hasTasks && params.orderTasks.every((t) => t.done)
    if (allDone) status = 'COMPLETED'
    else if (hasTasks) status = 'ACTIVE'

    const doneTasks = params.orderTasks.filter((t) => t.done).length
    const progressPct = hasTasks ? Math.round((doneTasks / params.orderTasks.length) * 100) : 0

    const order = await prisma.order.create({
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
        items: {
          create: params.items.map((i) => ({ sizeId: i.sizeId, ratio: i.ratio })),
        },
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
        batches: {
          create: params.batches.map((b) => ({
            batchNumber: b.batchNumber,
            batchedAt: b.batchedAt,
            note: b.note ?? null,
            items: { create: b.items.map((i) => ({ sizeId: i.sizeId, quantity: i.quantity })) },
          })),
        },
      },
    })
    return order
  }

  const variantTrangKeXanh = styleVariantMap['AO083']!['TRANG KE XANH']!
  const variantTrangKeDo = styleVariantMap['AO083']!['TRANG KE DO']!
  const variantXanhNavy = styleVariantMap['AO083']!['XANH NAVY']!
  const variantAo84Trang = styleVariantMap['AO084']!['TRANG TRON']!
  const variantAo85Xanh = styleVariantMap['AO085']!['XANH NHAT']!

  // ── Đơn 1: ACTIVE, 2 task done / 4, có 1 batch đã nhập ──
  await upsertOrder({
    code: 'TN150501',
    styleVariantId: variantTrangKeXanh,
    orderedAt: new Date('2026-05-15'),
    expectedAt: new Date('2026-06-30'),
    priority: 'HIGH',
    notes: 'Khách yêu cầu giao trước 30/6. Chú ý kẻ sọc thẳng.',
    items: [
      { sizeId: S.id, ratio: 3 },
      { sizeId: M.id, ratio: 3 },
      { sizeId: L.id, ratio: 2 },
      { sizeId: XL.id, ratio: 1 },
      { sizeId: XXL.id, ratio: 1 },
    ],
    orderTasks: [
      { taskId: CUT.id, nameSnapshot: CUT.name, descriptionSnapshot: CUT.description ?? undefined, position: 10, done: true },
      { taskId: SEW.id, nameSnapshot: SEW.name, descriptionSnapshot: SEW.description ?? undefined, position: 20, done: true },
      { taskId: IRON.id, nameSnapshot: IRON.name, descriptionSnapshot: IRON.description ?? undefined, position: 30, done: false },
      { taskId: PACK.id, nameSnapshot: PACK.name, descriptionSnapshot: PACK.description ?? undefined, position: 40, done: false },
    ],
    batches: [
      {
        batchNumber: 1,
        batchedAt: new Date('2026-05-20'),
        note: 'Đợt 1 — nhập theo tỉ lệ × 8',
        items: [
          { sizeId: S.id, quantity: 24 },
          { sizeId: M.id, quantity: 24 },
          { sizeId: L.id, quantity: 16 },
          { sizeId: XL.id, quantity: 8 },
          { sizeId: XXL.id, quantity: 8 },
        ],
      },
    ],
  })

  // ── Đơn 2: ACTIVE, 1 batch xong, batch 2 nhập thêm ──
  await upsertOrder({
    code: 'TN150502',
    styleVariantId: variantTrangKeDo,
    orderedAt: new Date('2026-05-15'),
    expectedAt: new Date('2026-07-15'),
    priority: 'NORMAL',
    items: [
      { sizeId: S.id, ratio: 2 },
      { sizeId: M.id, ratio: 3 },
      { sizeId: L.id, ratio: 3 },
      { sizeId: XL.id, ratio: 1 },
      { sizeId: XXL.id, ratio: 1 },
    ],
    orderTasks: [
      { taskId: CUT.id, nameSnapshot: CUT.name, position: 10, done: true },
      { taskId: SEW.id, nameSnapshot: SEW.name, position: 20, done: false },
      { taskId: IRON.id, nameSnapshot: IRON.name, position: 30, done: false },
      { taskId: PACK.id, nameSnapshot: PACK.name, position: 40, done: false },
    ],
    batches: [
      {
        batchNumber: 1,
        batchedAt: new Date('2026-05-22'),
        note: 'Đợt 1',
        items: [
          { sizeId: S.id, quantity: 20 },
          { sizeId: M.id, quantity: 30 },
          { sizeId: L.id, quantity: 30 },
          { sizeId: XL.id, quantity: 10 },
          { sizeId: XXL.id, quantity: 10 },
        ],
      },
      {
        batchNumber: 2,
        batchedAt: new Date('2026-06-01'),
        note: 'Đợt 2 — bổ sung',
        items: [
          { sizeId: S.id, quantity: 10 },
          { sizeId: M.id, quantity: 15 },
          { sizeId: L.id, quantity: 15 },
        ],
      },
    ],
  })

  // ── Đơn 3: COMPLETED, tất cả task done ──
  await upsertOrder({
    code: 'TN150503',
    styleVariantId: variantXanhNavy,
    orderedAt: new Date('2026-04-10'),
    expectedAt: new Date('2026-05-10'),
    priority: 'URGENT',
    notes: 'Đã giao xong.',
    items: [
      { sizeId: S.id, ratio: 1 },
      { sizeId: M.id, ratio: 2 },
      { sizeId: L.id, ratio: 2 },
      { sizeId: XL.id, ratio: 1 },
    ],
    orderTasks: [
      { taskId: CUT.id, nameSnapshot: CUT.name, position: 10, done: true },
      { taskId: SEW.id, nameSnapshot: SEW.name, position: 20, done: true },
      { taskId: IRON.id, nameSnapshot: IRON.name, position: 30, done: true },
      { taskId: PACK.id, nameSnapshot: PACK.name, position: 40, done: true },
    ],
    batches: [
      {
        batchNumber: 1,
        batchedAt: new Date('2026-04-20'),
        items: [
          { sizeId: S.id, quantity: 12 },
          { sizeId: M.id, quantity: 24 },
          { sizeId: L.id, quantity: 24 },
          { sizeId: XL.id, quantity: 12 },
        ],
      },
    ],
  })

  // ── Đơn 4: DRAFT, chưa có task, chưa có batch ──
  await upsertOrder({
    code: 'TN150504',
    styleVariantId: variantAo84Trang,
    orderedAt: new Date('2026-06-01'),
    expectedAt: new Date('2026-07-31'),
    priority: 'NORMAL',
    items: [
      { sizeId: S.id, ratio: 2 },
      { sizeId: M.id, ratio: 3 },
      { sizeId: L.id, ratio: 3 },
      { sizeId: XL.id, ratio: 2 },
    ],
    orderTasks: [],
    batches: [],
  })

  // ── Đơn 5: ACTIVE, chưa có batch (để demo "Generate từ tỉ lệ") ──
  await upsertOrder({
    code: 'TN150505',
    styleVariantId: variantAo85Xanh,
    orderedAt: new Date('2026-06-02'),
    expectedAt: new Date('2026-08-01'),
    priority: 'HIGH',
    notes: 'Chưa chốt đợt nhập — dùng "Generate từ tỉ lệ" để tạo batch.',
    items: [
      { sizeId: S.id, ratio: 3 },
      { sizeId: M.id, ratio: 4 },
      { sizeId: L.id, ratio: 4 },
      { sizeId: XL.id, ratio: 2 },
      { sizeId: XXL.id, ratio: 1 },
    ],
    orderTasks: [
      { taskId: CUT.id, nameSnapshot: CUT.name, position: 10, done: false },
      { taskId: SEW.id, nameSnapshot: SEW.name, position: 20, done: false },
      { taskId: IRON.id, nameSnapshot: IRON.name, position: 30, done: false },
      { taskId: PACK.id, nameSnapshot: PACK.name, position: 40, done: false },
    ],
    batches: [],
  })

  console.log('✓ Seeded 5 sample orders (TN150501–TN150505) với items, tasks, batches')
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
  let adminId: string
  if (fixedPassword) {
    const invalid = validateFixedPassword(fixedPassword)
    if (invalid) {
      console.error(`✗ SEED_ADMIN_PASSWORD invalid: ${invalid}`)
      process.exit(1)
    }

    // Always upsert: create if not exists, reset password if exists.
    const passwordHash = await bcrypt.hash(fixedPassword, 12)
    const admin = await prisma.user.upsert({
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
    adminId = admin.id
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✓ Admin user upserted (password reset from SEED_ADMIN_PASSWORD)')
    console.log(`  Email:    ${email}`)
    console.log(`  Password: <from SEED_ADMIN_PASSWORD env>`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }
  else {
    // No fixed password: only create if not exists, generate random.
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      console.log(`✓ Admin ${email} already exists, skipping`)
      adminId = existing.id
    }
    else {
      const password = generateRandomPassword()
      const passwordHash = await bcrypt.hash(password, 12)

      const admin = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: 'ADMIN',
          active: true,
        },
      })
      adminId = admin.id

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('✓ Admin user created (random password)')
      console.log(`  Email:    ${email}`)
      console.log(`  Password: ${password}`)
      console.log('  ⚠️  Lưu lại password này — không thể xem lại sau!')
      console.log('  💡 Đặt SEED_ADMIN_PASSWORD trong .env.local để dùng password cố định.')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
  }

  // Sample demo data (styles, variants, orders, batches)
  await seedSampleData(adminId)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

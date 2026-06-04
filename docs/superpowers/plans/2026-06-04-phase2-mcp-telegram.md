# Phase 2 — MCP Server + Telegram (OpenClaw) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng MCP server (stdio) để OpenClaw/Telegram có thể gọi vào Action Layer của DEMS, bao gồm read tools, write tools với pending-confirm flow.

**Architecture:** MCP server là Node.js process riêng trong thư mục `mcp-server/`, import trực tiếp `server/actions/` và `server/lib/prisma` (không qua HTTP). Transport stdio — OpenClaw spawn như subprocess. Ghi nặng (tạo/sửa/hủy đơn) đi qua pending store in-memory, hỏi confirm trước khi ghi DB.

**Tech Stack:** `@modelcontextprotocol/sdk` (MCP), `zod` (validation), `tsx` (dev runner), `typescript`, Prisma (shared với Phase 1).

---

## File Map

| File | Loại | Trách nhiệm |
|---|---|---|
| `mcp-server/package.json` | Create | Deps riêng cho MCP server |
| `mcp-server/tsconfig.json` | Create | Path alias `~/` → `../` |
| `mcp-server/index.ts` | Create | Entry point: init McpServer, register tools, connect stdio |
| `mcp-server/mcp-context.ts` | Create | Tạo `ActionContext` với `source='mcp'`, actor từ env |
| `mcp-server/pending-store.ts` | Create | In-memory Map + TTL 10 phút cho pending confirmations |
| `mcp-server/format-reply.ts` | Create | Format output → text ngắn gọn tiếng Việt cho Telegram |
| `mcp-server/tools/orders.ts` | Create | 5 tools: search_orders, get_order, create_order, update_order, cancel_order |
| `mcp-server/tools/batches.ts` | Create | 2 tools: create_batch, apply_ratio_to_batch |
| `mcp-server/tools/order-tasks.ts` | Create | 2 tools: pick_tasks, set_task_done |
| `mcp-server/tools/dashboard.ts` | Create | 2 tools: get_dashboard, get_overdue_orders |
| `mcp-server/tools/alerts.ts` | Create | 2 tools: get_alerts, dismiss_alert |
| `mcp-server/tools/confirm.ts` | Create | 2 tools: confirm_pending, cancel_pending |
| `prisma/seed.ts` | Modify | Thêm seed AI_ACTOR user |
| `.env.example` | Modify | Thêm `AI_ACTOR_ID` |

---

## Task 1: Scaffold mcp-server package

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/.env.example`

- [ ] **Step 1: Tạo `mcp-server/package.json`**

```json
{
  "name": "dems-mcp-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx --tsconfig tsconfig.json index.ts",
    "build": "tsc --project tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@prisma/client": "^5.20.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  },
  "engines": {
    "node": ">=24.0.0"
  }
}
```

- [ ] **Step 2: Tạo `mcp-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "~/*": ["../*"]
    }
  },
  "include": ["./**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Tạo `mcp-server/.env.example`**

```env
# Phải match DATABASE_URL trong .env.local của app chính
DATABASE_URL=postgresql://dems:dems@localhost:5432/dems

# UUID của AI actor user (chạy pnpm seed để có giá trị này)
AI_ACTOR_ID=

# Optional: NODE_ENV
NODE_ENV=production
```

- [ ] **Step 4: Cài dependencies**

```bash
cd mcp-server && npm install
```

Expected output: `added X packages` (không có errors).

- [ ] **Step 5: Commit**

```bash
git add mcp-server/package.json mcp-server/tsconfig.json mcp-server/.env.example
git commit -m "feat(mcp): scaffold mcp-server package"
```

---

## Task 2: Seed AI Actor user

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `.env.example`

- [ ] **Step 1: Đọc nội dung hiện tại của `prisma/seed.ts`** để biết cách upsert user, thêm đoạn AI actor vào sau phần seed admin.

- [ ] **Step 2: Thêm seed AI actor vào `prisma/seed.ts`**

Tìm đoạn cuối file (sau khi seed admin và sizes), thêm:

```typescript
// ─── AI Actor (dùng cho MCP server) ──────────────────────────────────────────
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
```

- [ ] **Step 3: Thêm vào `.env.example`**

```env
# MCP Server — AI Actor (lấy từ output của pnpm seed)
AI_ACTOR_ID=
```

- [ ] **Step 4: Chạy seed để lấy AI_ACTOR_ID**

```bash
cd /Users/sanghv/Downloads/data-entry-management-system
pnpm seed
```

Expected output có dòng: `✅ AI Actor: <uuid>  ← copy vào AI_ACTOR_ID`

Copy UUID đó vào `mcp-server/.env` (tạo file này, không commit — nó như `.env.local`):

```env
DATABASE_URL=postgresql://dems:dems@localhost:5432/dems
AI_ACTOR_ID=<uuid-từ-output-trên>
NODE_ENV=production
```

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts .env.example
git commit -m "feat(mcp): seed AI actor user for MCP context"
```

---

## Task 3: mcp-context + pending-store + format-reply

**Files:**
- Create: `mcp-server/mcp-context.ts`
- Create: `mcp-server/pending-store.ts`
- Create: `mcp-server/format-reply.ts`

- [ ] **Step 1: Tạo `mcp-server/mcp-context.ts`**

```typescript
import { randomUUID } from 'node:crypto'
import type { ActionContext } from '../server/actions/_base/context.js'
import { prisma } from '../server/lib/prisma.js'

let _actor: { id: string; email: string; role: 'EDITOR' } | null = null

async function getAiActor() {
  if (_actor) return _actor
  const actorId = process.env['AI_ACTOR_ID']
  if (!actorId) throw new Error('AI_ACTOR_ID env var not set — run pnpm seed first')
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, email: true, role: true },
  })
  if (!user) throw new Error(`AI actor ${actorId} not found in DB — run pnpm seed`)
  _actor = { id: user.id, email: user.email, role: 'EDITOR' }
  return _actor
}

export async function makeMcpContext(idempotencyKey?: string): Promise<ActionContext> {
  const actor = await getAiActor()
  return {
    actor,
    source: 'mcp',
    requestId: randomUUID(),
    idempotencyKey,
  }
}
```

- [ ] **Step 2: Tạo `mcp-server/pending-store.ts`**

```typescript
import { randomUUID } from 'node:crypto'

const TTL_MS = 10 * 60 * 1000 // 10 phút

export interface PendingEntry {
  id: string
  tool: string        // tên tool gốc vd 'create_order'
  args: unknown       // raw args sẽ truyền vào action
  summary: string     // text hiển thị cho user confirm
  expiresAt: Date
}

const store = new Map<string, PendingEntry>()

// Dọn expired entries mỗi 2 phút
setInterval(() => {
  const now = new Date()
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(id)
  }
}, 2 * 60 * 1000)

export function createPending(tool: string, args: unknown, summary: string): PendingEntry {
  const id = randomUUID().slice(0, 8) // short ID dễ đọc
  const entry: PendingEntry = {
    id,
    tool,
    args,
    summary,
    expiresAt: new Date(Date.now() + TTL_MS),
  }
  store.set(id, entry)
  return entry
}

export function getPending(id: string): PendingEntry | undefined {
  const entry = store.get(id)
  if (!entry) return undefined
  if (entry.expiresAt < new Date()) {
    store.delete(id)
    return undefined
  }
  return entry
}

export function deletePending(id: string): boolean {
  return store.delete(id)
}
```

- [ ] **Step 3: Tạo `mcp-server/format-reply.ts`**

```typescript
import type { PendingEntry } from './pending-store.js'

export function fmtPendingConfirm(entry: PendingEntry): string {
  return [
    `📋 Xác nhận thao tác:`,
    entry.summary,
    ``,
    `🔑 ID xác nhận: \`${entry.id}\``,
    `⏰ Hết hạn sau 10 phút`,
    ``,
    `➡️ Dùng tool \`confirm_pending\` với pendingId: "${entry.id}" để xác nhận`,
    `❌ Dùng tool \`cancel_pending\` với pendingId: "${entry.id}" để hủy`,
  ].join('\n')
}

export function fmtOrderSummary(o: {
  code: string
  status: string
  priority: string
  progressPct: number
  expectedAt?: Date | null
  styleCode?: string
  variantName?: string
}): string {
  const deadline = o.expectedAt
    ? o.expectedAt.toLocaleDateString('vi-VN')
    : 'Chưa có deadline'
  const style = o.styleCode ? `${o.styleCode} - ${o.variantName ?? ''}` : 'N/A'
  return [
    `📦 Đơn: ${o.code}`,
    `   Mẫu: ${style}`,
    `   Trạng thái: ${fmtStatus(o.status)} | Tiến độ: ${o.progressPct}%`,
    `   Ưu tiên: ${fmtPriority(o.priority)} | Deadline: ${deadline}`,
  ].join('\n')
}

export function fmtStatus(s: string): string {
  return { DRAFT: '📝 Nháp', ACTIVE: '🔄 Đang chạy', COMPLETED: '✅ Hoàn thành', CANCELLED: '❌ Đã hủy' }[s] ?? s
}

export function fmtPriority(p: string): string {
  return { LOW: '🟢 Thấp', NORMAL: '🔵 Bình thường', HIGH: '🟡 Cao', URGENT: '🔴 Khẩn cấp' }[p] ?? p
}

export function fmtError(err: unknown): string {
  if (err instanceof Error) return `❌ Lỗi: ${err.message}`
  return `❌ Lỗi không xác định`
}
```

- [ ] **Step 4: Commit**

```bash
git add mcp-server/mcp-context.ts mcp-server/pending-store.ts mcp-server/format-reply.ts
git commit -m "feat(mcp): add context, pending store, format helpers"
```

---

## Task 4: Read-only tools (dashboard + alerts)

**Files:**
- Create: `mcp-server/tools/dashboard.ts`
- Create: `mcp-server/tools/alerts.ts`

- [ ] **Step 1: Tạo `mcp-server/tools/dashboard.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getDashboardStats } from '../../server/actions/dashboard/getDashboardStats.js'
import { searchOrders } from '../../server/actions/orders/searchOrders.js'
import { makeMcpContext } from '../mcp-context.js'
import { fmtOrderSummary, fmtStatus } from '../format-reply.js'

export function registerDashboardTools(server: McpServer) {
  server.tool(
    'get_dashboard',
    'Xem tổng quan hệ thống: số đơn đang chạy, trễ deadline, sắp tới hạn, cảnh báo mở',
    {},
    async () => {
      const ctx = await makeMcpContext()
      const { stats, recentOrders } = await getDashboardStats(null, ctx)
      const lines = [
        `📊 Tổng quan hệ thống:`,
        `   🔄 Đang chạy: ${stats.running}`,
        `   🚨 Trễ deadline: ${stats.overdue}`,
        `   ⏰ Sắp tới hạn (7 ngày): ${stats.dueSoon}`,
        `   🔔 Cảnh báo mở: ${stats.openAlerts}`,
        ``,
        recentOrders.length > 0
          ? `📋 Đơn cần chú ý:\n${recentOrders.map(o => fmtOrderSummary(o)).join('\n\n')}`
          : `✅ Không có đơn nào cần chú ý ngay`,
      ]
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.tool(
    'get_overdue_orders',
    'Danh sách đơn hàng đã trễ deadline',
    {
      page: z.number().int().min(1).default(1).describe('Trang (mặc định 1)'),
      pageSize: z.number().int().min(1).max(50).default(10).describe('Số đơn mỗi trang'),
    },
    async ({ page, pageSize }) => {
      const ctx = await makeMcpContext()
      const result = await searchOrders({ overdue: true, page, pageSize, sort: 'expectedAt', sortDir: 'asc' }, ctx)
      if (result.total === 0) {
        return { content: [{ type: 'text', text: '✅ Không có đơn nào trễ deadline.' }] }
      }
      const lines = [
        `🚨 Đơn trễ deadline (${result.total} đơn tổng cộng, trang ${page}):`,
        '',
        ...result.items.map(o => fmtOrderSummary(o)),
      ]
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )
}
```

- [ ] **Step 2: Tạo `mcp-server/tools/alerts.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getActiveAlerts } from '../../server/actions/alerts/getActiveAlerts.js'
import { dismissAlert } from '../../server/actions/alerts/dismissAlert.js'
import { makeMcpContext } from '../mcp-context.js'
import { fmtError } from '../format-reply.js'

export function registerAlertTools(server: McpServer) {
  server.tool(
    'get_alerts',
    'Xem danh sách cảnh báo đang mở. Có thể lọc theo mã đơn hoặc mức độ.',
    {
      orderId: z.string().uuid().optional().describe('Lọc theo ID đơn hàng (uuid)'),
      severity: z
        .array(z.enum(['INFO', 'WARN', 'CRITICAL']))
        .optional()
        .describe('Lọc theo mức độ: INFO | WARN | CRITICAL'),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
    },
    async ({ orderId, severity, page, pageSize }) => {
      const ctx = await makeMcpContext()
      const result = await getActiveAlerts({ orderId, severity, page, pageSize }, ctx)
      const items = (result as { items?: unknown[] }).items ?? (result as unknown[])
      if (!Array.isArray(items) || items.length === 0) {
        return { content: [{ type: 'text', text: '✅ Không có cảnh báo nào.' }] }
      }
      const lines = [`🔔 Cảnh báo (${items.length}):\n`]
      for (const a of items as Array<{ id: string; severity: string; ruleCode: string; message: string; order?: { code: string } }>) {
        const icon = { CRITICAL: '🚨', WARN: '⚠️', INFO: 'ℹ️' }[a.severity] ?? '🔔'
        lines.push(`${icon} [${a.id.slice(0, 8)}] ${a.ruleCode} — ${a.message}${a.order ? ` (đơn ${a.order.code})` : ''}`)
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.tool(
    'dismiss_alert',
    'Bỏ qua (dismiss) một cảnh báo với lý do. Thao tác này ghi thẳng, không cần confirm.',
    {
      alertId: z.string().uuid().describe('ID của cảnh báo (uuid)'),
      reason: z.string().max(2000).optional().describe('Lý do bỏ qua (tùy chọn)'),
    },
    async ({ alertId, reason }) => {
      try {
        const ctx = await makeMcpContext()
        await dismissAlert({ alertId, reason }, ctx)
        return { content: [{ type: 'text', text: `✅ Đã bỏ qua cảnh báo ${alertId.slice(0, 8)}.` }] }
      }
      catch (err) {
        return { content: [{ type: 'text', text: fmtError(err) }] }
      }
    },
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add mcp-server/tools/dashboard.ts mcp-server/tools/alerts.ts
git commit -m "feat(mcp): add dashboard + alerts tools"
```

---

## Task 5: Order read tools + set_task_done (ghi nhẹ)

**Files:**
- Create: `mcp-server/tools/orders.ts` (phần read)
- Create: `mcp-server/tools/order-tasks.ts` (phần set_task_done)

- [ ] **Step 1: Tạo `mcp-server/tools/orders.ts`** — phần read trước (search + get), mutation thêm ở Task 6

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { searchOrders } from '../../server/actions/orders/searchOrders.js'
import { getOrderByCode } from '../../server/actions/orders/getOrderByCode.js'
import { createOrder } from '../../server/actions/orders/createOrder.js'
import { updateOrder } from '../../server/actions/orders/updateOrder.js'
import { cancelOrder } from '../../server/actions/orders/cancelOrder.js'
import { makeMcpContext } from '../mcp-context.js'
import { createPending, getPending, deletePending } from '../pending-store.js'
import { fmtOrderSummary, fmtPendingConfirm, fmtError, fmtStatus, fmtPriority } from '../format-reply.js'

export function registerOrderTools(server: McpServer) {
  // ─── READ ────────────────────────────────────────────────────────────────────

  server.tool(
    'search_orders',
    'Tìm kiếm đơn hàng theo text, trạng thái, độ ưu tiên, deadline',
    {
      q: z.string().optional().describe('Từ khóa tìm kiếm (mã đơn, mẫu áo...)'),
      status: z
        .array(z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']))
        .optional()
        .describe('Lọc theo trạng thái'),
      priority: z
        .array(z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']))
        .optional()
        .describe('Lọc theo ưu tiên'),
      overdue: z.boolean().optional().describe('true = chỉ lấy đơn trễ deadline'),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(10),
    },
    async ({ q, status, priority, overdue, page, pageSize }) => {
      const ctx = await makeMcpContext()
      const result = await searchOrders(
        { q, status, priority, overdue, page, pageSize, sort: 'expectedAt', sortDir: 'asc' },
        ctx,
      )
      if (result.total === 0) {
        return { content: [{ type: 'text', text: '🔍 Không tìm thấy đơn nào.' }] }
      }
      const lines = [
        `🔍 Kết quả (${result.total} đơn tổng, trang ${page}/${Math.ceil(result.total / result.pageSize)}):`,
        '',
        ...result.items.map(o => fmtOrderSummary(o)),
      ]
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  server.tool(
    'get_order',
    'Xem chi tiết một đơn hàng theo mã đơn (vd: TN260601)',
    {
      code: z.string().min(3).max(32).describe('Mã đơn hàng, vd TN260601'),
    },
    async ({ code }) => {
      try {
        const ctx = await makeMcpContext()
        const { order } = await getOrderByCode({ code }, ctx)
        const o = order as {
          code: string; status: string; priority: string; progressPct: number
          expectedAt?: Date | null; orderedAt?: Date | null; notes?: string | null
          styleVariant: { name: string; style: { code: string } }
          tasks: Array<{ nameSnapshot: string; done: boolean; position: number }>
          items: Array<{ size: { code: string }; ratio: number }>
          batches: Array<{ batchNumber: number; batchedAt: Date; items: Array<{ size: { code: string }; quantity: number }> }>
        }
        const taskLines = o.tasks.length > 0
          ? o.tasks
              .sort((a, b) => a.position - b.position)
              .map(t => `   ${t.done ? '✅' : '⬜'} ${t.nameSnapshot}`)
              .join('\n')
          : '   (chưa có task)'
        const itemLines = o.items.length > 0
          ? o.items.map(i => `   ${i.size.code}: tỉ lệ ${i.ratio}`).join(', ')
          : '   (chưa có)'
        const lines = [
          fmtOrderSummary({ code: o.code, status: o.status, priority: o.priority, progressPct: o.progressPct, expectedAt: o.expectedAt, styleCode: o.styleVariant.style.code, variantName: o.styleVariant.name }),
          `   Ngày đặt: ${o.orderedAt ? o.orderedAt.toLocaleDateString('vi-VN') : 'N/A'}`,
          o.notes ? `   Ghi chú: ${o.notes}` : '',
          ``,
          `📐 Quy trình công đoạn:`,
          taskLines,
          ``,
          `📏 Size & tỉ lệ: ${itemLines}`,
          ``,
          `📦 Đợt chốt nhập: ${o.batches.length} đợt`,
        ]
        return { content: [{ type: 'text', text: lines.filter(Boolean).join('\n') }] }
      }
      catch (err) {
        return { content: [{ type: 'text', text: fmtError(err) }] }
      }
    },
  )

  // ─── MUTATIONS (pending flow) ─────────────────────────────────────────────────

  server.tool(
    'create_order',
    'Tạo đơn hàng mới. Sẽ hỏi xác nhận trước khi ghi vào hệ thống.',
    {
      styleVariantId: z.string().uuid().describe('UUID của biến thể mẫu áo'),
      code: z.string().regex(/^[A-Z0-9-]{3,32}$/).optional().describe('Mã đơn tùy chỉnh, vd TN260601 (tự sinh nếu bỏ trống)'),
      orderedAt: z.string().optional().describe('Ngày đặt hàng, vd 2026-06-01'),
      expectedAt: z.string().optional().describe('Deadline giao, vd 2026-07-15'),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL').describe('Ưu tiên'),
      notes: z.string().max(10000).optional().describe('Ghi chú'),
    },
    async (args) => {
      const summary = [
        `Tạo đơn hàng mới:`,
        `  • Mã đơn: ${args.code ?? '(tự sinh)'}`,
        `  • Variant ID: ${args.styleVariantId}`,
        `  • Ngày đặt: ${args.orderedAt ?? 'N/A'}`,
        `  • Deadline: ${args.expectedAt ?? 'Chưa có'}`,
        `  • Ưu tiên: ${fmtPriority(args.priority)}`,
        args.notes ? `  • Ghi chú: ${args.notes}` : '',
      ].filter(Boolean).join('\n')
      const entry = createPending('create_order', args, summary)
      return { content: [{ type: 'text', text: fmtPendingConfirm(entry) }] }
    },
  )

  server.tool(
    'update_order',
    'Cập nhật thông tin đơn hàng (deadline, ưu tiên, ghi chú). Sẽ hỏi xác nhận.',
    {
      orderId: z.string().uuid().describe('UUID của đơn hàng'),
      version: z.number().int().min(0).describe('Version hiện tại (lấy từ get_order)'),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
      expectedAt: z.string().nullable().optional().describe('Deadline mới, vd 2026-07-15, hoặc null để xóa'),
      notes: z.string().max(10000).nullable().optional(),
    },
    async (args) => {
      const changes: string[] = []
      if (args.priority) changes.push(`Ưu tiên → ${fmtPriority(args.priority)}`)
      if (args.expectedAt !== undefined) changes.push(`Deadline → ${args.expectedAt ?? 'Xóa'}`)
      if (args.notes !== undefined) changes.push(`Ghi chú → ${args.notes ?? 'Xóa'}`)
      const summary = [`Cập nhật đơn ${args.orderId.slice(0, 8)}:`, ...changes.map(c => `  • ${c}`)].join('\n')
      const entry = createPending('update_order', args, summary)
      return { content: [{ type: 'text', text: fmtPendingConfirm(entry) }] }
    },
  )

  server.tool(
    'cancel_order',
    'Hủy đơn hàng. Sẽ hỏi xác nhận.',
    {
      orderId: z.string().uuid().describe('UUID của đơn hàng'),
      version: z.number().int().min(0).describe('Version hiện tại'),
      reason: z.string().max(2000).optional().describe('Lý do hủy'),
    },
    async (args) => {
      const summary = [
        `Hủy đơn ${args.orderId.slice(0, 8)}:`,
        args.reason ? `  • Lý do: ${args.reason}` : `  • Không có lý do`,
      ].join('\n')
      const entry = createPending('cancel_order', args, summary)
      return { content: [{ type: 'text', text: fmtPendingConfirm(entry) }] }
    },
  )
}
```

- [ ] **Step 2: Tạo `mcp-server/tools/order-tasks.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { setOrderTaskDone } from '../../server/actions/order-tasks/setOrderTaskDone.js'
import { pickTasksForOrder } from '../../server/actions/order-tasks/pickTasksForOrder.js'
import { makeMcpContext } from '../mcp-context.js'
import { createPending } from '../pending-store.js'
import { fmtPendingConfirm, fmtError } from '../format-reply.js'

export function registerOrderTaskTools(server: McpServer) {
  server.tool(
    'set_task_done',
    'Tick hoàn thành hoặc chưa xong cho một task trong đơn hàng. Ghi thẳng, không cần confirm.',
    {
      orderTaskId: z.string().uuid().describe('UUID của OrderTask'),
      done: z.boolean().describe('true = xong, false = chưa xong'),
      notes: z.string().max(2000).optional().describe('Ghi chú thêm cho task này'),
    },
    async ({ orderTaskId, done, notes }) => {
      try {
        const ctx = await makeMcpContext()
        const result = await setOrderTaskDone({ orderTaskId, done, notes }, ctx)
        const status = done ? '✅ Đánh dấu hoàn thành' : '⬜ Đánh dấu chưa xong'
        return {
          content: [{
            type: 'text',
            text: `${status} task ${orderTaskId.slice(0, 8)}.\nĐơn hàng: tiến độ ${result.order.progressPct}% | ${result.order.status}`,
          }],
        }
      }
      catch (err) {
        return { content: [{ type: 'text', text: fmtError(err) }] }
      }
    },
  )

  server.tool(
    'pick_tasks',
    'Thêm task quy trình vào đơn hàng theo thứ tự. Sẽ hỏi xác nhận.',
    {
      orderId: z.string().uuid().describe('UUID của đơn hàng'),
      taskIds: z
        .array(z.string().uuid())
        .min(1)
        .describe('Danh sách UUID task theo thứ tự muốn thực hiện'),
    },
    async (args) => {
      const summary = [
        `Pick ${args.taskIds.length} task vào đơn ${args.orderId.slice(0, 8)}:`,
        ...args.taskIds.map((id, i) => `  ${i + 1}. ${id.slice(0, 8)}`),
      ].join('\n')
      const entry = createPending('pick_tasks', args, summary)
      return { content: [{ type: 'text', text: fmtPendingConfirm(entry) }] }
    },
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add mcp-server/tools/orders.ts mcp-server/tools/order-tasks.ts
git commit -m "feat(mcp): add order + order-tasks tools"
```

---

## Task 6: Batch tools + Confirm tools

**Files:**
- Create: `mcp-server/tools/batches.ts`
- Create: `mcp-server/tools/confirm.ts`

- [ ] **Step 1: Tạo `mcp-server/tools/batches.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { createBatch } from '../../server/actions/batches/createBatch.js'
import { applyRatioToBatch } from '../../server/actions/batches/applyRatioToBatch.js'
import { makeMcpContext } from '../mcp-context.js'
import { createPending } from '../pending-store.js'
import { fmtPendingConfirm } from '../format-reply.js'

export function registerBatchTools(server: McpServer) {
  server.tool(
    'create_batch',
    'Tạo đợt chốt nhập số lượng cho đơn hàng. Sẽ hỏi xác nhận.',
    {
      orderId: z.string().uuid().describe('UUID của đơn hàng'),
      batchedAt: z.string().optional().describe('Ngày chốt nhập, vd 2026-06-15 (mặc định hôm nay)'),
      note: z.string().max(2000).optional(),
      items: z
        .array(
          z.object({
            sizeId: z.string().uuid().describe('UUID của size'),
            quantity: z.number().int().min(0),
          }),
        )
        .min(1)
        .describe('Danh sách size + số lượng'),
    },
    async (args) => {
      const totalQty = args.items.reduce((s, i) => s + i.quantity, 0)
      const summary = [
        `Tạo đợt chốt nhập cho đơn ${args.orderId.slice(0, 8)}:`,
        `  • Ngày chốt: ${args.batchedAt ?? 'Hôm nay'}`,
        `  • Tổng số lượng: ${totalQty}`,
        `  • Số size: ${args.items.length}`,
        args.note ? `  • Ghi chú: ${args.note}` : '',
      ].filter(Boolean).join('\n')
      const entry = createPending('create_batch', args, summary)
      return { content: [{ type: 'text', text: fmtPendingConfirm(entry) }] }
    },
  )

  server.tool(
    'apply_ratio_to_batch',
    'Tạo đợt chốt nhập tự động từ tỉ lệ size × số nhân. Sẽ hỏi xác nhận.',
    {
      orderId: z.string().uuid().describe('UUID của đơn hàng'),
      multiplier: z
        .number()
        .int()
        .min(1)
        .max(100000)
        .describe('Số nhân, vd 8 → tỉ lệ 3:3:2:1:1 cho ra 24:24:16:8:8'),
      batchedAt: z.string().optional().describe('Ngày chốt nhập (mặc định hôm nay)'),
      note: z.string().max(2000).optional(),
    },
    async (args) => {
      const summary = [
        `Tạo batch từ tỉ lệ cho đơn ${args.orderId.slice(0, 8)}:`,
        `  • Số nhân (multiplier): ${args.multiplier}`,
        `  • Ngày chốt: ${args.batchedAt ?? 'Hôm nay'}`,
        args.note ? `  • Ghi chú: ${args.note}` : '',
      ].filter(Boolean).join('\n')
      const entry = createPending('apply_ratio_to_batch', args, summary)
      return { content: [{ type: 'text', text: fmtPendingConfirm(entry) }] }
    },
  )
}
```

- [ ] **Step 2: Tạo `mcp-server/tools/confirm.ts`** — xử lý toàn bộ pending actions

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getPending, deletePending } from '../pending-store.js'
import { makeMcpContext } from '../mcp-context.js'
import { fmtError } from '../format-reply.js'

// Import all heavy-write actions
import { createOrder } from '../../server/actions/orders/createOrder.js'
import { updateOrder } from '../../server/actions/orders/updateOrder.js'
import { cancelOrder } from '../../server/actions/orders/cancelOrder.js'
import { createBatch } from '../../server/actions/batches/createBatch.js'
import { applyRatioToBatch } from '../../server/actions/batches/applyRatioToBatch.js'
import { pickTasksForOrder } from '../../server/actions/order-tasks/pickTasksForOrder.js'

type ActionArgs = Record<string, unknown>

async function executePendingAction(tool: string, args: ActionArgs): Promise<string> {
  const ctx = await makeMcpContext()
  switch (tool) {
    case 'create_order': {
      const result = await createOrder(args, ctx)
      return `✅ Đã tạo đơn hàng: ${result.order.code}${result.warnings.length > 0 ? `\n⚠️ Lưu ý: ${result.warnings.join(', ')}` : ''}`
    }
    case 'update_order': {
      const { id, version, priority, expectedAt, notes } = args as { id: string; version: number; priority?: string; expectedAt?: string | null; notes?: string | null }
      await updateOrder({
        id,
        version,
        patch: {
          ...(priority !== undefined ? { priority: priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' } : {}),
          ...(expectedAt !== undefined ? { expectedAt: expectedAt ? new Date(expectedAt) : null } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      }, ctx)
      return `✅ Đã cập nhật đơn hàng.`
    }
    case 'cancel_order': {
      const result = await cancelOrder(args, ctx)
      return `✅ Đã hủy đơn hàng ${(result.order as { code: string }).code}.`
    }
    case 'create_batch': {
      const result = await createBatch(args, ctx)
      return `✅ Đã tạo đợt chốt nhập #${(result.batch as { batchNumber: number }).batchNumber}. Tổng: ${result.total} cái.`
    }
    case 'apply_ratio_to_batch': {
      const result = await applyRatioToBatch(args, ctx)
      return `✅ Đã tạo batch từ tỉ lệ. Tổng: ${result.total} cái.`
    }
    case 'pick_tasks': {
      const result = await pickTasksForOrder(args, ctx)
      return `✅ Đã pick ${(result.tasks as unknown[]).length} task vào đơn hàng.`
    }
    default:
      throw new Error(`Unknown pending tool: ${tool}`)
  }
}

export function registerConfirmTools(server: McpServer) {
  server.tool(
    'confirm_pending',
    'Xác nhận thực thi một thao tác đang chờ. Dùng pendingId từ message trước.',
    {
      pendingId: z.string().min(1).describe('ID xác nhận (8 ký tự từ message trước)'),
    },
    async ({ pendingId }) => {
      const entry = getPending(pendingId)
      if (!entry) {
        return {
          content: [{
            type: 'text',
            text: `❌ Không tìm thấy pending ID "${pendingId}". Có thể đã hết hạn (10 phút) hoặc ID sai.`,
          }],
        }
      }
      deletePending(pendingId)
      try {
        const message = await executePendingAction(entry.tool, entry.args as ActionArgs)
        return { content: [{ type: 'text', text: message }] }
      }
      catch (err) {
        return { content: [{ type: 'text', text: fmtError(err) }] }
      }
    },
  )

  server.tool(
    'cancel_pending',
    'Hủy bỏ một thao tác đang chờ xác nhận.',
    {
      pendingId: z.string().min(1).describe('ID xác nhận cần hủy'),
    },
    async ({ pendingId }) => {
      const deleted = deletePending(pendingId)
      return {
        content: [{
          type: 'text',
          text: deleted
            ? `🚫 Đã hủy thao tác ${pendingId}. Không có gì được ghi vào hệ thống.`
            : `⚠️ Không tìm thấy pending ID "${pendingId}" (có thể đã hết hạn).`,
        }],
      }
    },
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add mcp-server/tools/batches.ts mcp-server/tools/confirm.ts
git commit -m "feat(mcp): add batch tools + confirm/cancel pending tools"
```

---

## Task 7: Entry point — index.ts

**Files:**
- Create: `mcp-server/index.ts`

- [ ] **Step 1: Tạo `mcp-server/index.ts`**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerDashboardTools } from './tools/dashboard.js'
import { registerAlertTools } from './tools/alerts.js'
import { registerOrderTools } from './tools/orders.js'
import { registerOrderTaskTools } from './tools/order-tasks.js'
import { registerBatchTools } from './tools/batches.js'
import { registerConfirmTools } from './tools/confirm.js'

const server = new McpServer({
  name: 'dems-mcp',
  version: '1.0.0',
})

// Register all tool groups
registerDashboardTools(server)
registerAlertTools(server)
registerOrderTools(server)
registerOrderTaskTools(server)
registerBatchTools(server)
registerConfirmTools(server)

// Connect via stdio transport (OpenClaw spawns this process)
const transport = new StdioServerTransport()
await server.connect(transport)

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.close()
  process.exit(0)
})
```

- [ ] **Step 2: Smoke test — chạy dev server và kiểm tra không lỗi khởi động**

```bash
cd mcp-server
AI_ACTOR_ID=<uuid-từ-seed> DATABASE_URL=postgresql://dems:dems@localhost:5432/dems npm run dev
```

Expected: process khởi động không có error. Không có output vì stdio dành cho MCP protocol. Dừng bằng Ctrl+C.

Nếu lỗi import: kiểm tra path alias trong tsconfig — các import `../../server/...` phải resolve đúng.

- [ ] **Step 3: Build TypeScript**

```bash
cd mcp-server
npm run build
```

Expected: tạo ra thư mục `mcp-server/dist/` không có TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add mcp-server/index.ts mcp-server/dist/
git commit -m "feat(mcp): add entry point, build dist"
```

---

## Task 8: Thêm vào .gitignore + README hướng dẫn setup

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Thêm vào `.gitignore`**

```
# MCP Server
mcp-server/node_modules/
mcp-server/.env
mcp-server/dist/
```

- [ ] **Step 2: Thêm section vào `README.md`** — sau phần "Tài liệu kỹ thuật":

```markdown
---

## Phase 2 — MCP Server (Telegram / OpenClaw)

### Yêu cầu thêm

- [OpenClaw](https://openclaw.ai/) self-hosted đã cài và chạy trên cùng máy
- Telegram Bot Token (tạo qua @BotFather)
- API Key của LLM provider (config trong OpenClaw UI)

### Setup MCP Server

```bash
# 1. Cài deps
cd mcp-server && npm install

# 2. Seed AI actor (nếu chưa làm)
cd .. && pnpm seed
# Copy AI_ACTOR_ID từ output

# 3. Tạo file env cho MCP server
cat > mcp-server/.env << 'EOF'
DATABASE_URL=postgresql://dems:dems@localhost:5432/dems
AI_ACTOR_ID=<uuid-từ-output-seed>
NODE_ENV=production
EOF

# 4. Build
cd mcp-server && npm run build
```

### Cấu hình trong OpenClaw

Thêm vào file MCP config của OpenClaw:

```json
{
  "mcpServers": {
    "dems": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://dems:dems@localhost:5432/dems",
        "AI_ACTOR_ID": "<uuid-của-AI-actor>"
      }
    }
  }
}
```

### Tools có sẵn

| Tool | Loại | Mô tả |
|---|---|---|
| `get_dashboard` | Read | Tổng quan: đang chạy, trễ, cảnh báo |
| `get_overdue_orders` | Read | Danh sách đơn trễ deadline |
| `search_orders` | Read | Tìm đơn theo text/status/priority |
| `get_order` | Read | Chi tiết đơn theo mã |
| `get_alerts` | Read | Cảnh báo đang mở |
| `dismiss_alert` | Ghi nhẹ | Bỏ qua cảnh báo |
| `set_task_done` | Ghi nhẹ | Tick task xong/chưa xong |
| `create_order` | Ghi nặng* | Tạo đơn mới |
| `update_order` | Ghi nặng* | Cập nhật deadline/ưu tiên/ghi chú |
| `cancel_order` | Ghi nặng* | Hủy đơn |
| `create_batch` | Ghi nặng* | Tạo đợt chốt nhập |
| `apply_ratio_to_batch` | Ghi nặng* | Tạo batch từ tỉ lệ × số nhân |
| `pick_tasks` | Ghi nặng* | Pick task quy trình vào đơn |
| `confirm_pending` | Confirm | Xác nhận thực thi pending action |
| `cancel_pending` | Confirm | Hủy pending action |

*Ghi nặng: tạo pending entry trước, hỏi xác nhận, rồi mới ghi DB.
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore README.md
git commit -m "docs: add Phase 2 MCP setup instructions"
```

---

## Kiểm tra tích hợp thủ công (sau khi cài OpenClaw)

Sau khi config OpenClaw xong, test các câu lệnh sau trong Telegram:

1. **Read:** "Cho tôi xem tổng quan hôm nay" → gọi `get_dashboard`
2. **Read:** "Có đơn nào trễ không?" → gọi `get_overdue_orders`
3. **Read:** "Tìm đơn TN260601" → gọi `get_order`
4. **Ghi nhẹ:** "Tick xong task [orderTaskId]" → gọi `set_task_done`, ghi thẳng
5. **Ghi nặng:** "Tạo đơn mới mẫu AO083..." → gọi `create_order` → nhận pending ID → confirm → ghi DB
6. **Audit log:** Vào web app → kiểm tra AuditLog có `source = 'mcp'` ✅

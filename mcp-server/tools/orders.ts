import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { searchOrders } from '../../server/actions/orders/searchOrders.js'
import { getOrderByCode } from '../../server/actions/orders/getOrderByCode.js'
import { createOrder } from '../../server/actions/orders/createOrder.js'
import { updateOrder } from '../../server/actions/orders/updateOrder.js'
import { cancelOrder } from '../../server/actions/orders/cancelOrder.js'
import { makeMcpContext } from '../mcp-context.js'
import { createPending } from '../pending-store.js'
import { fmtOrderSummary, fmtPendingConfirm, fmtError, fmtPriority } from '../format-reply.js'

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
        return { content: [{ type: 'text' as const, text: '🔍 Không tìm thấy đơn nào.' }] }
      }
      const lines = [
        `🔍 Kết quả (${result.total} đơn tổng, trang ${page}/${Math.ceil(result.total / result.pageSize)}):`,
        '',
        ...result.items.map(o => fmtOrderSummary(o)),
      ]
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
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
          code: string
          status: string
          priority: string
          progressPct: number
          expectedAt?: Date | null
          orderedAt?: Date | null
          notes?: string | null
          styleVariant: { name: string; style: { code: string } }
          tasks: Array<{ nameSnapshot: string; done: boolean; position: number }>
          items: Array<{ size: { code: string }; ratio: number }>
          batches: Array<{ batchNumber: number }>
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
          fmtOrderSummary({
            code: o.code,
            status: o.status,
            priority: o.priority,
            progressPct: o.progressPct,
            expectedAt: o.expectedAt,
            styleCode: o.styleVariant.style.code,
            variantName: o.styleVariant.name,
          }),
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
        return { content: [{ type: 'text' as const, text: lines.filter(Boolean).join('\n') }] }
      }
      catch (err) {
        return { content: [{ type: 'text' as const, text: fmtError(err) }] }
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
      return { content: [{ type: 'text' as const, text: fmtPendingConfirm(entry) }] }
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
      return { content: [{ type: 'text' as const, text: fmtPendingConfirm(entry) }] }
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
      return { content: [{ type: 'text' as const, text: fmtPendingConfirm(entry) }] }
    },
  )
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
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
      return { content: [{ type: 'text' as const, text: fmtPendingConfirm(entry) }] }
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
      return { content: [{ type: 'text' as const, text: fmtPendingConfirm(entry) }] }
    },
  )
}

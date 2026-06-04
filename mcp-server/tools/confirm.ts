import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getPending, deletePending } from '../pending-store.js'
import { makeMcpContext } from '../mcp-context.js'
import { fmtError } from '../format-reply.js'
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
      // args: { styleVariantId, code?, orderedAt?, expectedAt?, priority, notes? }
      const result = await createOrder(args, ctx)
      const warnings = result.warnings.length > 0 ? `\n⚠️ Lưu ý: ${result.warnings.join(', ')}` : ''
      return `✅ Đã tạo đơn hàng: ${result.order.code}${warnings}`
    }

    case 'update_order': {
      // args: { orderId, version, priority?, expectedAt?, notes? }
      // updateOrder action nhận: { id, version, patch: { ... } }
      const { orderId, version, priority, expectedAt, notes } = args as {
        orderId: string
        version: number
        priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
        expectedAt?: string | null
        notes?: string | null
      }
      await updateOrder({
        id: orderId,
        version,
        patch: {
          ...(priority !== undefined ? { priority } : {}),
          ...(expectedAt !== undefined ? { expectedAt: expectedAt ? new Date(expectedAt) : null } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      }, ctx)
      return `✅ Đã cập nhật đơn hàng.`
    }

    case 'cancel_order': {
      // args: { orderId, version, reason? }
      // cancelOrder action nhận: { id, version, reason? }
      const { orderId, version, reason } = args as { orderId: string; version: number; reason?: string }
      const result = await cancelOrder({ id: orderId, version, reason }, ctx)
      return `✅ Đã hủy đơn hàng ${(result.order as { code: string }).code}.`
    }

    case 'create_batch': {
      // args: { orderId, batchedAt?, note?, items: [...] }
      const result = await createBatch(args, ctx)
      return `✅ Đã tạo đợt chốt nhập #${(result.batch as { batchNumber: number }).batchNumber}. Tổng: ${result.total} cái.`
    }

    case 'apply_ratio_to_batch': {
      // args: { orderId, multiplier, batchedAt?, note? }
      const result = await applyRatioToBatch(args, ctx)
      return `✅ Đã tạo batch từ tỉ lệ. Tổng: ${result.total} cái.`
    }

    case 'pick_tasks': {
      // args: { orderId, taskIds: [...] }
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
            type: 'text' as const,
            text: `❌ Không tìm thấy pending ID "${pendingId}". Có thể đã hết hạn (10 phút) hoặc ID sai.`,
          }],
        }
      }
      deletePending(pendingId)
      try {
        const message = await executePendingAction(entry.tool, entry.args as ActionArgs)
        return { content: [{ type: 'text' as const, text: message }] }
      }
      catch (err) {
        return { content: [{ type: 'text' as const, text: fmtError(err) }] }
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
          type: 'text' as const,
          text: deleted
            ? `🚫 Đã hủy thao tác ${pendingId}. Không có gì được ghi vào hệ thống.`
            : `⚠️ Không tìm thấy pending ID "${pendingId}" (có thể đã hết hạn).`,
        }],
      }
    },
  )
}

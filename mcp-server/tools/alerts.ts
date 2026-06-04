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
        return { content: [{ type: 'text' as const, text: '✅ Không có cảnh báo nào.' }] }
      }
      const lines = [`🔔 Cảnh báo (${items.length}):\n`]
      for (const a of items as Array<{ id: string; severity: string; ruleCode: string; message: string; order?: { code: string } }>) {
        const iconMap: Record<string, string> = { CRITICAL: '🚨', WARN: '⚠️', INFO: 'ℹ️' }
        const icon = iconMap[a.severity] ?? '🔔'
        lines.push(`${icon} [${a.id.slice(0, 8)}] ${a.ruleCode} — ${a.message}${a.order ? ` (đơn ${a.order.code})` : ''}`)
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
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
        return { content: [{ type: 'text' as const, text: `✅ Đã bỏ qua cảnh báo ${alertId.slice(0, 8)}.` }] }
      }
      catch (err) {
        return { content: [{ type: 'text' as const, text: fmtError(err) }] }
      }
    },
  )
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getDashboardStats } from '../../server/actions/dashboard/getDashboardStats.js'
import { searchOrders } from '../../server/actions/orders/searchOrders.js'
import { makeMcpContext } from '../mcp-context.js'
import { fmtOrderSummary } from '../format-reply.js'

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
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
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
        return { content: [{ type: 'text' as const, text: '✅ Không có đơn nào trễ deadline.' }] }
      }
      const lines = [
        `🚨 Đơn trễ deadline (${result.total} đơn tổng cộng, trang ${page}):`,
        '',
        ...result.items.map(o => fmtOrderSummary(o)),
      ]
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )
}

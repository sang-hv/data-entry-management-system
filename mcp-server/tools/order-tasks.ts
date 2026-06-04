import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { setOrderTaskDone } from '../../server/actions/order-tasks/setOrderTaskDone.js'
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
            type: 'text' as const,
            text: `${status} task ${orderTaskId.slice(0, 8)}.\nĐơn hàng: tiến độ ${result.order.progressPct}% | ${result.order.status}`,
          }],
        }
      }
      catch (err) {
        return { content: [{ type: 'text' as const, text: fmtError(err) }] }
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
      return { content: [{ type: 'text' as const, text: fmtPendingConfirm(entry) }] }
    },
  )
}

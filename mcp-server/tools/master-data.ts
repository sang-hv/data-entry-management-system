import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listStyles } from '../../server/actions/styles/listStyles.js'
import { getStyleById } from '../../server/actions/styles/getStyleById.js'
import { listSizes } from '../../server/actions/sizes/listSizes.js'
import { listTasks } from '../../server/actions/tasks/listTasks.js'
import { makeMcpContext } from '../mcp-context.js'
import { fmtError } from '../format-reply.js'

/**
 * Master-data lookup tools. These are essential: every write tool needs a UUID
 * (styleVariantId, sizeId, taskId) that the AI can only obtain by listing the
 * master data first.
 */
export function registerMasterDataTools(server: McpServer) {
  server.tool(
    'list_styles',
    'Liệt kê mẫu áo (style). Trả về id + code + tên. Để lấy danh sách variant kèm id, dùng get_style.',
    {
      q: z.string().optional().describe('Từ khóa tìm mẫu (theo code hoặc tên)'),
    },
    async ({ q }) => {
      const ctx = await makeMcpContext()
      const { items, total } = await listStyles({ q }, ctx)
      if (total === 0) {
        return { content: [{ type: 'text' as const, text: '🔍 Không tìm thấy mẫu áo nào.' }] }
      }
      const lines = [
        `👕 Mẫu áo (${total}):`,
        '',
        ...items.map(
          (s) => `• ${s.code} — ${s.name}  (id: ${s.id}, ${s.variantCount} variant)`,
        ),
        '',
        '💡 Dùng get_style với id để xem variant kèm styleVariantId (cần cho create_order).',
      ]
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )

  server.tool(
    'get_style',
    'Xem chi tiết một mẫu áo kèm danh sách variant (mỗi variant có styleVariantId dùng để tạo đơn).',
    {
      styleId: z.string().uuid().describe('UUID của mẫu áo (lấy từ list_styles)'),
    },
    async ({ styleId }) => {
      try {
        const ctx = await makeMcpContext()
        const { style } = await getStyleById({ id: styleId }, ctx)
        const s = style as {
          code: string
          name: string
          variants: Array<{ id: string; name: string; color: string | null }>
        }
        const variantLines = s.variants.length > 0
          ? s.variants.map(
              (vrt) => `   • ${s.code}-${vrt.name}${vrt.color ? ` (${vrt.color})` : ''}\n     styleVariantId: ${vrt.id}`,
            )
          : ['   (chưa có variant)']
        const lines = [
          `👕 ${s.code} — ${s.name}`,
          '',
          '🎨 Variants:',
          ...variantLines,
        ]
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
      }
      catch (err) {
        return { content: [{ type: 'text' as const, text: fmtError(err) }] }
      }
    },
  )

  server.tool(
    'list_sizes',
    'Liệt kê các size (S/M/L/XL/XXL...). Trả về sizeId — cần cho create_batch.',
    {},
    async () => {
      const ctx = await makeMcpContext()
      const { items } = await listSizes({}, ctx)
      if (items.length === 0) {
        return { content: [{ type: 'text' as const, text: 'Không có size nào.' }] }
      }
      const lines = [
        `📏 Sizes (${items.length}):`,
        '',
        ...items.map((s) => `• ${s.code} (${s.label})  sizeId: ${s.id}`),
      ]
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )

  server.tool(
    'list_tasks',
    'Liệt kê thư viện task quy trình (Cắt vải, May, Ủi...). Trả về taskId — cần cho pick_tasks.',
    {
      q: z.string().optional().describe('Từ khóa tìm task'),
    },
    async ({ q }) => {
      const ctx = await makeMcpContext()
      const { items } = await listTasks({ q }, ctx)
      if (items.length === 0) {
        return { content: [{ type: 'text' as const, text: '🔍 Không tìm thấy task nào.' }] }
      }
      const lines = [
        `📐 Task quy trình (${items.length}):`,
        '',
        ...items.map((t) => `• ${t.name}${t.code ? ` [${t.code}]` : ''}  taskId: ${t.id}`),
      ]
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    },
  )
}

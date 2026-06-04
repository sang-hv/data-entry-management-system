/**
 * Smoke test luồng GHI với pending-confirm.
 * Tạo đơn nháp → confirm → set_task_done → cancel_order, rồi cleanup.
 * Chạy: node --import tsx mcp-server/smoke-write.mts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const transport = new StdioClientTransport({
  command: 'node',
  args: ['--import', 'tsx', join(__dirname, 'index.ts')],
  env: process.env as Record<string, string>,
})
const client = new Client({ name: 'smoke-write', version: '1.0.0' })
await client.connect(transport)

async function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const res = await client.callTool({ name, arguments: args })
  const content = res.content as Array<{ type: string; text?: string }>
  const text = content.map(c => c.text ?? '').join('\n')
  console.log(`\n──── ${name}(${JSON.stringify(args)}) ────\n${text}`)
  return text
}

function extractPendingId(text: string): string {
  const m = text.match(/ID xác nhận:\s*`([^`]+)`/)
  if (!m) throw new Error('Không tìm thấy pendingId trong response')
  return m[1]!
}

// 1. Lấy 1 styleVariantId từ get_style (AO083)
const stylesText = await call('list_styles', { q: 'AO083' })
const styleId = stylesText.match(/id:\s*([0-9a-f-]{36})/)![1]!
const styleText = await call('get_style', { styleId })
const variantId = styleText.match(/styleVariantId:\s*([0-9a-f-]{36})/)![1]!

// 2. create_order → pending
const createText = await call('create_order', {
  styleVariantId: variantId,
  code: 'MCPTEST01',
  priority: 'NORMAL',
  notes: 'Đơn test MCP — sẽ xóa',
})
const pendingId = extractPendingId(createText)

// 3. confirm_pending → ghi DB thật
await call('confirm_pending', { pendingId })

// 4. get_order để lấy orderId + version
const orderText = await call('get_order', { code: 'MCPTEST01' })
const orderId = orderText.match(/orderId:\s*([0-9a-f-]{36})/)![1]!
const version = Number(orderText.match(/version:\s*(\d+)/)![1]!)

// 5. cancel_order → pending → confirm (cleanup, vì không có hard-delete tool)
const cancelText = await call('cancel_order', {
  orderId,
  version,
  reason: 'Cleanup smoke test',
})
const cancelPendingId = extractPendingId(cancelText)
await call('confirm_pending', { pendingId: cancelPendingId })

// 6. Test cancel_pending (không confirm)
const create2 = await call('create_order', {
  styleVariantId: variantId,
  code: 'MCPTEST02',
  priority: 'LOW',
})
const pid2 = extractPendingId(create2)
await call('cancel_pending', { pendingId: pid2 })
// Verify MCPTEST02 KHÔNG được tạo
await call('get_order', { code: 'MCPTEST02' })

await client.close()
console.log('\n✅ Smoke write test xong. Đơn MCPTEST01 đã bị hủy, MCPTEST02 không được tạo.')
process.exit(0)

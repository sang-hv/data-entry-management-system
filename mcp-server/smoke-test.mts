/**
 * Smoke test: spawn MCP server qua stdio, list tools, gọi vài read tool.
 * Chạy: node --import tsx/esm mcp-server/smoke-test.mts
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

const client = new Client({ name: 'smoke-test', version: '1.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
console.log(`\n✅ Đã đăng ký ${tools.length} tools:`)
for (const t of tools) console.log(`   • ${t.name}`)

async function call(name: string, args: Record<string, unknown> = {}) {
  console.log(`\n──── call ${name}(${JSON.stringify(args)}) ────`)
  const res = await client.callTool({ name, arguments: args })
  const content = res.content as Array<{ type: string; text?: string }>
  for (const c of content) console.log(c.text ?? JSON.stringify(c))
}

await call('get_dashboard')
await call('list_sizes')
await call('list_styles')
await call('list_tasks')
await call('search_orders', { pageSize: 3 })
await call('get_order', { code: 'TN150501' })

await client.close()
console.log('\n✅ Smoke test xong.')
process.exit(0)

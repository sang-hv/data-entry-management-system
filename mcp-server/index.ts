import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerMasterDataTools } from './tools/master-data.js'
import { registerDashboardTools } from './tools/dashboard.js'
import { registerAlertTools } from './tools/alerts.js'
import { registerOrderTools } from './tools/orders.js'
import { registerOrderTaskTools } from './tools/order-tasks.js'
import { registerBatchTools } from './tools/batches.js'
import { registerConfirmTools } from './tools/confirm.js'

// Load mcp-server/.env nếu chạy standalone (OpenClaw truyền env trực tiếp qua config
// nên bước này chỉ là fallback tiện lợi cho dev/test local).
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '.env')
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath)
}

const server = new McpServer({
  name: 'dems-mcp',
  version: '1.0.0',
})

registerMasterDataTools(server)
registerDashboardTools(server)
registerAlertTools(server)
registerOrderTools(server)
registerOrderTaskTools(server)
registerBatchTools(server)
registerConfirmTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)

process.on('SIGINT', async () => {
  await server.close()
  process.exit(0)
})

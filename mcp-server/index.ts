import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerDashboardTools } from './tools/dashboard.js'
import { registerAlertTools } from './tools/alerts.js'
import { registerOrderTools } from './tools/orders.js'
import { registerOrderTaskTools } from './tools/order-tasks.js'
import { registerBatchTools } from './tools/batches.js'
import { registerConfirmTools } from './tools/confirm.js'

const server = new McpServer({
  name: 'dems-mcp',
  version: '1.0.0',
})

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

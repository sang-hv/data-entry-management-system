# Phase 2 — MCP Server + Telegram (OpenClaw) Design

> **Ngày:** 2026-06-04
> **Trạng thái:** Approved — sẵn sàng implement

---

## 1. Mục tiêu

Thêm lớp AI bên ngoài vào hệ thống quản lý đơn hàng may mặc (DEMS), cho phép admin ra lệnh qua **Telegram** bằng ngôn ngữ tự nhiên tiếng Việt. AI (OpenClaw) nhận tin nhắn, hiểu yêu cầu, gọi vào **MCP server** để đọc/ghi dữ liệu, và trả lời trong Telegram.

Nguyên tắc: hệ thống lõi Phase 1 **không thay đổi**. MCP server là lớp adapter thuần túy ở ngoài.

---

## 2. Kiến trúc

```
Telegram ←→ OpenClaw (LLM + agent, cùng máy)
                │  stdio (spawn process)
                ▼
          MCP Server (Node.js process riêng)
          mcp-server/
                │  import trực tiếp (không HTTP)
                ▼
          server/actions/ (Phase 1 Action Layer)
                │
                ▼
          PostgreSQL
```

- **Transport:** stdio — OpenClaw spawn MCP server như subprocess, giao tiếp qua stdin/stdout.
- **MCP Server** import trực tiếp `server/actions/` và `server/lib/prisma` — không HTTP hop, cùng DB connection pool.
- **OpenClaw** tự lo LLM provider — admin config API key trong OpenClaw UI. MCP server hoàn toàn LLM-agnostic.
- **ActionContext.source = 'mcp'** cho mọi tool call từ AI — phân biệt với `'ui'` trong audit log.

---

## 3. Cấu trúc thư mục

```
mcp-server/
├── package.json          # deps: @modelcontextprotocol/sdk, zod, tsx
├── tsconfig.json         # path alias ~/ → ../ để import server/actions
├── index.ts              # entry: khởi tạo McpServer, register tools, connect stdio
├── mcp-context.ts        # tạo ActionContext với source='mcp', actor = AI user
├── pending-store.ts      # lưu pending confirmations trong memory (Map + TTL 10 phút)
├── format-reply.ts       # helper format message trả về Telegram (text ngắn gọn, tiếng Việt)
└── tools/
    ├── orders.ts         # tools: search_orders, get_order, create_order, update_order, cancel_order
    ├── batches.ts        # tools: create_batch, apply_ratio_to_batch
    ├── order-tasks.ts    # tools: pick_tasks, set_task_done
    ├── dashboard.ts      # tools: get_dashboard, get_overdue_orders
    ├── alerts.ts         # tools: get_alerts, dismiss_alert
    └── confirm.ts        # tools: confirm_pending, cancel_pending
```

---

## 4. Tool list đầy đủ

### Read-only (ghi thẳng vào response, không cần confirm)

| Tool | Action gọi | Mô tả |
|---|---|---|
| `search_orders` | `searchOrders` | Tìm đơn theo text/status/deadline |
| `get_order` | `getOrderByCode` | Xem chi tiết đơn theo mã |
| `get_dashboard` | `getDashboardStats` | Xem tổng quan: đang chạy, trễ, sắp hạn |
| `get_overdue_orders` | `searchOrders({overdue:true})` | Danh sách đơn đã trễ |
| `get_alerts` | `getActiveAlerts` | Danh sách cảnh báo đang mở |

### Ghi nhẹ (ghi thẳng, không cần confirm)

| Tool | Action gọi | Mô tả |
|---|---|---|
| `set_task_done` | `setOrderTaskDone` | Tick task xong / chưa xong |
| `dismiss_alert` | `dismissAlert` | Bỏ qua cảnh báo |

### Ghi nặng (tạo pending → hỏi confirm → ghi DB)

| Tool | Action gọi | Mô tả |
|---|---|---|
| `create_order` | `createOrder` | Tạo đơn hàng mới |
| `update_order` | `updateOrder` | Cập nhật deadline/ghi chú/ưu tiên |
| `cancel_order` | `cancelOrder` | Hủy đơn |
| `create_batch` | `createBatch` | Tạo đợt chốt nhập |
| `apply_ratio_to_batch` | `applyRatioToBatch` | Tạo batch từ tỉ lệ × multiplier |
| `pick_tasks` | `pickTasksForOrder` | Pick task quy trình vào đơn |

### Confirm flow

| Tool | Mô tả |
|---|---|
| `confirm_pending` | Xác nhận thực thi một pending action |
| `cancel_pending` | Hủy một pending action |

---

## 5. Pending Store

- **In-memory Map** — đủ cho 1 admin dùng, không cần Redis.
- TTL 10 phút — sau đó pending tự xóa, không thể confirm.
- Schema mỗi entry:
  ```ts
  interface PendingEntry {
    id: string          // uuid
    action: string      // 'create_order' | 'update_order' | ...
    args: unknown       // raw input cho action
    summary: string     // text hiển thị để user confirm
    expiresAt: Date
  }
  ```

---

## 6. AI Actor

MCP server cần một `actor` (User record) để ghi vào `ActionContext`. Giải pháp: seed một user đặc biệt `AI_ACTOR` trong DB với role `EDITOR`, không có session, không đăng nhập được qua UI. MCP server đọc `AI_ACTOR_ID` từ env.

---

## 7. Confirm flow chi tiết

```
User: "Tạo đơn TN260601 mẫu AO083"
  → OpenClaw gọi tool create_order(...)
  → MCP: tạo pending entry P1, trả về:
    { pending: true, pendingId: "P1", summary: "Tạo đơn TN260601..." }
  → OpenClaw nhận → reply Telegram:
    "📋 Xác nhận tạo đơn:
     • Mã: TN260601
     • Mẫu: AO083-TRANG KE XANH
     Gõ 'xác nhận' hoặc 'hủy'"

User: "xác nhận"
  → OpenClaw gọi tool confirm_pending({ pendingId: "P1" })
  → MCP: gọi action thật createOrder(...) với ctx.source='mcp'
  → Reply: "✅ Đã tạo đơn TN260601"
```

---

## 8. Bảo mật

- MCP server chỉ chạy được trên cùng máy (stdio transport, không expose port).
- AI Actor không thể đăng nhập qua UI (không có passwordHash hợp lệ).
- Validation giống hệt UI — Zod schema Phase 1 không thay đổi.
- Mọi mutation ghi `source = 'mcp'` trong AuditLog — truy vết đầy đủ.
- MCP server không expose cơ chế bypass auth hay idempotency.

---

## 9. Setup OpenClaw

Admin cần làm sau khi MCP server build xong:

1. Cài OpenClaw (self-hosted) theo hướng dẫn tại openclaw.ai.
2. Thêm Telegram bot token vào OpenClaw config.
3. Thêm LLM API key (OpenAI/Anthropic/Ollama) vào OpenClaw config.
4. Thêm MCP server vào OpenClaw config:
   ```json
   {
     "mcpServers": {
       "dems": {
         "command": "node",
         "args": ["/path/to/mcp-server/dist/index.js"],
         "env": {
           "DATABASE_URL": "...",
           "AI_ACTOR_ID": "..."
         }
       }
     }
   }
   ```

---

## 10. Ngoài phạm vi Phase 2

- Vision từ ảnh (Phase 2.5)
- Multi-user / phân quyền nhiều tài khoản Telegram
- Persistent pending store (Redis/DB)
- Web UI để xem pending queue

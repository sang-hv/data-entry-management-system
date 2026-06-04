# DEMS — Data Entry Management System

Hệ thống quản lý đơn đặt hàng may mặc nội bộ. Xây dựng bằng Nuxt 3 + Prisma + PostgreSQL.

## Tính năng

- **Đơn hàng** — tạo, tra cứu, lọc theo trạng thái/deadline; theo dõi tiến độ công đoạn
- **Quy trình công đoạn** — master data (Cắt vải, May, Ủi, Đóng gói...); pick task vào đơn, tick hoàn thành, auto-derive trạng thái đơn
- **Size & tỉ lệ** — khai báo size + tỉ lệ phân bổ cho mỗi đơn
- **Mẫu áo** — quản lý style + biến thể (màu/họa tiết) + ảnh mẫu
- **Cảnh báo tự động** — rule engine đánh giá sức khỏe đơn (trễ deadline, chưa có quy trình...), dismiss, cron 10 phút
- **Dashboard** — stat cards thật + danh sách đơn cần chú ý

---

## Yêu cầu môi trường

| Phần mềm | Phiên bản |
|---|---|
| Node.js | 24 LTS (xem `.nvmrc`) |
| pnpm | 9+ |
| Docker + Docker Compose | latest |
| macOS hoặc Linux | — |

---

## Setup local (lần đầu)

```bash
# 1. Dùng đúng Node version
nvm use

# 2. Cài dependencies
pnpm install

# 3. Start Postgres
docker compose up -d

# 4. Copy env (rồi chỉnh nếu cần)
cp .env.example .env.local

# 5. Apply DB schema
pnpm prisma:migrate

# 6. Seed admin + master data (sizes, tasks)
pnpm seed

# (tùy chọn) Seed thêm styles + orders mẫu để demo
pnpm seed -- --sample

# 7. Start dev server
pnpm dev
# → http://localhost:3000
```

**Login:** email và password được in ra console lúc seed. Mặc định nếu có `SEED_ADMIN_PASSWORD` trong `.env.local`:
- Email: `admin@local`
- Password: giá trị `SEED_ADMIN_PASSWORD` (mặc định trong `.env.example`: `Admin@Local2026`)

---

## Scripts

| Script | Mô tả |
|---|---|
| `pnpm dev` | Dev server với hot-reload |
| `pnpm build` | Production build |
| `pnpm typecheck` | Vue + TypeScript type check |
| `pnpm lint` | ESLint |
| `pnpm test` | Chạy toàn bộ test (vitest) |
| `pnpm seed` | Admin + master data (sizes, tasks) |
| `pnpm seed -- --sample` | + thêm styles và orders mẫu để demo |
| `pnpm prisma:migrate` | Apply migration DB |
| `pnpm prisma:studio` | Prisma Studio tại http://localhost:5555 |

---

## ⚠️ Lưu ý: integration tests dùng DB dev

Test integration (`tests/integration/**`) chạy trực tiếp trên DB dev (cùng Postgres với môi trường local). Mỗi test chạy `resetDb()` xóa sạch data trước khi test.

**Sau khi chạy `pnpm test`, phải seed lại:**

```bash
pnpm seed
```
> **Tip:** set `SEED_ADMIN_PASSWORD` trong `.env.local` để dùng password cố định — `pnpm seed` sẽ luôn upsert admin với password đó, tiện recovery sau khi test xóa data.

---

## Cấu trúc thư mục

```
├── server/
│   ├── actions/          # Business logic layer (entry point cho mọi mutation)
│   ├── api/              # HTTP handlers (mỏng — chỉ parse + gọi action)
│   ├── modules/          # Repos, domain helpers
│   │   └── alerts/       # Rule engine + alert repo
│   ├── jobs/             # Cron jobs (alert evaluator mỗi 10 phút)
│   ├── middleware/        # Request ID, auth
│   └── plugins/          # Prisma, logger, jobs scheduler
├── pages/                # Nuxt pages (UI)
├── components/           # Vue components tái dụng
├── composables/          # useAuth, useDebouncedRef
├── i18n/locales/         # Chuỗi tiếng Việt
├── prisma/
│   ├── schema.prisma     # Schema đầy đủ
│   ├── migrations/       # Migration history
│   └── seed.ts           # Admin + data mẫu
└── tests/
    ├── unit/             # Pure function tests (rules, helpers)
    └── integration/      # Action tests với Postgres thật
```

---

## Alert Rules

| Code | Điều kiện | Severity |
|---|---|---|
| `OVERDUE` | `expectedAt < now` và chưa hoàn thành | CRITICAL |
| `DUE_SOON_3D` | Deadline trong 3 ngày | CRITICAL |
| `DUE_SOON_7D` | Deadline trong 4-7 ngày | WARN |
| `MISSING_DEADLINE` | Đơn ACTIVE chưa có ngày giao | WARN |
| `NO_ITEMS` | Đơn ACTIVE chưa có size & tỉ lệ | WARN |
| `NO_TASKS` | Đơn ACTIVE chưa có quy trình | WARN |
| `STALE_ORDER` | Đơn ACTIVE không cập nhật > 14 ngày | INFO |

---

## Backup thủ công

```bash
# Dump DB (chạy khi Docker đang up)
docker exec dems_postgres pg_dump -U dems dems > backup-$(date +%Y%m%d).sql

# Restore
docker exec -i dems_postgres psql -U dems dems < backup-20260604.sql
```

---

## Tài liệu kỹ thuật

- `docs/overview.md` — tổng quan nghiệp vụ
- `docs/implementation-plan.md` — blueprint kỹ thuật đầy đủ (schema, action layer, conventions)
- `docs/plans/` — plan TDD chi tiết từng milestone (M1–M6)

---

## Phase 2 — MCP Server (Telegram / OpenClaw)

### Yêu cầu thêm

- [OpenClaw](https://openclaw.ai/) self-hosted đã cài và chạy trên cùng máy
- Telegram Bot Token (tạo qua [@BotFather](https://t.me/BotFather))
- API Key của LLM provider (config trong OpenClaw UI)

### Setup MCP Server

```bash
# 1. Cài deps
cd mcp-server && npm install

# 2. Seed AI actor (nếu chưa làm)
cd .. && pnpm seed
# Output sẽ in: ✅ AI Actor: <uuid>  ← copy uuid này

# 3. Tạo file env cho MCP server (không commit file này)
cp mcp-server/.env.example mcp-server/.env
# Điền DATABASE_URL và AI_ACTOR_ID vào mcp-server/.env

# 4. Build
cd mcp-server && npm run build
```

### Cấu hình trong OpenClaw

Thêm vào file MCP config của OpenClaw (`~/.openclaw/mcp.json` hoặc tương đương):

```json
{
  "mcpServers": {
    "dems": {
      "command": "npx",
      "args": ["tsx", "--tsconfig", "mcp-server/tsconfig.json", "mcp-server/index.ts"],
      "cwd": "/absolute/path/to/data-entry-management-system",
      "env": {
        "DATABASE_URL": "postgresql://dems:dems_dev_password@localhost:5432/dems",
        "AI_ACTOR_ID": "<uuid-của-AI-actor-từ-pnpm-seed>"
      }
    }
  }
}
```

### Tools có sẵn

| Tool | Loại | Mô tả |
|---|---|---|
| `get_dashboard` | Read | Tổng quan: đang chạy, trễ, cảnh báo |
| `get_overdue_orders` | Read | Danh sách đơn trễ deadline |
| `search_orders` | Read | Tìm đơn theo text/status/priority |
| `get_order` | Read | Chi tiết đơn theo mã |
| `get_alerts` | Read | Cảnh báo đang mở |
| `dismiss_alert` | Ghi nhẹ | Bỏ qua cảnh báo (không cần confirm) |
| `set_task_done` | Ghi nhẹ | Tick task xong/chưa xong (không cần confirm) |
| `create_order` | Ghi nặng* | Tạo đơn mới |
| `update_order` | Ghi nặng* | Cập nhật deadline/ưu tiên/ghi chú |
| `cancel_order` | Ghi nặng* | Hủy đơn |
| `create_batch` | Ghi nặng* | Tạo đợt chốt nhập |
| `apply_ratio_to_batch` | Ghi nặng* | Tạo batch từ tỉ lệ × số nhân |
| `pick_tasks` | Ghi nặng* | Pick task quy trình vào đơn |
| `confirm_pending` | Confirm | Xác nhận thực thi pending action |
| `cancel_pending` | Confirm | Hủy pending action |

*Ghi nặng: tạo pending entry trước, hỏi xác nhận, rồi mới ghi DB.

### Ví dụ chat Telegram

```
Bạn: "Có đơn nào trễ không?"
AI: 🚨 Đơn trễ deadline (2 đơn):
    📦 Đơn: TN150501 ...

Bạn: "Tạo đơn mới mẫu AO083-TRANG KE XANH, deadline 15/8"
AI: 📋 Xác nhận tạo đơn:
    • Mã đơn: (tự sinh)
    • Deadline: 2026-08-15
    🔑 ID xác nhận: `a1b2c3d4`
    ➡️ Dùng confirm_pending với pendingId: "a1b2c3d4"

Bạn: "xác nhận"
AI: ✅ Đã tạo đơn hàng: TN260605
```

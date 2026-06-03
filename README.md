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

# Data Entry Management System

Hệ thống quản lý đơn đặt hàng may mặc nội bộ. Xem chi tiết:

- `docs/overview.md` — tổng quan (gửi khách).
- `docs/implementation-plan.md` — blueprint kỹ thuật.
- `docs/plans/` — plan TDD chi tiết từng milestone.

## Yêu cầu môi trường

- Node 24 (xem `.nvmrc`)
- pnpm 9
- Docker + Docker Compose
- macOS / Linux

## Setup local

```bash
nvm use
pnpm install
docker compose up -d            # Postgres ở port 5432, Adminer ở 8080
cp .env.example .env.local      # rồi edit nếu cần
pnpm prisma:migrate             # tạo schema + apply migrations
pnpm seed                       # tạo admin + sizes mặc định
pnpm dev                        # http://localhost:3000
```

Login với email và password được in ra console khi seed.

## Scripts

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm typecheck` — type check
- `pnpm lint` — eslint check
- `pnpm test` — vitest run
- `pnpm prisma:studio` — DB GUI tại http://localhost:5555

## ⚠️ Note: integration tests use the dev database

Integration tests (`tests/integration/**`) run against the **same** Postgres
database as development. They use `prisma.X.deleteMany()` to reset state in
`beforeEach` blocks — meaning **running `pnpm test` will wipe seeded data**.

If you ran tests and your admin user / sample data is gone:

```bash
pnpm seed                   # re-creates admin + default sizes
```

Future improvement (post-M1): switch tests to a dedicated test schema, or
wrap each test in a transaction that rolls back. For Phase 1 / single-dev
workflow this is acceptable.

## Project structure

Xem `docs/implementation-plan.md` mục 4.

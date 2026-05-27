# M1 Foundation — Implementation Plan

> **For agentic workers:** dùng skill `subagent-driven-development` (recommended) hoặc `executing-plans` để implement từng task. Steps dùng checkbox (`- [ ]`).

**Goal:** Khởi tạo project Nuxt 3 + Prisma + Postgres trên Mac Mini, có 1 admin login được, có health endpoint, có CI cơ bản.

**Architecture:** Nuxt 3 monolith, Postgres qua Docker Compose, Prisma ORM. Action layer + middleware auth + cookie session. Sau M1 sẽ có "trang trắng" sau khi login — chưa có business logic, đó là M2 trở đi.

**Tech Stack:** Node 24, **Nuxt 4** (4.x backward-compatible with Nuxt 3 codebase), TypeScript strict, Prisma 5, PostgreSQL 15, Zod, bcrypt, pino, Nuxt UI v3, vitest 4, pnpm 9.

**Reference docs:** `docs/implementation-plan.md` (blueprint), `docs/overview.md` (high-level).

> **Note about Nuxt 4:** Nuxt 4 default expects source in `app/` directory but auto-detects legacy layout (root-level `pages/`, `components/`, `composables/`, `middleware/`). Plan continues to use legacy layout (root-level dirs) — works on Nuxt 4 without changes via `future.compatibilityVersion: 3` or by explicitly setting `srcDir`. nuxt.config in Task 3 has appropriate setting.

**Acceptance criteria (toàn M1):**
- [ ] `pnpm install && docker compose up -d && pnpm prisma migrate dev && pnpm seed && pnpm dev` chạy được từ máy mới.
- [ ] `/` redirect `/login`.
- [ ] Login admin seeded → vào trang chính (placeholder dashboard).
- [ ] Logout → redirect login.
- [ ] `/api/health` trả `{ status: 'ok', dbReachable: true, time: ISO }`.
- [ ] DB có sẵn 5 size mặc định (S/M/L/XL/XXL).
- [ ] CI xanh: typecheck + lint.

---

## Task 1: Init repo, .gitignore, .nvmrc, README skeleton

**Files:**
- Modify: `.gitignore`
- Create: `.nvmrc`
- Create: `README.md`
- Create: `package.json`

- [ ] **Step 1.1: Update `.gitignore`**

```gitignore
# Node
node_modules/
.output/
.nuxt/
.nitro/
.cache/
dist/

# Env
.env
.env.local
.env.*.local

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Storage
storage/uploads/
backups/

# Prisma
prisma/migrations/dev.db*

# Test
coverage/
.vitest-cache/
```

- [ ] **Step 1.2: Create `.nvmrc`**

```
24
```

- [ ] **Step 1.3: Create `package.json`**

```json
{
  "name": "data-entry-management-system",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "typecheck": "nuxt typecheck",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@nuxt/ui": "^3.0.0",
    "@prisma/client": "^5.20.0",
    "bcrypt": "^5.1.1",
    "nuxt": "^3.13.0",
    "pino": "^9.5.0",
    "vue": "^3.5.0",
    "vue-router": "^4.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nuxt/eslint": "^0.5.0",
    "@nuxt/test-utils": "^3.14.0",
    "@types/bcrypt": "^5.0.2",
    "@types/node": "^24.0.0",
    "eslint": "^9.10.0",
    "prisma": "^5.20.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=24.0.0"
  },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 1.4: Create `README.md`**

```markdown
# Data Entry Management System

Hệ thống quản lý đơn đặt hàng may mặc nội bộ. Xem chi tiết:
- `docs/overview.md` — tổng quan (gửi khách).
- `docs/implementation-plan.md` — blueprint kỹ thuật.

## Yêu cầu môi trường

- Node 24 (xem `.nvmrc`)
- pnpm 9
- Docker + Docker Compose
- macOS / Linux

## Setup local

\```bash
nvm use
pnpm install
docker compose up -d            # Postgres ở port 5432
cp .env.example .env.local      # rồi edit nếu cần
pnpm prisma:migrate              # tạo schema + apply migrations
pnpm seed                        # tạo admin + sizes mặc định
pnpm dev                         # http://localhost:3000
\```

Login với email và password được in ra console khi seed.

## Scripts

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm typecheck` — type check
- `pnpm lint` — eslint check
- `pnpm test` — vitest run
- `pnpm prisma:studio` — DB GUI

## Project structure

Xem `docs/implementation-plan.md` mục 4.
```

- [ ] **Step 1.5: Init pnpm + commit**

Run:
```bash
pnpm install
```
Expected: tạo `pnpm-lock.yaml` và `node_modules/`.

```bash
git add .
git commit -m "chore: init project skeleton"
```

---

## Task 2: Docker Compose cho Postgres + Adminer

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 2.1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: dems_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: dems
      POSTGRES_PASSWORD: dems_dev_password
      POSTGRES_DB: dems
    ports:
      - "5432:5432"
    volumes:
      - dems_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dems -d dems"]
      interval: 5s
      timeout: 3s
      retries: 10

  adminer:
    image: adminer:latest
    container_name: dems_adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  dems_pg_data:
```

- [ ] **Step 2.2: Create `.env.example`**

```bash
# Database
DATABASE_URL="postgresql://dems:dems_dev_password@localhost:5432/dems?schema=public"

# App
NODE_ENV=development
LOG_LEVEL=info
SESSION_TTL_DAYS=7

# Storage
STORAGE_DIR=./storage/uploads

# Seed admin (chỉ dùng cho seed)
SEED_ADMIN_EMAIL=admin@local
SEED_ADMIN_NAME=Administrator
```

- [ ] **Step 2.3: Copy `.env.example` → `.env.local`, start postgres, verify**

```bash
cp .env.example .env.local
docker compose up -d
docker compose ps
```
Expected: `dems_postgres` healthy, `dems_adminer` running.

```bash
docker exec dems_postgres pg_isready -U dems -d dems
```
Expected: `accepting connections`.

- [ ] **Step 2.4: Commit**

```bash
git add docker-compose.yml .env.example .env.local
# .env.local nằm trong .gitignore — sẽ không bị commit
git status
git add docker-compose.yml .env.example
git commit -m "chore: add docker-compose for postgres + adminer"
```

---

## Task 3: TypeScript + ESLint config + Nuxt config

**Files:**
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `nuxt.config.ts`
- Create: `app.vue`

- [ ] **Step 3.1: Create `tsconfig.json`**

```json
{
  "extends": "./.nuxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 3.2: Create `eslint.config.mjs`**

```js
import nuxt from './.nuxt/eslint.config.mjs'

export default nuxt({
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'vue/multi-word-component-names': 'off',
  },
})
```

- [ ] **Step 3.3: Create `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  compatibilityDate: '2025-05-26',
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
  ],
  runtimeConfig: {
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
    storageDir: process.env.STORAGE_DIR ?? './storage/uploads',
    public: {},
  },
  typescript: {
    typeCheck: true,
    strict: true,
  },
  nitro: {
    experimental: { tasks: false },
  },
})
```

- [ ] **Step 3.4: Create `app.vue`**

```vue
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

- [ ] **Step 3.5: Run nuxt prepare to gen `.nuxt`**

```bash
pnpm nuxt prepare
```
Expected: tạo thư mục `.nuxt/` (gitignored).

- [ ] **Step 3.6: Verify typecheck**

```bash
pnpm typecheck
```
Expected: PASS với 0 errors (warning được, lỗi không được).

- [ ] **Step 3.7: Commit**

```bash
git add tsconfig.json eslint.config.mjs nuxt.config.ts app.vue
git commit -m "chore: configure typescript, eslint, nuxt"
```

---

## Task 4: Prisma schema + initial migration

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/.gitignore` (cho migrations dev local)

- [ ] **Step 4.1: Create `prisma/schema.prisma`**

Copy schema **đầy đủ** từ `docs/implementation-plan.md` mục 5 (bao gồm User, Session, Style, StyleVariant, Size, Order, OrderItem, OrderBatch, BatchItem, OrderUpdate, Alert, Attachment, AuditLog, IdempotencyKey, OrderCodeCounter).

> **Nhắc:** không paste lại 200 dòng vào plan — engineer mở `docs/implementation-plan.md` mục 5 và copy nguyên si vào `prisma/schema.prisma`. Verify bằng cách run `pnpm prisma format` — Prisma sẽ auto-format và báo lỗi nếu sai syntax.

- [ ] **Step 4.2: Format & validate schema**

```bash
pnpm prisma format
pnpm prisma validate
```
Expected: cả 2 PASS không lỗi.

- [ ] **Step 4.3: Run initial migration**

```bash
pnpm prisma migrate dev --name init
```
Expected: tạo `prisma/migrations/<timestamp>_init/migration.sql` và apply lên DB. Generate Prisma Client.

- [ ] **Step 4.4: Verify schema in DB**

```bash
docker exec -it dems_postgres psql -U dems -d dems -c "\dt"
```
Expected: list 15 tables (User, Session, Style, StyleVariant, Size, Order, OrderItem, OrderBatch, BatchItem, OrderUpdate, Alert, Attachment, AuditLog, IdempotencyKey, OrderCodeCounter, _prisma_migrations).

- [ ] **Step 4.5: Commit**

```bash
git add prisma/
git commit -m "feat(db): add prisma schema and initial migration"
```

---

## Task 5: Prisma singleton plugin + logger

**Files:**
- Create: `server/plugins/prisma.ts`
- Create: `server/plugins/logger.ts`

- [ ] **Step 5.1: Create `server/plugins/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma = global.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma
}

export default defineNitroPlugin(() => {
  // Singleton initialized on import. Plugin ensures it loads at boot.
})
```

- [ ] **Step 5.2: Create `server/plugins/logger.ts`**

```ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ['password', '*.password', '*.passwordHash', 'authorization', 'cookie'],
    censor: '[REDACTED]',
  },
})

export default defineNitroPlugin(() => {
  logger.info({ event: 'app.boot' }, 'Application booting')
})
```

- [ ] **Step 5.3: Commit**

```bash
git add server/plugins/
git commit -m "feat(server): add prisma singleton and pino logger"
```

---

## Task 6: Action layer base — context, errors, idempotency

**Files:**
- Create: `server/actions/_base/context.ts`
- Create: `server/actions/_base/errors.ts`
- Create: `server/actions/_base/idempotency.ts`

- [ ] **Step 6.1: Create `server/actions/_base/context.ts`**

```ts
import type { Role } from '@prisma/client'

export type ActionSource = 'ui' | 'api' | 'mcp' | 'system'

export interface Actor {
  id: string
  email: string
  role: Role
}

export interface ActionContext {
  actor: Actor | null
  source: ActionSource
  requestId: string
  idempotencyKey?: string
}

export function systemContext(requestId: string): ActionContext {
  return { actor: null, source: 'system', requestId }
}
```

- [ ] **Step 6.2: Create `server/actions/_base/errors.ts`**

```ts
export class ActionError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ActionError'
  }
}

export class ValidationError extends ActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION', message, 400, details)
  }
}

export class NotFoundError extends ActionError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} ${id} not found`, 404, { entity, id })
  }
}

export class ConflictError extends ActionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details)
  }
}

export class ForbiddenError extends ActionError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}

export class UnauthorizedError extends ActionError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class OptimisticLockError extends ActionError {
  constructor() {
    super('STALE_VERSION', 'Resource was modified by another request, please reload', 409)
  }
}
```

- [ ] **Step 6.3: Write failing test for idempotency wrapper**

Create: `tests/unit/actions/_base/idempotency.test.ts`

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { withIdempotency } from '~/server/actions/_base/idempotency'
import { prisma } from '~/server/plugins/prisma'
import type { ActionContext } from '~/server/actions/_base/context'

const makeCtx = (key?: string): ActionContext => ({
  actor: { id: 'test-actor', email: 'test@local', role: 'ADMIN' },
  source: 'ui',
  requestId: 'req-test',
  idempotencyKey: key,
})

describe('withIdempotency', () => {
  beforeEach(async () => {
    await prisma.idempotencyKey.deleteMany()
  })

  it('runs function when no idempotency key', async () => {
    let calls = 0
    const result = await withIdempotency(makeCtx(), 'test.action', async () => {
      calls++
      return { value: 42 }
    })
    expect(calls).toBe(1)
    expect(result).toEqual({ value: 42 })
  })

  it('runs once and caches result for same key', async () => {
    const key = 'test-key-1'
    let calls = 0
    const fn = async () => { calls++; return { value: 'first' } }

    const r1 = await withIdempotency(makeCtx(key), 'test.action', fn)
    const r2 = await withIdempotency(makeCtx(key), 'test.action', fn)

    expect(calls).toBe(1)
    expect(r1).toEqual({ value: 'first' })
    expect(r2).toEqual({ value: 'first' })
  })

  it('throws if same key used for different action', async () => {
    const key = 'test-key-2'
    await withIdempotency(makeCtx(key), 'action.a', async () => ({ ok: true }))

    await expect(
      withIdempotency(makeCtx(key), 'action.b', async () => ({ ok: true })),
    ).rejects.toThrow(/Idempotency key reused/)
  })
})
```

- [ ] **Step 6.4: Run test → verify FAIL**

```bash
pnpm vitest run tests/unit/actions/_base/idempotency.test.ts
```
Expected: FAIL with "Cannot find module '~/server/actions/_base/idempotency'".

- [ ] **Step 6.5: Implement `server/actions/_base/idempotency.ts`**

```ts
import type { ActionContext } from './context'
import { prisma } from '~/server/plugins/prisma'

const TTL_HOURS = 24

export async function withIdempotency<T>(
  ctx: ActionContext,
  actionName: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!ctx.idempotencyKey) return fn()

  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: ctx.idempotencyKey },
  })

  if (existing) {
    if (existing.action !== actionName) {
      throw new Error(
        `Idempotency key "${ctx.idempotencyKey}" was previously used for action "${existing.action}", cannot reuse for "${actionName}"`,
      )
    }
    return existing.responseJson as T
  }

  const result = await fn()
  await prisma.idempotencyKey.create({
    data: {
      key: ctx.idempotencyKey,
      action: actionName,
      responseHash: '',
      responseJson: result as object,
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000),
    },
  })
  return result
}
```

- [ ] **Step 6.6: Configure vitest**

Create: `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
```

- [ ] **Step 6.7: Run test → verify PASS**

```bash
pnpm vitest run tests/unit/actions/_base/idempotency.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 6.8: Commit**

```bash
git add server/actions/_base/ tests/ vitest.config.ts
git commit -m "feat(actions): add base context, errors, idempotency wrapper"
```

---

## Task 7: Audit log helper + repo

**Files:**
- Create: `server/modules/audit/audit.repo.ts`

- [ ] **Step 7.1: Write failing test**

Create: `tests/unit/modules/audit.test.ts`

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { auditRepo } from '~/server/modules/audit/audit.repo'
import { prisma } from '~/server/plugins/prisma'

describe('auditRepo', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany()
  })

  it('writes an audit entry with all fields', async () => {
    await auditRepo.write({
      actorId: null,
      source: 'system',
      action: 'test.create',
      entityType: 'TestEntity',
      entityId: 'entity-1',
      before: null,
      after: { name: 'foo' },
      requestId: 'req-1',
    })

    const entries = await prisma.auditLog.findMany()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      source: 'system',
      action: 'test.create',
      entityType: 'TestEntity',
      entityId: 'entity-1',
      requestId: 'req-1',
    })
    expect(entries[0]!.after).toEqual({ name: 'foo' })
  })

  it('lists audit entries for an entity', async () => {
    await auditRepo.write({
      actorId: null, source: 'system', action: 'test.create',
      entityType: 'TestEntity', entityId: 'entity-2',
      before: null, after: { v: 1 }, requestId: 'r1',
    })
    await auditRepo.write({
      actorId: null, source: 'system', action: 'test.update',
      entityType: 'TestEntity', entityId: 'entity-2',
      before: { v: 1 }, after: { v: 2 }, requestId: 'r2',
    })

    const entries = await auditRepo.listForEntity('TestEntity', 'entity-2')
    expect(entries).toHaveLength(2)
    expect(entries[0]!.action).toBe('test.update') // newest first
  })
})
```

- [ ] **Step 7.2: Run test → verify FAIL**

```bash
pnpm vitest run tests/unit/modules/audit.test.ts
```
Expected: FAIL with "Cannot find module".

- [ ] **Step 7.3: Implement `server/modules/audit/audit.repo.ts`**

```ts
import type { Prisma } from '@prisma/client'
import { prisma } from '~/server/plugins/prisma'

export interface AuditWriteInput {
  actorId: string | null
  source: string
  action: string
  entityType: string
  entityId: string
  before: unknown
  after: unknown
  requestId: string | null
}

export const auditRepo = {
  async write(input: AuditWriteInput) {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        source: input.source,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before as Prisma.InputJsonValue,
        after: input.after as Prisma.InputJsonValue,
        requestId: input.requestId,
      },
    })
  },

  async listForEntity(entityType: string, entityId: string, limit = 50) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },
}
```

- [ ] **Step 7.4: Run test → verify PASS**

```bash
pnpm vitest run tests/unit/modules/audit.test.ts
```
Expected: 2 tests PASS.

- [ ] **Step 7.5: Commit**

```bash
git add server/modules/audit/ tests/unit/modules/audit.test.ts
git commit -m "feat(audit): add audit repo with write and listForEntity"
```

---

## Task 8: Password helper (bcrypt wrapper)

**Files:**
- Create: `server/modules/auth/password.ts`

- [ ] **Step 8.1: Write failing test**

Create: `tests/unit/modules/auth/password.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword, validatePasswordStrength } from '~/server/modules/auth/password'

describe('password', () => {
  it('hashes and verifies password', async () => {
    const hash = await hashPassword('Secure123Pass')
    expect(hash).not.toBe('Secure123Pass')
    expect(hash.length).toBeGreaterThan(20)

    expect(await verifyPassword('Secure123Pass', hash)).toBe(true)
    expect(await verifyPassword('WrongPass123', hash)).toBe(false)
  })

  it('rejects passwords below 10 chars', () => {
    const r = validatePasswordStrength('Short1')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/10/)
  })

  it('rejects passwords without digit', () => {
    const r = validatePasswordStrength('NoDigitsHere')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/digit|số/i)
  })

  it('rejects passwords without letter', () => {
    const r = validatePasswordStrength('1234567890')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/letter|chữ/i)
  })

  it('accepts strong password', () => {
    const r = validatePasswordStrength('Secure123Pass')
    expect(r.ok).toBe(true)
  })
})
```

- [ ] **Step 8.2: Run test → FAIL**

```bash
pnpm vitest run tests/unit/modules/auth/password.test.ts
```

- [ ] **Step 8.3: Implement `server/modules/auth/password.ts`**

```ts
import bcrypt from 'bcrypt'

const COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export interface PasswordCheckResult {
  ok: boolean
  reason?: string
}

export function validatePasswordStrength(plain: string): PasswordCheckResult {
  if (plain.length < 10) {
    return { ok: false, reason: 'Password must be at least 10 characters' }
  }
  if (!/\d/.test(plain)) {
    return { ok: false, reason: 'Password must contain at least one digit' }
  }
  if (!/[a-zA-Z]/.test(plain)) {
    return { ok: false, reason: 'Password must contain at least one letter' }
  }
  return { ok: true }
}
```

- [ ] **Step 8.4: Run test → PASS**

```bash
pnpm vitest run tests/unit/modules/auth/password.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 8.5: Commit**

```bash
git add server/modules/auth/password.ts tests/unit/modules/auth/
git commit -m "feat(auth): add bcrypt password helper with strength validation"
```

---

## Task 9: Session repo + token helper

**Files:**
- Create: `server/modules/auth/session.ts`
- Create: `server/modules/auth/auth.repo.ts`

- [ ] **Step 9.1: Write failing test**

Create: `tests/unit/modules/auth/session.test.ts`

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { hashToken, generateSessionToken } from '~/server/modules/auth/session'
import { authRepo } from '~/server/modules/auth/auth.repo'
import { prisma } from '~/server/plugins/prisma'
import { hashPassword } from '~/server/modules/auth/password'

describe('session', () => {
  let userId: string

  beforeEach(async () => {
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    const u = await prisma.user.create({
      data: {
        email: 'sess@local',
        name: 'Session Test',
        passwordHash: await hashPassword('TestPass123'),
        role: 'ADMIN',
      },
    })
    userId = u.id
  })

  it('generateSessionToken returns 43+ chars URL-safe string', () => {
    const t = generateSessionToken()
    expect(t.length).toBeGreaterThanOrEqual(43)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('hashToken is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })

  it('createSession + findValidSession round-trip', async () => {
    const token = generateSessionToken()
    const session = await authRepo.createSession({
      userId, token, ttlDays: 7, ipAddress: '127.0.0.1', userAgent: 'test',
    })
    expect(session.userId).toBe(userId)

    const found = await authRepo.findValidSession(token)
    expect(found).not.toBeNull()
    expect(found!.userId).toBe(userId)
  })

  it('findValidSession returns null for expired session', async () => {
    const token = generateSessionToken()
    await authRepo.createSession({ userId, token, ttlDays: 7 })

    // manually expire
    await prisma.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const found = await authRepo.findValidSession(token)
    expect(found).toBeNull()
  })

  it('deleteSession removes by token', async () => {
    const token = generateSessionToken()
    await authRepo.createSession({ userId, token, ttlDays: 7 })
    await authRepo.deleteSession(token)
    expect(await authRepo.findValidSession(token)).toBeNull()
  })
})
```

- [ ] **Step 9.2: FAIL**

```bash
pnpm vitest run tests/unit/modules/auth/session.test.ts
```

- [ ] **Step 9.3: Implement `server/modules/auth/session.ts`**

```ts
import { randomBytes, createHash } from 'node:crypto'

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
```

- [ ] **Step 9.4: Implement `server/modules/auth/auth.repo.ts`**

```ts
import { prisma } from '~/server/plugins/prisma'
import { hashToken } from './session'

export const authRepo = {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  },

  async updateLastLoginAt(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })
  },

  async createSession(input: {
    userId: string
    token: string
    ttlDays: number
    ipAddress?: string
    userAgent?: string
  }) {
    const expiresAt = new Date(Date.now() + input.ttlDays * 86400_000)
    return prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash: hashToken(input.token),
        expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    })
  },

  async findValidSession(token: string) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    })
    if (!session) return null
    if (session.expiresAt <= new Date()) return null
    if (!session.user.active) return null
    return session
  },

  async deleteSession(token: string) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  },

  async deleteExpiredSessions() {
    const r = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    return r.count
  },
}
```

- [ ] **Step 9.5: PASS**

```bash
pnpm vitest run tests/unit/modules/auth/session.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 9.6: Commit**

```bash
git add server/modules/auth/session.ts server/modules/auth/auth.repo.ts tests/unit/modules/auth/session.test.ts
git commit -m "feat(auth): add session token + auth repo"
```

---

## Task 10: Login + logout actions

**Files:**
- Create: `server/actions/auth/login.ts`
- Create: `server/actions/auth/logout.ts`

- [ ] **Step 10.1: Write failing test for login**

Create: `tests/integration/actions/auth/login.test.ts`

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { login } from '~/server/actions/auth/login'
import { logout } from '~/server/actions/auth/logout'
import { prisma } from '~/server/plugins/prisma'
import { hashPassword } from '~/server/modules/auth/password'
import { authRepo } from '~/server/modules/auth/auth.repo'
import type { ActionContext } from '~/server/actions/_base/context'

const ctx: ActionContext = {
  actor: null,
  source: 'ui',
  requestId: 'req-test',
}

describe('login action', () => {
  beforeEach(async () => {
    await prisma.session.deleteMany()
    await prisma.user.deleteMany()
    await prisma.user.create({
      data: {
        email: 'admin@local',
        name: 'Admin',
        passwordHash: await hashPassword('Secret123Pass'),
        role: 'ADMIN',
      },
    })
  })

  it('issues a session token on correct credentials', async () => {
    const result = await login({ email: 'admin@local', password: 'Secret123Pass' }, ctx)
    expect(result.token).toBeTruthy()
    expect(result.user.email).toBe('admin@local')

    const valid = await authRepo.findValidSession(result.token)
    expect(valid).not.toBeNull()
  })

  it('rejects wrong password', async () => {
    await expect(
      login({ email: 'admin@local', password: 'WrongPass1' }, ctx),
    ).rejects.toThrow(/Invalid credentials/)
  })

  it('rejects non-existent email with same error to prevent enumeration', async () => {
    await expect(
      login({ email: 'noone@local', password: 'AnyPass123' }, ctx),
    ).rejects.toThrow(/Invalid credentials/)
  })

  it('rejects login for inactive user', async () => {
    await prisma.user.updateMany({ data: { active: false } })
    await expect(
      login({ email: 'admin@local', password: 'Secret123Pass' }, ctx),
    ).rejects.toThrow(/Invalid credentials/)
  })

  it('logout deletes the session', async () => {
    const { token } = await login({ email: 'admin@local', password: 'Secret123Pass' }, ctx)
    await logout({ token }, ctx)
    expect(await authRepo.findValidSession(token)).toBeNull()
  })
})
```

- [ ] **Step 10.2: FAIL**

```bash
pnpm vitest run tests/integration/actions/auth/login.test.ts
```

- [ ] **Step 10.3: Implement `server/actions/auth/login.ts`**

```ts
import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { UnauthorizedError } from '../_base/errors'
import { authRepo } from '~/server/modules/auth/auth.repo'
import { verifyPassword } from '~/server/modules/auth/password'
import { generateSessionToken } from '~/server/modules/auth/session'
import { auditRepo } from '~/server/modules/audit/audit.repo'

export const LoginInput = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
})
export type LoginInput = z.infer<typeof LoginInput>

export interface LoginOutput {
  token: string
  user: { id: string; email: string; name: string; role: string }
  expiresAt: Date
}

const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 7)

export async function login(rawInput: unknown, ctx: ActionContext): Promise<LoginOutput> {
  const input = LoginInput.parse(rawInput)

  const user = await authRepo.findUserByEmail(input.email)
  // Same error for missing user + wrong password to prevent enumeration
  if (!user || !user.active) {
    throw new UnauthorizedError('Invalid credentials')
  }

  const ok = await verifyPassword(input.password, user.passwordHash)
  if (!ok) {
    throw new UnauthorizedError('Invalid credentials')
  }

  const token = generateSessionToken()
  const session = await authRepo.createSession({
    userId: user.id,
    token,
    ttlDays: TTL_DAYS,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })
  await authRepo.updateLastLoginAt(user.id)

  await auditRepo.write({
    actorId: user.id,
    source: ctx.source,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    before: null,
    after: { sessionId: session.id },
    requestId: ctx.requestId,
  })

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    expiresAt: session.expiresAt,
  }
}
```

- [ ] **Step 10.4: Implement `server/actions/auth/logout.ts`**

```ts
import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { authRepo } from '~/server/modules/auth/auth.repo'
import { auditRepo } from '~/server/modules/audit/audit.repo'

export const LogoutInput = z.object({
  token: z.string().min(1),
})

export async function logout(rawInput: unknown, ctx: ActionContext): Promise<{ ok: true }> {
  const input = LogoutInput.parse(rawInput)
  await authRepo.deleteSession(input.token)

  if (ctx.actor) {
    await auditRepo.write({
      actorId: ctx.actor.id,
      source: ctx.source,
      action: 'auth.logout',
      entityType: 'User',
      entityId: ctx.actor.id,
      before: null,
      after: null,
      requestId: ctx.requestId,
    })
  }

  return { ok: true }
}
```

- [ ] **Step 10.5: PASS**

```bash
pnpm vitest run tests/integration/actions/auth/login.test.ts
```
Expected: 5 tests PASS.

- [ ] **Step 10.6: Commit**

```bash
git add server/actions/auth/ tests/integration/actions/auth/
git commit -m "feat(auth): add login and logout actions"
```

---

## Task 11: HTTP utilities + middleware

**Files:**
- Create: `server/utils/http.ts`
- Create: `server/middleware/01.request-id.ts`
- Create: `server/middleware/02.auth.ts`
- Create: `server/middleware/03.error-handler.ts`

- [ ] **Step 11.1: Create `server/utils/http.ts`**

```ts
import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import type { ActionContext } from '~/server/actions/_base/context'
import { UnauthorizedError } from '~/server/actions/_base/errors'

const COOKIE_NAME = 'session_token'

export function getRequestId(event: H3Event): string {
  return (event.context.requestId as string | undefined) ?? randomUUID()
}

export function buildContext(event: H3Event): ActionContext {
  const user = event.context.user as ActionContext['actor'] | undefined
  return {
    actor: user ?? null,
    source: 'ui',
    requestId: getRequestId(event),
    idempotencyKey: getHeader(event, 'idempotency-key') ?? undefined,
  }
}

export function requireAuth(event: H3Event): NonNullable<ActionContext['actor']> {
  const user = event.context.user as ActionContext['actor'] | undefined
  if (!user) throw new UnauthorizedError()
  return user
}

export function setSessionCookie(event: H3Event, token: string, expiresAt: Date) {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

export function getSessionToken(event: H3Event): string | null {
  return getCookie(event, COOKIE_NAME) ?? null
}
```

- [ ] **Step 11.2: Create `server/middleware/01.request-id.ts`**

```ts
import { randomUUID } from 'node:crypto'

export default defineEventHandler((event) => {
  const incoming = getHeader(event, 'x-request-id')
  const requestId = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID()
  event.context.requestId = requestId
  setHeader(event, 'X-Request-Id', requestId)
})
```

- [ ] **Step 11.3: Create `server/middleware/02.auth.ts`**

```ts
import { authRepo } from '~/server/modules/auth/auth.repo'
import { getSessionToken } from '~/server/utils/http'

export default defineEventHandler(async (event) => {
  const token = getSessionToken(event)
  if (!token) {
    event.context.user = null
    return
  }
  const session = await authRepo.findValidSession(token)
  if (!session) {
    event.context.user = null
    return
  }
  event.context.user = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  }
})
```

- [ ] **Step 11.4: Create `server/middleware/03.error-handler.ts`**

This is registered via Nitro hooks instead of as middleware. Create `server/plugins/error-handler.ts`:

```ts
import { ActionError } from '~/server/actions/_base/errors'
import { logger } from '~/server/plugins/logger'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    const requestId = event?.context?.requestId as string | undefined
    if (error instanceof ActionError) {
      logger.warn({ requestId, code: error.code, message: error.message }, 'Action error')
    } else {
      logger.error({ requestId, err: error }, 'Unhandled error')
    }
  })

  nitroApp.hooks.hook('beforeResponse', (event, { body }) => {
    if (event.node.res.statusCode >= 400 && body && typeof body === 'object') {
      const error = body as { statusCode?: number; statusMessage?: string; data?: { code?: string; message?: string; details?: unknown } }
      if (!error.data || !error.data.code) {
        // Wrap unknown errors into standard envelope
      }
    }
  })
})
```

> **Note:** Nuxt 3 / H3 uses `createError({ statusCode, statusMessage, data })` thrown from handlers. The standard envelope is built by translating `ActionError` → `createError` in the handler wrapper. See Step 11.5.

- [ ] **Step 11.5: Update `server/utils/http.ts` — add error translator**

Append:

```ts
import { ActionError } from '~/server/actions/_base/errors'

export function toHttpError(err: unknown): never {
  if (err instanceof ActionError) {
    throw createError({
      statusCode: err.httpStatus,
      statusMessage: err.code,
      data: {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
    })
  }
  // Zod errors
  if (err && typeof err === 'object' && 'issues' in err) {
    throw createError({
      statusCode: 400,
      statusMessage: 'VALIDATION',
      data: {
        error: {
          code: 'VALIDATION',
          message: 'Validation failed',
          details: (err as { issues: unknown }).issues,
        },
      },
    })
  }
  throw err
}
```

- [ ] **Step 11.6: Commit**

```bash
git add server/utils/ server/middleware/ server/plugins/error-handler.ts
git commit -m "feat(server): add http utils, request-id, auth middleware, error handler"
```

---

## Task 12: API routes for auth

**Files:**
- Create: `server/api/auth/login.post.ts`
- Create: `server/api/auth/logout.post.ts`
- Create: `server/api/auth/me.get.ts`
- Create: `server/api/health.get.ts`

- [ ] **Step 12.1: Create `server/api/auth/login.post.ts`**

```ts
import { login } from '~/server/actions/auth/login'
import { buildContext, setSessionCookie, toHttpError } from '~/server/utils/http'

export default defineEventHandler(async (event) => {
  try {
    const ctx = buildContext(event)
    const body = await readBody(event)
    const ipAddress = getRequestIP(event, { xForwardedFor: true })
    const userAgent = getHeader(event, 'user-agent')
    const result = await login({ ...body, ipAddress, userAgent }, ctx)
    setSessionCookie(event, result.token, result.expiresAt)
    return { user: result.user, expiresAt: result.expiresAt }
  } catch (err) {
    toHttpError(err)
  }
})
```

- [ ] **Step 12.2: Create `server/api/auth/logout.post.ts`**

```ts
import { logout } from '~/server/actions/auth/logout'
import { buildContext, clearSessionCookie, getSessionToken, toHttpError } from '~/server/utils/http'

export default defineEventHandler(async (event) => {
  try {
    const ctx = buildContext(event)
    const token = getSessionToken(event)
    if (token) {
      await logout({ token }, ctx)
    }
    clearSessionCookie(event)
    return { ok: true }
  } catch (err) {
    toHttpError(err)
  }
})
```

- [ ] **Step 12.3: Create `server/api/auth/me.get.ts`**

```ts
import { requireAuth } from '~/server/utils/http'
import { authRepo } from '~/server/modules/auth/auth.repo'

export default defineEventHandler(async (event) => {
  const actor = requireAuth(event)
  const user = await authRepo.findUserById(actor.id)
  if (!user) {
    return null
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    lastLoginAt: user.lastLoginAt,
  }
})
```

- [ ] **Step 12.4: Create `server/api/health.get.ts`**

```ts
import { prisma } from '~/server/plugins/prisma'

export default defineEventHandler(async () => {
  let dbReachable = false
  try {
    await prisma.$queryRaw`SELECT 1`
    dbReachable = true
  } catch {
    dbReachable = false
  }
  return {
    status: dbReachable ? 'ok' : 'degraded',
    dbReachable,
    time: new Date().toISOString(),
  }
})
```

- [ ] **Step 12.5: Manual smoke test**

Run dev server in a separate terminal:
```bash
pnpm dev
```

In another terminal:
```bash
curl -i http://localhost:3000/api/health
```
Expected: `200 OK`, body `{"status":"ok","dbReachable":true,...}`.

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"x","password":"y"}'
```
Expected: `400` with body containing `"code":"VALIDATION"` (email invalid).

- [ ] **Step 12.6: Commit**

```bash
git add server/api/
git commit -m "feat(api): add auth endpoints + health check"
```

---

## Task 13: Seed script (admin + 5 sizes)

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 13.1: Create `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const DEFAULT_SIZES = [
  { code: 'S', label: 'Áo S', order: 10 },
  { code: 'M', label: 'Áo M', order: 20 },
  { code: 'L', label: 'Áo L', order: 30 },
  { code: 'XL', label: 'Áo XL', order: 40 },
  { code: 'XXL', label: 'Áo XXL', order: 50 },
]

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@local'
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator'

  // Sizes: idempotent upsert
  for (const s of DEFAULT_SIZES) {
    await prisma.size.upsert({
      where: { code: s.code },
      create: s,
      update: {},
    })
  }
  console.log(`✓ Seeded ${DEFAULT_SIZES.length} default sizes`)

  // Admin: create only if not exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✓ Admin ${email} already exists, skipping`)
    return
  }

  const password = randomBytes(12).toString('base64url').slice(0, 14) + 'A1' // ensure letter+digit, ≥10 chars
  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'ADMIN',
      active: true,
    },
  })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✓ Admin user created')
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
  console.log('  ⚠️  Lưu lại password này — không thể xem lại sau!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 13.2: Run seed**

```bash
pnpm seed
```
Expected: 5 sizes seeded, admin user printed with password.

- [ ] **Step 13.3: Verify in DB**

```bash
docker exec dems_postgres psql -U dems -d dems -c "SELECT code, label, \"order\" FROM \"Size\" ORDER BY \"order\";"
```
Expected: 5 rows S/M/L/XL/XXL.

```bash
docker exec dems_postgres psql -U dems -d dems -c "SELECT email, role FROM \"User\";"
```
Expected: 1 row admin@local with role ADMIN.

- [ ] **Step 13.4: Verify idempotency**

```bash
pnpm seed
```
Expected: "Seeded 5 default sizes" + "Admin admin@local already exists, skipping". No errors.

- [ ] **Step 13.5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): add admin + default sizes seed script"
```

---

## Task 14: Login page + auth-guarded layout

**Files:**
- Create: `pages/login.vue`
- Create: `pages/index.vue`
- Create: `pages/dashboard.vue`
- Create: `middleware/auth.global.ts`
- Create: `composables/useAuth.ts`

- [ ] **Step 14.1: Create `composables/useAuth.ts`**

```ts
interface AuthUser {
  id: string
  email: string
  name: string
  role: string
}

export const useAuthState = () => useState<AuthUser | null>('auth.user', () => null)

export function useAuth() {
  const user = useAuthState()

  async function fetchMe() {
    try {
      const data = await $fetch<AuthUser>('/api/auth/me')
      user.value = data
    } catch {
      user.value = null
    }
  }

  async function login(email: string, password: string) {
    const data = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = data.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  return { user, fetchMe, login, logout }
}
```

- [ ] **Step 14.2: Create `middleware/auth.global.ts`**

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchMe } = useAuth()

  if (user.value === null) {
    await fetchMe()
  }

  const isLoginPage = to.path === '/login'
  const authed = !!user.value

  if (!authed && !isLoginPage) {
    return navigateTo('/login')
  }
  if (authed && isLoginPage) {
    return navigateTo('/dashboard')
  }
})
```

- [ ] **Step 14.3: Create `pages/index.vue`**

```vue
<script setup lang="ts">
definePageMeta({ name: 'home' })
await navigateTo('/dashboard', { replace: true })
</script>

<template><div /></template>
```

- [ ] **Step 14.4: Create `pages/login.vue`**

```vue
<script setup lang="ts">
const { login } = useAuth()
const email = ref('')
const password = ref('')
const errorMsg = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  errorMsg.value = null
  submitting.value = true
  try {
    await login(email.value, password.value)
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    const e = err as { data?: { error?: { message?: string } } }
    errorMsg.value = e.data?.error?.message ?? 'Đăng nhập thất bại'
  } finally {
    submitting.value = false
  }
}

definePageMeta({ layout: false })
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">Đăng nhập</h1>
      </template>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Email" required>
          <UInput v-model="email" type="email" autocomplete="email" required />
        </UFormField>
        <UFormField label="Mật khẩu" required>
          <UInput v-model="password" type="password" autocomplete="current-password" required />
        </UFormField>
        <UAlert v-if="errorMsg" color="error" variant="soft" :title="errorMsg" />
        <UButton type="submit" block :loading="submitting">Đăng nhập</UButton>
      </form>
    </UCard>
  </div>
</template>
```

- [ ] **Step 14.5: Create `pages/dashboard.vue`**

```vue
<script setup lang="ts">
const { user, logout } = useAuth()
</script>

<template>
  <div class="p-6">
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold">Dashboard</h1>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-600">{{ user?.email }}</span>
        <UButton variant="ghost" @click="logout">Đăng xuất</UButton>
      </div>
    </header>
    <UCard>
      <p class="text-gray-600">Đây là placeholder Dashboard. Nội dung thật sẽ có ở M5.</p>
    </UCard>
  </div>
</template>
```

- [ ] **Step 14.6: Manual smoke test**

In dev server:
1. Open `http://localhost:3000/` → should redirect to `/login`.
2. Try login with wrong password → see error.
3. Login with correct admin credentials (from seed output) → redirect to `/dashboard`.
4. See email shown in header.
5. Click "Đăng xuất" → back to `/login`.
6. Try `http://localhost:3000/dashboard` directly while logged out → redirect `/login`.

- [ ] **Step 14.7: Commit**

```bash
git add pages/ middleware/ composables/
git commit -m "feat(ui): add login page, dashboard placeholder, auth guard"
```

---

## Task 15: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 15.1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: dems
          POSTGRES_PASSWORD: dems_dev_password
          POSTGRES_DB: dems
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-timeout 3s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Prisma generate + migrate
        env:
          DATABASE_URL: postgresql://dems:dems_dev_password@localhost:5432/dems?schema=public
        run: |
          pnpm prisma generate
          pnpm prisma migrate deploy

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        env:
          DATABASE_URL: postgresql://dems:dems_dev_password@localhost:5432/dems?schema=public
        run: pnpm test
```

- [ ] **Step 15.2: Verify locally first**

```bash
pnpm lint
pnpm typecheck
pnpm test
```
Expected: all PASS.

- [ ] **Step 15.3: Commit**

```bash
git add .github/
git commit -m "ci: add github actions for lint, typecheck, test"
```

---

## Task 16: Final smoke test + tag M1

- [ ] **Step 16.1: Reset and rebuild from scratch (simulate fresh clone)**

```bash
docker compose down -v
rm -rf node_modules .nuxt .output
docker compose up -d
pnpm install
pnpm prisma migrate dev
pnpm seed
pnpm dev
```
Expected: dev server up at `http://localhost:3000`. Login works with admin email + password from seed output.

- [ ] **Step 16.2: Verify acceptance criteria checklist**

Go through the M1 checklist at the top of this document:
- [x] `/` redirects `/login`
- [x] Login → dashboard
- [x] Logout → login
- [x] `/api/health` returns `dbReachable: true`
- [x] DB has 5 default sizes
- [x] CI green (push to a branch and verify)

- [ ] **Step 16.3: Tag**

```bash
git tag m1-foundation -m "M1: foundation — auth, db schema, CI ready"
git push --tags
```

- [ ] **Step 16.4: Notify**

Update issue tracker / chat: M1 complete, ready for M2.

---

## End of M1 plan

**Khi nào bắt đầu M2:** sau khi tag `m1-foundation`. M2 plan sẽ được viết dựa trên blueprint mục 14 (Master Data: Style + Size).

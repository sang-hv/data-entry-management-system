# Phase 1 — Implementation Blueprint (v2)

> **Mục đích:** tài liệu kỹ thuật nội bộ làm reference xuyên suốt Phase 1. Chốt schema, action layer, REST surface, cấu trúc thư mục, conventions.
>
> **Đối tượng đọc:** team thực thi (BE + FE).
>
> **Khác `overview.md`:** overview là tài liệu gửi khách (high-level, ngôn ngữ nghiệp vụ). File này là spec kỹ thuật chi tiết, có code thật.
>
> **Phiên bản:** 2.0 — 26/05/2026
> **Status:** Draft, chờ duyệt trước khi triển khai M1.
> **Thay đổi v2:** rewrite domain từ "manufacturing project + BOM" sang "apparel order + style/size/batch" theo dữ liệu thật của khách (file Excel quản lý đơn đặt hàng). Drop `Material` và `Vendor` khỏi Phase 1.

---

## 0. Domain Glossary (đọc 1 lần — bắt buộc nắm)

| Từ trong nghiệp vụ | Tên trong code | Giải thích |
|---|---|---|
| **Đơn đặt hàng / Mã đặt hàng** | `Order`, `Order.code` | 1 dòng đặt áo của khách. VD: `TN150501`. |
| **Mẫu (áo)** | `Style` | Master data kiểu áo. VD `AO083`. Có nhiều variant (TRANG KE XANH, TRANG KE DO). |
| **Variant mẫu** | `StyleVariant` | Biến thể của 1 style: màu, ảnh, mã hậu tố. VD `AO083-TRANG KE XANH`. |
| **Size** | `Size` (master) + `OrderItem.size` | S/M/L/XL/XXL. Master data, mở rộng được. |
| **Tỉ lệ nhập** | `OrderItem.ratio` | Tỉ lệ phân bổ size, chỉ tham khảo. |
| **Số lượng chốt đợt mới** | `OrderBatch` + `BatchItem.quantity` | 1 đơn có nhiều đợt chốt nhập, mỗi đợt có số lượng theo từng size. |
| **Tổng** | computed | Tổng = sum `BatchItem.quantity` của batch / order, không lưu. |
| **Ngày đặt hàng** | `Order.orderedAt` | |
| **Ảnh mẫu** | `StyleVariant.imageUrl` | Lưu ở storage, không lưu trong DB. |

---

## 1. Quy tắc vàng (đọc 1 lần và nhớ)

1. **Database là source of truth.** Mọi state đều ở Postgres. Không cache cross-request.
2. **Action layer là entry point duy nhất cho mọi mutation.** API handler không chứa business logic. UI và (Phase 2) MCP đều gọi vào đúng những actions này.
3. **Mọi mutation phải có audit log + nhận `ActionContext`.**
4. **Validate ở action layer bằng Zod.** Schema export ra được để Phase 2 map MCP tool.
5. **Soft delete mặc định.** Mọi entity nghiệp vụ có `deletedAt`. Repo tự filter `deletedAt: null`.
6. **Không import AI SDK ở Phase 1.** Không OpenAI, Anthropic, LangChain, vector DB.
7. **Mỗi module không thò tay sang DB của module khác.** Đi qua service của module đó.
8. **Frequent commits.** Mỗi step xanh là 1 commit.
9. **Tổng (qty) là computed.** Không lưu cột tổng — luôn sum on the fly để tránh lệch dữ liệu.

---

## 2. Tech stack chốt

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | 24 LTS | |
| Nuxt | 3.x latest stable | |
| TypeScript | 5.x | `strict: true` |
| Prisma | 5.x | |
| PostgreSQL | 15 | Docker Compose lúc dev |
| Zod | 3.x | |
| bcrypt | latest | password hashing |
| pino | latest | structured logging |
| node-cron | latest | scheduled jobs |
| vitest | latest | unit + integration |
| Pinia | latest | FE state |
| Tailwind CSS | latest | styling |
| UI primitives | **Nuxt UI v3** | chốt — `@nuxt/ui` |

---

## 3. Mapping Excel ↔ Database

Mapping trực tiếp từ file Excel của khách sang schema mới:

| Cột Excel | Field DB | Ghi chú |
|---|---|---|
| `Mã Đặt Hàng` (TN150501) | `Order.code` | Unique. User nhập tay hoặc auto-gen. |
| `Mẫu` (AO083-TRANG KE XANH) | `Order.styleVariantId` → `StyleVariant.code + name` | FK đến variant. Hiển thị format `<styleCode>-<variantName>`. |
| `Ảnh` | `StyleVariant.imageUrl` | Ảnh thuộc về variant, không thuộc về order. |
| `Size` (Áo S/M/L/XL/XXL) | `OrderItem.sizeId` → `Size.code` | 1 order có N OrderItem (mỗi size 1 item). Chỉ lưu size có ratio hoặc quantity > 0. |
| `Tỉ lệ Nhập` (3, 3, 2, 1, 1) | `OrderItem.ratio` | Số nguyên ≥ 0. Chỉ tham khảo. |
| `Số lượng chốt nhập đợt mới` | `BatchItem.quantity` | Mỗi đợt nhập (`OrderBatch`) có nhiều `BatchItem`, mỗi item ứng với 1 size. |
| `Tổng` (80) | computed | `SUM(BatchItem.quantity)` của đợt nhập mới nhất hoặc của order. Không lưu. |
| `Ngày Đặt Hàng` (15/5/2026) | `Order.orderedAt` | Date, không có time. |
| (chưa có ở Excel) | `Order.status` | Enum mới: `DRAFT, CONFIRMED, IN_PRODUCTION, QC, READY, DELIVERED, CANCELLED`. |
| (chưa có ở Excel) | `Order.notes` | Free text. |

### Quan hệ tổng quan

```
Style (AO083)
  └── StyleVariant (TRANG KE XANH, TRANG KE DO)
         └── Order (TN150501) ─── orderedAt, status
                ├── OrderItem [size=S, ratio=3]
                ├── OrderItem [size=M, ratio=3]
                ├── OrderItem [size=L, ratio=2]
                ├── OrderItem [size=XL, ratio=1]
                └── OrderItem [size=XXL, ratio=1]
                
                └── OrderBatch (đợt 1) ── batchedAt, note
                       ├── BatchItem [size=S, qty=24]
                       ├── BatchItem [size=M, qty=24]
                       ├── BatchItem [size=L, qty=16]
                       ├── BatchItem [size=XL, qty=8]
                       └── BatchItem [size=XXL, qty=8]
                
                └── OrderBatch (đợt 2) ── batchedAt, note
                       └── ...

Size (master) ── code (S/M/L/XL/XXL/...), order, active
```

### Khác biệt quan trọng so với v1

- ❌ Bỏ hẳn `MaterialRequirement` và `Vendor` khỏi Phase 1.
- ❌ Bỏ `Milestone`.
- ✅ Đổi `Project` → `Order`.
- ✅ Thêm `Style`, `StyleVariant`, `Size`, `OrderItem`, `OrderBatch`, `BatchItem`.
- ✅ Status enum đổi sang vòng đời may mặc.
- ✅ Bỏ `progressPct` (tiến độ kiểu % không phù hợp với đơn may; dùng status + qty đã chốt là đủ).

---

## 4. Cấu trúc thư mục

```
data-entry-management-system/
├── .env.example
├── .env.local                          # gitignored
├── .nvmrc                              # node 24
├── docker-compose.yml                  # postgres + adminer
├── eslint.config.mjs
├── nuxt.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
│
├── docs/
│   ├── overview.md
│   ├── implementation-plan.md          # file này
│   └── plans/                          # plan TDD chi tiết từng milestone
│       └── M1-foundation.md
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                         # admin + 5 size mặc định + sample style
│
├── server/
│   ├── api/                            # HTTP layer (mỏng)
│   │   ├── auth/
│   │   │   ├── login.post.ts
│   │   │   ├── logout.post.ts
│   │   │   └── me.get.ts
│   │   ├── orders/
│   │   │   ├── index.get.ts            # search
│   │   │   ├── index.post.ts           # createOrder
│   │   │   ├── [id].get.ts
│   │   │   ├── [id].patch.ts
│   │   │   ├── [id].delete.ts
│   │   │   ├── by-code/[code].get.ts
│   │   │   ├── [id]/status.post.ts
│   │   │   ├── [id]/validate.get.ts
│   │   │   ├── [id]/timeline.get.ts
│   │   │   ├── [id]/items.put.ts       # set toàn bộ items (replace)
│   │   │   ├── [id]/apply-ratio.post.ts# generate batch từ ratio × multiplier
│   │   │   ├── [id]/batches.post.ts    # createBatch
│   │   │   └── [id]/attachments.post.ts
│   │   ├── batches/
│   │   │   ├── [id].get.ts
│   │   │   ├── [id].patch.ts           # update batch metadata
│   │   │   ├── [id].delete.ts
│   │   │   └── [id]/items.put.ts       # set toàn bộ batch items
│   │   ├── styles/
│   │   │   ├── index.get.ts
│   │   │   ├── index.post.ts
│   │   │   ├── [id].get.ts
│   │   │   ├── [id].patch.ts
│   │   │   ├── [id].delete.ts
│   │   │   └── [id]/variants.post.ts
│   │   ├── variants/
│   │   │   ├── [id].patch.ts
│   │   │   ├── [id].delete.ts
│   │   │   └── [id]/image.post.ts
│   │   ├── sizes/
│   │   │   ├── index.get.ts
│   │   │   ├── index.post.ts
│   │   │   ├── [id].patch.ts
│   │   │   └── [id].delete.ts
│   │   ├── alerts/
│   │   │   ├── index.get.ts
│   │   │   └── [id]/dismiss.post.ts
│   │   ├── dashboard/
│   │   │   ├── urgent.get.ts
│   │   │   ├── overdue.get.ts
│   │   │   └── missing-data.get.ts
│   │   └── health.get.ts
│   │
│   ├── actions/                        # ⭐ ACTION LAYER
│   │   ├── _base/
│   │   │   ├── context.ts
│   │   │   ├── errors.ts
│   │   │   └── idempotency.ts
│   │   ├── orders/
│   │   │   ├── createOrder.ts
│   │   │   ├── updateOrder.ts
│   │   │   ├── updateOrderStatus.ts
│   │   │   ├── deleteOrder.ts
│   │   │   ├── getOrderById.ts
│   │   │   ├── getOrderByCode.ts
│   │   │   ├── searchOrders.ts
│   │   │   ├── getOrderTimeline.ts
│   │   │   ├── setOrderItems.ts
│   │   │   ├── applyRatioToBatch.ts    # ⭐ generate batch qty từ ratio
│   │   │   └── validateOrderDataCompleteness.ts
│   │   ├── batches/
│   │   │   ├── createBatch.ts
│   │   │   ├── updateBatch.ts
│   │   │   ├── deleteBatch.ts
│   │   │   └── setBatchItems.ts
│   │   ├── styles/
│   │   │   ├── createStyle.ts
│   │   │   ├── updateStyle.ts
│   │   │   ├── deleteStyle.ts
│   │   │   ├── listStyles.ts
│   │   │   ├── createStyleVariant.ts
│   │   │   ├── updateStyleVariant.ts
│   │   │   ├── deleteStyleVariant.ts
│   │   │   └── uploadVariantImage.ts
│   │   ├── sizes/
│   │   │   ├── createSize.ts
│   │   │   ├── updateSize.ts
│   │   │   ├── deleteSize.ts
│   │   │   └── listSizes.ts
│   │   ├── alerts/
│   │   │   ├── getActiveAlerts.ts
│   │   │   └── dismissAlert.ts
│   │   ├── dashboard/
│   │   │   ├── getUrgentOrders.ts
│   │   │   ├── getOverdueOrders.ts
│   │   │   └── getOrdersMissingData.ts
│   │   ├── attachments/
│   │   │   ├── attachFileToOrder.ts
│   │   │   └── deleteAttachment.ts
│   │   └── auth/
│   │       ├── login.ts
│   │       └── logout.ts
│   │
│   ├── modules/                        # domain logic, repo, helpers
│   │   ├── orders/
│   │   │   ├── order.repo.ts
│   │   │   ├── order.code-gen.ts       # TN-YYMMDD-## hoặc theo format khách (xem mục 7)
│   │   │   ├── order.totals.ts         # computed totals helpers
│   │   │   └── order.types.ts
│   │   ├── batches/
│   │   │   ├── batch.repo.ts
│   │   │   └── batch.types.ts
│   │   ├── styles/
│   │   │   ├── style.repo.ts
│   │   │   └── variant.repo.ts
│   │   ├── sizes/
│   │   │   └── size.repo.ts
│   │   ├── alerts/
│   │   │   ├── alert.repo.ts
│   │   │   ├── alert-engine.ts
│   │   │   └── rules/
│   │   │       ├── _types.ts
│   │   │       ├── overdue.rule.ts
│   │   │       ├── due-soon-3d.rule.ts
│   │   │       ├── due-soon-7d.rule.ts
│   │   │       ├── missing-deadline.rule.ts
│   │   │       ├── no-items.rule.ts
│   │   │       ├── no-batch.rule.ts
│   │   │       ├── batch-qty-mismatch-ratio.rule.ts
│   │   │       ├── status-timeline-mismatch.rule.ts
│   │   │       └── stale-order.rule.ts
│   │   ├── audit/
│   │   │   └── audit.repo.ts
│   │   ├── attachments/
│   │   │   ├── attachment.repo.ts
│   │   │   └── storage.ts
│   │   └── auth/
│   │       ├── auth.repo.ts
│   │       ├── password.ts
│   │       └── session.ts
│   │
│   ├── jobs/
│   │   ├── alert-evaluator.job.ts      # cron 10 phút
│   │   ├── session-cleanup.job.ts
│   │   └── index.ts
│   │
│   ├── middleware/
│   │   ├── 01.request-id.ts
│   │   ├── 02.auth.ts
│   │   └── 03.error-handler.ts
│   │
│   ├── plugins/
│   │   ├── prisma.ts
│   │   ├── logger.ts
│   │   └── jobs.ts
│   │
│   └── utils/
│       ├── http.ts
│       └── pagination.ts
│
├── pages/
│   ├── index.vue                       # → /dashboard
│   ├── login.vue
│   ├── dashboard.vue
│   ├── orders/
│   │   ├── index.vue                   # list + filter
│   │   ├── new.vue
│   │   └── [id].vue                    # tabs: Info, Items, Batches, Timeline, Attachments, Alerts
│   ├── styles/
│   │   ├── index.vue
│   │   └── [id].vue                    # variants management
│   ├── sizes/
│   │   └── index.vue                   # master data CRUD
│   └── alerts/
│       └── index.vue
│
├── components/
│   ├── orders/
│   │   ├── OrderForm.vue
│   │   ├── OrderList.vue
│   │   ├── OrderStatusBadge.vue
│   │   ├── OrderHealthCheck.vue
│   │   ├── OrderTimeline.vue
│   │   ├── OrderItemsEditor.vue        # bảng size + ratio
│   │   ├── BatchList.vue
│   │   ├── BatchEditor.vue             # bảng size + qty của 1 batch
│   │   └── ApplyRatioDialog.vue        # ⭐ nhập multiplier → preview qty
│   ├── styles/
│   │   ├── StylePicker.vue             # dropdown chọn variant trong order form
│   │   ├── StyleForm.vue
│   │   └── VariantForm.vue
│   ├── alerts/
│   │   ├── AlertCard.vue
│   │   └── AlertList.vue
│   └── ui/                             # button, input, modal primitives
│
├── composables/
│   ├── useApi.ts
│   ├── useAuth.ts
│   └── useToast.ts
│
└── tests/
    ├── unit/
    │   ├── actions/
    │   ├── rules/
    │   └── modules/
    └── integration/
        ├── api/
        └── flows/
```

---

## 5. Schema Prisma đầy đủ

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ========== Enums ==========

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

enum OrderStatus {
  DRAFT          // Mới tạo, chưa chốt thông tin
  CONFIRMED      // Đã chốt đơn (size + tỉ lệ + có ít nhất 1 batch)
  IN_PRODUCTION  // Đang sản xuất
  QC             // Đang kiểm hàng
  READY          // Sẵn sàng giao
  DELIVERED      // Đã giao
  CANCELLED      // Hủy
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum AlertSeverity {
  INFO
  WARN
  CRITICAL
}

enum AlertStatus {
  OPEN
  DISMISSED
  RESOLVED
  SNOOZED
}

// ========== Identity ==========

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  name         String
  passwordHash String
  role         Role      @default(ADMIN)
  active       Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  ownedOrders Order[]         @relation("OrderOwner")
  uploads     Attachment[]
  updates     OrderUpdate[]
  auditLogs   AuditLog[]
  sessions    Session[]
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  ipAddress String?
  userAgent String?

  @@index([userId])
  @@index([expiresAt])
}

// ========== Master data: Style + Variant ==========

model Style {
  id          String         @id @default(uuid())
  code        String         @unique         // VD: AO083
  name        String                          // VD: "Áo polo cổ bẻ"
  description String?        @db.Text
  metadata    Json?
  active      Boolean        @default(true)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  deletedAt   DateTime?

  variants    StyleVariant[]

  @@index([active])
  @@index([deletedAt])
}

model StyleVariant {
  id        String  @id @default(uuid())
  styleId   String
  style     Style   @relation(fields: [styleId], references: [id])
  // Hậu tố variant. VD "TRANG KE XANH". Display: "{style.code}-{name}".
  name      String
  imageUrl  String?           // tương đối hoặc URL đầy đủ
  color     String?
  active    Boolean  @default(true)
  metadata  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  orders    Order[]

  @@unique([styleId, name])
  @@index([active])
  @@index([deletedAt])
}

// ========== Master data: Size ==========

model Size {
  id        String   @id @default(uuid())
  code      String   @unique     // S, M, L, XL, XXL, XS, XXXL, ...
  label     String                // hiển thị: "Áo S"
  order     Int      @default(0) // thứ tự hiển thị (S=10, M=20, L=30, XL=40, XXL=50)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  orderItems  OrderItem[]
  batchItems  BatchItem[]

  @@index([active, order])
  @@index([deletedAt])
}

// ========== Core: Order ==========

model Order {
  id              String       @id @default(uuid())
  code            String       @unique           // TN150501
  styleVariantId  String
  styleVariant    StyleVariant @relation(fields: [styleVariantId], references: [id])
  ownerId         String
  owner           User         @relation("OrderOwner", fields: [ownerId], references: [id])

  status     OrderStatus @default(DRAFT)
  priority   Priority    @default(NORMAL)

  orderedAt    DateTime?       // Ngày đặt hàng (từ Excel)
  expectedAt   DateTime?       // Deadline giao
  actualAt     DateTime?       // Ngày giao thực tế

  notes      String?    @db.Text
  metadata   Json?

  version    Int        @default(0)  // optimistic locking

  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  deletedAt  DateTime?

  items       OrderItem[]
  batches     OrderBatch[]
  updates     OrderUpdate[]
  attachments Attachment[]
  alerts      Alert[]

  @@index([status, expectedAt])
  @@index([ownerId])
  @@index([deletedAt])
  @@index([code])
  @@index([orderedAt])
}

// 1 OrderItem = 1 dòng "size + tỉ lệ" của order
model OrderItem {
  id        String  @id @default(uuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  sizeId    String
  size      Size    @relation(fields: [sizeId], references: [id])
  ratio     Int     @default(0)   // tỉ lệ nhập (3, 3, 2, 1, 1)
  notes     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([orderId, sizeId])
  @@index([orderId])
}

// 1 OrderBatch = 1 đợt chốt nhập của order
model OrderBatch {
  id          String   @id @default(uuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  batchNumber Int                            // 1, 2, 3 — tự tăng theo order
  batchedAt   DateTime @default(now())       // ngày chốt nhập
  note        String?
  metadata    Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  items     BatchItem[]

  @@unique([orderId, batchNumber])
  @@index([orderId, batchedAt])
  @@index([deletedAt])
}

// 1 BatchItem = 1 dòng "size + qty" trong 1 batch
model BatchItem {
  id        String     @id @default(uuid())
  batchId   String
  batch     OrderBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  sizeId    String
  size      Size       @relation(fields: [sizeId], references: [id])
  quantity  Int        @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([batchId, sizeId])
  @@index([batchId])
}

// ========== History ==========

model OrderUpdate {
  id           String   @id @default(uuid())
  orderId      String
  order        Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  fromStatus   String?
  toStatus     String?
  note         String?  @db.Text
  createdAt    DateTime @default(now())
  createdById  String
  createdBy    User     @relation(fields: [createdById], references: [id])
  source       String   @default("ui")

  @@index([orderId, createdAt])
}

// ========== Alerts ==========

model Alert {
  id           String        @id @default(uuid())
  orderId      String
  order        Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  ruleCode     String
  severity     AlertSeverity
  message      String
  dataSnapshot Json?
  status       AlertStatus   @default(OPEN)
  triggeredAt  DateTime      @default(now())
  resolvedAt   DateTime?
  snoozeUntil  DateTime?
  dismissedReason String?

  @@unique([orderId, ruleCode, status], name: "uniq_open_alert")
  @@index([status, severity])
  @@index([orderId, status])
}

// ========== Attachments ==========

model Attachment {
  id           String   @id @default(uuid())
  orderId      String?
  order        Order?   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  // attachment có thể gắn vào StyleVariant cho ảnh mẫu, hoặc Order cho file đính kèm
  filename     String
  mimeType     String
  sizeBytes    Int
  storagePath  String
  uploadedById String
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime @default(now())
  deletedAt    DateTime?

  @@index([orderId])
}

// ========== Cross-cutting ==========

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String?
  actor      User?    @relation(fields: [actorId], references: [id])
  source     String                       // ui | api | mcp | system
  action     String                       // "order.create", "batch.update", ...
  entityType String
  entityId   String
  before     Json?
  after      Json?
  requestId  String?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId, createdAt])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}

model IdempotencyKey {
  key          String   @id
  action       String
  responseHash String
  responseJson Json
  createdAt    DateTime @default(now())
  expiresAt    DateTime

  @@index([expiresAt])
}

model OrderCodeCounter {
  // counter theo prefix tùy người dùng cấu hình. VD prefix "TN150501" → key="TN", value=501
  prefix String @id
  value  Int    @default(0)
}
```

### Lưu ý quan trọng về schema

- **Ảnh mẫu** thuộc về `StyleVariant.imageUrl`, **không** phải `Attachment` của order. 1 mẫu được dùng nhiều lần, không upload lại.
- **Tổng (qty)** không có cột nào lưu — luôn computed `SUM(BatchItem.quantity)`.
- **OrderItem.ratio** là số nguyên (excel khách dùng 3, 3, 2, 1, 1). Nếu khách muốn fractional sau này, đổi sang `Decimal`.
- **OrderBatch.batchNumber** unique trong scope 1 order — generate ở action `createBatch`.
- **Size là master data dùng chung**, không scoped theo style. Nếu sau này có style chỉ có size onesize, vẫn dùng được entity này.
- **`Attachment.orderId` nullable** để tương lai dùng cho variant image (M5+). Phase 1 chỉ dùng cho order.

---

## 6. Action Layer — Conventions

### 6.1. ActionContext

```ts
// server/actions/_base/context.ts
export interface ActionContext {
  actor: { id: string; email: string; role: Role } | null
  source: 'ui' | 'api' | 'mcp' | 'system'
  requestId: string
  idempotencyKey?: string
}
```

### 6.2. Errors

```ts
// server/actions/_base/errors.ts
export class ActionError extends Error {
  constructor(public code: string, message: string, public httpStatus: number = 400) { super(message) }
}
export class ValidationError extends ActionError { constructor(m: string) { super('VALIDATION', m, 400) } }
export class NotFoundError extends ActionError {
  constructor(entity: string, id: string) { super('NOT_FOUND', `${entity} ${id} not found`, 404) }
}
export class ConflictError extends ActionError { constructor(m: string) { super('CONFLICT', m, 409) } }
export class ForbiddenError extends ActionError { constructor(m: string) { super('FORBIDDEN', m, 403) } }
export class OptimisticLockError extends ActionError {
  constructor() { super('STALE_VERSION', 'Resource was modified, please reload', 409) }
}
```

### 6.3. Idempotency

```ts
// server/actions/_base/idempotency.ts
import type { ActionContext } from './context'
import { prisma } from '~/server/plugins/prisma'

const TTL_HOURS = 24

export async function withIdempotency<T>(
  ctx: ActionContext,
  actionName: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!ctx.idempotencyKey) return fn()

  const existing = await prisma.idempotencyKey.findUnique({ where: { key: ctx.idempotencyKey } })
  if (existing) {
    if (existing.action !== actionName) throw new Error('Idempotency key reused for different action')
    return existing.responseJson as T
  }

  const result = await fn()
  await prisma.idempotencyKey.create({
    data: {
      key: ctx.idempotencyKey,
      action: actionName,
      responseHash: '',
      responseJson: result as any,
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600_000),
    },
  })
  return result
}
```

### 6.4. Action mẫu chuẩn — `createOrder`

```ts
// server/actions/orders/createOrder.ts
import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, NotFoundError, ValidationError } from '../_base/errors'
import { withIdempotency } from '../_base/idempotency'
import { generateOrderCode } from '~/server/modules/orders/order.code-gen'
import { orderRepo } from '~/server/modules/orders/order.repo'
import { variantRepo } from '~/server/modules/styles/variant.repo'
import { sizeRepo } from '~/server/modules/sizes/size.repo'
import { auditRepo } from '~/server/modules/audit/audit.repo'
import { evaluateOrderAlerts } from '~/server/modules/alerts/alert-engine'

export const CreateOrderInput = z.object({
  code: z.string().regex(/^[A-Z0-9-]{3,32}$/).optional(),
  styleVariantId: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
  orderedAt: z.coerce.date().optional(),
  expectedAt: z.coerce.date().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  notes: z.string().max(10000).optional(),
  // Tạo kèm items luôn — mảng size + ratio
  items: z.array(z.object({
    sizeId: z.string().uuid(),
    ratio: z.number().int().min(0).default(0),
  })).default([]),
})
export type CreateOrderInput = z.infer<typeof CreateOrderInput>

export interface CreateOrderOutput {
  order: { id: string; code: string; status: 'DRAFT'; createdAt: Date }
  warnings: string[]
}

export async function createOrder(rawInput: unknown, ctx: ActionContext): Promise<CreateOrderOutput> {
  const input = CreateOrderInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  return withIdempotency(ctx, 'order.create', async () => {
    const variant = await variantRepo.findById(input.styleVariantId)
    if (!variant || variant.deletedAt) throw new NotFoundError('StyleVariant', input.styleVariantId)

    if (input.expectedAt && input.orderedAt && input.expectedAt < input.orderedAt) {
      throw new ValidationError('expectedAt must be after orderedAt')
    }

    // Validate sizeIds
    if (input.items.length > 0) {
      const sizeIds = input.items.map(i => i.sizeId)
      const sizes = await sizeRepo.findManyByIds(sizeIds)
      if (sizes.length !== new Set(sizeIds).size) {
        throw new ValidationError('Some sizeIds are invalid or duplicated')
      }
    }

    const code = input.code ?? await generateOrderCode()
    const existing = await orderRepo.findByCode(code)
    if (existing) throw new ConflictError(`Order code ${code} already exists`)

    const order = await orderRepo.createWithItems({
      code,
      styleVariantId: input.styleVariantId,
      ownerId: input.ownerId ?? ctx.actor.id,
      orderedAt: input.orderedAt ?? null,
      expectedAt: input.expectedAt ?? null,
      priority: input.priority,
      notes: input.notes ?? null,
      items: input.items,
    })

    await auditRepo.write({
      actorId: ctx.actor.id, source: ctx.source, action: 'order.create',
      entityType: 'Order', entityId: order.id, before: null, after: order,
      requestId: ctx.requestId,
    })

    await evaluateOrderAlerts(order.id)

    const warnings: string[] = []
    if (!input.expectedAt) warnings.push('Chưa có deadline — sẽ trigger MISSING_DEADLINE alert')
    if (input.items.length === 0) warnings.push('Chưa có size items — bổ sung trước khi chốt đơn')

    return {
      order: { id: order.id, code: order.code, status: order.status as 'DRAFT', createdAt: order.createdAt },
      warnings,
    }
  })
}
```

---

## 7. Bộ Action chốt cho Phase 1

### 7.1. Core actions (must-have, được map MCP Phase 2)

| # | Action | Loại | Input chính | Output chính |
|---|---|---|---|---|
| 1 | `createOrder` | write | code?, styleVariantId, items[], orderedAt?, expectedAt?, priority, notes? | `{ order, warnings[] }` |
| 2 | `updateOrder` | write | id, version, patch | `{ order }` |
| 3 | `updateOrderStatus` | write | id, version, toStatus, note? | `{ order, alertsChanged[] }` |
| 4 | `setOrderItems` | write | orderId, items[] (replace toàn bộ) | `{ items[] }` |
| 5 | `applyRatioToBatch` ⭐ | write | orderId, multiplier, batchNumber? | `{ batch, items[] }` |
| 6 | `createBatch` | write | orderId, items[], batchedAt?, note? | `{ batch }` |
| 7 | `setBatchItems` | write | batchId, items[] (replace) | `{ items[] }` |
| 8 | `getOrderByCode` | read | code | `{ order, items, batches, alerts, totals }` |
| 9 | `searchOrders` | read | filter, pagination, sort | `{ items[], total, page, pageSize }` |
| 10 | `getUrgentOrders` | read | thresholdDays? | `Order[]` |
| 11 | `getOrdersMissingData` | read | — | `{ order, missing[] }[]` |
| 12 | `validateOrderDataCompleteness` | read | orderId | `{ isComplete, score, missing[] }` ⭐ |
| 13 | `getActiveAlerts` | read | filter? | `Alert[]` |

### 7.2. Auxiliary actions

```
deleteOrder, getOrderById, getOrderTimeline, getOverdueOrders
updateBatch, deleteBatch
createStyle, updateStyle, deleteStyle, listStyles
createStyleVariant, updateStyleVariant, deleteStyleVariant, uploadVariantImage
createSize, updateSize, deleteSize, listSizes
attachFileToOrder, deleteAttachment
dismissAlert
login, logout
```

### 7.3. Zod schema cho action quan trọng

```ts
// applyRatioToBatch — ⭐ generate batch qty từ ratio
export const ApplyRatioToBatchInput = z.object({
  orderId: z.string().uuid(),
  // multiplier: số nhân với mỗi ratio để ra qty
  // VD ratio = [3,3,2,1,1], multiplier=8 → qty = [24,24,16,8,8] → tổng 80
  multiplier: z.number().int().min(1).max(100000),
  // Nếu cung cấp batchNumber → update batch đó. Nếu không → tạo batch mới.
  batchNumber: z.number().int().min(1).optional(),
  batchedAt: z.coerce.date().optional(),
  note: z.string().max(2000).optional(),
})

// createBatch — manual nhập qty cho từng size
export const CreateBatchInput = z.object({
  orderId: z.string().uuid(),
  batchedAt: z.coerce.date().optional(),
  note: z.string().max(2000).optional(),
  items: z.array(z.object({
    sizeId: z.string().uuid(),
    quantity: z.number().int().min(0),
  })).min(1),
})

// setOrderItems — replace toàn bộ items của order
export const SetOrderItemsInput = z.object({
  orderId: z.string().uuid(),
  items: z.array(z.object({
    sizeId: z.string().uuid(),
    ratio: z.number().int().min(0).default(0),
  })),  // mảng rỗng = xóa hết
})

// setBatchItems — replace toàn bộ items của batch
export const SetBatchItemsInput = z.object({
  batchId: z.string().uuid(),
  items: z.array(z.object({
    sizeId: z.string().uuid(),
    quantity: z.number().int().min(0),
  })),
})

// updateOrder — whitelist
export const UpdateOrderInput = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(0),
  patch: z.object({
    styleVariantId: z.string().uuid().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    orderedAt: z.coerce.date().nullable().optional(),
    expectedAt: z.coerce.date().nullable().optional(),
    notes: z.string().max(10000).nullable().optional(),
  }),
})

// updateOrderStatus
export const UpdateOrderStatusInput = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(0),
  toStatus: z.enum(['DRAFT','CONFIRMED','IN_PRODUCTION','QC','READY','DELIVERED','CANCELLED']),
  note: z.string().max(2000).optional(),
})

// searchOrders
export const SearchOrdersInput = z.object({
  q: z.string().optional(),  // free-text: code, style code, variant name
  status: z.array(z.enum(['DRAFT','CONFIRMED','IN_PRODUCTION','QC','READY','DELIVERED','CANCELLED'])).optional(),
  priority: z.array(z.enum(['LOW','NORMAL','HIGH','URGENT'])).optional(),
  styleId: z.string().uuid().optional(),
  styleVariantId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  orderedFrom: z.coerce.date().optional(),
  orderedTo: z.coerce.date().optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  hasOpenAlert: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sort: z.enum(['expectedAt','orderedAt','createdAt','priority','updatedAt']).default('orderedAt'),
  sortDir: z.enum(['asc','desc']).default('desc'),
})

// validateOrderDataCompleteness
export const ValidateOrderInput = z.object({ orderId: z.string().uuid() })
export interface ValidateOrderOutput {
  isComplete: boolean
  score: number  // 0..1
  missing: Array<{ field: string; severity: 'info' | 'warn' | 'critical'; message: string }>
}

// getActiveAlerts
export const GetActiveAlertsInput = z.object({
  orderId: z.string().uuid().optional(),
  severity: z.array(z.enum(['INFO','WARN','CRITICAL'])).optional(),
  status: z.array(z.enum(['OPEN','SNOOZED'])).default(['OPEN']),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
})
```

### 7.4. `applyRatioToBatch` — ⭐ chi tiết

Đây là action tận dụng tỉ lệ để generate số lượng — đúng workflow Excel khách đang dùng (3,3,2,1,1 × 8 = 24,24,16,8,8 → tổng 80).

**Logic:**
1. Load order + `OrderItem[]` (size + ratio).
2. Tính `qty = ratio × multiplier` cho mỗi size có `ratio > 0`.
3. Nếu `batchNumber` được cung cấp → update batch đó (replace toàn bộ items). Nếu không → tạo batch mới với `batchNumber = max + 1`.
4. Audit + evaluate alerts.
5. Trả `{ batch, items, total: sum(qty) }`.

**Note:** action này **không phải bắt buộc** dùng. User vẫn có thể `createBatch` nhập tay từng số. `applyRatio` chỉ là tiện lợi.

### 7.5. `validateOrderDataCompleteness` — chấm điểm dữ liệu order

Trọng số Phase 1:

| Field | Weight | Critical? |
|---|---|---|
| `styleVariantId` | 0.10 | ✅ |
| `orderedAt` | 0.10 | — |
| `expectedAt` | 0.20 | ✅ |
| Có ít nhất 1 `OrderItem` (khi status ≥ CONFIRMED) | 0.20 | ✅ khi CONFIRMED+ |
| Tất cả `OrderItem.ratio > 0` (khi có items) | 0.10 | — |
| Có ít nhất 1 `OrderBatch` (khi status ≥ IN_PRODUCTION) | 0.20 | ✅ khi IN_PRODUCTION+ |
| Tổng qty của batch mới nhất khớp với multiplier × ratio | 0.10 | — |

`score = sum(weight × completed)`. `isComplete = (score ≥ 0.95) AND no critical missing`.

---

## 8. REST endpoint mapping

| Method | Path | Action |
|---|---|---|
| `POST` | `/api/auth/login` | login |
| `POST` | `/api/auth/logout` | logout |
| `GET` | `/api/auth/me` | get current user |
| `POST` | `/api/orders` | createOrder |
| `GET` | `/api/orders?...` | searchOrders |
| `GET` | `/api/orders/:id` | getOrderById |
| `GET` | `/api/orders/by-code/:code` | getOrderByCode |
| `PATCH` | `/api/orders/:id` | updateOrder |
| `DELETE` | `/api/orders/:id` | deleteOrder (soft) |
| `POST` | `/api/orders/:id/status` | updateOrderStatus |
| `GET` | `/api/orders/:id/validate` | validateOrderDataCompleteness |
| `GET` | `/api/orders/:id/timeline` | getOrderTimeline |
| `PUT` | `/api/orders/:id/items` | setOrderItems |
| `POST` | `/api/orders/:id/apply-ratio` | applyRatioToBatch |
| `POST` | `/api/orders/:id/batches` | createBatch |
| `POST` | `/api/orders/:id/attachments` | attachFileToOrder (multipart) |
| `DELETE` | `/api/attachments/:id` | deleteAttachment |
| `GET` | `/api/batches/:id` | getBatchById (auxiliary) |
| `PATCH` | `/api/batches/:id` | updateBatch |
| `DELETE` | `/api/batches/:id` | deleteBatch (soft) |
| `PUT` | `/api/batches/:id/items` | setBatchItems |
| `GET` | `/api/styles?...` | listStyles |
| `POST` | `/api/styles` | createStyle |
| `PATCH` | `/api/styles/:id` | updateStyle |
| `DELETE` | `/api/styles/:id` | deleteStyle |
| `POST` | `/api/styles/:id/variants` | createStyleVariant |
| `PATCH` | `/api/variants/:id` | updateStyleVariant |
| `DELETE` | `/api/variants/:id` | deleteStyleVariant |
| `POST` | `/api/variants/:id/image` | uploadVariantImage (multipart) |
| `GET` | `/api/sizes` | listSizes |
| `POST` | `/api/sizes` | createSize |
| `PATCH` | `/api/sizes/:id` | updateSize |
| `DELETE` | `/api/sizes/:id` | deleteSize |
| `GET` | `/api/alerts?...` | getActiveAlerts |
| `POST` | `/api/alerts/:id/dismiss` | dismissAlert |
| `GET` | `/api/dashboard/urgent?days=7` | getUrgentOrders |
| `GET` | `/api/dashboard/overdue` | getOverdueOrders |
| `GET` | `/api/dashboard/missing-data` | getOrdersMissingData |
| `GET` | `/api/health` | health check (no auth) |

**API handler chuẩn:**
```ts
// server/api/orders/index.post.ts
import { createOrder } from '~/server/actions/orders/createOrder'
import { buildContext } from '~/server/utils/http'

export default defineEventHandler(async (event) => {
  const ctx = await buildContext(event)
  const body = await readBody(event)
  return await createOrder(body, ctx)
})
```

**Headers:** `X-Request-Id` (auto-gen), `Idempotency-Key` (optional).

**Error response:**
```json
{ "error": { "code": "VALIDATION", "message": "...", "details": {...}, "requestId": "req_..." } }
```

---

## 9. Order Code Format

**Quyết định (xem mục 18):** auto-gen `TN-YYYYMMDD-####`, cho phép user override.

- Auto: `TN-20260515-0001` (ngày đặt + sequence trong ngày).
- User override: nhập tay format cũ như `TN150501` khi import dữ liệu lúc M3 (ví dụ admin tự nhập từ excel).
- Validation: regex `/^[A-Z0-9-]{3,32}$/`, unique.

**Implementation:** dùng bảng `OrderCodeCounter(prefix, value)`.

```ts
async function generateOrderCode(date = new Date()) {
  const yyyymmdd = formatYYYYMMDD(date)  // "20260515"
  const prefix = `TN-${yyyymmdd}`
  // Atomic upsert + increment
  const counter = await prisma.orderCodeCounter.upsert({
    where: { prefix },
    create: { prefix, value: 1 },
    update: { value: { increment: 1 } },
  })
  return `${prefix}-${String(counter.value).padStart(4, '0')}`
}
```

---

## 10. Alert Rules

| Mã rule | Điều kiện | Severity | Khi nào reset |
|---|---|---|---|
| `OVERDUE` | `expectedAt < now()` AND `status NOT IN (DELIVERED, CANCELLED)` | CRITICAL | Khi DELIVERED hoặc dời `expectedAt` |
| `DUE_SOON_3D` | `expectedAt - now() <= 3d` AND status active | CRITICAL | Như trên |
| `DUE_SOON_7D` | `expectedAt - now() <= 7d` AND status active | WARN | Như trên |
| `MISSING_DEADLINE` | `expectedAt IS NULL` AND `status >= CONFIRMED` | WARN | Khi điền |
| `NO_ITEMS` | `status >= CONFIRMED` AND không có `OrderItem` | WARN | Khi thêm item |
| `NO_BATCH` | `status >= IN_PRODUCTION` AND không có `OrderBatch` | WARN | Khi tạo batch |
| `BATCH_QTY_MISMATCH_RATIO` | Ratio định nghĩa nhưng tổng qty của batch mới nhất không phải bội của tổng ratio | INFO | Khi sửa lại |
| `STATUS_TIMELINE_MISMATCH` | `status = DELIVERED` nhưng `actualAt IS NULL` | INFO | Khi điền |
| `STALE_ORDER` | `status = IN_PRODUCTION` AND `updatedAt < now() - 14d` | INFO | Khi có cập nhật |

### Rule interface

```ts
// server/modules/alerts/rules/_types.ts
export interface OrderWithRelations {
  id: string
  status: OrderStatus
  expectedAt: Date | null
  orderedAt: Date | null
  actualAt: Date | null
  updatedAt: Date
  items: Array<{ sizeId: string; ratio: number }>
  batches: Array<{
    id: string
    batchNumber: number
    items: Array<{ sizeId: string; quantity: number }>
  }>
}

export interface AlertResult {
  message: string
  dataSnapshot: Record<string, unknown>
}

export interface AlertRule {
  code: string
  severity: AlertSeverity
  evaluate(order: OrderWithRelations, now: Date): AlertResult | null
}
```

### Engine

```ts
// server/modules/alerts/alert-engine.ts
import { rules } from './rules'

export async function evaluateOrderAlerts(orderId: string, now = new Date()) {
  const order = await loadOrderWithRelations(orderId)
  if (!order || order.deletedAt) return

  const matched = rules
    .map(r => ({ rule: r, result: r.evaluate(order, now) }))
    .filter((x): x is { rule: AlertRule; result: AlertResult } => x.result !== null)

  await prisma.$transaction(async (tx) => {
    for (const { rule, result } of matched) {
      await tx.alert.upsert({
        where: { uniq_open_alert: { orderId, ruleCode: rule.code, status: 'OPEN' } },
        create: { orderId, ruleCode: rule.code, severity: rule.severity, message: result.message, dataSnapshot: result.dataSnapshot, status: 'OPEN' },
        update: { message: result.message, dataSnapshot: result.dataSnapshot },
      })
    }
    const matchedCodes = new Set(matched.map(m => m.rule.code))
    await tx.alert.updateMany({
      where: { orderId, status: 'OPEN', ruleCode: { notIn: [...matchedCodes] } },
      data: { status: 'RESOLVED', resolvedAt: now },
    })
  })
}
```

**Trigger:**
- Tức thời: sau mọi mutation order/items/batch.
- Cron `alert-evaluator.job` chạy mỗi 10 phút quét tất cả order active.

---

## 11. Security & Auth (1 admin)

- **Seed admin** ở `prisma/seed.ts`: email cấu hình qua env `SEED_ADMIN_EMAIL`, password ngẫu nhiên in console, set `User.metadata.mustChangePassword = true`.
- **Login:** POST `/api/auth/login` → check bcrypt → tạo Session → set cookie `session_token` (HttpOnly, Secure, SameSite=Lax, max-age 7 ngày). Token 32 bytes random base64url, lưu `tokenHash = sha256(token)`.
- **Middleware `02.auth.ts`:** đọc cookie, lookup session, attach `event.context.user`.
- **Helper `requireAuth(event)`:** ném `ForbiddenError` nếu chưa login.
- **bcrypt cost 12.** Password tối thiểu 10 ký tự, có chữ + số.
- **CSRF:** SameSite=Lax cho cùng origin là đủ.
- **Rate limit login:** 5 lần / IP / 15 phút (in-memory Map).

---

## 12. Logging

```ts
// server/plugins/logger.ts
import pino from 'pino'
export const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
```

- Mỗi request: 1 log (`requestId`, `method`, `path`, `status`, `durationMs`, `actorId`).
- Mỗi action mutation: 1 log (`action`, `requestId`, `actorId`, `entityId`, `durationMs`).
- Error: log `error.stack` + `requestId`.
- Không log password / token / file content.

`/api/health` trả `{ status: 'ok', dbReachable: true, time: ISO }`.

---

## 13. Testing strategy

### Pyramid

- **Unit (60%):** rules, helpers (order-code-gen, password, idempotency, ratio math).
- **Integration (35%):** action functions với Postgres test schema.
- **E2E (5%):** flows chính: login → create order → set items → apply ratio → tạo batch → đổi status → see alert.

### Test DB

- Postgres test schema riêng. Mỗi test wrap transaction, rollback cuối test.
- Helper `createTestContext({ role: 'ADMIN' })` trả `ActionContext`.

### Mỗi action có ít nhất

- Happy path
- Validation fail (per required field)
- Conflict / not found
- Authorization (chưa login)
- Idempotency replay (mutation)

### Không test

- UI components (E2E flow là đủ)
- Prisma directly (infrastructure)

---

## 14. Milestone breakdown

Mỗi milestone là **1 đơn vị có thể demo được**. Sau mỗi milestone:
- Tất cả test xanh.
- Clone repo, `docker compose up`, `pnpm dev` chạy được.
- Có flow demo cụ thể.
- Tag git: `m1-foundation`, `m2-orders`, ...

### M1 — Foundation

**Mục tiêu:** project boot, DB, auth, 1 admin login.

**Scope:**
- Init Nuxt 3, `tsconfig`, ESLint, Prettier.
- `docker-compose.yml` với Postgres 15 + Adminer.
- Prisma init, schema đầy đủ (mục 5), `migrate dev --name init`.
- `prisma/seed.ts`: 1 admin + 5 size mặc định (S/M/L/XL/XXL với order 10/20/30/40/50).
- `server/plugins/prisma.ts`, `logger.ts`.
- `server/actions/_base/` (context, errors, idempotency).
- `server/utils/http.ts` với `buildContext`, `parseZod`, error response middleware.
- Action `login`, `logout`, `me`. API `/api/auth/*`.
- Middleware request-id, auth, error-handler.
- Page `/login`, layout có check auth.
- `/api/health`.
- CI cơ bản (typecheck + test).
- README setup.

**Acceptance criteria:**
- [ ] `pnpm install && docker compose up -d && pnpm prisma migrate dev && pnpm seed && pnpm dev` chạy được từ máy mới.
- [ ] `/` redirect `/login`.
- [ ] Login admin seeded → vào trang chính (placeholder dashboard).
- [ ] Logout → redirect login.
- [ ] `/api/health` trả `dbReachable: true`.
- [ ] DB có sẵn 5 size mặc định.
- [ ] CI xanh: typecheck + lint.

### M2 — Master Data: Style & Size

**Mục tiêu:** quản lý style + variant + size để tạo order ở M3.

**Scope:**
- Module `styles`: style.repo, variant.repo, types.
- Actions: `createStyle`, `updateStyle`, `deleteStyle`, `listStyles`, `createStyleVariant`, `updateStyleVariant`, `deleteStyleVariant`, `uploadVariantImage`.
- Module `sizes`: size.repo. Actions: `createSize`, `updateSize`, `deleteSize`, `listSizes`.
- API tương ứng.
- Module `attachments`: storage adapter (disk Phase 1) — vì variant cần upload ảnh.
- FE:
  - `pages/styles/index.vue` (list style + button new).
  - `pages/styles/[id].vue` (detail + variants list + upload ảnh inline).
  - `pages/sizes/index.vue` (CRUD bảng đơn).
  - Component `StyleForm`, `VariantForm`.
- Test integration cho actions.

**Acceptance criteria:**
- [ ] Tạo Style `AO083 - Áo polo cổ bẻ`.
- [ ] Tạo 2 variants: `TRANG KE XANH`, `TRANG KE DO`, mỗi cái upload 1 ảnh.
- [ ] List style hiển thị thumbnail variant đầu tiên.
- [ ] Sửa size `S` thành `Áo S` (label) — lưu được.
- [ ] Thêm size mới `XS` order=5 → list theo thứ tự XS, S, M, L, XL, XXL.
- [ ] Xóa style đang có order tham chiếu → conflict error rõ ràng.
- [ ] Audit log có entry cho mỗi mutation.

### M3 — Orders core (đơn + items + status)

**Mục tiêu:** tạo order với size + ratio, đổi status, lưu lịch sử. Chưa có batch.

**Scope:**
- Module `orders`: order.repo, order.code-gen, order.totals, types.
- Actions: `createOrder`, `updateOrder`, `updateOrderStatus`, `setOrderItems`, `deleteOrder`, `getOrderById`, `getOrderByCode`, `searchOrders`, `getOrderTimeline`.
- API tương ứng.
- FE:
  - `pages/orders/index.vue` (list + filter + search).
  - `pages/orders/new.vue` (form: code, style picker, ngày đặt, ngày kỳ vọng, priority, notes; thêm bảng items chọn size + ratio).
  - `pages/orders/[id].vue` với tab Info, Items, Timeline (Batches/Attachments/Alerts placeholder).
  - Component `OrderForm`, `OrderList`, `OrderStatusBadge`, `OrderItemsEditor`, `OrderTimeline`, `StylePicker`.
- Test integration 8 actions.

**Acceptance criteria:**
- [ ] Tạo order `TN150501` với variant AO083-TRANG KE XANH, items [S:3, M:3, L:2, XL:1, XXL:1].
- [ ] Đổi status DRAFT → CONFIRMED → tab Timeline hiện entry.
- [ ] Sửa name xong reload → tên mới.
- [ ] Xóa order → biến mất khỏi list.
- [ ] Hai tab cùng sửa 1 order → tab thứ 2 báo "Resource was modified".
- [ ] AuditLog có entry cho mọi mutation, `source = 'ui'`, `requestId` khớp.
- [ ] Search `q=TN150501` trả đúng order.
- [ ] Test integration 100% xanh.

### M4 — Batches & Apply Ratio

**Mục tiêu:** quản lý đợt nhập, apply ratio để generate qty.

**Scope:**
- Module `batches`: batch.repo, types.
- Actions: `createBatch`, `updateBatch`, `deleteBatch`, `setBatchItems`, `applyRatioToBatch`.
- API tương ứng.
- FE:
  - Tab Batches trong order detail: list batches + button "Tạo đợt mới" + button "Generate từ tỉ lệ".
  - Component `BatchList`, `BatchEditor`, `ApplyRatioDialog`.
  - Hiển thị Tổng (sum qty) computed.
- Test integration.

**Acceptance criteria:**
- [ ] Order có ratio [3,3,2,1,1] → bấm "Generate từ tỉ lệ" → nhập multiplier=8 → tạo batch với qty [24,24,16,8,8] tổng 80.
- [ ] Tạo batch thứ 2 với multiplier=10 → qty [30,30,20,10,10] tổng 100.
- [ ] Tạo batch tay (không apply ratio) → vẫn ok.
- [ ] Sửa batch existing với apply ratio (cùng batchNumber) → update items chứ không tạo batch mới.
- [ ] Xóa batch → batch cũ vẫn còn trong DB (soft).
- [ ] Tổng order = sum qty của tất cả batch chưa xóa.

### M5 — Alerts & Dashboard & Validate

**Mục tiêu:** rule engine, cron, dashboard, health check.

**Scope:**
- Module `alerts`: 9 rule files, alert-engine.
- Actions: `getActiveAlerts`, `dismissAlert`, `getUrgentOrders`, `getOverdueOrders`, `getOrdersMissingData`, `validateOrderDataCompleteness`.
- Cron job `alert-evaluator` mỗi 10 phút.
- Trigger evaluate sau mỗi mutation order/items/batch.
- FE:
  - `pages/dashboard.vue` với 4 widget (urgent, overdue, missing data, recent alerts).
  - `pages/alerts/index.vue` (full list + filter).
  - Component `AlertCard`, `AlertList`, `OrderHealthCheck` (dùng validate action).
  - Tab Alerts trong order detail.

**Acceptance criteria:**
- [ ] Tạo order không có deadline → alert `MISSING_DEADLINE` xuất hiện trong < 5 giây.
- [ ] Set `expectedAt` = quá khứ → alert `OVERDUE` với số ngày trễ.
- [ ] DELIVERED order → `OVERDUE` tự đóng.
- [ ] Dashboard count đúng.
- [ ] Dismiss alert kèm reason → biến mất khỏi list active.
- [ ] `validateOrderDataCompleteness` trả đúng score cho 3 case test (empty, half, full).
- [ ] Cron log đúng định kỳ.

### M6 — Attachments + Polish + Go-live

**Mục tiêu:** đính kèm file đơn, polish UX, deploy.

**Scope:**
- Action: `attachFileToOrder`, `deleteAttachment`. Multipart upload.
- Validation: max 20MB, mime whitelist.
- FE: tab Attachments trong order detail.
- Polish: loading state, error toast, empty state, keyboard shortcut.
- Production Dockerfile multi-stage, env validation khi boot.
- Backup script `pg_dump` daily (cron host).
- README deploy.

**Acceptance criteria:**
- [ ] Upload PDF 5MB vào order → download lại được.
- [ ] Upload .exe → reject.
- [ ] File lưu ngoài thư mục public.
- [ ] Build production Docker image, run được.
- [ ] Backup script tạo dump file.
- [ ] Smoke test full flow: tạo style+variant → tạo size → tạo order → set items → apply ratio → tạo batch 2 → đổi status → see alert → đính kèm file.

---

## 15. Conventions tổng hợp

| Quy tắc | Chi tiết |
|---|---|
| **Soft delete** | Mọi entity nghiệp vụ có `deletedAt`. Repo default filter `deletedAt: null`. |
| **Optimistic locking** | `Order.version`, `OrderBatch.version` (nice-to-have). Update phải nhận `version`, mismatch → `OptimisticLockError`. |
| **Audit log** | Mọi mutation gọi `auditRepo.write` sau commit. Action name `<entity>.<verb>`. |
| **Source field** | `OrderUpdate.source`, `AuditLog.source` — Phase 1 luôn `'ui'`. Phase 2 thêm `'mcp'`. |
| **Idempotency** | Mọi action mutation wrap `withIdempotency`. UI Phase 1 không bắt buộc. |
| **Quantity** | `Int` cho batch qty (đơn vị nguyên: chiếc áo). Nếu khách quản lý theo lô / cuộn / kg ở entity khác sau này → Decimal. |
| **Date** | UTC trong DB. FE format theo timezone trình duyệt. |
| **Tổng qty** | Computed, không lưu. |
| **JSON metadata** | Field tùy biến / Phase 2 AI extracted. Không dùng cho field cần filter/sort. |
| **Naming** | Action `verbNoun`. API `/api/<plural>/<id>/<sub>`. DB column `camelCase`. |
| **Commit msg** | Conventional Commits. |
| **Branch** | `main` luôn deploy được. Feature `feat/<short>`. |

---

## 16. Out of scope Phase 1

❌ MCP server thật. ❌ AI/LLM/OCR. ❌ Material/BOM/Vendor (đẩy về Phase sau khi khách yêu cầu). ❌ Multi-user / RBAC. ❌ Multi-tenant. ❌ Real-time collab. ❌ Mobile app. ❌ Export Excel/CSV (nice-to-have, làm sau M6 nếu kịp). ❌ Email notification (nice-to-have). ❌ Workflow framework. ❌ Microservices. ❌ Forecast/ML. ❌ 2FA (đẩy về Phase 1.5 nếu khách yêu cầu).

---

## 17. Phase 2 readiness checklist

- [ ] Mọi mutation đi qua `server/actions/`.
- [ ] Mọi action có Zod input schema export.
- [ ] Mọi action nhận `ActionContext`.
- [ ] `AuditLog.source` có dữ liệu thật.
- [ ] `OrderUpdate.source` có dữ liệu thật.
- [ ] `validateOrderDataCompleteness` đã được UI dùng.
- [ ] Soft delete + optimistic locking thống nhất.
- [ ] Backup daily + đã test restore.
- [ ] `metadata Json?` ở Order/Style/Variant available.
- [ ] Format code (order, style) chốt và không đổi.
- [ ] Vài tháng dữ liệu thật khi vào Phase 2.
- [ ] Documentation actions auto-gen từ Zod.
- [ ] Logging + monitoring ổn định.
- [ ] Policy AI tools đã thảo luận với khách.

---

## 18. Decisions đã chốt (trước M1)

| # | Câu hỏi | Quyết định | Tác động |
|---|---|---|---|
| 1 | Hosting | **Mac Mini ở công ty (self-host) qua tunnel** | Không cần Dockerfile production cho cloud. Chỉ cần `docker compose up -d` trên Mac Mini. M6 viết script systemd-equivalent (launchd plist) để Postgres + app auto-start khi reboot. |
| 2 | Domain + HTTPS | **Tunnel tự lo HTTPS** (Cloudflare Tunnel / ngrok / Tailscale Funnel) | App listen `127.0.0.1:3000`, Nginx + Let's Encrypt **không cần**. App vẫn cần set cookie `Secure` khi `NODE_ENV=production`. |
| 3 | Storage ảnh + attachment | **Disk local Phase 1** (path: `./storage/uploads/`) | Storage adapter có interface — đổi sang S3 sau bằng cách thêm adapter mới, không touch action layer. |
| 4 | Backup | **Chưa làm Phase 1.** | M6 chỉ document cách backup manual (`pg_dump` 1 dòng) trong README. Khách tự chạy nếu muốn. ⚠️ Rủi ro mất dữ liệu khi Mac Mini hỏng đã được flag với khách. |
| 5 | UI library | **Nuxt UI v3** | Cài 1 module, dùng `<UButton>`, `<UTable>`, `<UModal>`, `<UForm>`, `<UDashboardPanel>` ngay. Headless UI + Tailwind làm nền. |
| 6 | Order code format | **Auto-gen `TN-YYYYMMDD-####`, cho phép user override** khi import/nhập tay | `OrderCodeCounter` key theo prefix `TN-YYYYMMDD`. User Excel cũ vẫn nhập được `TN150501`. |
| 7 | Style code format | **Free text, user tự quyết** | Schema `Style.code String @unique`, validation chỉ check không trùng. Không auto-gen. |
| 8 | Variant naming | **Free text, search case-insensitive** | Dùng Postgres `ILIKE` cho search. Lưu nguyên người dùng nhập (`Trắng kẻ xanh` hoặc `TRANG KE XANH` — admin chọn). |
| 9 | Import dữ liệu cũ | **Không, bắt đầu trắng** | Không cần script import. Admin sẽ nhập tay đơn đang chạy lúc go-live. |
| 10 | Số ảnh per variant | **1 ảnh** (như Excel hiện tại) | Schema `StyleVariant.imageUrl String?`. Phase sau cần gallery → đổi sang `StyleVariantImage[]` với migration. |

### Notes triển khai phát sinh từ decisions

- **Self-host Mac Mini:** dev và production cùng Mac Mini? Đề xuất **dev trên cùng máy, production là một docker-compose riêng** (`docker-compose.prod.yml`) chạy ở port khác để không conflict.
- **Cookie `Secure` flag:** chỉ bật khi `NODE_ENV=production`. Local dev qua HTTP nên dev mode tắt `Secure`.
- **`OrderCodeCounter`:** key phải lock atomically. Dùng `prisma.$transaction` với `upsert + increment`.
- **Variant search case-insensitive:** trong action `searchOrders`, dùng `WHERE lower(name) LIKE lower($1)` hoặc Prisma `mode: 'insensitive'`.
- **Storage adapter:**
  ```ts
  interface StorageAdapter {
    save(buffer: Buffer, filename: string, contentType: string): Promise<{ storagePath: string }>
    read(storagePath: string): Promise<Buffer>
    delete(storagePath: string): Promise<void>
  }
  ```
  Phase 1 chỉ implement `LocalDiskStorage`. Phase sau thêm `S3Storage`.
- **Tunnel test:** trước khi go-live cần test tunnel hoạt động ổn định 24/7 — nếu rớt mạng nhà sếp, app down.

---

*Hết blueprint v2.*

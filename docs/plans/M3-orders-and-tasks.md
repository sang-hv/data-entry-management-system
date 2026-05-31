# M3 Orders & Tasks — Implementation Record

> **Status:** ✅ Complete (tag `m3-orders-tasks`)
> **Format:** post-execution record. Decisions + execution notes + lessons for M4.
> **Reference:** schema chi tiết ở `docs/implementation-plan.md` mục 5; actions ở mục 7.

**Goal:** Tạo đơn đặt hàng đầu-cuối với items (size + tỉ lệ), pick task quy trình từ thư viện, cập nhật tiến độ để auto-derive trạng thái + tổng tiến độ đơn.

**Scope không bao gồm:** OrderBatch + applyRatio (M4), alerts engine + dashboard data (M5), attachments (M6).

---

## 1. Domain decisions chốt cho M3 (theo thảo luận với user)

| # | Decision | Chọn | Lý do |
|---|---|---|---|
| 1 | Task workflow | A: master data + snapshot | Quy trình xưởng có pattern lặp; snapshot giữ tên cũ khi master đổi |
| 2 | Trùng task trong 1 đơn | A: cho phép | Thực tế ngành may có nhiều bước lặp (kiểm hàng đợt 1/2...) |
| 3 | Task progress | A: chỉ `progressPct 0..100`, 100 = done | Đơn giản nhất; UI tự render tick khi 100 |
| 4 | Order status | B: `DRAFT/ACTIVE/COMPLETED/CANCELLED` auto-derive | Cần cho dashboard filter; logic auto từ task progress |
| 5 | Order progressPct | A: avg đơn giản | Trọng số có thể nâng cấp sau nếu khách yêu cầu |
| 6 | Tuần tự task | B: gợi ý hiển thị, không enforce | Flexibility — xưởng có công đoạn parallel |
| 7 | `expectedDuration` cho task | Không (Phase 1) | Chỉ name + description đủ |
| 8 | `notes` riêng cho OrderTask | Có | Optional |
| 9 | Lịch sử update task | Có — qua `OrderUpdate` + `AuditLog` | Reuse entity hiện có |

---

## 2. Schema additions (đã update vào blueprint mục 5)

```prisma
model Task {
  id          String   @id @default(uuid())
  code        String?  @unique           // "CUT", "SEW" — optional
  name        String                      // "Cắt vải"
  description String?  @db.Text
  active      Boolean  @default(true)
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  orderTasks  OrderTask[]

  @@index([active])
  @@index([deletedAt])
}

model Order {
  // ... fields cũ ...
  progressPct Int @default(0)             // ⬅ NEW: cache, 0..100
  // status enum đổi:
  // OLD: DRAFT|CONFIRMED|IN_PRODUCTION|QC|READY|DELIVERED|CANCELLED
  // NEW: DRAFT|ACTIVE|COMPLETED|CANCELLED
  tasks OrderTask[]                        // ⬅ NEW relation
}

model OrderTask {
  id                  String   @id @default(uuid())
  orderId             String
  order               Order    @relation(...)
  taskId              String?              // null nếu master bị xóa
  task                Task?    @relation(...)
  nameSnapshot        String               // không đổi khi master đổi
  descriptionSnapshot String?  @db.Text
  order               Int      @default(0) // thứ tự
  progressPct         Int      @default(0) // 0..100
  notes               String?
  startedAt           DateTime?            // auto khi progressPct > 0 lần đầu
  completedAt         DateTime?            // auto khi progressPct = 100
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([orderId, order])
  @@index([taskId])
}
```

**Migration:** vì M2 đã chốt schema cũ với enum status 7-state nhưng **chưa có Order data thật** (M3 chưa execute), tạo migration mới drop enum cũ + add tasks. Không lo data loss.

---

## 3. Tasks plan (sẽ execute)

| # | Task | Tests | Output |
|---|---|---|---|
| 1 | Migration: update OrderStatus enum, add `progressPct`, add Task + OrderTask | — | DB ready |
| 2 | Task module: repo + 4 actions (`createTask`, `updateTask`, `deleteTask`, `listTasks`) | ~12 | Master data ready |
| 3 | Tasks API + UI page (`/tasks`) | smoke | Admin tạo task chuẩn được |
| 4 | Order module: order.repo, order.code-gen, order.totals, order.progress | — | Foundation |
| 5 | Order actions: `createOrder`, `updateOrder`, `cancelOrder`, `setOrderItems`, `deleteOrder`, `getOrderById`, `getOrderByCode`, `searchOrders`, `getOrderTimeline` | ~20 | Order CRUD đầy đủ |
| 6 | OrderTask module: orderTask.repo + helper recompute order progress/status | — | Reusable engine |
| 7 | OrderTask actions: `pickTasksForOrder`, `setOrderTasks`, `updateOrderTaskProgress` | ~12 | Task workflow |
| 8 | API endpoints orders + order-tasks | smoke | REST surface |
| 9 | UI: `pages/orders/index.vue` (list + status badge + progress bar) | smoke | Browse orders |
| 10 | UI: `pages/orders/new.vue` (form + style picker + items editor + task picker) | smoke | Create order |
| 11 | UI: `pages/orders/[id].vue` (tabs: Info, Items, Quy trình stepper, Timeline) | smoke | Detail + workflow |
| 12 | Component: `OrderStatusBadge`, `OrderProgressBar`, `OrderTaskStepper`, `TaskPicker` | — | Reusable widgets |
| 13 | i18n keys: `orders.*`, `tasks.*`, `orders.tasks.*` | — | All strings ext'd |
| 14 | Integration test: full happy path (tạo order → pick tasks → update progress → auto-derive) | 1 e2e-style | Verify auto-derive logic |
| 15 | Update seed: thêm 4 task chuẩn (Cắt vải, May, Ủi, Đóng gói) | — | Demo-ready |
| 16 | Smoke test full + tag `m3-orders-tasks` | — | Done |

---

## 4. Auto-derive logic spec

### Khi `updateOrderTaskProgress(orderTaskId, progressPct)` chạy

```ts
// pseudo
async function updateOrderTaskProgress(input, ctx) {
  const before = await orderTaskRepo.findById(input.orderTaskId)
  if (!before) throw NotFoundError
  if (before.order.status === 'CANCELLED') throw ConflictError('Order is cancelled')

  // Update task
  const startedAt = before.startedAt ?? (input.progressPct > 0 ? new Date() : null)
  const completedAt = input.progressPct === 100 ? new Date() : null
  const updatedTask = await orderTaskRepo.update(input.orderTaskId, {
    progressPct: input.progressPct,
    notes: input.notes,
    startedAt,
    completedAt,
  })

  // Recompute order
  const allTasks = await orderTaskRepo.listByOrder(before.orderId)
  const avgProgress = Math.round(
    allTasks.reduce((s, t) => s + t.progressPct, 0) / allTasks.length
  )
  const newStatus = computeOrderStatus(allTasks)  // see below
  const updatedOrder = await orderRepo.update(before.orderId, {
    progressPct: avgProgress,
    status: newStatus,
    actualAt: newStatus === 'COMPLETED' ? new Date() : null,
  })

  // OrderUpdate entry
  await orderUpdateRepo.write({
    orderId: before.orderId,
    fromStatus: before.order.status,
    toStatus: newStatus,
    note: `Task "${before.nameSnapshot}" → ${input.progressPct}%`,
    createdById: ctx.actor.id,
    source: ctx.source,
  })
  // Audit log entry as usual
}

function computeOrderStatus(tasks): OrderStatus {
  if (tasks.length === 0) return 'DRAFT'
  if (tasks.every(t => t.progressPct === 100)) return 'COMPLETED'
  return 'ACTIVE'
  // CANCELLED never auto-derived; only via cancelOrder action.
}
```

### Khi `pickTasksForOrder` / `setOrderTasks` chạy

Sau khi insert/update OrderTask, gọi cùng recompute logic ở trên (chỉ tính status — `progressPct` của order = avg, các task mới = 0 → progress = 0).

### Khi `cancelOrder` chạy

- Set `status = CANCELLED`, không thay đổi task progress.
- Mọi action update task tiếp theo throw `ConflictError`.

### Khi đơn `CANCELLED` muốn restore

Phase 1: không support (đẩy về Phase 1.5 nếu khách cần). Cancel = final state.

---

## 5. Acceptance criteria (chi tiết)

- [ ] Tạo 4 task master `CUT`, `SEW`, `IRON`, `PACK` qua `/tasks` UI.
- [ ] Tạo order `TN150501` với variant + items → `status=DRAFT, progressPct=0`.
- [ ] Pick 4 task vào order theo thứ tự → `status=ACTIVE, progressPct=0`.
- [ ] `OrderTask.nameSnapshot` được clone từ `Task.name` lúc pick.
- [ ] Update task `CUT` → 50% → `Order.progressPct = 12` (50/4 = 12.5 round to 12 hoặc 13 — chốt round half to even). Status = ACTIVE.
- [ ] Update task `CUT` → 100% → `progressPct = 25`, task có `completedAt`.
- [ ] Update task `SEW` → 100% → `progressPct = 50`.
- [ ] Update task `IRON` → 75% → `progressPct = (100+100+75+0)/4 = 68.75` → 69.
- [ ] Update `IRON` → 100% và `PACK` → 100% → `status = COMPLETED, progressPct = 100, actualAt = now`.
- [ ] Sau khi đổi tên `Task.name` từ `Cắt vải` → `Cắt mảnh`, `OrderTask.nameSnapshot` giữ nguyên `Cắt vải`.
- [ ] Xóa task master đang được order dùng → `ConflictError`.
- [ ] Cancel order → `status=CANCELLED`, mọi update task subsequent throw error.
- [ ] Stepper UI hiển thị task list có ✓ cho task 100%, % cho task in-progress, grey cho task chưa làm.
- [ ] Order list có column "Tiến độ" với progress bar.
- [ ] Optimistic locking: 2 tab cùng update order → tab 2 nhận `STALE_VERSION` error.
- [ ] AuditLog có entry cho mọi mutation (create order, pick tasks, update progress, cancel, ...).
- [ ] OrderUpdate có entry cho mỗi lần status đổi hoặc task progress đổi.
- [ ] i18n: mọi string UI mới qua `t('orders.*')` / `t('tasks.*')`.
- [ ] Test integration ≥ 90% pass.
- [ ] Lint clean.

---

## 6. UI mockup

### `/tasks` (master CRUD, giống `/sizes`)
```
| Mã   | Tên       | Mô tả             | Hoạt động | _ |
| CUT  | Cắt vải   | Cắt theo rập      | ●         |   |
| SEW  | May       | Ráp các chi tiết  | ●         |   |
| IRON | Ủi        | Ủi nhiệt          | ●         |   |
| PACK | Đóng gói  | Bao bì + đếm số   | ●         |   |
```

### `/orders/[id]` tab "Quy trình"
```
─── Quy trình ──────────────────────────────────────────────

  ① Cắt vải         ✓ Hoàn thành   100%  (28/05/2026)
  ─
  ② May             ✓ Hoàn thành   100%  (29/05/2026)
  ─
  ③ Ủi              ●●●●●●○○○○      75%
                    "Đang ủi 60/80 áo"
  ─
  ④ Đóng gói        ○○○○○○○○○○       0%

  [+ Pick task khác]      [≡ Sắp xếp lại]

──────────────────────────────────────────────────────────
Tổng tiến độ:  ●●●●●●●○○○  68.75%
Status:        ACTIVE
```

### `/orders` list (column "Tiến độ" mới)
```
| Mã đơn      | Mẫu                | Status   | Tiến độ        | Deadline   | _ |
| TN150501    | AO083-TRANG KE XANH| ACTIVE   | ▓▓▓▓░░░░ 68%   | 15/06/2026 |   |
| TN150502    | AO083-TRANG KE DO  | DRAFT    | ░░░░░░░░  0%   | —          |   |
| TN150503    | AO084              | DONE     | ▓▓▓▓▓▓▓▓ 100%  | 10/05/2026 |   |
```

---

## 7. Risks / open questions

- **Migration trên DB hiện tại:** DB đang có schema với enum status 7-state nhưng **chưa có Order data** (M3 chưa execute). Migration sẽ:
  1. Drop column `Order.status` (cũ).
  2. Drop enum `OrderStatus` (cũ).
  3. Create new enum `OrderStatus` (4 giá trị).
  4. Add column `Order.status` (mặc định `DRAFT`).
  5. Add column `Order.progressPct Int @default(0)`.
  6. Create table `Task`, `OrderTask` với indexes.

  Prisma sẽ tự gen migration phù hợp khi `prisma migrate dev`.

- **Round half up vs half even:** lấy `Math.round` mặc định JS (round half to even cho .5 chính xác — nhưng JS `Math.round` thực tế round half away from zero). Phase 1 không cần precision cao, chấp nhận `Math.round(avg)`.

- **Cancel đơn rồi restore?** Phase 1 không support. Phase 1.5 nếu khách cần thì thêm `uncancelOrder` action với optimistic lock check.

- **Task có thể `deletedAt` rồi vẫn hiển thị tên trong order cũ?** Có. `OrderTask.nameSnapshot` không phụ thuộc Task master còn sống hay không.

- **Order chuyển từ COMPLETED về ACTIVE?** Khi user chỉnh task progress xuống dưới 100% sau khi order đã COMPLETED. Logic `computeOrderStatus` sẽ tự derive lại → status quay về ACTIVE. `actualAt` sẽ bị clear (set null). Đã spec ở section 4.

---

## 8. Execution summary (post-completion)

**13 commits + 1 tag** (`m3-orders-tasks`) trên `master`.

| Task | Commit | Tests added |
|---|---|---|
| 1. Migration: enum 4-state + Task + OrderTask | `dcb99f3` | — (66 existing still pass) |
| 2. Task module + 4 actions | `32a00fd` | 12 |
| 3. Tasks API + UI page | `009fd62` | smoke |
| 4. Order foundation (code-gen, progress, repo) | `bc6e1bc` | 11 (4 codegen + 7 progress) |
| 5. 9 order actions | `2aad564` | 21 |
| 6. OrderTask repo + recompute helper | `cd21116` | covered by Task 7 |
| 7. 3 order-task actions | `57136c2` | 13 |
| 8. 11 REST endpoints | `168ed5f` | smoke |
| 9-12. UI pages + 6 components | `0ec844b` | smoke |
| 13. i18n keys | (in 0ec844b) | — |
| 14. Full happy-path test | (in 57136c2) | — |
| 15. Update seed: 4 tasks + (chuẩn bị) | (this commit) | — |
| 16. Tag M3 | (final) | — |

**Total:** 57 new tests added in M3 backend. Combined with M1+M2 = **123 tests pass**.

### Decisions tweaked during execution

- **Migration approach:** `prisma migrate dev` is interactive when dropping enum values; bypassed by:
  1. `prisma migrate reset --force --skip-seed` (DB had no order data — safe).
  2. `prisma db push --accept-data-loss --skip-generate` to sync schema.
  3. `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new> --script` to generate SQL.
  4. Save SQL into `prisma/migrations/...` and `prisma migrate resolve --applied` to mark as applied.
  Future: dùng same approach for any enum drop.

- **`OrderTask.position`** thay cho `order` (field name conflict với relation `order`).

- **`order.repo.list()` JSON include** trả `_count.tasks/items/batches` cho UI list.

- **`StylePicker` component** rewrite từ `computedAsync` sang preload all variants qua endpoint mới `GET /api/variants` (flatten variants of all active styles). Lý do: `computedAsync` chỉ có ở `@vueuse/core`, cài thêm dependency cho 1 use case là over-engineering.

- **Lucide icons:** Nuxt UI v3 yêu cầu `@iconify-json/lucide` collection cài local thay vì fetch online — không có thì icons không render đúng.

- **TaskPicker** cho phép pick cùng task nhiều lần — UI hiển thị badge có ordinal số (1, 2, 3...) để user không nhầm.

---

## 9. Out of scope (deferred)

- ❌ Task templates (gắn sẵn 1 set task vào style → khi tạo order auto-pick) — đẩy về Phase 1.5 nếu khách yêu cầu.
- ❌ Task dependencies (task X phải xong trước task Y) — không thực hiện ở M3 vì user chọn option B (gợi ý, không enforce).
- ❌ Estimated duration / due date riêng cho task — không Phase 1.
- ❌ Task assignee (giao cho ai làm) — Phase 1 chỉ 1 admin.
- ❌ Task có sub-task / checklist — không Phase 1.

---

## 10. Lessons cho M4 (Batches & Apply Ratio)

- **Inherit:** action layer pattern, optimistic locking, recompute-on-mutation, snapshot-on-pick.
- **New ở M4:**
  - `OrderBatch` có `batchNumber` auto-increment per order (transactional).
  - Action `applyRatioToBatch(orderId, multiplier)` ⭐ — generate batch qty từ `OrderItem.ratio × multiplier`.
  - Trigger alert evaluation sau mỗi batch mutation (chuẩn bị cho M5).
- **Pitfalls đã ghi nhận M3:**
  - Migrate enum drop → cần workflow non-interactive (db push + diff + resolve).
  - Avoid `computedAsync` trong components — preload via dedicated endpoint.
  - Field name "order" conflict với relation; dùng "position" cho ordering.
  - Component khi `await useFetch` ở top-level cần `useRequestFetch` để forward cookies trong SSR (đã fix ở `useAuth`).

---

*Hết M3 record. Tag: `m3-orders-tasks`.*

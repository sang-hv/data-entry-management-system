# M4 Batches & Apply Ratio — Implementation Plan

> **Status:** ✅ Complete (tag `m4-batches`)
> **Format:** pre-execution plan. Decisions + tasks + acceptance + test plan.
> **Reference:** schema mục 5, action specs mục 7.3–7.4, REST mục 8 trong `docs/implementation-plan.md`.
> **Kế thừa M3:** action layer pattern, optimistic locking, recompute-on-mutation, soft delete, audit-on-every-mutation. Xem `docs/plans/M3-orders-and-tasks.md` mục 10.

**Goal:** Quản lý đợt chốt nhập (`OrderBatch`) với số lượng theo size (`BatchItem`), và action tiện lợi `applyRatioToBatch` để generate qty từ `OrderItem.ratio × multiplier` — đúng workflow Excel của khách (3,3,2,1,1 × 8 = 24,24,16,8,8 → tổng 80).

**Scope KHÔNG bao gồm:** alerts engine + `batch-qty-mismatch-ratio` rule (M5), dashboard (M5), attachments (M6). Chỉ chuẩn bị hook point để M5 trigger alert evaluation sau batch mutation.

---

## 1. Hiện trạng (đã verify trong code)

| Đã có (M1–M3) | Chưa có (M4 phải làm) |
|---|---|
| Schema `OrderBatch` + `BatchItem` đã khai báo trong `prisma/schema.prisma` mục 5 | Module `batches` (repo + types) |
| `Order.batches` relation, `orderRepo` đã `include: { batches: { where: { deletedAt: null }, include: { items: true } } }` | 5 actions: `createBatch`, `updateBatch`, `deleteBatch`, `setBatchItems`, `applyRatioToBatch` |
| `OrderItem.ratio` + `setOrderItems` action | API endpoints batches |
| `sizeRepo.findManyByIds`, `sizeRepo.countReferences` (đã đếm `batchItem`) | Helper tính tổng (`order.totals.ts`) |
| Action conventions (`_base`), `auditRepo`, optimistic lock pattern | Tab "Batches" trong `pages/orders/[id].vue` |
| `pages/orders/[id].vue` đã có `batches: unknown[]` placeholder trong type | Components `BatchList`, `BatchEditor`, `ApplyRatioDialog` |
| i18n keys `orders.*` | i18n keys `orders.batches.*` |

**Lưu ý quan trọng:** schema `OrderBatch`/`BatchItem` đã tồn tại trong DB sau migration M3 (toàn bộ schema mục 5 được khai báo từ M1). Cần **verify** không cần migration mới — chỉ chạy `prisma migrate status`. Nếu schema khớp, M4 thuần là application layer, **không có migration**.

---

## 2. Decisions cần chốt với user trước khi execute

| # | Câu hỏi | Đề xuất mặc định | Lý do |
|---|---|---|---|
| 1 | `batchNumber` generate thế nào? | Auto `max(batchNumber theo order) + 1`, **transactional** (kể cả batch đã soft-delete vẫn tính để tránh trùng unique `[orderId, batchNumber]`) | Tránh race + tránh vi phạm unique constraint |
| 2 | Soft-delete batch rồi tạo mới có tái dùng số cũ? | Không — số luôn tăng | Đơn giản, audit rõ ràng |
| 3 | `applyRatioToBatch` với size có `ratio = 0` | Bỏ qua (không tạo BatchItem) | Theo spec mục 7.4: "mỗi size có `ratio > 0`" |
| 4 | Order `CANCELLED` có cho tạo/sửa batch? | Không — throw `ValidationError` (giống `setOrderItems`) | Consistency với M3 |
| 5 | Order `COMPLETED` có cho sửa batch? | Cho phép | Batch là dữ liệu số lượng, độc lập với task progress |
| 6 | Batch mutation có bump `Order.version` không? | Không — batch là child entity riêng, dùng `updateInternal` pattern nếu cần touch order | Giống cách recompute không bump version |
| 7 | "Tổng order" = sum qty của batch nào? | Sum qty **tất cả batch chưa xóa** (theo acceptance M4) | Khớp acceptance criteria cuối M4 |
| 8 | `applyRatioToBatch` khi order chưa có item nào (ratio rỗng) | Throw `ValidationError('Order has no items with ratio')` | Không tạo batch rỗng |
| 9 | `updateBatch` sửa được field nào? | `batchedAt`, `note` (metadata). Không sửa `batchNumber` | batchNumber là immutable identity |

> ⚠️ Cần user confirm hàng #2, #5, #7 vì ảnh hưởng nghiệp vụ. Còn lại theo pattern M3.

---

## 3. Schema (xác nhận — không đổi)

Đã có trong `prisma/schema.prisma`, copy lại để reference:

```prisma
model OrderBatch {
  id          String   @id @default(uuid())
  orderId     String
  order       Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  batchNumber Int                            // 1, 2, 3 — tự tăng theo order
  batchedAt   DateTime @default(now())       // ngày chốt nhập
  note        String?
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  items       BatchItem[]

  @@unique([orderId, batchNumber])
  @@index([orderId, batchedAt])
  @@index([deletedAt])
}

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
```

**Action:** chạy `pnpm prisma migrate status` → nếu in sync, không tạo migration. Nếu lệch, generate migration `m4-batches-verify` (no-op hoặc add index còn thiếu).

---

## 4. Tasks plan (TDD — test trước, code sau)

| # | Task | File chính | Tests | Output |
|---|---|---|---|---|
| 1 | Verify schema in-sync (migrate status). Nếu cần, migration. | `prisma/` | — | DB ready |
| 2 | `batch.types.ts` + `batch.repo.ts`: `findById`, `listByOrder`, `nextBatchNumber(tx, orderId)`, `createWithItems`, `updateMeta`, `replaceItems`, `softDelete` | `server/modules/batches/` | — | Repo foundation |
| 3 | `order.totals.ts`: `sumBatchQty(batches)`, `sumBatchItemsBySize(batches)` (computed, không lưu) | `server/modules/orders/order.totals.ts` | ~4 unit | Totals helper |
| 4 | Action `createBatch` (manual qty) | `server/actions/batches/createBatch.ts` | ~5 | Tạo batch tay |
| 5 | Action `applyRatioToBatch` ⭐ (generate qty từ ratio × multiplier; tạo mới hoặc update theo batchNumber) | `server/actions/batches/applyRatioToBatch.ts` | ~7 | Core feature |
| 6 | Action `setBatchItems` (replace items 1 batch) | `server/actions/batches/setBatchItems.ts` | ~4 | Sửa items |
| 7 | Action `updateBatch` (metadata: batchedAt, note) | `server/actions/batches/updateBatch.ts` | ~3 | Sửa meta |
| 8 | Action `deleteBatch` (soft) | `server/actions/batches/deleteBatch.ts` | ~3 | Xóa mềm |
| 9 | API: `POST /api/orders/:id/batches`, `POST /api/orders/:id/apply-ratio`, `GET/PATCH/DELETE /api/batches/:id`, `PUT /api/batches/:id/items` | `server/api/orders/[id]/`, `server/api/batches/` | smoke | REST surface |
| 10 | Component `BatchEditor` (bảng size + qty, dựa trên `OrderItemsEditor` pattern) | `components/orders/BatchEditor.vue` | — | Reusable |
| 11 | Component `ApplyRatioDialog` (input multiplier → preview qty từ ratio) | `components/orders/ApplyRatioDialog.vue` | — | Apply-ratio UX |
| 12 | Component `BatchList` (list batches + tổng + nút tạo/generate/xóa) | `components/orders/BatchList.vue` | — | Reusable |
| 13 | Tab "Batches" trong `pages/orders/[id].vue` (thêm vào `tabItems`, wire actions) | `pages/orders/[id].vue` | smoke | UI hoàn chỉnh |
| 14 | i18n keys `orders.batches.*` (vi) | `i18n/locales/*` | — | Strings ext'd |
| 15 | Integration test happy-path: ratio [3,3,2,1,1] × 8 → batch tổng 80; ×10 → 100; tổng order = 180 | `tests/integration/actions/batches.test.ts` | 1 e2e-style | Verify full flow |
| 16 | Smoke `pnpm dev` + lint + typecheck, tag `m4-batches` | — | — | Done |

**Ước lượng:** ~26 test mới. Commit mỗi task xanh (theo Quy tắc vàng #8).

---

## 5. Action specs chi tiết

### 5.1. `applyRatioToBatch` ⭐ (action quan trọng nhất)

Input (theo mục 7.3):
```ts
ApplyRatioToBatchInput = {
  orderId: uuid,
  multiplier: int 1..100000,
  batchNumber?: int >= 1,   // có → update batch đó; không → tạo mới
  batchedAt?: date,
  note?: string,
}
```

Logic:
```
1. Load order (findById, filter deletedAt). Không có → NotFoundError.
2. order.status === 'CANCELLED' → ValidationError.
3. items = order.items.filter(ratio > 0). Rỗng → ValidationError('Order has no items with ratio').
4. computed: qty[sizeId] = ratio * multiplier (chỉ size ratio>0).
5. Transaction:
   - Nếu batchNumber provided:
       batch = findByOrderAndNumber(orderId, batchNumber, chưa xóa)
       không có → NotFoundError
       replaceItems(batch.id, qty[])    // deleteMany + createMany
       updateMeta nếu batchedAt/note provided
   - Nếu không:
       n = nextBatchNumber(tx, orderId)   // max(all batchNumber incl. deleted) + 1
       batch = create({ orderId, batchNumber: n, batchedAt, note })
       createMany BatchItem từ qty[]
6. audit.write('batch.apply_ratio', before/after)
7. (M5 hook) evaluateOrderAlerts(orderId) — để TODO comment, chưa implement.
8. return { batch, items, total: sum(qty) }
```

### 5.2. `createBatch`

```ts
CreateBatchInput = { orderId, batchedAt?, note?, items: [{ sizeId, quantity>=0 }].min(1) }
```
- Validate order tồn tại + không CANCELLED.
- Validate sizeIds hợp lệ + không trùng (giống `setOrderItems`).
- `batchNumber = nextBatchNumber`.
- Transaction tạo batch + items.
- Audit `batch.create`.
- return `{ batch, items, total }`.

### 5.3. `setBatchItems` / `updateBatch` / `deleteBatch`

- `setBatchItems`: load batch (kèm order để check CANCELLED), validate sizeIds, replace items (deleteMany+createMany), audit `batch.set_items`.
- `updateBatch`: patch `{ batchedAt?, note? }`, audit `batch.update`.
- `deleteBatch`: set `deletedAt = now()`, audit `batch.delete`. Soft — DB vẫn giữ row (acceptance criteria).

### 5.4. `order.totals.ts` (computed, không lưu)

```ts
// Tổng qty toàn order = sum mọi BatchItem của batch chưa xóa.
export function sumBatchQty(batches: { deletedAt: Date|null; items: { quantity: number }[] }[]): number
// Tổng theo size, để UI hiển thị breakdown.
export function sumBatchItemsBySize(batches): Record<sizeId, number>
```
Reuse ở `getOrderById` output / UI. Không thêm cột DB (Quy tắc vàng #9).

---

## 6. Acceptance criteria (từ blueprint M4 + chi tiết)

- [ ] Order có items ratio [3,3,2,1,1] → `applyRatioToBatch(multiplier=8)` → batch qty [24,24,16,8,8], tổng 80.
- [ ] Tạo batch thứ 2 `applyRatioToBatch(multiplier=10)` → qty [30,30,20,10,10], tổng 100. `batchNumber = 2`.
- [ ] `createBatch` nhập tay (không apply ratio) → tạo được, `batchNumber` tăng đúng.
- [ ] `applyRatioToBatch(batchNumber=1, multiplier=5)` → **update** batch 1 (qty [15,15,10,5,5]), không tạo batch mới.
- [ ] `deleteBatch` → batch còn trong DB với `deletedAt != null`; không xuất hiện ở list/tổng.
- [ ] Sau khi xóa batch 2 rồi tạo batch mới → `batchNumber = 3` (không tái dùng 2).
- [ ] Tổng order = sum qty tất cả batch chưa xóa.
- [ ] `applyRatioToBatch` trên order không có item ratio>0 → `ValidationError`.
- [ ] Tạo/sửa batch trên order `CANCELLED` → `ValidationError`.
- [ ] `setBatchItems` với sizeId trùng → `ValidationError`.
- [ ] AuditLog có entry cho mọi mutation (create/apply-ratio/set-items/update/delete), `source='ui'`, `requestId` khớp.
- [ ] UI: tab "Batches" hiển thị list batch, mỗi batch có bảng size+qty + tổng; nút "Tạo đợt mới", "Generate từ tỉ lệ" (mở `ApplyRatioDialog` có preview), nút xóa.
- [ ] i18n: mọi string mới qua `t('orders.batches.*')`.
- [ ] Test integration ≥ 90% pass. Lint + typecheck clean.

---

## 7. Test plan (`tests/integration/actions/batches.test.ts`)

Dựa trên `setupFixtures()` của `orders.test.ts` (style + variant + 5 size + order với items).

```
describe('batches actions')
  beforeEach resetDb
  setupOrderWithItems() → order + items [S:3,M:3,L:2,XL:1,XXL:1]

  applyRatioToBatch:
    - multiplier=8 → tổng 80, qty đúng từng size, batchNumber=1
    - lần 2 multiplier=10 → batchNumber=2, tổng 100
    - batchNumber=1 → update không tạo mới (count batch vẫn = 1)
    - order CANCELLED → throw
    - order no-ratio-items → throw
    - audit entry tồn tại
  createBatch:
    - manual items → tổng đúng, batchNumber tăng
    - sizeId trùng → throw
    - order CANCELLED → throw
  setBatchItems / updateBatch:
    - replace items OK
    - update note/batchedAt OK
  deleteBatch:
    - soft delete → findById trả null nhưng row tồn tại (raw query)
    - batchNumber không tái dùng sau xóa
  order totals:
    - 2 batch → sumBatchQty = 180; xóa 1 → 80
```

Unit test `order.totals.test.ts`: sum rỗng=0, sum nhiều batch, bỏ batch deleted, breakdown by size.

---

## 8. Risks / open questions

- **`nextBatchNumber` race condition:** 2 request đồng thời tạo batch cho cùng order → có thể trùng `batchNumber` vi phạm unique. Mitigate: tính `max+1` **trong cùng transaction** với create, hoặc bắt lỗi unique và retry 1 lần. Phase 1 single-admin → rủi ro thấp, nhưng nên implement transactional cho đúng.
- **Tổng order semantics (#7 ở mục 2):** acceptance nói "sum tất cả batch chưa xóa". Excel khách thực tế có thể chỉ quan tâm batch mới nhất ("Số lượng chốt nhập đợt mới"). Cần user xác nhận để hiển thị UI đúng (tổng cộng dồn vs tổng đợt mới nhất).
- **Quan hệ ratio ↔ batch:** ratio chỉ tham khảo (mục 0 glossary). `applyRatioToBatch` không enforce qty phải khớp ratio — user sửa tay được sau. Rule cảnh báo mismatch để dành M5 (`batch-qty-mismatch-ratio.rule`).
- **Alert hook:** để TODO comment `// TODO(M5): evaluateOrderAlerts(orderId)` ở cuối mỗi batch action, tránh refactor lớn khi M5 vào.

---

## 9. Out of scope (deferred)

- ❌ `batch-qty-mismatch-ratio` alert rule → M5.
- ❌ Lịch sử thay đổi batch (chỉ có AuditLog, không có timeline riêng) → không Phase 1.
- ❌ Import batch từ Excel → Phase 2.
- ❌ Khóa batch sau khi confirm → không Phase 1.

---

## 10. Lessons kế thừa từ M3 (đã ghi nhận)

- Field name `order` conflict với relation → dùng tên khác (M4 không có vấn đề này, `batchNumber` rõ ràng).
- Component tránh `computedAsync` — preload qua endpoint (`ApplyRatioDialog` lấy ratio từ data order đã load, không cần fetch thêm).
- `await useFetch` top-level trong component cần forward cookie SSR — tab Batches dùng `refresh()` của trang cha, không tự fetch.
- Migration enum cần workflow non-interactive — M4 dự kiến **không có migration**, verify trước.

---

*Plan M4 — chờ user confirm decisions mục 2 (#2/#5/#7) trước khi execute. Dự kiến tag: `m4-batches`.*

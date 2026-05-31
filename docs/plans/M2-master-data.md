# M2 Master Data — Implementation Record

> **Status:** ✅ Complete (tag `m2-master-data`)
> **Format note:** M1 viết plan trước rồi execute. M2 execute trực tiếp do phần lớn pattern lặp lại từ M1 (action + repo + zod + audit + test). Tài liệu này ghi lại **post-execution**: đã làm gì, decisions phát sinh, lessons cho M3 dùng.

**Goal:** Quản lý master data — Sizes, Styles, StyleVariants — và lớp lưu trữ ảnh để chuẩn bị cho M3 (Orders) gắn được vào style + size.

**Architecture:** Tiếp tục pattern từ M1: `action layer → repo → prisma`. Storage adapter pattern cho phép swap S3 sau. UI theo dạng list/table responsive (mobile stacked / desktop table) thay vì grid. I18n bằng `@nuxtjs/i18n` cho mọi string UI.

**Tech additions ngoài M1:**
- `@nuxt/ui` v3 + Tailwind CSS v4 (cần CSS entry file `assets/css/main.css`).
- `@nuxtjs/i18n` v10 với locale `vi.json`.
- Layout responsive: mobile drawer + desktop fixed sidebar.
- Local disk storage adapter cho file upload.

---

## 1. Tasks executed

| # | Task | Files | Tests | Commit |
|---|---|---|---|---|
| 1 | Sizes module: repo + 4 actions | `server/modules/sizes/`, `server/actions/sizes/` | 12/12 | `14b207b` |
| 2 | Sizes API + UI page + shared test helpers | `server/api/sizes/`, `pages/sizes/`, `tests/helpers/db.ts` | — | `cb1a5e5` |
| 3 | Styles module: repo + 5 actions (incl. getStyleById) | `server/modules/styles/style.repo.ts`, `server/actions/styles/` | 14/14 | `d41f939` |
| 4 | StyleVariants: repo + 3 actions | `server/modules/styles/variant.repo.ts`, `server/actions/styles/` | 9/9 | `0132b60` |
| 5 | Local disk storage adapter | `server/modules/storage/storage.ts` | 6/6 | `a93ed98` |
| 6 | uploadVariantImage action + multipart API + auth-protected serve route | `server/actions/styles/uploadVariantImage.ts`, `server/api/variants/`, `server/routes/storage/` | 5/5 | `53a4217` |
| 7 | Styles API + FE pages (list + detail) | `server/api/styles/`, `pages/styles/` | — (smoke) | `6ae9f39` |
| 8 | Tag M2 | — | — | `6ae9f39` (tagged) |

**Hot-fix tasks (xen kẽ trong M2):**

| # | Fix | Commit |
|---|---|---|
| HF1 | `app.vue` thiếu `<NuxtLayout>` → sidebar không render | `8cd3a26` |
| HF2 | Tailwind không compile (Nuxt UI v3 + Tailwind v4 cần CSS entry) | `369c217` |
| HF3 | Layout responsive (mobile drawer + desktop sidebar) + chuyển styles sang list/table | `c2c9109` |
| HF4 | Centralize toàn bộ UI string vào `i18n/locales/vi.json` | `463547f` |
| HF5 | Seed admin với password cố định từ `SEED_ADMIN_PASSWORD` env (recovery sau test wipe) | `652bccf` |

---

## 2. Acceptance criteria

- [x] Tạo Style `AO083 - Áo polo cổ bẻ` thành công qua UI và API.
- [x] Tạo 2 variants `TRANG KE XANH` + `TRANG KE DO` cho cùng 1 style.
- [x] Upload ảnh JPEG/PNG/WEBP cho variant (max 5 MB), replace ảnh cũ best-effort.
- [x] List style hiển thị thumbnail của variant đầu tiên + variantCount.
- [x] Search style theo mã hoặc tên (case-insensitive).
- [x] CRUD Size đầy đủ với toggle active.
- [x] Conflict error khi xóa size đang có order item refer.
- [x] Conflict error khi xóa style/variant đang có order refer.
- [x] Audit log có entry cho mọi mutation.
- [x] Auth-protected `/storage/*` route (401 nếu chưa login, 404 nếu file không tồn tại).
- [x] UI responsive: mobile drawer + desktop sidebar.
- [x] Mọi string UI đều qua `t()` từ `i18n/locales/vi.json`.

**Test count:** 66/66 pass (10 test files).
**Lint:** clean (0 errors, 0 warnings).

---

## 3. Decisions phát sinh trong M2

### 3.1. Tailwind CSS v4 + Nuxt UI v3 cần CSS entry file

**Vấn đề:** Pages render plain HTML không có CSS — sidebar không có background, padding, shadow.

**Lý do:** Nuxt UI v3 dùng Tailwind v4 với "CSS-first" approach. Phải khai báo `@import 'tailwindcss'` và `@import '@nuxt/ui'` trong CSS entry, không tự động compile như Tailwind v3.

**Fix:** Tạo `assets/css/main.css`:
```css
@import "tailwindcss";
@import "@nuxt/ui";
```
Đăng ký vào `nuxt.config.ts` qua `css: ['~/assets/css/main.css']`.

**Lesson cho M3:** mọi global CSS / theme override đặt vào `assets/css/main.css`.

### 3.2. `app.vue` phải wrap `<NuxtLayout>` để layout default apply

**Vấn đề:** Sidebar không render dù đã có `layouts/default.vue`.

**Lý do:** Nuxt 3+ không auto-apply default layout — phải explicit wrap.

**Fix trong `app.vue`:**
```vue
<UApp>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</UApp>
```
Page nào không cần layout dùng `definePageMeta({ layout: false })` (vd `/login`).

### 3.3. Responsive breakpoint: `md` (768px)

**Decision:** Dùng `md:` (768px) làm cutoff giữa mobile và desktop. Lý do:
- Tablet portrait (~768px) dùng giao diện desktop được, nav 240px vẫn vừa.
- Phone landscape (~640px) hợp lý dùng drawer.
- Tránh thêm breakpoint trung gian (sm/lg) cho layout — chỉ dùng cho content grid.

**Pattern dùng:**
```vue
<aside class="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0">  <!-- desktop -->
<header class="md:hidden ...">  <!-- mobile top bar with hamburger -->
<main class="flex-1 md:ml-60">  <!-- offset content to right of fixed sidebar -->
```

### 3.4. Styles UI: list/table thay grid

**Initial:** grid 3-column với card lớn.
**Final:** list mobile / table desktop.

**Lý do feedback:** đơn vị quản lý dạng record + dễ scan hàng loạt + table dày dữ liệu hơn grid (mã / tên / status / count / ngày).

**Pattern reusable cho M3 (Orders, OrderBatches):**
```vue
<UCard :ui="{ body: 'p-0 sm:p-0' }">
  <ul class="md:hidden divide-y ...">  <!-- mobile stacked -->
  <table class="hidden md:table w-full text-sm">  <!-- desktop table -->
</UCard>
```

### 3.5. I18n bằng `@nuxtjs/i18n`, single locale `vi`

**Decision:** strategy `no_prefix` (URL không có `/vi/...`), single locale lúc Phase 1, scaffold sẵn để thêm `en.json` sau.

**Cấu trúc keys** đã chốt — đặt theo nhóm domain:
```
app.{name, tagline}
common.{actions, labels, messages, confirm}
nav.{dashboard, orders, styles, sizes}
auth.login.{title, submit, errorDefault}
dashboard.{greeting, stats, placeholderNote}
<entity>.{title, subtitle, fields, ...}      // sizes, styles, ...
<entity>.<sub>.{...}                          // styles.variants, ...
```

**Quy ước cho M3:**
- Thêm key mới phải đặt vào nhóm phù hợp, không tạo nhóm mới trừ khi domain mới (vd `orders.*`, `orders.batches.*`).
- Xác nhận label đã có trong `common.labels` chưa trước khi thêm key riêng.
- Confirm dialog dùng placeholder: `t('orders.deleteConfirm', { code: row.code })`.

### 3.6. Storage adapter pattern (LocalDiskStorage hôm nay, S3 sau này)

**Interface:**
```ts
interface StorageAdapter {
  save(opts: { buffer, originalName, contentType, folder? }): Promise<{ storagePath, sizeBytes }>
  read(storagePath: string): Promise<Buffer>
  delete(storagePath: string): Promise<void>
  publicUrl(storagePath: string): string
}
```

**Implementation Phase 1:** `LocalDiskStorage` lưu vào `STORAGE_DIR` (default `./storage/uploads/`).

**Bảo mật:**
- Path traversal blocked qua `resolveSafe()` (target phải thuộc `baseDir`).
- File-type whitelist ở action layer (`uploadVariantImage`): png/jpeg/webp.
- Size limit 5 MB ở action layer.
- Serve qua route auth-protected `/storage/*` (require session cookie).

**Singleton getStorage()** check env mỗi lần để re-create khi `STORAGE_DIR` đổi (test friendly).

**Lesson cho M3 (attachments cho order):**
- Action `attachFileToOrder` tái sử dụng `getStorage()`, folder khác (`orders/`).
- Cần thêm MIME whitelist riêng cho order attachment (PDF/DOCX/XLSX cộng với image).
- Size limit khác (đề xuất 20 MB cho attachment vs 5 MB cho variant image).

### 3.7. Test helpers: `tests/helpers/db.ts` với `resetDb()` + `ensureTestAdmin()`

**Vấn đề M2 phát hiện:** Cross-test pollution — `sizes.test.ts` xóa user `admin@local`, `auth/login.test.ts` đợi user đó tồn tại → conflict.

**Fix:** Tạo helper `resetDb()` xóa **theo đúng thứ tự FK** (idempotency → audit → session → alert/attachment/orderUpdate → batchItem/orderBatch/orderItem/order → variant/style → size → counter → user). Mọi integration test đầu file gọi `await resetDb()` trong `beforeEach`.

**Helper `ensureTestAdmin()`:** Upsert user `admin@local` với hash dummy, trả về user object để build `ActionContext`.

**Lesson cho M3:** Mọi action test đều dùng cặp `resetDb() + ensureTestAdmin()` — không tự xóa table riêng lẻ trong test file (gây drift).

### 3.8. Seed admin: `SEED_ADMIN_PASSWORD` env cho fixed password

**Vấn đề:** Mỗi lần `pnpm test` wipe user → cần `pnpm seed` lại → password random mới → khó nhớ.

**Fix:** Nếu `SEED_ADMIN_PASSWORD` set trong `.env.local`, seed luôn upsert admin với password đó (reset mỗi lần). Nếu không set, behavior cũ (random password lần đầu, skip nếu đã có).

**Default trong `.env.example`:** `Admin@Local2026`.

---

## 4. Files added in M2

```
i18n/
├── i18n.config.ts                   ← vue-i18n options
└── locales/
    └── vi.json                      ← TẤT CẢ string UI

assets/
└── css/
    └── main.css                     ← Tailwind + Nuxt UI imports

layouts/
└── default.vue                      ← Mobile drawer + desktop sidebar

server/
├── actions/
│   ├── sizes/
│   │   ├── createSize.ts
│   │   ├── updateSize.ts
│   │   ├── deleteSize.ts
│   │   └── listSizes.ts
│   └── styles/
│       ├── createStyle.ts
│       ├── updateStyle.ts
│       ├── deleteStyle.ts
│       ├── listStyles.ts
│       ├── getStyleById.ts
│       ├── createStyleVariant.ts
│       ├── updateStyleVariant.ts
│       ├── deleteStyleVariant.ts
│       └── uploadVariantImage.ts
├── modules/
│   ├── sizes/
│   │   └── size.repo.ts
│   ├── storage/
│   │   └── storage.ts               ← LocalDiskStorage + StorageAdapter interface
│   └── styles/
│       ├── style.repo.ts
│       └── variant.repo.ts
├── api/
│   ├── sizes/
│   │   ├── index.get.ts
│   │   ├── index.post.ts
│   │   ├── [id].patch.ts
│   │   └── [id].delete.ts
│   ├── styles/
│   │   ├── index.get.ts
│   │   ├── index.post.ts
│   │   ├── [id].get.ts
│   │   ├── [id].patch.ts
│   │   ├── [id].delete.ts
│   │   └── [id]/variants.post.ts
│   └── variants/
│       ├── [id].patch.ts
│       ├── [id].delete.ts
│       └── [id]/image.post.ts       ← multipart upload
└── routes/
    └── storage/
        └── [...path].get.ts         ← auth-protected file serve

pages/
├── sizes/
│   └── index.vue                    ← list/table mobile + desktop
└── styles/
    ├── index.vue                    ← list/table mobile + desktop
    └── [id].vue                     ← variants list with hover/tap upload

tests/
├── helpers/
│   └── db.ts                        ← resetDb + ensureTestAdmin
├── integration/
│   ├── actions/
│   │   ├── sizes.test.ts            (12 tests)
│   │   ├── styles.test.ts           (14 tests)
│   │   ├── style-variants.test.ts   (9 tests)
│   │   └── upload-variant-image.test.ts (5 tests)
│   └── modules/
│       └── storage.test.ts          (6 tests)
```

---

## 5. Test summary

| File | Tests | Note |
|---|---|---|
| `tests/integration/actions/_base/idempotency.test.ts` | 3 | (M1) |
| `tests/integration/modules/audit.test.ts` | 2 | (M1) |
| `tests/unit/modules/auth/password.test.ts` | 5 | (M1) |
| `tests/integration/modules/auth/session.test.ts` | 5 | (M1) |
| `tests/integration/actions/auth/login.test.ts` | 5 | (M1) |
| `tests/integration/actions/sizes.test.ts` | 12 | M2 |
| `tests/integration/actions/styles.test.ts` | 14 | M2 |
| `tests/integration/actions/style-variants.test.ts` | 9 | M2 |
| `tests/integration/actions/upload-variant-image.test.ts` | 5 | M2 |
| `tests/integration/modules/storage.test.ts` | 6 | M2 |
| **Total** | **66** | |

**Coverage gaps đáng note (defer xử lý sau khi cần):**
- ❌ FE component tests — chưa có. Phase 1 chấp nhận; nếu thấy bug UI lặp ở M3-M5 sẽ thêm.
- ❌ E2E tests — chưa có Playwright/Cypress setup. Smoke test bằng curl + manual browser test.
- ❌ Action `getStyleById` chỉ có 2 test (happy + not-found). Đủ cho Phase 1.

---

## 6. Lessons cho M3 (Orders core)

### Inherit từ M2

✅ **Action layer pattern** (Zod input + ActionContext + audit + idempotency wrap) — copy nguyên xi.
✅ **Soft delete + reference check** trước khi xóa — pattern "countXxxRefs() > 0 → ConflictError".
✅ **Test helpers** `resetDb()` + `ensureTestAdmin()` — dùng trong mọi test mới.
✅ **REST endpoint convention**: `GET/POST /api/<plural>`, `GET/PATCH/DELETE /api/<plural>/:id`, `POST /api/<parent>/:id/<child>` cho nested.
✅ **List/table responsive pattern** (`UCard` + `ul md:hidden` + `table hidden md:table`).
✅ **i18n keys** trong nhóm `orders.*` cho mọi string mới.
✅ **Toast pattern** (`t('common.messages.created')` / `genericError` / `deleted`).

### Mới ở M3

🔵 **Optimistic locking** với `version Int @default(0)` — chưa dùng ở M2 vì master data. M3 Order phải nhận `version` trong update body, mismatch → `OptimisticLockError`.
🔵 **Order code generator** atomic qua `OrderCodeCounter` table.
🔵 **Cross-entity validate** trong `createOrder`: kiểm tra `styleVariantId` tồn tại + active, validate items array có sizeId hợp lệ.
🔵 **Status transition rules** — ⚠️ **superseded ở v2.1:** thay enum `OrderStatus` cứng bằng task-based workflow. Status đơn rút gọn còn `DRAFT/ACTIVE/COMPLETED/CANCELLED`, auto-derive từ task progress. Xem `docs/implementation-plan.md` mục 5 (schema) + mục 14 (M3 milestone). Không cần state machine library — derive logic nằm trong action `updateOrderTaskProgress`.
🔵 **Set vs patch semantics**: action `setOrderItems` (replace toàn bộ) vs `addMaterialRequirement` (append). Cẩn thận cho M3 — dự định `setOrderItems` là replace.
🔵 **Search với multi-field filter**: extend `searchOrders` Zod schema với `q`, `status[]`, `priority[]`, `dueBefore/After`, ...
🔵 **Bộ M4 ⭐**: action `applyRatioToBatch(orderId, multiplier)` — generate batch qty từ tỉ lệ × multiplier. Đây là feature đặc trưng nhất của domain may mặc.

### Pitfalls đã từng gặp (tránh ở M3)

⚠️ Đừng lặp lại `app.vue` thiếu `NuxtLayout` — đã có rồi, mọi page mới chỉ cần `<template>`.
⚠️ Đừng tạo lại CSS entry — đã có `assets/css/main.css`.
⚠️ Đừng hardcode string Vietnamese vào template — luôn `t('xxx')`.
⚠️ Đừng tự xóa table trong test — dùng `resetDb()`.
⚠️ Đừng dùng `~/server/...` import path trong server-side code (Nuxt 4 set `~` thành `serverDir`). Dùng relative paths.
⚠️ Đừng quên multi-field index trong Prisma cho query phức tạp (Order sẽ cần).

---

## 7. Out of scope M2 (defer cho M3+)

- ❌ Order entity và toàn bộ orders module → M3.
- ❌ OrderBatch + BatchItem → M4.
- ❌ Apply ratio action → M4.
- ❌ Alert engine + dashboard số liệu thật → M5.
- ❌ FE component test / E2E test → tùy Phase 2 nếu cần.
- ❌ Style/variant clone (tạo style mới từ template) → khách chưa yêu cầu.
- ❌ Bulk import master data từ CSV → nice-to-have post-Phase 1.

---

## 8. Phase 2 readiness check (cập nhật từ M2)

Đối chiếu với `implementation-plan.md` mục 17 — đã đạt:

- [x] Mọi mutation đi qua `server/actions/` (sizes, styles, variants, upload).
- [x] Mọi action có Zod input schema export.
- [x] Mọi action nhận `ActionContext`.
- [x] `AuditLog.source` có dữ liệu thật từ UI.
- [x] Soft delete + reference check thống nhất.
- [x] Idempotency wrap trên mọi mutation.
- [x] Storage adapter ready để swap S3.

Còn pending tới khi M3-M6 xong:
- [ ] `OrderUpdate.source` (M3 sẽ có).
- [ ] `validateOrderDataCompleteness` (M5).
- [ ] Optimistic locking thực tế (M3).
- [ ] Format code chốt (`TN-YYYYMMDD-####` đã chốt M2 doc, implement M3).
- [ ] Vài tháng dữ liệu thật (post go-live).
- [ ] Documentation auto-gen (M5/M6 nếu kịp).

---

*Hết M2 record. Tag: `m2-master-data` (commit `6ae9f39`, plus hot-fixes `8cd3a26`/`369c217`/`c2c9109`/`463547f`/`652bccf`).*

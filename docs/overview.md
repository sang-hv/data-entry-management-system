# Hệ thống Quản lý Đơn đặt hàng May mặc — Tài liệu Tổng quan Giải pháp

> **Phiên bản:** 2.0
> **Ngày phát hành:** 26/05/2026
> **Mục đích:** Trình bày phạm vi, kiến trúc và lộ trình giải pháp ở mức tổng quan để khách hàng duyệt trước khi triển khai.
> **Đối tượng đọc:** Người ra quyết định nghiệp vụ và người duyệt giải pháp kỹ thuật.
> **Thay đổi v2:** điều chỉnh domain theo dữ liệu thật của khách (file Excel quản lý đơn đặt hàng áo) — bỏ phần vật tư/nhà cung cấp khỏi Phase 1, thêm quản lý mẫu áo + tỉ lệ size + đợt nhập.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Bối cảnh và mục tiêu](#2-bối-cảnh-và-mục-tiêu)
3. [Phạm vi Phase 1 — Khách được gì](#3-phạm-vi-phase-1--khách-được-gì)
4. [Ngoài phạm vi Phase 1](#4-ngoài-phạm-vi-phase-1)
5. [Các module nghiệp vụ chính](#5-các-module-nghiệp-vụ-chính)
6. [Kiến trúc giải pháp](#6-kiến-trúc-giải-pháp)
7. [Mô hình dữ liệu](#7-mô-hình-dữ-liệu)
8. [Cảnh báo tự động](#8-cảnh-báo-tự-động)
9. [Bảo mật, sao lưu và vận hành](#9-bảo-mật-sao-lưu-và-vận-hành)
10. [Lộ trình mở rộng — Phase 2 (AI)](#10-lộ-trình-mở-rộng--phase-2-ai)
11. [Rủi ro và cách giảm thiểu](#11-rủi-ro-và-cách-giảm-thiểu)
12. [Tech stack và lý do lựa chọn](#12-tech-stack-và-lý-do-lựa-chọn)
13. [Phụ lục — Từ điển thuật ngữ](#13-phụ-lục--từ-điển-thuật-ngữ)

---

## 1. Tổng quan

Đây là một **web app nội bộ** giúp khách hàng quản lý các **đơn đặt hàng may mặc** tại một nơi duy nhất: thông tin đơn, mẫu áo, tỉ lệ size, số lượng chốt nhập theo đợt, deadline và cảnh báo.

Phase 1 thay thế cho cách quản lý hiện tại bằng file Excel — vốn dễ bị nhiều phiên bản trôi nổi, khó tra cứu lịch sử, dễ quên deadline. Phase 2 sẽ bổ sung **lớp AI bên ngoài** để tự động trích xuất dữ liệu từ ảnh/email/tin nhắn của khách rồi đưa vào hệ thống, giảm thời gian nhập tay.

**Nguyên tắc xuyên suốt:** *hệ thống lõi phải chạy tốt mà không cần AI*. AI chỉ là kênh nhập liệu thông minh thêm vào sau, không phải lõi.

---

## 2. Bối cảnh và mục tiêu

### Bối cảnh hiện tại

Khách hàng đang quản lý đơn đặt hàng bằng file Excel với cấu trúc:

| Mã đặt hàng | Mẫu | Ảnh | Size | Tỉ lệ nhập | Số lượng chốt đợt mới | Tổng | Ngày đặt |
|---|---|---|---|---|---|---|---|
| TN150501 | AO083-TRANG KE XANH | 🖼️ | S/M/L/XL/XXL | 3, 3, 2, 1, 1 | 24, 24, 16, 8, 8 | 80 | 15/5/2026 |

Hệ quả thường gặp:
- Nhiều phiên bản file ở nhiều nơi, không rõ phiên bản nào mới nhất.
- Khó tra cứu lịch sử một đơn từng đặt mẫu nào, đợt mấy, qua bao nhiêu lần chốt số.
- Dễ quên đơn sắp tới hạn / đã trễ.
- Khi cần báo cáo "tổng số áo đã chốt tháng này", phải mở từng file đếm.
- 1 mẫu áo (như `AO083`) bị nhập đi nhập lại trong nhiều đơn, không có nơi quản lý chung.

### Mục tiêu Phase 1

| # | Mục tiêu | Đo lường thành công |
|---|---|---|
| 1 | Một nơi duy nhất quản lý mọi đơn đặt hàng | 100% đơn đang chạy được nhập vào hệ thống |
| 2 | Mẫu áo quản lý tập trung | Mỗi mẫu chỉ nhập 1 lần, các đơn dùng lại |
| 3 | Tra cứu đơn tức thì | Tìm thấy đơn trong < 5 giây bằng mã/mẫu |
| 4 | Không bỏ sót đơn trễ deadline | Cảnh báo tự động, không phụ thuộc trí nhớ |
| 5 | Sinh số lượng nhanh từ tỉ lệ | 1 thao tác chuyển tỉ lệ + multiplier sang số lượng cụ thể |
| 6 | Có nền tảng dữ liệu sạch để Phase 2 AI tận dụng | Dữ liệu có cấu trúc, có lịch sử, có ràng buộc |

### Người sử dụng

Phase 1, hệ thống được sử dụng bởi **một người dùng quản trị duy nhất**. Đăng nhập bằng email và mật khẩu, không phân quyền phức tạp. Hệ thống vẫn ghi đầy đủ nhật ký thay đổi để Phase 2, khi AI tham gia, có thể phân biệt thao tác do người và do AI.

---

## 3. Phạm vi Phase 1 — Khách được gì

Đây là danh sách tính năng có trong bản giao Phase 1, viết theo góc nhìn người dùng cuối.

### Quản lý đơn đặt hàng

- Tạo đơn mới với mã đơn duy nhất (tự sinh hoặc nhập tay theo format khách quen, ví dụ `TN150501`).
- Mỗi đơn gắn với một mẫu áo cụ thể (chọn từ danh sách mẫu đã có).
- Nhập đầy đủ thông tin: ngày đặt, ngày kỳ vọng giao, độ ưu tiên, ghi chú.
- Sửa thông tin bất kỳ lúc nào, có lưu lịch sử thay đổi.
- Trạng thái đơn theo vòng đời may mặc: *Nháp, Đã chốt, Đang sản xuất, Đang kiểm hàng, Sẵn sàng giao, Đã giao, Hủy*.
- Xóa mềm (soft delete): đơn xóa đi vẫn còn trong hệ thống, có thể khôi phục.

### Quản lý mẫu áo (Style)

- Một mẫu áo (ví dụ `AO083 — Áo polo cổ bẻ`) là dữ liệu nền dùng chung — nhập 1 lần, dùng nhiều đơn.
- Một mẫu có nhiều biến thể (variant), ví dụ `TRANG KE XANH`, `TRANG KE DO` — mỗi biến thể có mã, tên, ảnh riêng.
- Upload ảnh cho từng biến thể, hiển thị thumbnail trong danh sách đơn.
- Tìm kiếm mẫu theo mã hoặc tên.

### Quản lý kích cỡ (Size)

- Hệ thống có sẵn 5 size mặc định: S, M, L, XL, XXL — đúng với cách dùng hiện tại.
- Có thể thêm/sửa/xóa size (ví dụ thêm XS, XXXL khi cần).
- Sắp xếp size theo thứ tự hiển thị tùy ý.

### Tỉ lệ size + đợt nhập

- Mỗi đơn có thể khai báo **tỉ lệ size** (giống cột "Tỉ lệ nhập" trong Excel: 3, 3, 2, 1, 1).
- Mỗi đơn có thể có **nhiều đợt chốt nhập** — mỗi đợt là một bản ghi với ngày chốt + số lượng theo từng size.
- Có chức năng **"Tạo đợt nhập từ tỉ lệ"**: nhập một số nhân (multiplier) → hệ thống tự sinh số lượng cho từng size dựa trên tỉ lệ. Ví dụ tỉ lệ 3-3-2-1-1 × 8 → ra 24-24-16-8-8 = tổng 80.
- Tổng số lượng đơn được tính tự động (cộng dồn các đợt), không phải nhập tay.

### Tệp đính kèm

- Đính kèm file PDF, ảnh, tài liệu vào từng đơn.
- Tải lên, tải xuống, xem danh sách file.

### Tìm kiếm và lọc

- Tìm đơn theo mã, theo mẫu (style code, variant name).
- Lọc theo trạng thái, độ ưu tiên, ngày đặt, ngày kỳ vọng giao.
- Sắp xếp theo ngày đặt, deadline, ngày tạo.

### Dashboard tổng quan

- Số đơn đang chạy, đã trễ, sắp tới hạn, thiếu thông tin.
- Danh sách đơn cần chú ý hôm nay.
- Tổng quan cảnh báo còn mở.

### Cảnh báo tự động

- Đơn trễ deadline.
- Đơn sắp tới hạn (3 ngày, 7 ngày).
- Đơn đã chốt nhưng thiếu mẫu/size/tỉ lệ.
- Đơn đang sản xuất nhưng chưa có đợt chốt nhập nào.
- Đơn không có cập nhật trong thời gian dài.
- Chi tiết xem [Mục 8](#8-cảnh-báo-tự-động).

### Lịch sử và nhật ký

- Mỗi đơn có dòng thời gian (timeline) ghi mọi cập nhật trạng thái, thay đổi đợt nhập.
- Nhật ký hệ thống (audit log) ghi mọi thao tác sửa đổi, phục vụ tra cứu sau.

### Bảo mật cơ bản

- Đăng nhập bằng email + mật khẩu cho một tài khoản admin duy nhất.
- Mật khẩu mã hóa bằng bcrypt.
- Phiên đăng nhập tự hết hạn sau thời gian không hoạt động.

### Phân loại Must-have / Nice-to-have

| Tính năng | Mức độ |
|---|---|
| Order CRUD, mã đơn, lịch sử trạng thái | **Must** |
| Style + Variant + ảnh | **Must** |
| Size master + Order Items (size + tỉ lệ) | **Must** |
| Đợt nhập + apply ratio | **Must** |
| Tổng tự động tính | **Must** |
| Cảnh báo tự động (deadline, thiếu thông tin) | **Must** |
| Dashboard tổng quan | **Must** |
| Audit log + timeline | **Must** |
| Đính kèm file đơn | **Must** |
| Đăng nhập admin đơn giản | **Must** |
| Xuất Excel/CSV danh sách đơn | Nice-to-have |
| Nhập hàng loạt từ Excel hiện tại | Nice-to-have |
| Email khi cảnh báo phát sinh | Nice-to-have |
| Lưu bộ lọc tùy chỉnh | Nice-to-have |

---

## 4. Ngoài phạm vi Phase 1

Để Phase 1 ra nhanh và ổn định, các hạng mục sau **không build ở Phase 1**:

- ❌ **Quản lý vật tư** (vải, cúc, chỉ, ...) và **nhà cung cấp**. Có thể bổ sung Phase sau khi khách yêu cầu — schema được thiết kế để mở rộng dễ.
- ❌ **Tích hợp AI** dưới mọi hình thức (LLM, OCR, parse ảnh tự động).
- ❌ **MCP server thật** — chỉ thiết kế sẵn để Phase 2 tích hợp dễ.
- ❌ **Vector database, semantic search**.
- ❌ **Đa người dùng / phân quyền nhiều cấp** — Phase 1 chỉ 1 admin.
- ❌ **Multi-tenant** (nhiều công ty trên cùng hệ thống).
- ❌ **Real-time collaboration**.
- ❌ **Mobile app riêng** — web responsive là đủ.
- ❌ **Tích hợp ERP/Kế toán** ngoài.
- ❌ **Dự báo bằng machine learning**.

---

## 5. Các module nghiệp vụ chính

Hệ thống được tổ chức thành các module độc lập, mỗi module có trách nhiệm rõ ràng. Cách tổ chức này giúp dễ bảo trì, dễ mở rộng và dễ tích hợp AI ở Phase 2.

| Module | Trách nhiệm chính | Có ở Phase 1 |
|---|---|---|
| **Orders** | Quản lý đơn đặt hàng, trạng thái, lịch sử | ✅ |
| **Order Items** | Khai báo size + tỉ lệ cho từng đơn | ✅ |
| **Order Batches** | Đợt chốt nhập (số lượng theo từng size) | ✅ |
| **Styles & Variants** | Master data mẫu áo + biến thể + ảnh | ✅ |
| **Sizes** | Master data kích cỡ (S/M/L/XL/XXL + mở rộng) | ✅ |
| **Alerts** | Đánh giá quy tắc cảnh báo, sinh và đóng cảnh báo | ✅ |
| **Search** | Tìm kiếm và lọc xuyên các thực thể | ✅ |
| **Attachments** | Quản lý tệp đính kèm | ✅ |
| **Audit** | Nhật ký thay đổi cho mọi mutation | ✅ |
| **Auth** | Đăng nhập admin đơn giản | ✅ |
| **Notifications** | Email khi cảnh báo phát sinh | 🟡 Nice-to-have |

**Nguyên tắc thiết kế:** mỗi module không "thò tay" thẳng vào dữ liệu của module khác — phải đi qua giao diện công khai (service layer) của module đó. Phase 2 khi AI gọi vào, AI và giao diện người dùng đều dùng cùng "cổng vào", không có đường tắt nguy hiểm.

---

## 6. Kiến trúc giải pháp

### Tổng thể Phase 1

Hệ thống là một ứng dụng đơn (monolith) đơn giản, dễ triển khai và vận hành. Một process Nuxt 3 chứa cả giao diện người dùng và backend API, kết nối tới một cơ sở dữ liệu PostgreSQL duy nhất.

```
┌──────────────────────────────────────────────────────────────┐
│                      Trình duyệt (User)                      │
│               Giao diện web responsive (Vue 3)               │
└──────────────────────────────┬───────────────────────────────┘
                               │  HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Nuxt 3 App (1 process)                    │
│                                                              │
│  ┌────────────────┐         ┌─────────────────────────┐      │
│  │   Pages / UI   │         │   Server API routes     │      │
│  │  (Vue, Pinia)  │ ──────► │   /api/orders/...       │      │
│  └────────────────┘         │   /api/styles/...       │      │
│                             └────────────┬────────────┘      │
│                                          │                   │
│                             ┌────────────▼────────────┐      │
│                             │   Action Layer ⭐        │      │
│                             │   (createOrder,          │      │
│                             │    applyRatioToBatch...) │      │
│                             └────────────┬────────────┘      │
│                                          │                   │
│                             ┌────────────▼────────────┐      │
│                             │   Service / Repository  │      │
│                             │   + Prisma ORM          │      │
│                             └────────────┬────────────┘      │
│                                          │                   │
│  ┌──────────────────────────┐            │                   │
│  │  Background jobs (cron)  │            │                   │
│  │   - Đánh giá cảnh báo    │ ───────────┤                   │
│  │   - Dọn phiên hết hạn    │            │                   │
│  └──────────────────────────┘            │                   │
└──────────────────────────────────────────┼───────────────────┘
                                           │
                                ┌──────────▼──────────┐
                                │    PostgreSQL       │
                                │  (Source of Truth)  │
                                └─────────────────────┘
                                           │
                                ┌──────────▼──────────┐
                                │  Lưu trữ ảnh + tệp  │
                                │  (đĩa cục bộ hoặc   │
                                │   S3-compatible)    │
                                └─────────────────────┘
```

### Bốn lớp rõ ràng

1. **UI (Pages/Components):** màn hình hiển thị, biểu mẫu nhập liệu. Không chứa logic nghiệp vụ.
2. **API Routes:** lớp HTTP mỏng, chỉ nhận request và gọi Action.
3. **⭐ Action Layer:** mỗi nghiệp vụ là một hàm thuần (`createOrder`, `applyRatioToBatch`, `setOrderItems`, ...) với input được kiểm tra chặt chẽ. **Đây là điểm mấu chốt** để Phase 2 AI tái sử dụng nguyên vẹn.
4. **Service & Repository:** logic nghiệp vụ chi tiết và truy xuất DB.

### Background jobs

Một số tác vụ chạy ngầm theo lịch (mỗi 10 phút):
- **Đánh giá cảnh báo:** quét đơn đang chạy, tự sinh hoặc đóng cảnh báo theo quy tắc.
- **Dọn phiên hết hạn:** xóa session đã quá hạn.

### Triển khai

- **Hạ tầng:** 1 máy chủ (VPS hoặc cloud instance) cấu hình tối thiểu (2 vCPU, 4GB RAM, 50GB SSD).
- **Cài đặt:** Node.js 20+, PostgreSQL 15+, Nginx + HTTPS (Let's Encrypt).
- **Tự host:** khách có thể tự vận hành trên máy chủ riêng nếu muốn dữ liệu nội bộ hoàn toàn.

---

## 7. Mô hình dữ liệu

### Sơ đồ quan hệ tổng quan

```
                 ┌──────────────┐
                 │     User     │  (1 admin duy nhất ở Phase 1)
                 └──────┬───────┘
                        │ owns
                        ▼
   ┌────────────┐   ┌──────────┐         ┌──────────────────┐
   │   Style    │   │  Order   │────────►│  OrderUpdate     │
   │   AO083    │   │ TN150501 │         │ (lịch sử trạng   │
   └─────┬──────┘   │          │         │  thái)           │
         │          │          │         └──────────────────┘
         ▼          │          │
   ┌────────────┐   │          │         ┌──────────────────┐
   │StyleVariant│◄──│          │────────►│   OrderItem      │──►┌──────┐
   │TRANG KE...│   │          │         │ (size + tỉ lệ)   │   │ Size │
   │  +ảnh      │   │          │         └──────────────────┘   └──────┘
   └────────────┘   │          │
                    │          │         ┌──────────────────┐
                    │          │────────►│   OrderBatch     │
                    │          │         │ (đợt 1, 2, ...)  │
                    │          │         └────────┬─────────┘
                    │          │                  │
                    │          │                  ▼
                    │          │         ┌──────────────────┐
                    │          │         │   BatchItem      │──►┌──────┐
                    │          │         │ (size + qty)     │   │ Size │
                    │          │         └──────────────────┘   └──────┘
                    │          │
                    │          │         ┌──────────────┐
                    │          │────────►│  Attachment  │
                    │          │         └──────────────┘
                    │          │
                    │          │         ┌──────────────┐
                    │          │────────►│    Alert     │
                    └──────────┘         └──────────────┘

                    ┌──────────────────────────────┐
                    │  AuditLog (ghi mọi mutation) │
                    └──────────────────────────────┘
```

### Các bảng chính

| Bảng | Mục đích | Trường quan trọng |
|---|---|---|
| **User** | Tài khoản đăng nhập | id, email, name, passwordHash, role |
| **Style** | Mẫu áo (master data) | **code** (AO083), name, description, active |
| **StyleVariant** | Biến thể của một mẫu | styleId, name (TRANG KE XANH), imageUrl, color |
| **Size** | Kích cỡ (master data) | **code** (S/M/L/...), label, order, active |
| **Order** | Đơn đặt hàng | **code** (TN150501), styleVariantId, status, priority, orderedAt, expectedAt, actualAt, notes |
| **OrderItem** | Size + tỉ lệ của một đơn | orderId, sizeId, ratio |
| **OrderBatch** | Đợt chốt nhập | orderId, batchNumber, batchedAt, note |
| **BatchItem** | Số lượng cho một size trong một đợt | batchId, sizeId, quantity |
| **OrderUpdate** | Lịch sử thay đổi trạng thái đơn | orderId, fromStatus, toStatus, note, **source** |
| **Attachment** | Tệp đính kèm | orderId, filename, mimeType, sizeBytes, storagePath |
| **Alert** | Cảnh báo từ rule engine | orderId, ruleCode, severity, message, status |
| **AuditLog** | Nhật ký kỹ thuật mọi thay đổi | actorId, **source**, action, entityType, entityId, before, after |

### Một số quyết định thiết kế đáng chú ý

**Mã đơn đặt hàng.** Mỗi đơn có mã định danh duy nhất theo format khách quen (ví dụ `TN150501`), tự sinh hoặc nhập tay nếu đã có từ Excel cũ. Mã không thay đổi sau khi tạo, dùng tham chiếu lâu dài.

**Mẫu áo tách 2 cấp.** `Style` là mẫu gốc (`AO083`) — một mẫu có nhiều `StyleVariant` (biến thể màu/họa tiết: `TRANG KE XANH`, `TRANG KE DO`). Cách này phản ánh đúng thực tế: cùng kiểu áo nhưng nhiều màu, mỗi màu có ảnh riêng, không phải nhập lại từ đầu.

**Tỉ lệ và đợt nhập tách rời.** Tỉ lệ nằm ở `OrderItem` — định nghĩa 1 lần cho cả đơn. Số lượng thực tế nằm ở `OrderBatch` + `BatchItem` — mỗi đợt một bản ghi. Cách này cho phép: (1) một đơn có nhiều đợt nhập theo thời gian, (2) tỉ lệ là plan, qty là thực tế, không lẫn lộn.

**Tổng số lượng là computed.** Không lưu cột "Tổng" — luôn cộng dồn `BatchItem.quantity` để tránh lệch dữ liệu khi sửa.

**Trường `source` trong nhật ký.** Mọi mutation ghi rõ nguồn: `ui` (admin thao tác), `mcp` (Phase 2 AI gọi vào). Phase 1 hầu hết là `ui`, thiết kế từ đầu để Phase 2 không cần đổi schema.

**Trường `metadata Json?` ở các thực thể chính.** Cho phép lưu các trường tùy biến chưa muốn lên schema chính. Phase 2, AI có thể đẩy field trích xuất được nhưng chưa map vào trường chuẩn — admin xem lại, duyệt, mới chuyển vào trường chính.

**Xóa mềm (soft delete).** Đơn xóa không bị xóa thật, chỉ đánh dấu `deletedAt`. Có thể khôi phục, không mất lịch sử.

---

## 8. Cảnh báo tự động

Cảnh báo trong Phase 1 hoạt động theo **quy tắc cứng** (rule-based), không dùng AI. Ưu điểm: chạy nhanh, kết quả nhất quán, có thể giải thích được.

### Bộ quy tắc Phase 1

| Mã quy tắc | Điều kiện | Mức độ | Khi nào tự đóng |
|---|---|---|---|
| `OVERDUE` | Đơn có deadline đã qua nhưng chưa giao | **Khẩn cấp** | Khi đánh dấu Đã giao hoặc dời deadline |
| `DUE_SOON_3D` | Còn ≤ 3 ngày tới deadline | **Khẩn cấp** | Như trên |
| `DUE_SOON_7D` | Còn ≤ 7 ngày tới deadline | Cảnh báo | Như trên |
| `MISSING_DEADLINE` | Đơn đã chốt nhưng chưa có deadline | Cảnh báo | Khi điền |
| `NO_ITEMS` | Đơn đã chốt nhưng chưa khai size + tỉ lệ | Cảnh báo | Khi thêm items |
| `NO_BATCH` | Đơn đang sản xuất nhưng chưa có đợt nhập nào | Cảnh báo | Khi tạo đợt |
| `BATCH_QTY_MISMATCH_RATIO` | Tổng qty đợt mới nhất không khớp tỉ lệ | Thông tin | Khi sửa lại |
| `STATUS_TIMELINE_MISMATCH` | "Đã giao" nhưng chưa có ngày giao thực tế | Thông tin | Khi điền ngày |
| `STALE_ORDER` | Đơn đang sản xuất, > 14 ngày không cập nhật | Thông tin | Khi có cập nhật |

### Khi nào quy tắc chạy

- **Tức thời:** sau mỗi thao tác sửa đổi đơn/items/đợt → cảnh báo phát sinh hoặc tự đóng trong vài giây.
- **Định kỳ:** mỗi 10 phút, tác vụ nền quét toàn bộ đơn đang chạy để bắt cảnh báo phụ thuộc thời gian (như "trễ deadline").

### Hành động trên cảnh báo

- **Bỏ qua** (dismiss) kèm lý do — cảnh báo lưu lại, có thể tra cứu sau.
- **Tạm hoãn** (snooze) đến một thời điểm.
- Cảnh báo tự **đóng** (resolved) khi điều kiện không còn đúng.

---

## 9. Bảo mật, sao lưu và vận hành

### Bảo mật

| Khía cạnh | Phase 1 |
|---|---|
| Đăng nhập | Email + mật khẩu, mã hóa bằng bcrypt |
| Phiên làm việc | Cookie HttpOnly + Secure, có thời gian hết hạn |
| Truyền tải | Bắt buộc HTTPS qua Nginx + Let's Encrypt |
| Bảo vệ form | CSRF token cho mọi thao tác sửa đổi |
| Đầu vào | Validate chặt chẽ bằng schema (Zod) ở mọi điểm tiếp nhận |
| Truy vấn DB | Tham số hóa qua Prisma — không ghép chuỗi SQL |
| Tệp đính kèm | Kiểm tra MIME type, giới hạn dung lượng, lưu ngoài web root |
| Mật khẩu mặc định | Bắt buộc đổi ngay lần đăng nhập đầu tiên |

### Sao lưu

- **Sao lưu tự động hằng ngày** (`pg_dump`), giữ 30 ngày gần nhất.
- **Sao lưu ảnh + tệp đính kèm** đồng bộ định kỳ.
- **Khôi phục thử** trước khi go-live và 1 lần/quý sau đó.

### Vận hành & giám sát

- **Log có cấu trúc** (JSON) cho request quan trọng và mọi lỗi.
- **Health check** `/api/health` để giám sát từ ngoài.
- **Cảnh báo hệ thống** khi server lỗi, DB không kết nối được.
- **Quy trình cập nhật:** deploy → smoke test → rollback nếu cần.

### Auditability

Mọi thao tác sửa đổi quan trọng được lưu trong `AuditLog` với: ai làm, khi nào, thao tác gì, giá trị trước/sau, nguồn gốc (`ui` ở Phase 1; `mcp` khi AI vào ở Phase 2). Phase 2 có thể truy vết "AI tạo đơn nào, từ ảnh nào, lúc nào" rõ ràng.

---

## 10. Lộ trình mở rộng — Phase 2 (AI)

Phase 2 **không phải viết lại hệ thống**. Đó là việc thêm một lớp adapter ở ngoài để AI đọc/ghi dữ liệu vào hệ thống lõi đã có.

### Kịch bản tiêu biểu Phase 2

> *Khách hàng cuối gửi tin nhắn có ảnh kèm số lượng và mẫu áo. Thay vì gõ tay vào hệ thống, admin chuyển tiếp tin nhắn cho AI. AI nhìn ảnh, đọc text, nhận diện mẫu (`AO083 - TRANG KE XANH`), trích xuất tỉ lệ + số lượng theo size, gọi vào hệ thống tạo đơn nháp ở trạng thái "Chờ duyệt". Admin mở hệ thống, xem lại, sửa nếu cần, xác nhận. Toàn bộ mất 30 giây thay vì 30 phút.*

### Cách tích hợp

1. **Lớp wrapper MCP** — mỗi action Phase 1 đã được thiết kế dưới dạng hàm thuần với schema rõ ràng → tự động map thành "công cụ" cho AI gọi vào.
2. **Service AI parser** bên ngoài — gọi nhà cung cấp AI (OpenAI, Anthropic, ...) để trích xuất dữ liệu có cấu trúc từ ảnh/text.
3. **Hộp duyệt** — AI tạo dữ liệu ở trạng thái "Chờ duyệt", admin duyệt mới chính thức vào hệ thống.

### Nguyên tắc bảo vệ ở Phase 2

- AI không có đường tắt — phải đi qua đúng "cổng vào" mà UI đang dùng.
- AI dùng tài khoản riêng — không dùng tài khoản admin. Mọi thao tác AI ghi rõ `source = mcp` trong nhật ký.
- Validation giống hệt UI — AI không thể "lách luật".
- Idempotency — gọi 1 lệnh nhiều lần không tạo trùng dữ liệu.
- Human-in-the-loop mặc định — thao tác ghi quan trọng đi vào hộp duyệt.
- AI không được tự đóng cảnh báo.

### Phase 3 (định hướng xa)

- AI chủ động đề xuất hành động ("Đơn X đang trễ, cần ưu tiên xếp xưởng").
- Phát hiện bất thường (mẫu này hay bị trễ, tỉ lệ này hay thay đổi giữa chừng).
- Trợ lý hội thoại: "Cho tôi xem 5 đơn ưu tiên cao nhất tuần sau".
- Dự báo deadline thực tế dựa trên lịch sử.

Phase 3 chỉ làm khi Phase 2 đã ổn định và có đủ dữ liệu lịch sử.

---

## 11. Rủi ro và cách giảm thiểu

| Rủi ro | Tác động | Cách giảm thiểu |
|---|---|---|
| **Mô hình dữ liệu sai từ đầu** (lẫn lộn style/variant, ratio và qty không tách bạch) | Dữ liệu bẩn, sửa rất tốn công | Xác nhận với khách 5–10 use case cụ thể trước khi viết code; tách rõ Style/Variant, OrderItem (ratio) và BatchItem (qty) |
| **Phụ thuộc AI quá sớm** | Hệ thống không chạy được khi AI lỗi/đắt/hết hạn | Phase 1 cấm import bất kỳ thư viện AI nào |
| **Mất dữ liệu** | Mất toàn bộ lịch sử đơn hàng | Backup hằng ngày, retention 30 ngày, kiểm thử khôi phục |
| **Thao tác trùng lặp** (nhấn 2 lần → tạo 2 đơn) | Dữ liệu trùng | Hỗ trợ idempotency key ngay từ đầu |
| **Race condition** (admin sửa cùng lúc với cron) | Dữ liệu sai | Optimistic locking bằng `version` |
| **Sinh mã đơn trùng** | Mã không còn duy nhất | Postgres counter atomic, không dùng `MAX+1` |
| **Logic nghiệp vụ rò rỉ ra UI** | Bug khó tìm | Tập trung vào Action Layer; UI và AI cùng gọi vào |
| **Quên đơn trễ deadline** | Bỏ sót, mất uy tín với khách hàng cuối | Rule engine cảnh báo tự động, chạy cron |
| **Tệp đính kèm chứa malware** | Server bị nhiễm | Giới hạn loại file, kiểm tra MIME, lưu ngoài web root |
| **Tài khoản admin duy nhất bị chiếm** | Mất kiểm soát | HTTPS, mật khẩu mạnh; có thể bật 2FA Phase 1.5 |

---

## 12. Tech stack và lý do lựa chọn

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| **Frontend & API framework** | Nuxt 3 (Vue 3) | Một framework full-stack, một codebase. Hệ sinh thái Vue trưởng thành, ít boilerplate. |
| **Database** | PostgreSQL 15+ | Open-source, ổn định, hỗ trợ JSON tốt, full-text built-in, ràng buộc nghiệp vụ chặt. |
| **ORM** | Prisma | Type-safe, migration rõ ràng, schema cũng là tài liệu data model. |
| **Validation** | Zod | Schema dùng chung UI và API. Phase 2 chính schema này map thành "tool schema" cho AI. |
| **Authentication** | Cookie + bcrypt | Đơn giản, phù hợp 1 admin. Không cần OAuth/SSO. |
| **Background jobs** | node-cron (cùng process) | Đủ Phase 1, không cần Redis/BullMQ. |
| **File storage** | Disk hoặc S3-compatible | Bắt đầu disk; chuyển S3 (hoặc Minio self-host) khi cần. |
| **Reverse proxy & TLS** | Nginx + Let's Encrypt | Tiêu chuẩn ngành, miễn phí, ổn định. |
| **Logging** | Pino (JSON structured) | Hiệu năng tốt, dễ parse. |
| **Triển khai** | Docker Compose trên VPS | Một lệnh bring up toàn bộ stack. |

### Vì sao không chọn các phương án khác

- **Không microservices:** một ứng dụng đơn dễ phát triển và vận hành hơn 5–10 lần ở quy mô này.
- **Không NoSQL:** dữ liệu nghiệp vụ có quan hệ chặt (order ↔ style ↔ size ↔ batch), cần ràng buộc.
- **Không workflow engine:** trạng thái đơn dùng enum + chuyển trạng thái có kiểm tra điều kiện là đủ.

---

## 13. Phụ lục — Từ điển thuật ngữ

| Thuật ngữ | Giải thích ngắn |
|---|---|
| **CRUD** | Create / Read / Update / Delete — bốn thao tác cơ bản trên dữ liệu. |
| **Style / Mẫu** | Kiểu áo gốc, có mã (AO083) và mô tả chung. |
| **Variant / Biến thể** | Một biến thể của Style (TRANG KE XANH, TRANG KE DO) — có ảnh và màu riêng. |
| **Size / Kích cỡ** | S/M/L/XL/XXL — master data, có thể mở rộng. |
| **Order Item** | Một dòng "size + tỉ lệ" của một đơn. |
| **Batch / Đợt nhập** | Một đợt chốt số lượng — mỗi đơn có thể có nhiều đợt theo thời gian. |
| **Ratio / Tỉ lệ** | Tỉ lệ phân bổ size (3:3:2:1:1). Nhân với multiplier ra số lượng cụ thể. |
| **Multiplier** | Số nhân với tỉ lệ. Ví dụ ratio 3:3:2:1:1 × 8 = qty 24:24:16:8:8. |
| **Master data** | Dữ liệu nền dùng đi dùng lại (mẫu áo, kích cỡ). |
| **Soft delete** | Xóa "mềm" — đánh dấu xóa nhưng còn trong DB, có thể khôi phục. |
| **Audit log** | Nhật ký kỹ thuật ghi mọi thay đổi để truy vết. |
| **Rule engine** | Cơ chế đánh giá quy tắc cứng để sinh cảnh báo. |
| **ORM** | Object-Relational Mapping — lớp ánh xạ giữa code và bảng DB. |
| **Idempotency** | Tính chất "gọi nhiều lần cho cùng kết quả" — chống thao tác trùng. |
| **MCP** | Model Context Protocol — chuẩn để AI gọi vào hệ thống có kiểm soát. |
| **LLM** | Large Language Model (như GPT, Claude). |
| **Action Layer** | Lớp tập trung mọi hành động nghiệp vụ — UI và (sau này) AI cùng gọi vào. |
| **Source of truth** | Nơi duy nhất chứa dữ liệu chính thức. |

---

## Kết luận

Phase 1 của hệ thống là một **ứng dụng quản lý đơn đặt hàng may mặc** với cấu trúc dữ liệu rõ ràng (mẫu áo, biến thể, kích cỡ, tỉ lệ, đợt nhập), thay thế cách quản lý phân mảnh hiện tại bằng Excel. Mọi quyết định thiết kế đảm bảo nguyên tắc *"hệ thống chạy tốt mà không cần AI"*.

Phase 2 sẽ thêm AI như một kênh nhập liệu thông minh, tận dụng nguyên kiến trúc Phase 1 — không cần viết lại.

---

*Tài liệu này là bản tổng quan giải pháp. Tài liệu chi tiết kỹ thuật (đặc tả API, schema cơ sở dữ liệu, kế hoạch triển khai) sẽ được cung cấp khi khách hàng phê duyệt phương án.*

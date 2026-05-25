# Hệ thống Quản lý Dự án Sản xuất — Tài liệu Tổng quan Giải pháp

> **Phiên bản:** 1.0
> **Ngày phát hành:** 26/05/2026
> **Mục đích tài liệu:** Trình bày phạm vi, kiến trúc và lộ trình giải pháp ở mức tổng quan để khách hàng duyệt trước khi đi vào chi tiết triển khai.
> **Đối tượng đọc:** Người ra quyết định nghiệp vụ và người duyệt giải pháp kỹ thuật.

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Bối cảnh và mục tiêu](#2-bối-cảnh-và-mục-tiêu)
3. [Phạm vi Phase 1 — Khách được gì](#3-phạm-vi-phase-1--khách-được-gì)
4. [Ngoài phạm vi Phase 1](#4-ngoài-phạm-vi-phase-1)
5. [Các module nghiệp vụ chính](#5-các-module-nghiệp-vụ-chính)
6. [Kiến trúc giải pháp](#6-kiến-trúc-giải-pháp)
7. [Mô hình dữ liệu](#7-mô-hình-dữ-liệu)
8. [Quy tắc cảnh báo (Rule-based Alerts)](#8-quy-tắc-cảnh-báo-rule-based-alerts)
9. [Bảo mật, sao lưu và vận hành](#9-bảo-mật-sao-lưu-và-vận-hành)
10. [Lộ trình mở rộng — Phase 2 (AI)](#10-lộ-trình-mở-rộng--phase-2-ai)
11. [Rủi ro và cách giảm thiểu](#11-rủi-ro-và-cách-giảm-thiểu)
12. [Tech stack và lý do lựa chọn](#12-tech-stack-và-lý-do-lựa-chọn)
13. [Phụ lục — Từ điển thuật ngữ](#13-phụ-lục--từ-điển-thuật-ngữ)

---

## 1. Tổng quan dự án

Đây là một **web app nội bộ** giúp khách hàng quản lý các dự án/đơn hàng sản xuất tại một nơi duy nhất: thông tin dự án, trạng thái, tiến độ, vật tư, nhà cung cấp, deadline và cảnh báo. Phase 1 tập trung vào **một hệ thống dữ liệu nghiệp vụ chạy ổn định, dễ dùng, dễ tra cứu** — thay thế cho cách quản lý phân mảnh bằng Excel, email và tin nhắn. Phase 2 sẽ bổ sung **lớp AI bên ngoài** để tự động trích xuất dữ liệu từ ảnh/email/tin nhắn và đưa vào hệ thống, giảm thao tác nhập tay.

Nguyên tắc xuyên suốt: **hệ thống lõi phải chạy tốt mà không cần AI**. AI chỉ là một kênh nhập liệu thông minh thêm vào sau, không phải là lõi.

---

## 2. Bối cảnh và mục tiêu

### Bối cảnh hiện tại

Khách hàng đang quản lý dự án sản xuất bằng các công cụ rời rạc (file Excel, ghi chú, tin nhắn). Hệ quả thường gặp:

- Mỗi dự án có nhiều phiên bản dữ liệu khác nhau ở nhiều nơi, không biết phiên bản nào mới nhất.
- Dễ quên deadline, vật tư thiếu thông số mà không phát hiện kịp.
- Khó tra cứu lịch sử: dự án này trước đây ai phụ trách, vendor nào cung cấp, đã bị trễ bao nhiêu lần.
- Khi cần báo cáo nhanh "có bao nhiêu dự án đang trễ", phải mở từng file để đếm.

### Mục tiêu Phase 1

| # | Mục tiêu | Đo lường thành công |
|---|---|---|
| 1 | Một nơi duy nhất quản lý mọi dự án | 100% dự án đang chạy được nhập vào hệ thống |
| 2 | Cập nhật trạng thái và tiến độ nhanh hơn | Mỗi cập nhật < 30 giây thao tác |
| 3 | Tra cứu thông tin dự án tức thì | Tìm thấy dự án trong < 5 giây bằng mã/tên/khách |
| 4 | Không bỏ sót deadline và vật tư thiếu thông số | Hệ thống tự cảnh báo, không phụ thuộc trí nhớ con người |
| 5 | Có nền tảng dữ liệu sạch để Phase 2 AI tận dụng | Dữ liệu có cấu trúc, có lịch sử, có ràng buộc nghiệp vụ |

### Người sử dụng

Phase 1, hệ thống được sử dụng bởi **một người dùng quản trị duy nhất** (chủ doanh nghiệp/người vận hành). Đăng nhập đơn giản bằng email và mật khẩu, không cần phân quyền phức tạp. Hệ thống vẫn ghi đầy đủ nhật ký thay đổi để Phase 2, khi AI tham gia, có thể phân biệt thao tác nào do người, thao tác nào do AI.

---

## 3. Phạm vi Phase 1 — Khách được gì

Đây là danh sách tính năng có trong bản giao Phase 1, viết theo góc nhìn người dùng cuối.

### Quản lý dự án

- Tạo dự án mới với mã dự án duy nhất (tự sinh theo định dạng `PRJ-YYYY-####`, hoặc tự nhập nếu đã có mã từ trước).
- Nhập đầy đủ thông tin: tên dự án, khách hàng, ngày bắt đầu/kết thúc dự kiến, độ ưu tiên, ghi chú.
- Sửa thông tin bất kỳ lúc nào, có lưu lịch sử thay đổi.
- Đánh dấu dự án ở các trạng thái: *Nháp, Đã lên kế hoạch, Đang thực hiện, Tạm dừng, Hoàn thành, Đã hủy*.
- Cập nhật phần trăm tiến độ kèm ghi chú lý do cập nhật.
- Xóa mềm (soft delete): dự án xóa đi vẫn còn trong hệ thống, có thể khôi phục, không mất dữ liệu lịch sử.

### Quản lý vật tư (Materials)

- Mỗi dự án có một danh sách vật tư cần dùng (BOM — Bill of Materials).
- Mỗi dòng vật tư có: tên vật tư, thông số kỹ thuật (free-text), số lượng, đơn vị, vendor dự kiến, ngày cần có, ghi chú.
- Trạng thái vật tư: *Cần đặt, Đã đặt, Đã nhận, Thiếu thông tin*.
- Có thể gắn vật tư vào nhà cung cấp (vendor) đã có sẵn trong hệ thống.

### Quản lý nhà cung cấp (Vendors)

- Bảng dữ liệu vendor riêng, không nhập tay lặp lại trong từng dự án.
- Mỗi vendor có mã, tên, thông tin liên hệ, ngành hàng, trạng thái hoạt động.
- Khi nhập vật tư có thể chọn vendor từ danh sách đã có.

### Quản lý khách hàng (Customers)

- Bảng dữ liệu khách hàng tách riêng tương tự vendor.
- Mã, tên, thông tin liên hệ.

### Mốc tiến độ (Milestones)

- Mỗi dự án có thể có nhiều mốc tiến độ con với ngày dự kiến và ngày hoàn thành thực tế.
- Hỗ trợ theo dõi các giai đoạn (đặt vật tư, sản xuất, nghiệm thu, giao hàng...).

### Tệp đính kèm

- Đính kèm file PDF, ảnh, tài liệu vào từng dự án.
- Tải lên, tải xuống, xem danh sách file.

### Tìm kiếm và lọc

- Tìm dự án theo mã, tên, khách hàng, vendor, tên vật tư.
- Lọc theo trạng thái, độ ưu tiên, deadline, người phụ trách.
- Sắp xếp theo deadline, ngày tạo, mức độ trễ.

### Dashboard tổng quan

- Số dự án đang chạy, đã trễ, sắp tới hạn, thiếu thông tin.
- Danh sách dự án cần chú ý hôm nay.
- Tổng quan cảnh báo còn mở.

### Cảnh báo tự động (Rule-based)

- Cảnh báo dự án trễ deadline.
- Cảnh báo dự án sắp đến hạn (3 ngày, 7 ngày).
- Cảnh báo vật tư thiếu thông số/số lượng.
- Cảnh báo vật tư chưa có vendor.
- Cảnh báo dự án không có cập nhật trong thời gian dài.
- Chi tiết các quy tắc xem [Mục 8](#8-quy-tắc-cảnh-báo-rule-based-alerts).

### Lịch sử và nhật ký

- Mỗi dự án có một dòng thời gian (timeline) ghi lại mọi cập nhật trạng thái, tiến độ, thay đổi vật tư, vendor.
- Nhật ký hệ thống (audit log) ghi lại mọi thao tác sửa đổi quan trọng, phục vụ tra cứu sau này.

### Bảo mật cơ bản

- Đăng nhập bằng email + mật khẩu cho một tài khoản admin duy nhất.
- Mật khẩu được mã hóa theo chuẩn (bcrypt).
- Phiên đăng nhập tự hết hạn sau thời gian không hoạt động.

### Phân loại Must-have / Nice-to-have

| Tính năng | Mức độ |
|---|---|
| Project CRUD, mã dự án, lịch sử trạng thái | **Must** |
| Materials, Vendors, Customers | **Must** |
| Tìm kiếm và lọc cơ bản | **Must** |
| Cảnh báo tự động (deadline, thiếu thông tin, thiếu vendor) | **Must** |
| Dashboard tổng quan | **Must** |
| Audit log | **Must** |
| Đính kèm file | **Must** |
| Đăng nhập admin đơn giản | **Must** |
| Xuất Excel/CSV danh sách dự án | Nice-to-have |
| Nhập hàng loạt từ Excel/CSV | Nice-to-have |
| Gửi email khi cảnh báo phát sinh | Nice-to-have |
| Lưu bộ lọc tùy chỉnh (saved view) | Nice-to-have |

---

## 4. Ngoài phạm vi Phase 1

Để Phase 1 ra nhanh và ổn định, các hạng mục sau **không được build ở Phase 1**, kể cả khi có vẻ "tiện làm luôn":

- ❌ **Tích hợp AI** dưới mọi hình thức (LLM, OCR, parse ảnh tự động).
- ❌ **MCP server** để AI gọi vào hệ thống — chỉ thiết kế sẵn để Phase 2 tích hợp dễ, không build server thật.
- ❌ **Vector database, semantic search, embeddings**.
- ❌ **Đa người dùng / phân quyền nhiều cấp** — Phase 1 chỉ 1 admin.
- ❌ **Multi-tenant** (nhiều công ty trên cùng một hệ thống).
- ❌ **Real-time collaboration** (nhiều người sửa cùng lúc kiểu Google Docs).
- ❌ **Workflow engine / BPMN / state machine framework** phức tạp.
- ❌ **Mobile app riêng** — web app responsive là đủ ở Phase 1.
- ❌ **Tích hợp ERP/Kế toán bên ngoài** — chỉ export dữ liệu thủ công nếu cần.
- ❌ **Dự báo (forecast) bằng machine learning**.

Lý do: mỗi hạng mục trên đều có thể bổ sung sau khi nền tảng dữ liệu Phase 1 ổn định. Đưa vào Phase 1 sẽ kéo dài thời gian giao hàng và tăng rủi ro mà không đem lại giá trị tương xứng cho người dùng đầu tiên.

---

## 5. Các module nghiệp vụ chính

Hệ thống được tổ chức thành các module nghiệp vụ độc lập, mỗi module có trách nhiệm rõ ràng. Cách tổ chức này giúp dễ bảo trì, dễ mở rộng và đặc biệt dễ tích hợp AI ở Phase 2 (mỗi module sẽ "mở" ra một số API mà AI có thể gọi vào).

| Module | Trách nhiệm chính | Có ở Phase 1 |
|---|---|---|
| **Projects** | Quản lý dự án: tạo, sửa, đổi trạng thái, tiến độ, milestone | ✅ |
| **Materials** | Quản lý vật tư yêu cầu cho từng dự án (BOM) | ✅ |
| **Vendors** | Master data nhà cung cấp | ✅ |
| **Customers** | Master data khách hàng | ✅ |
| **Alerts** | Đánh giá quy tắc cảnh báo, sinh và đóng cảnh báo | ✅ |
| **Search** | Tìm kiếm và lọc xuyên các thực thể | ✅ |
| **Attachments** | Quản lý tệp đính kèm | ✅ |
| **Audit** | Nhật ký thay đổi cho mọi mutation | ✅ |
| **Auth** | Đăng nhập admin đơn giản | ✅ |
| **Notifications** | Thông báo qua email khi cảnh báo phát sinh | 🟡 Nice-to-have |

**Nguyên tắc thiết kế:** mỗi module không được phép "thò tay" thẳng vào dữ liệu của module khác — luôn phải đi qua giao diện công khai (service layer) của module đó. Nguyên tắc này giúp Phase 2 khi AI gọi vào hệ thống, AI và giao diện người dùng đều dùng cùng một bộ "cổng vào", không có đường tắt nguy hiểm.

---

## 6. Kiến trúc giải pháp

### Kiến trúc tổng thể Phase 1

Hệ thống là một ứng dụng đơn (monolith) đơn giản, dễ triển khai, dễ vận hành. Một process Nuxt 3 chứa cả giao diện người dùng và backend API, kết nối tới một cơ sở dữ liệu PostgreSQL duy nhất.

```
┌──────────────────────────────────────────────────────────────┐
│                       Trình duyệt (User)                     │
│              Giao diện web responsive (Vue 3)                │
└──────────────────────────────┬───────────────────────────────┘
                               │  HTTPS
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Nuxt 3 App (1 process)                    │
│                                                              │
│  ┌────────────────┐         ┌─────────────────────────┐      │
│  │   Pages / UI   │         │   Server API routes     │      │
│  │  (Vue, Pinia)  │ ──────► │   /api/projects/...     │      │
│  └────────────────┘         │   /api/materials/...    │      │
│                             └────────────┬────────────┘      │
│                                          │                   │
│                             ┌────────────▼────────────┐      │
│                             │   Action Layer ⭐        │      │
│                             │   (createProject,        │      │
│                             │    updateStatus, ...)    │      │
│                             └────────────┬────────────┘      │
│                                          │                   │
│                             ┌────────────▼────────────┐      │
│                             │   Service / Repository  │      │
│                             │   (business logic +     │      │
│                             │    Prisma ORM)          │      │
│                             └────────────┬────────────┘      │
│                                          │                   │
│  ┌──────────────────────────┐            │                   │
│  │ Background jobs (cron)   │            │                   │
│  │  - Đánh giá cảnh báo     │ ───────────┤                   │
│  │  - Dọn phiên hết hạn     │            │                   │
│  └──────────────────────────┘            │                   │
└──────────────────────────────────────────┼───────────────────┘
                                           │
                                ┌──────────▼──────────┐
                                │    PostgreSQL       │
                                │  (Source of Truth)  │
                                └─────────────────────┘
                                           │
                                ┌──────────▼──────────┐
                                │  Lưu trữ tệp        │
                                │  (đĩa cục bộ hoặc   │
                                │   S3-compatible)    │
                                └─────────────────────┘
```

### Bốn lớp rõ ràng

1. **UI (Pages/Components):** màn hình hiển thị và biểu mẫu nhập liệu. Không chứa logic nghiệp vụ.
2. **API Routes:** lớp HTTP mỏng, chỉ làm nhiệm vụ nhận request, gọi Action, trả response.
3. **⭐ Action Layer (lớp hành động):** mỗi nghiệp vụ là một hàm thuần (`createProject`, `updateProjectStatus`, `addMaterialRequirement`, ...) với tham số đầu vào được kiểm tra chặt chẽ. **Đây là điểm mấu chốt** để Phase 2 AI có thể tái sử dụng nguyên vẹn — AI gọi đúng những hàm này thay vì tự sinh logic.
4. **Service & Repository:** logic nghiệp vụ chi tiết và truy xuất cơ sở dữ liệu qua Prisma ORM.

### Background jobs

Một số tác vụ chạy ngầm theo lịch (mỗi 10 phút):

- **Đánh giá cảnh báo:** quét dự án đang chạy, tự động sinh hoặc đóng cảnh báo theo quy tắc (xem [Mục 8](#8-quy-tắc-cảnh-báo-rule-based-alerts)).
- **Dọn phiên hết hạn:** xóa các session đăng nhập đã quá hạn.

Phase 1 không cần một hệ thống job queue riêng (như Redis/BullMQ) — node-cron trong cùng process là đủ. Khi nào dữ liệu vượt một ngưỡng nhất định (ví dụ trên 5.000 dự án đang hoạt động) mới cần tách.

### Triển khai

- **Hạ tầng:** 1 máy chủ (VPS hoặc cloud instance) cấu hình tối thiểu (2 vCPU, 4GB RAM, 50GB SSD).
- **Cài đặt:** Node.js 20+, PostgreSQL 15+, Nginx làm reverse proxy, chứng chỉ HTTPS (Let's Encrypt).
- **Tự host:** khách hàng có thể tự vận hành trên máy chủ riêng nếu muốn dữ liệu nội bộ hoàn toàn.

---

## 7. Mô hình dữ liệu

### Sơ đồ quan hệ tổng quan

```
                        ┌──────────────┐
                        │     User     │  (1 admin duy nhất ở Phase 1)
                        └──────┬───────┘
                               │ owns
                               ▼
   ┌────────────┐         ┌──────────┐         ┌──────────────┐
   │  Customer  │◄────────│ Project  │────────►│  Milestone   │
   └────────────┘         │          │         └──────────────┘
                          │          │
                          │          │         ┌──────────────────┐
                          │          │────────►│ ProjectUpdate    │
                          │          │         │ (lịch sử trạng   │
                          │          │         │  thái/tiến độ)   │
                          │          │         └──────────────────┘
                          │          │
                          │          │         ┌──────────────────┐
                          │          │────────►│ MaterialReq.     │────►┌──────────┐
                          │          │         │ (BOM dự án)      │     │  Vendor  │
                          │          │         └──────────────────┘     └──────────┘
                          │          │
                          │          │         ┌──────────────┐
                          │          │────────►│  Attachment  │
                          │          │         └──────────────┘
                          │          │
                          │          │         ┌──────────────┐
                          │          │────────►│    Alert     │
                          └──────────┘         └──────────────┘
                                                       
                          ┌────────────────────────────┐
                          │   AuditLog (cross-cutting) │
                          │   ghi mọi mutation         │
                          └────────────────────────────┘
```

### Các bảng chính

| Bảng | Mục đích | Trường quan trọng |
|---|---|---|
| **User** | Tài khoản đăng nhập | id, email, name, passwordHash, role |
| **Project** | Dự án/đơn hàng sản xuất | id, **code** (duy nhất), name, customerId, status, priority, progressPct, expectedStart, expectedEnd, actualStart, actualEnd, notes, metadata |
| **ProjectUpdate** | Lịch sử thay đổi trạng thái/tiến độ của dự án | projectId, fromStatus, toStatus, fromProgress, toProgress, note, createdAt, **source** |
| **Milestone** | Mốc tiến độ con | projectId, name, dueDate, completedAt, order |
| **Customer** | Khách hàng (master data) | code, name, contact |
| **Vendor** | Nhà cung cấp (master data) | code, name, contact, category, active |
| **MaterialRequirement** | Vật tư cần cho dự án (BOM) | projectId, name, spec, quantity, unit, vendorId, status, neededBy, notes |
| **Attachment** | Tệp đính kèm | projectId, filename, mimeType, sizeBytes, storagePath, uploadedById |
| **Alert** | Cảnh báo phát sinh từ rule engine | projectId, ruleCode, severity, message, status, triggeredAt, resolvedAt |
| **AuditLog** | Nhật ký kỹ thuật mọi thay đổi | actorId, **source**, action, entityType, entityId, before, after, requestId, createdAt |

### Một số quyết định thiết kế đáng chú ý

**Mã dự án (project code).** Mỗi dự án có mã định danh dạng `PRJ-YYYY-####` (ví dụ `PRJ-2026-0042`), được hệ thống tự sinh hoặc cho phép admin nhập tay nếu đã có sẵn từ hệ thống cũ. Mã này **không thay đổi** sau khi tạo, dùng để tham chiếu lâu dài (đặt tên file, tra cứu, gắn trong báo cáo).

**Lịch sử thay đổi tách hai cấp độ.**
- `ProjectUpdate` ghi các thay đổi *nghiệp vụ* (đổi trạng thái, đổi tiến độ) — admin xem được trên giao diện như "dòng thời gian dự án".
- `AuditLog` ghi các thay đổi *kỹ thuật* (sửa bất kỳ trường nào) — phục vụ tra cứu chuyên sâu khi cần điều tra.

**Trường `source` trong mọi bản ghi thay đổi.** Mọi mutation đều ghi nguồn gốc: `ui` (do admin thao tác), `api` (do tích hợp ngoài), `mcp` (Phase 2 — do AI gọi vào). Phase 1 hầu hết là `ui`, nhưng việc thiết kế từ đầu giúp Phase 2 phân biệt rạch ròi mà không cần đổi schema.

**Trường `metadata Json?` ở các thực thể chính.** Cho phép lưu các trường tùy biến chưa muốn lên schema chính. Phase 2, AI có thể đẩy các trường trích xuất được nhưng chưa map vào trường chuẩn — admin xem lại, duyệt, mới chuyển vào trường chính. Quy tắc: trường nào dùng để lọc/dashboard thì phải là cột thật, không được ở trong `metadata`.

**Xóa mềm (soft delete).** Dự án xóa đi không bị xóa thật trong cơ sở dữ liệu, chỉ đánh dấu `deletedAt`. Có thể khôi phục, không mất dữ liệu lịch sử.

---

## 8. Quy tắc cảnh báo (Rule-based Alerts)

Cảnh báo trong Phase 1 hoạt động theo **quy tắc cứng** (rule-based), không dùng AI. Cách này có 3 ưu điểm: (1) chạy nhanh, (2) kết quả nhất quán, có thể giải thích được, (3) admin tin tưởng và không phải băn khoăn "vì sao hệ thống nói trễ".

### Bộ quy tắc Phase 1

| Mã quy tắc | Điều kiện kích hoạt | Mức độ | Khi nào tự đóng |
|---|---|---|---|
| `OVERDUE` | Dự án có deadline đã qua nhưng chưa hoàn thành | **Khẩn cấp** | Khi đánh dấu hoàn thành hoặc dời deadline |
| `DUE_SOON_3D` | Còn ≤ 3 ngày tới deadline | **Khẩn cấp** | Khi hoàn thành hoặc dời deadline |
| `DUE_SOON_7D` | Còn ≤ 7 ngày tới deadline | Cảnh báo | Như trên |
| `MISSING_DEADLINE` | Dự án đang thực hiện nhưng chưa có deadline | Cảnh báo | Khi điền deadline |
| `NO_MATERIALS` | Dự án đang thực hiện nhưng chưa có vật tư nào | Cảnh báo | Khi thêm vật tư |
| `MATERIAL_NO_VENDOR` | Vật tư chưa được gán vendor | Thông tin | Khi gán vendor |
| `MATERIAL_MISSING_QTY` | Vật tư chưa có số lượng hoặc số lượng = 0 | Cảnh báo | Khi điền số lượng |
| `STATUS_TIMELINE_MISMATCH` | Trạng thái không khớp với thời gian thực tế (ví dụ "Hoàn thành" nhưng chưa có ngày kết thúc thực tế) | Thông tin | Khi điền ngày |
| `STALE_PROJECT` | Dự án đang chạy nhưng > 14 ngày không có cập nhật | Thông tin | Khi có cập nhật mới |
| `PROGRESS_BEHIND` | Tiến độ thực tế thấp hơn tiến độ kỳ vọng theo timeline > 30% | Cảnh báo | Khi cập nhật tiến độ đạt mức kỳ vọng |

### Cách quy tắc chạy

- **Tức thời:** sau mỗi thao tác sửa đổi dự án/vật tư, hệ thống đánh giá lại các quy tắc liên quan ngay → cảnh báo phát sinh hoặc tự đóng trong vài giây.
- **Định kỳ:** mỗi 10 phút, một tác vụ nền quét toàn bộ dự án đang chạy để bắt các cảnh báo phụ thuộc thời gian (ví dụ "trễ deadline" — không có thao tác user nào kích hoạt, chỉ có thời gian trôi qua).

### Hành động trên cảnh báo

- Admin có thể **bỏ qua** một cảnh báo (dismiss) kèm lý do — cảnh báo đó được lưu, có thể tra cứu sau.
- **Tạm hoãn** (snooze) một cảnh báo đến một thời điểm.
- Cảnh báo tự **đóng** (resolved) khi điều kiện không còn đúng.

### Mở rộng quy tắc

Mỗi quy tắc là một module nhỏ độc lập. Khi cần thêm quy tắc mới (ví dụ "vendor X đã trễ 3 lần liên tiếp"), chỉ cần thêm một module mới mà không ảnh hưởng các quy tắc hiện có.

---

## 9. Bảo mật, sao lưu và vận hành

### Bảo mật

| Khía cạnh | Phase 1 |
|---|---|
| Đăng nhập | Email + mật khẩu, mật khẩu mã hóa bằng bcrypt |
| Phiên làm việc | Cookie HttpOnly + Secure, có thời gian hết hạn |
| Truyền tải | Bắt buộc HTTPS (TLS) qua Nginx + Let's Encrypt |
| Bảo vệ form | CSRF token cho mọi thao tác sửa đổi |
| Đầu vào | Validate chặt chẽ bằng schema (Zod) ở mọi điểm tiếp nhận dữ liệu |
| Truy vấn DB | Tham số hóa qua Prisma — không có chỗ nào ghép chuỗi SQL trực tiếp |
| Tệp đính kèm | Kiểm tra MIME type, giới hạn dung lượng, lưu ngoài thư mục web-accessible |
| Mật khẩu mặc định | Bắt buộc đổi ngay lần đăng nhập đầu tiên |

### Sao lưu

- **Sao lưu tự động hằng ngày** cơ sở dữ liệu (`pg_dump`), giữ 30 ngày gần nhất.
- **Sao lưu tệp đính kèm** đồng bộ định kỳ (rsync hoặc S3 versioning nếu dùng cloud storage).
- **Khôi phục thử** định kỳ (ít nhất 1 lần trước khi go-live và 1 lần/quý sau đó) để xác nhận backup thực sự khôi phục được.

### Vận hành & giám sát

- **Log:** ghi log có cấu trúc (JSON) cho mọi request quan trọng và mọi lỗi.
- **Health check:** một endpoint `/api/health` để giám sát từ bên ngoài (uptime monitor).
- **Cảnh báo hệ thống:** khi server lỗi (5xx), khi DB không kết nối được — gửi qua email hoặc kênh chat của khách.
- **Cập nhật:** quy trình cập nhật phiên bản chuẩn (deploy → smoke test → rollback nếu cần).

### Auditability (khả năng truy vết)

Mọi thao tác sửa đổi quan trọng đều được lưu trong `AuditLog` với:
- Ai làm (user id),
- Khi nào (timestamp),
- Thao tác gì (`project.update_status`, `material.create`, ...),
- Trước/sau giá trị thay đổi,
- Nguồn gốc (`ui` ở Phase 1; `mcp` khi AI vào ở Phase 2).

Đây là tài sản dữ liệu quan trọng — Phase 2 khi AI tham gia, có thể truy vết "AI đã tạo dự án nào, từ ảnh nào, lúc nào" một cách rõ ràng.

---

## 10. Lộ trình mở rộng — Phase 2 (AI)

Phase 2 **không phải là viết lại hệ thống**. Đó là việc thêm một lớp adapter ở ngoài để AI có thể đọc/ghi dữ liệu vào hệ thống lõi đã có.

### Kịch bản người dùng tiêu biểu Phase 2

> *Admin nhận một email từ khách hàng kèm spec sản phẩm dạng PDF. Thay vì ngồi gõ lại 30 trường vào hệ thống, admin chuyển tiếp email cho AI. AI đọc PDF, trích xuất thông tin dự án + danh sách vật tư + thông số, gọi vào hệ thống tạo bản nháp dự án ở trạng thái "Chờ duyệt". Admin mở hệ thống, xem lại bản nháp, sửa nếu cần, rồi xác nhận. Toàn bộ quá trình mất 30 giây thay vì 30 phút.*

### Cách tích hợp

Phase 2 thêm vào những gì đã có ở Phase 1:

1. **Lớp wrapper MCP** — mỗi hành động (action) trong Phase 1 đã được thiết kế dưới dạng hàm thuần với schema đầu vào rõ ràng → tự động map thành "công cụ" cho AI gọi vào.
2. **Service AI parser bên ngoài** — gọi tới nhà cung cấp AI (OpenAI, Anthropic, ...) để trích xuất dữ liệu có cấu trúc từ ảnh/PDF/text.
3. **Hộp duyệt (Approval inbox)** — AI tạo dữ liệu ở trạng thái "Chờ duyệt", admin duyệt mới chính thức vào hệ thống.

### Nguyên tắc quan trọng ở Phase 2

- **AI không có đường tắt** — AI phải đi qua đúng những "cổng vào" mà giao diện người dùng đang dùng. Không cho AI tự viết SQL, không cho AI ghi thẳng vào DB.
- **AI dùng tài khoản riêng** — không dùng tài khoản admin. Mọi thao tác AI ghi rõ `source = mcp` trong nhật ký.
- **Kiểm tra dữ liệu giống hệt giao diện** — schema validation dùng chung, AI không thể "lách luật".
- **Idempotency** — gọi 1 lệnh nhiều lần không tạo trùng dữ liệu.
- **Human-in-the-loop mặc định** — các thao tác ghi quan trọng đi vào hộp duyệt, admin xác nhận mới apply.
- **AI không được tự đóng cảnh báo** — nếu cho AI đóng, sớm muộn AI sẽ "dọn dẹp" cảnh báo để tỏ ra đã hoàn thành nhiệm vụ.

### Phase 3 (định hướng xa)

- AI chủ động đề xuất hành động ("Dự án X đang trễ, vendor Y có sẵn vật liệu Z, có muốn tạo PO không?").
- Phát hiện bất thường (vendor luôn chậm, vật tư hay thiếu).
- Trợ lý hội thoại: "Cho tôi xem 5 dự án ưu tiên cao nhất tuần sau".
- Dự báo deadline thực tế dựa trên lịch sử.

Lộ trình Phase 3 chỉ làm khi Phase 2 đã ổn định và có đủ dữ liệu lịch sử.

---

## 11. Rủi ro và cách giảm thiểu

| Rủi ro | Tác động | Cách giảm thiểu |
|---|---|---|
| **Mô hình dữ liệu sai từ đầu** (ví dụ nhầm lẫn giữa dự án/đơn hàng, vendor làm field text thay vì master data) | Dữ liệu bẩn, sửa rất tốn công về sau | Xác nhận rõ với khách 5–10 use case cụ thể trước khi viết code; dùng entity riêng cho Vendor/Customer/Material ngay từ đầu |
| **Phụ thuộc AI quá sớm** | Hệ thống không chạy được khi AI lỗi/đắt/hết hạn | Phase 1 cấm import bất kỳ thư viện AI nào; mọi nghiệp vụ phải chạy được không cần AI |
| **Mất dữ liệu** | Mất toàn bộ lịch sử dự án | Backup hằng ngày, retention 30 ngày, kiểm thử khôi phục định kỳ |
| **Thao tác trùng lặp** (ví dụ nhấn 2 lần → tạo 2 dự án) | Dữ liệu trùng | Hỗ trợ idempotency key ngay từ đầu, kể cả khi giao diện chưa dùng tới |
| **Race condition** (admin update cùng lúc với cron job) | Dữ liệu sai | Optimistic locking bằng `updatedAt` hoặc field `version` |
| **Sinh mã dự án trùng** | Mã không còn duy nhất | Dùng Postgres sequence hoặc transactional counter, không dùng `MAX+1` |
| **Logic nghiệp vụ rò rỉ vào nhiều chỗ** (UI, API, sau này AI) | Bug khó tìm, fix một chỗ thiếu chỗ khác | Tập trung mọi nghiệp vụ vào Action Layer; UI và AI cùng gọi vào đó |
| **Quá phụ thuộc trí nhớ admin** để bắt deadline trễ | Bỏ sót, mất uy tín với khách hàng cuối | Rule engine cảnh báo tự động, chạy cron |
| **Tệp đính kèm chứa malware** | Server bị nhiễm | Giới hạn loại file, kiểm tra MIME, lưu ngoài web root |
| **Một tài khoản admin duy nhất bị chiếm** | Mất kiểm soát toàn bộ hệ thống | Bắt buộc HTTPS, mật khẩu mạnh, đổi mật khẩu định kỳ; có thể bật 2FA ở Phase 1.5 nếu khách yêu cầu |

---

## 12. Tech stack và lý do lựa chọn

| Thành phần | Lựa chọn | Lý do chọn |
|---|---|---|
| **Frontend & API framework** | Nuxt 3 (Vue 3) | Một framework full-stack, một codebase cho cả UI và API. Render server-side cho tốc độ và SEO. Hệ sinh thái Vue trưởng thành, ít boilerplate. |
| **Database** | PostgreSQL 15+ | Open-source, ổn định lâu năm, hỗ trợ JSON tốt (cho `metadata`), index full-text built-in (cho tìm kiếm), hỗ trợ tốt cho audit log và soft delete. |
| **ORM** | Prisma | Type-safe, migration rõ ràng, hỗ trợ TypeScript tự động sinh type. Schema Prisma cũng là tài liệu data model. |
| **Validation** | Zod | Schema dùng chung cho input UI và API. Phase 2 chính schema này map thành "tool schema" cho AI. |
| **Authentication** | Cookie-based + bcrypt | Đơn giản, phù hợp 1 admin. Không cần OAuth/SSO ở Phase 1. |
| **Background jobs** | node-cron (cùng process) | Đủ cho Phase 1, không cần Redis hay BullMQ. Khi cần scale lên mới tách. |
| **File storage** | Disk cục bộ hoặc S3-compatible | Bắt đầu bằng disk cho đơn giản; chuyển S3 (hoặc Minio self-host) khi cần. |
| **Reverse proxy & TLS** | Nginx + Let's Encrypt | Tiêu chuẩn ngành, miễn phí, ổn định. |
| **Logging** | Pino (JSON structured) | Hiệu năng tốt, dễ parse khi cần phân tích. |
| **Triển khai** | Docker Compose (1 file) trên VPS | Một lệnh để bring up toàn bộ stack. Dễ chuyển nhà cung cấp hosting. |

### Vì sao không chọn các phương án khác

- **Không chọn microservices:** một ứng dụng đơn dễ phát triển và vận hành hơn 5–10 lần ở quy mô này. Khi nào nghẽn rồi mới tách.
- **Không chọn NoSQL (MongoDB...):** dữ liệu nghiệp vụ có quan hệ chặt (project ↔ material ↔ vendor), cần ràng buộc và truy vấn aggregate. PostgreSQL phù hợp hơn.
- **Không chọn workflow engine (Temporal, Camunda...):** quá nặng cho Phase 1; trạng thái dự án dùng enum + chuyển trạng thái có kiểm tra điều kiện là đủ.
- **Không chọn Next.js:** Nuxt 3 phù hợp hơn nếu team quen Vue; đây là quyết định tech lead phía thực thi đề xuất.

---

## 13. Phụ lục — Từ điển thuật ngữ

| Thuật ngữ | Giải thích ngắn |
|---|---|
| **CRUD** | Create / Read / Update / Delete — bốn thao tác cơ bản trên dữ liệu. |
| **BOM** | Bill of Materials — danh sách vật tư cần để hoàn thành một dự án/sản phẩm. |
| **Master data** | Dữ liệu nền dùng đi dùng lại nhiều lần (như danh sách vendor, khách hàng, đơn vị đo). |
| **Soft delete** | Xóa "mềm" — dữ liệu bị đánh dấu xóa nhưng vẫn còn trong DB, có thể khôi phục. |
| **Audit log** | Nhật ký kỹ thuật ghi lại mọi thay đổi trên hệ thống để truy vết. |
| **Rule engine** | Cơ chế đánh giá một bộ quy tắc cứng để sinh ra cảnh báo/quyết định. |
| **ORM** | Object-Relational Mapping — lớp ánh xạ giữa code và bảng DB, tránh viết SQL tay. |
| **Idempotency** | Tính chất "gọi nhiều lần cũng cho kết quả như gọi 1 lần" — quan trọng để chống thao tác trùng. |
| **MCP** | Model Context Protocol — chuẩn để AI/agent gọi vào hệ thống bên ngoài một cách có kiểm soát. |
| **LLM** | Large Language Model — mô hình ngôn ngữ lớn (như GPT, Claude). |
| **OCR** | Optical Character Recognition — nhận dạng chữ trong ảnh. |
| **Action Layer** | Lớp tập trung mọi hành động nghiệp vụ ở dạng hàm thuần — UI và (sau này) AI cùng gọi vào đây. |
| **Source of truth** | "Nguồn chân lý" — nơi duy nhất chứa dữ liệu chính thức, các nơi khác phải đồng bộ về đây. |

---

## Kết luận

Phase 1 của hệ thống là một **ứng dụng quản trị dữ liệu nghiệp vụ vững chắc, dễ dùng, dễ tra cứu**, thay thế cho cách quản lý phân mảnh hiện tại. Mọi quyết định thiết kế ở Phase 1 đều đảm bảo nguyên tắc *"hệ thống chạy tốt mà không cần AI"*.

Phase 2 sẽ thêm AI như một kênh nhập liệu thông minh, tận dụng nguyên kiến trúc Phase 1 mà không cần viết lại — đây là điểm then chốt giúp đầu tư Phase 1 không bị lãng phí khi mở rộng về sau.

---

*Tài liệu này là bản tổng quan giải pháp. Các tài liệu chi tiết kèm theo (đặc tả API, schema cơ sở dữ liệu chi tiết, kế hoạch triển khai) sẽ được cung cấp khi khách hàng phê duyệt phương án.*

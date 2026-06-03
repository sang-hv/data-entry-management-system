# M5 Alerts & Dashboard — Implementation Plan

> **Status:** 📋 Planned → execute ngay sau khi viết
> **Reference:** implementation-plan.md mục 10 (alert rules), 7.3 (action schemas), 14 (M5 scope)
> **Kế thừa:** action layer pattern, audit-on-mutation, conventions M1–M4.

**Goal:** Rule engine đánh giá sức khỏe đơn hàng → tạo Alert tự động → dashboard hiển thị số liệu thật → dismiss alert.

**Scope KHÔNG bao gồm:** attachments (M6), MCP (Phase 2), AI/OCR.

---

## Hiện trạng

- Chưa có: `server/modules/alerts/`, `server/actions/alerts/`, `server/actions/dashboard/`, API alerts/dashboard, `pages/alerts/`, dashboard data thật, cron jobs.
- Có sẵn: Schema `Alert` đầy đủ trong DB, `TODO(M5): evaluateOrderAlerts` comment trong batch actions, dashboard placeholder.

---

## Tasks (16 tasks, TDD)

| # | Task |
|---|---|
| 1 | `rules/_types.ts` — interface `AlertRule`, `AlertResult`, `OrderSnapshot` |
| 2 | 9 rule files (mỗi file = 1 rule, export 1 object) |
| 3 | `alert.repo.ts` — upsert open, resolve stale, list with filter |
| 4 | `alert-engine.ts` — `evaluateOrderAlerts(orderId)` |
| 5 | Actions: `getActiveAlerts`, `dismissAlert` |
| 6 | Actions: `getUrgentOrders`, `getOverdueOrders`, `getOrdersMissingData` |
| 7 | `validateOrderDataCompleteness` action |
| 8 | API: `/api/alerts`, `/api/alerts/:id/dismiss`, `/api/dashboard/*`, `/api/orders/:id/validate` |
| 9 | Wire `evaluateOrderAlerts` vào mutations (createOrder, updateOrder, cancelOrder, setOrderItems, setOrderTaskDone) |
| 10 | Cron job `alert-evaluator.job.ts` (10 phút), `jobs/index.ts`, `plugins/jobs.ts` |
| 11 | Unit tests: 9 rules × 2-3 cases = ~22 tests |
| 12 | Integration tests: engine + dismiss + dashboard queries |
| 13 | Dashboard page — 4 stat cards thật + danh sách đơn cần chú ý |
| 14 | `pages/alerts/index.vue` — list + filter severity + dismiss |
| 15 | Tab Alerts trong order detail |
| 16 | Seed: update 2 đơn để có alert thật, `pnpm seed` chạy lại |

---

## Alert Rules (10 rules theo spec + 1 điều chỉnh)

| Code | Điều kiện | Severity |
|---|---|---|
| `OVERDUE` | `expectedAt < now` AND status ∉ {COMPLETED, CANCELLED} | CRITICAL |
| `DUE_SOON_3D` | `0 < expectedAt - now ≤ 3d` AND status ∉ {COMPLETED, CANCELLED} | CRITICAL |
| `DUE_SOON_7D` | `3d < expectedAt - now ≤ 7d` AND status ∉ {COMPLETED, CANCELLED} | WARN |
| `MISSING_DEADLINE` | `expectedAt IS NULL` AND `status = ACTIVE` | WARN |
| `NO_ITEMS` | `status = ACTIVE` AND items.length = 0 | WARN |
| `NO_TASKS` | `status = ACTIVE` AND tasks.length = 0 | WARN |
| `STALE_ORDER` | `status = ACTIVE` AND `updatedAt < now - 14d` | INFO |

> **Điều chỉnh vs blueprint:** Bỏ `NO_BATCH`, `BATCH_QTY_MISMATCH_RATIO`, `STATUS_TIMELINE_MISMATCH` vì feature batch đã bị bỏ. Giữ 7 rules có giá trị thực tế nhất.

---

## Execution

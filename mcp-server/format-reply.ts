import type { PendingEntry } from './pending-store.js'

export function fmtPendingConfirm(entry: PendingEntry): string {
  return [
    `📋 Xác nhận thao tác:`,
    entry.summary,
    ``,
    `🔑 ID xác nhận: \`${entry.id}\``,
    `⏰ Hết hạn sau 10 phút`,
    ``,
    `➡️ Dùng tool \`confirm_pending\` với pendingId: "${entry.id}" để xác nhận`,
    `❌ Dùng tool \`cancel_pending\` với pendingId: "${entry.id}" để hủy`,
  ].join('\n')
}

export function fmtOrderSummary(o: {
  code: string
  status: string
  priority?: string | null
  progressPct: number
  expectedAt?: Date | null
  styleCode?: string
  variantName?: string
}): string {
  const deadline = o.expectedAt
    ? o.expectedAt.toLocaleDateString('vi-VN')
    : 'Chưa có deadline'
  const style = o.styleCode ? `${o.styleCode} - ${o.variantName ?? ''}` : 'N/A'
  const priorityLine = o.priority != null ? ` | Ưu tiên: ${fmtPriority(o.priority)}` : ''
  return [
    `📦 Đơn: ${o.code}`,
    `   Mẫu: ${style}`,
    `   Trạng thái: ${fmtStatus(o.status)} | Tiến độ: ${o.progressPct}%${priorityLine}`,
    `   Deadline: ${deadline}`,
  ].join('\n')
}

export function fmtStatus(s: string): string {
  const map: Record<string, string> = {
    DRAFT: '📝 Nháp',
    ACTIVE: '🔄 Đang chạy',
    COMPLETED: '✅ Hoàn thành',
    CANCELLED: '❌ Đã hủy',
  }
  return map[s] ?? s
}

export function fmtPriority(p: string): string {
  const map: Record<string, string> = {
    LOW: '🟢 Thấp',
    NORMAL: '🔵 Bình thường',
    HIGH: '🟡 Cao',
    URGENT: '🔴 Khẩn cấp',
  }
  return map[p] ?? p
}

export function fmtError(err: unknown): string {
  if (err instanceof Error) return `❌ Lỗi: ${err.message}`
  return `❌ Lỗi không xác định`
}

import type { AlertRule } from './_types'

const MS_14D = 14 * 86400_000

export const staleOrderRule: AlertRule = {
  code: 'STALE_ORDER',
  severity: 'INFO',
  evaluate(order, now) {
    if (order.status !== 'ACTIVE') return null
    const staleDays = Math.floor((now.getTime() - order.updatedAt.getTime()) / 86400_000)
    if (staleDays < 14) return null
    return {
      message: `Đơn không có cập nhật trong ${staleDays} ngày`,
      dataSnapshot: { updatedAt: order.updatedAt, staleDays },
    }
  },
}

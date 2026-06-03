import type { AlertRule } from './_types'

export const overdueRule: AlertRule = {
  code: 'OVERDUE',
  severity: 'CRITICAL',
  evaluate(order, now) {
    if (!order.expectedAt) return null
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return null
    if (order.expectedAt >= now) return null
    const daysLate = Math.floor((now.getTime() - order.expectedAt.getTime()) / 86400_000)
    return {
      message: `Đơn trễ deadline ${daysLate} ngày (deadline: ${order.expectedAt.toLocaleDateString('vi-VN')})`,
      dataSnapshot: { expectedAt: order.expectedAt, daysLate },
    }
  },
}

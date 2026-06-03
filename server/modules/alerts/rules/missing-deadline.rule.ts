import type { AlertRule } from './_types'

export const missingDeadlineRule: AlertRule = {
  code: 'MISSING_DEADLINE',
  severity: 'WARN',
  evaluate(order) {
    if (order.status !== 'ACTIVE') return null
    if (order.expectedAt !== null) return null
    return {
      message: 'Đơn đang chạy chưa có ngày giao hàng kỳ vọng',
      dataSnapshot: {},
    }
  },
}

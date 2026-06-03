import type { AlertRule } from './_types'

export const noTasksRule: AlertRule = {
  code: 'NO_TASKS',
  severity: 'WARN',
  evaluate(order) {
    if (order.status !== 'ACTIVE') return null
    if (order.tasks.length > 0) return null
    return {
      message: 'Đơn đang chạy chưa có quy trình công đoạn',
      dataSnapshot: {},
    }
  },
}

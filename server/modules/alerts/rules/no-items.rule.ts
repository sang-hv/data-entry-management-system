import type { AlertRule } from './_types'

export const noItemsRule: AlertRule = {
  code: 'NO_ITEMS',
  severity: 'WARN',
  evaluate(order) {
    if (order.status !== 'ACTIVE') return null
    if (order.items.length > 0) return null
    return {
      message: 'Đơn đang chạy chưa có size & tỉ lệ',
      dataSnapshot: {},
    }
  },
}

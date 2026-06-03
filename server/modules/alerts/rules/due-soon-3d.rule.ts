import type { AlertRule } from './_types'

const MS_3D = 3 * 86400_000

export const dueSoon3dRule: AlertRule = {
  code: 'DUE_SOON_3D',
  severity: 'CRITICAL',
  evaluate(order, now) {
    if (!order.expectedAt) return null
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return null
    const diff = order.expectedAt.getTime() - now.getTime()
    if (diff <= 0 || diff > MS_3D) return null
    const daysLeft = Math.ceil(diff / 86400_000)
    return {
      message: `Đơn sắp tới deadline trong ${daysLeft} ngày`,
      dataSnapshot: { expectedAt: order.expectedAt, daysLeft },
    }
  },
}

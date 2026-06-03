import type { AlertRule } from './_types'

const MS_3D = 3 * 86400_000
const MS_7D = 7 * 86400_000

export const dueSoon7dRule: AlertRule = {
  code: 'DUE_SOON_7D',
  severity: 'WARN',
  evaluate(order, now) {
    if (!order.expectedAt) return null
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return null
    const diff = order.expectedAt.getTime() - now.getTime()
    // Only fires if NOT already in 3d window (avoid duplicate with DUE_SOON_3D)
    if (diff <= MS_3D || diff > MS_7D) return null
    const daysLeft = Math.ceil(diff / 86400_000)
    return {
      message: `Đơn sắp tới deadline trong ${daysLeft} ngày`,
      dataSnapshot: { expectedAt: order.expectedAt, daysLeft },
    }
  },
}

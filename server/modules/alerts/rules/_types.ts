import type { AlertSeverity, OrderStatus } from '@prisma/client'

export interface OrderSnapshot {
  id: string
  status: OrderStatus
  expectedAt: Date | null
  orderedAt: Date | null
  actualAt: Date | null
  updatedAt: Date
  items: Array<{ sizeId: string; ratio: number }>
  tasks: Array<{ done: boolean }>
}

export interface AlertResult {
  message: string
  dataSnapshot: Record<string, unknown>
}

export interface AlertRule {
  code: string
  severity: AlertSeverity
  evaluate(order: OrderSnapshot, now: Date): AlertResult | null
}

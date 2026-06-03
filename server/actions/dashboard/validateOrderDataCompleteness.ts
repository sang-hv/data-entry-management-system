import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { prisma } from '../../lib/prisma'

export const ValidateOrderInput = z.object({ orderId: z.string().uuid() })

export interface ValidationIssue {
  field: string
  severity: 'info' | 'warn' | 'critical'
  message: string
}

export async function validateOrderDataCompleteness(rawInput: unknown, ctx: ActionContext) {
  const input = ValidateOrderInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const order = await prisma.order.findFirst({
    where: { id: input.orderId, deletedAt: null },
    include: {
      items: true,
      tasks: { select: { done: true } },
    },
  })
  if (!order) throw new NotFoundError('Order', input.orderId)

  const missing: ValidationIssue[] = []
  let score = 0
  const weights = {
    styleVariantId: 0.10,
    orderedAt: 0.05,
    expectedAt: 0.20,
    hasItems: 0.20,
    hasTasks: 0.25,
    allRatioPositive: 0.10,
    notesPresent: 0.10,
  }

  // styleVariantId — always set (required at creation), count it
  score += weights.styleVariantId

  if (order.orderedAt) {
    score += weights.orderedAt
  }
  else {
    missing.push({ field: 'orderedAt', severity: 'info', message: 'Chưa có ngày đặt hàng' })
  }

  if (order.expectedAt) {
    score += weights.expectedAt
  }
  else {
    missing.push({ field: 'expectedAt', severity: 'critical', message: 'Chưa có ngày giao hàng kỳ vọng' })
  }

  if (order.items.length > 0) {
    score += weights.hasItems
  }
  else {
    missing.push({ field: 'items', severity: 'critical', message: 'Chưa khai báo size & tỉ lệ' })
  }

  if (order.tasks.length > 0) {
    score += weights.hasTasks
  }
  else {
    missing.push({ field: 'tasks', severity: 'critical', message: 'Chưa có quy trình công đoạn' })
  }

  if (order.items.length > 0 && order.items.every((i) => i.ratio > 0)) {
    score += weights.allRatioPositive
  }
  else if (order.items.length > 0) {
    missing.push({ field: 'items.ratio', severity: 'info', message: 'Một số size chưa có tỉ lệ' })
  }

  if (order.notes && order.notes.trim().length > 0) {
    score += weights.notesPresent
  }
  else {
    missing.push({ field: 'notes', severity: 'info', message: 'Chưa có ghi chú cho đơn' })
  }

  const roundedScore = Math.round(score * 100) / 100
  const isComplete = roundedScore >= 0.95 && !missing.some((m) => m.severity === 'critical')

  return { isComplete, score: roundedScore, missing }
}

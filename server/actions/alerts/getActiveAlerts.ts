import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ValidationError } from '../_base/errors'
import { alertRepo } from '../../modules/alerts/alert.repo'

export const GetActiveAlertsInput = z.object({
  orderId: z.string().uuid().optional(),
  severity: z.array(z.enum(['INFO', 'WARN', 'CRITICAL'])).optional(),
  status: z.array(z.enum(['OPEN', 'SNOOZED'])).default(['OPEN']),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
})

export async function getActiveAlerts(rawInput: unknown, ctx: ActionContext) {
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')
  const input = GetActiveAlertsInput.parse(rawInput ?? {})
  return alertRepo.listActive({
    orderId: input.orderId,
    severity: input.severity,
    status: input.status,
    page: input.page,
    pageSize: input.pageSize,
  })
}

import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { alertRepo } from '../../modules/alerts/alert.repo'

export const DismissAlertInput = z.object({
  alertId: z.string().uuid(),
  reason: z.string().max(2000).optional(),
})

export async function dismissAlert(rawInput: unknown, ctx: ActionContext) {
  const input = DismissAlertInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  const alert = await alertRepo.findById(input.alertId)
  if (!alert) throw new NotFoundError('Alert', input.alertId)
  if (alert.status !== 'OPEN') {
    throw new ValidationError(`Alert is already ${alert.status}`)
  }

  const dismissed = await alertRepo.dismiss(input.alertId, input.reason)

  await auditRepo.write({
    actorId: ctx.actor.id,
    source: ctx.source,
    action: 'alert.dismiss',
    entityType: 'Alert',
    entityId: input.alertId,
    before: { status: 'OPEN' },
    after: { status: 'DISMISSED', reason: input.reason },
    requestId: ctx.requestId,
  })

  return { alert: dismissed }
}

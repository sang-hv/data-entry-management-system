import { prisma } from '../lib/prisma'
import { evaluateOrderAlerts } from '../modules/alerts/alert-engine'
import { logger } from '../lib/logger'

/**
 * Scan all ACTIVE orders and re-evaluate alerts.
 * Called by cron every 10 minutes.
 */
export async function runAlertEvaluator() {
  const start = Date.now()
  const orders = await prisma.order.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  })

  let evaluated = 0
  let errors = 0
  for (const { id } of orders) {
    try {
      await evaluateOrderAlerts(id)
      evaluated++
    }
    catch (err) {
      errors++
      logger.error({ err, orderId: id }, 'alert-evaluator: error evaluating order')
    }
  }

  logger.info(
    { evaluated, errors, durationMs: Date.now() - start },
    'alert-evaluator: run complete',
  )
}

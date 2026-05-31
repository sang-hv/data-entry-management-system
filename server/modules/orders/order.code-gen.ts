import { prisma } from '../../lib/prisma'

function formatYYYYMMDD(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/**
 * Generate the next order code in the form `TN-YYYYMMDD-####`.
 * Atomic via Postgres upsert + increment on the OrderCodeCounter table.
 */
export async function generateOrderCode(date: Date = new Date()): Promise<string> {
  const yyyymmdd = formatYYYYMMDD(date)
  const prefix = `TN-${yyyymmdd}`

  const counter = await prisma.orderCodeCounter.upsert({
    where: { prefix },
    create: { prefix, value: 1 },
    update: { value: { increment: 1 } },
  })

  return `${prefix}-${String(counter.value).padStart(4, '0')}`
}

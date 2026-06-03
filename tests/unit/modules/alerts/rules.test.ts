import { describe, expect, it } from 'vitest'
import { overdueRule } from '~/server/modules/alerts/rules/overdue.rule'
import { dueSoon3dRule } from '~/server/modules/alerts/rules/due-soon-3d.rule'
import { dueSoon7dRule } from '~/server/modules/alerts/rules/due-soon-7d.rule'
import { missingDeadlineRule } from '~/server/modules/alerts/rules/missing-deadline.rule'
import { noItemsRule } from '~/server/modules/alerts/rules/no-items.rule'
import { noTasksRule } from '~/server/modules/alerts/rules/no-tasks.rule'
import { staleOrderRule } from '~/server/modules/alerts/rules/stale-order.rule'
import type { OrderSnapshot } from '~/server/modules/alerts/rules/_types'

const now = new Date('2026-06-04T12:00:00Z')

function order(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: 'order-1',
    status: 'ACTIVE',
    expectedAt: null,
    orderedAt: new Date('2026-05-01'),
    actualAt: null,
    updatedAt: new Date('2026-05-30'),
    items: [{ sizeId: 's1', ratio: 1 }],
    tasks: [{ done: false }],
    ...overrides,
  }
}

describe('overdueRule', () => {
  it('fires when expectedAt < now and status ACTIVE', () => {
    const result = overdueRule.evaluate(order({ expectedAt: new Date('2026-06-01') }), now)
    expect(result).not.toBeNull()
    expect(result!.dataSnapshot.daysLate).toBe(3)
  })
  it('no fire when COMPLETED', () => {
    expect(overdueRule.evaluate(order({ expectedAt: new Date('2026-06-01'), status: 'COMPLETED' }), now)).toBeNull()
  })
  it('no fire when expectedAt in future', () => {
    expect(overdueRule.evaluate(order({ expectedAt: new Date('2026-06-10') }), now)).toBeNull()
  })
  it('no fire when expectedAt null', () => {
    expect(overdueRule.evaluate(order({ expectedAt: null }), now)).toBeNull()
  })
})

describe('dueSoon3dRule', () => {
  it('fires when deadline within 3 days', () => {
    const result = dueSoon3dRule.evaluate(order({ expectedAt: new Date('2026-06-06') }), now)
    expect(result).not.toBeNull()
    expect(result!.dataSnapshot.daysLeft).toBe(2)
  })
  it('no fire when overdue', () => {
    expect(dueSoon3dRule.evaluate(order({ expectedAt: new Date('2026-06-01') }), now)).toBeNull()
  })
  it('no fire when > 3 days away', () => {
    expect(dueSoon3dRule.evaluate(order({ expectedAt: new Date('2026-06-15') }), now)).toBeNull()
  })
  it('no fire when COMPLETED', () => {
    expect(dueSoon3dRule.evaluate(order({ expectedAt: new Date('2026-06-06'), status: 'COMPLETED' }), now)).toBeNull()
  })
})

describe('dueSoon7dRule', () => {
  it('fires when deadline 4-7 days away', () => {
    const result = dueSoon7dRule.evaluate(order({ expectedAt: new Date('2026-06-09') }), now)
    expect(result).not.toBeNull()
  })
  it('no fire when within 3 days (DUE_SOON_3D handles it)', () => {
    expect(dueSoon7dRule.evaluate(order({ expectedAt: new Date('2026-06-06') }), now)).toBeNull()
  })
  it('no fire when > 7 days', () => {
    expect(dueSoon7dRule.evaluate(order({ expectedAt: new Date('2026-06-20') }), now)).toBeNull()
  })
})

describe('missingDeadlineRule', () => {
  it('fires when ACTIVE and no expectedAt', () => {
    expect(missingDeadlineRule.evaluate(order({ expectedAt: null }), now)).not.toBeNull()
  })
  it('no fire when expectedAt set', () => {
    expect(missingDeadlineRule.evaluate(order({ expectedAt: new Date('2026-07-01') }), now)).toBeNull()
  })
  it('no fire when DRAFT', () => {
    expect(missingDeadlineRule.evaluate(order({ status: 'DRAFT', expectedAt: null }), now)).toBeNull()
  })
})

describe('noItemsRule', () => {
  it('fires when ACTIVE and no items', () => {
    expect(noItemsRule.evaluate(order({ items: [] }), now)).not.toBeNull()
  })
  it('no fire when has items', () => {
    expect(noItemsRule.evaluate(order({ items: [{ sizeId: 's1', ratio: 1 }] }), now)).toBeNull()
  })
  it('no fire when DRAFT', () => {
    expect(noItemsRule.evaluate(order({ status: 'DRAFT', items: [] }), now)).toBeNull()
  })
})

describe('noTasksRule', () => {
  it('fires when ACTIVE and no tasks', () => {
    expect(noTasksRule.evaluate(order({ tasks: [] }), now)).not.toBeNull()
  })
  it('no fire when has tasks', () => {
    expect(noTasksRule.evaluate(order({ tasks: [{ done: false }] }), now)).toBeNull()
  })
  it('no fire when COMPLETED', () => {
    expect(noTasksRule.evaluate(order({ status: 'COMPLETED', tasks: [] }), now)).toBeNull()
  })
})

describe('staleOrderRule', () => {
  it('fires when ACTIVE and updatedAt > 14d ago', () => {
    const result = staleOrderRule.evaluate(
      order({ updatedAt: new Date('2026-05-01') }),
      now,
    )
    expect(result).not.toBeNull()
    expect(result!.dataSnapshot.staleDays).toBeGreaterThanOrEqual(14)
  })
  it('no fire when updated recently', () => {
    expect(staleOrderRule.evaluate(order({ updatedAt: new Date('2026-06-01') }), now)).toBeNull()
  })
  it('no fire when COMPLETED', () => {
    expect(staleOrderRule.evaluate(order({ status: 'COMPLETED', updatedAt: new Date('2026-01-01') }), now)).toBeNull()
  })
})

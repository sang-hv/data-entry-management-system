import { describe, expect, it } from 'vitest'
import {
  computeOrderProgress,
  computeOrderStatus,
} from '~/server/modules/orders/order.progress'

describe('computeOrderStatus', () => {
  it('returns DRAFT for empty task list', () => {
    expect(computeOrderStatus([])).toBe('DRAFT')
  })

  it('returns ACTIVE when at least one task < 100', () => {
    expect(computeOrderStatus([{ progressPct: 0 }])).toBe('ACTIVE')
    expect(computeOrderStatus([{ progressPct: 50 }, { progressPct: 100 }])).toBe('ACTIVE')
    expect(computeOrderStatus([{ progressPct: 99 }, { progressPct: 100 }])).toBe('ACTIVE')
  })

  it('returns COMPLETED when every task is >= 100', () => {
    expect(computeOrderStatus([{ progressPct: 100 }])).toBe('COMPLETED')
    expect(computeOrderStatus([{ progressPct: 100 }, { progressPct: 100 }])).toBe('COMPLETED')
  })
})

describe('computeOrderProgress', () => {
  it('returns 0 for empty list', () => {
    expect(computeOrderProgress([])).toBe(0)
  })

  it('returns the single value for one task', () => {
    expect(computeOrderProgress([{ progressPct: 75 }])).toBe(75)
  })

  it('rounds the average for multiple tasks', () => {
    // (100 + 100 + 75 + 0) / 4 = 68.75 → 69
    expect(
      computeOrderProgress([
        { progressPct: 100 },
        { progressPct: 100 },
        { progressPct: 75 },
        { progressPct: 0 },
      ]),
    ).toBe(69)
    // (50 + 50) / 2 = 50
    expect(computeOrderProgress([{ progressPct: 50 }, { progressPct: 50 }])).toBe(50)
    // (1) / 4 = 0.25 → 0
    expect(
      computeOrderProgress([
        { progressPct: 1 },
        { progressPct: 0 },
        { progressPct: 0 },
        { progressPct: 0 },
      ]),
    ).toBe(0)
  })

  it('returns 100 only when all tasks are 100', () => {
    expect(
      computeOrderProgress([{ progressPct: 100 }, { progressPct: 100 }]),
    ).toBe(100)
  })
})

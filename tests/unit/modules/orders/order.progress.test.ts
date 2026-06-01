import { describe, expect, it } from 'vitest'
import {
  computeOrderProgress,
  computeOrderStatus,
} from '~/server/modules/orders/order.progress'

describe('computeOrderStatus', () => {
  it('returns DRAFT for empty task list', () => {
    expect(computeOrderStatus([])).toBe('DRAFT')
  })

  it('returns ACTIVE when at least one task is not done', () => {
    expect(computeOrderStatus([{ done: false }])).toBe('ACTIVE')
    expect(computeOrderStatus([{ done: false }, { done: true }])).toBe('ACTIVE')
  })

  it('returns COMPLETED when every task is done', () => {
    expect(computeOrderStatus([{ done: true }])).toBe('COMPLETED')
    expect(computeOrderStatus([{ done: true }, { done: true }])).toBe('COMPLETED')
  })
})

describe('computeOrderProgress', () => {
  it('returns 0 for empty list', () => {
    expect(computeOrderProgress([])).toBe(0)
  })

  it('returns 0 when no task is done', () => {
    expect(computeOrderProgress([{ done: false }])).toBe(0)
    expect(computeOrderProgress([{ done: false }, { done: false }])).toBe(0)
  })

  it('returns the done ratio as a rounded percentage', () => {
    // 1/4 done = 25
    expect(
      computeOrderProgress([
        { done: true },
        { done: false },
        { done: false },
        { done: false },
      ]),
    ).toBe(25)
    // 2/4 done = 50
    expect(
      computeOrderProgress([
        { done: true },
        { done: true },
        { done: false },
        { done: false },
      ]),
    ).toBe(50)
    // 1/3 done = 33.33 → 33
    expect(
      computeOrderProgress([{ done: true }, { done: false }, { done: false }]),
    ).toBe(33)
  })

  it('returns 100 only when all tasks are done', () => {
    expect(computeOrderProgress([{ done: true }, { done: true }])).toBe(100)
  })
})

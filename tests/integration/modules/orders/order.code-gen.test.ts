import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '~/server/lib/prisma'
import { generateOrderCode } from '~/server/modules/orders/order.code-gen'

describe('generateOrderCode', () => {
  beforeEach(async () => {
    await prisma.orderCodeCounter.deleteMany()
  })

  it('returns TN-YYYYMMDD-0001 for first call', async () => {
    const date = new Date(Date.UTC(2026, 4, 15)) // 15/05/2026
    const code = await generateOrderCode(date)
    expect(code).toBe('TN-20260515-0001')
  })

  it('increments sequentially within same date', async () => {
    const date = new Date(Date.UTC(2026, 4, 15))
    const c1 = await generateOrderCode(date)
    const c2 = await generateOrderCode(date)
    const c3 = await generateOrderCode(date)
    expect(c1).toBe('TN-20260515-0001')
    expect(c2).toBe('TN-20260515-0002')
    expect(c3).toBe('TN-20260515-0003')
  })

  it('starts fresh per day', async () => {
    const day1 = new Date(Date.UTC(2026, 4, 15))
    const day2 = new Date(Date.UTC(2026, 4, 16))
    const c1 = await generateOrderCode(day1)
    const c2 = await generateOrderCode(day2)
    expect(c1).toBe('TN-20260515-0001')
    expect(c2).toBe('TN-20260516-0001')
  })

  it('pads sequence to 4 digits', async () => {
    const date = new Date(Date.UTC(2026, 4, 15))
    const codes: string[] = []
    for (let i = 0; i < 12; i++) {
      codes.push(await generateOrderCode(date))
    }
    expect(codes[0]).toBe('TN-20260515-0001')
    expect(codes[9]).toBe('TN-20260515-0010')
    expect(codes[11]).toBe('TN-20260515-0012')
  })
})

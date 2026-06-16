import { describe, it, expect } from 'vitest'
import { computeFee, formatSGD } from '@/lib/utils'

// The collab payment invariant enforced by select_application_atomic is
// platform_fee + creator_payout === agreed_rate. computeFee is the only
// producer of those numbers - it must never leak or create a cent.
describe('computeFee', () => {
  const rates = [1, 99, 100, 12345, 25000, 99999, 100000, 7777777]

  it('fee + payout equals the agreed rate exactly (free plan)', () => {
    for (const rate of rates) {
      const { fee, payout } = computeFee(rate, 'free')
      expect(fee + payout).toBe(rate)
      expect(fee).toBeGreaterThanOrEqual(0)
      expect(payout).toBeGreaterThanOrEqual(0)
    }
  })

  it('fee + payout equals the agreed rate exactly (pro plan)', () => {
    for (const rate of rates) {
      const { fee, payout } = computeFee(rate, 'pro')
      expect(fee + payout).toBe(rate)
    }
  })

  it('pro fee (8%) is lower than free fee (12%)', () => {
    const free = computeFee(100000, 'free')
    const pro = computeFee(100000, 'pro')
    expect(free.fee).toBe(12000)
    expect(pro.fee).toBe(8000)
    expect(pro.payout).toBeGreaterThan(free.payout)
  })

  it('formatSGD treats values as cents', () => {
    expect(formatSGD(15000)).toBe('S$150.00')
    expect(formatSGD(1)).toBe('S$0.01')
  })
})

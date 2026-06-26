import { describe, it, expect } from 'vitest'
import { computeFee, formatSGD } from '@/lib/utils'

// The collab payment invariant enforced by select_application_atomic is
// platform_fee + creator_payout === agreed_rate. computeFee is the only
// producer of those numbers - it must never leak or create a cent.
describe('computeFee', () => {
  const rates = [1, 99, 100, 12345, 25000, 99999, 100000, 7777777]

  it('fee + payout equals the agreed rate exactly (creator free)', () => {
    for (const rate of rates) {
      const { fee, payout } = computeFee(rate, false)
      expect(fee + payout).toBe(rate)
      expect(fee).toBeGreaterThanOrEqual(0)
      expect(payout).toBeGreaterThanOrEqual(0)
    }
  })

  it('fee + payout equals the agreed rate exactly (creator pro)', () => {
    for (const rate of rates) {
      const { fee, payout } = computeFee(rate, true)
      expect(fee + payout).toBe(rate)
    }
  })

  it('creator pro fee (8%) is lower than creator free fee (10%)', () => {
    const free = computeFee(100000, false)
    const pro = computeFee(100000, true)
    expect(free.fee).toBe(10000)
    expect(pro.fee).toBe(8000)
    expect(pro.payout).toBeGreaterThan(free.payout)
  })

  it('commission does not depend on the brand — same rate regardless', () => {
    // computeFee takes only (rate, creatorPro); there is no brand input.
    expect(computeFee(50000, false).fee).toBe(5000)
    expect(computeFee(50000, true).fee).toBe(4000)
  })

  it('formatSGD treats values as cents', () => {
    expect(formatSGD(15000)).toBe('S$150.00')
    expect(formatSGD(1)).toBe('S$0.01')
  })
})

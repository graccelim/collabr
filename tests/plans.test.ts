import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { resolvePlan, proGateResponse, isBetaFreePro } from '@/lib/plans'

const ORIGINAL = process.env.BETA_FREE_PRO
afterAll(() => { process.env.BETA_FREE_PRO = ORIGINAL })

const future = new Date(Date.now() + 7 * 86400_000).toISOString()
const past = new Date(Date.now() - 7 * 86400_000).toISOString()

describe('beta mode (BETA_FREE_PRO)', () => {
  it('defaults ON when unset', () => {
    delete process.env.BETA_FREE_PRO
    expect(isBetaFreePro()).toBe(true)
  })

  it('only the literal string "false" activates paid mode', () => {
    process.env.BETA_FREE_PRO = 'false'
    expect(isBetaFreePro()).toBe(false)
    process.env.BETA_FREE_PRO = 'FALSE' // not the literal — stays beta
    expect(isBetaFreePro()).toBe(true)
    process.env.BETA_FREE_PRO = 'true'
    expect(isBetaFreePro()).toBe(true)
  })

  it('resolves every brand to Pro Beta, even with no row', () => {
    process.env.BETA_FREE_PRO = 'true'
    const plan = resolvePlan(null)
    expect(plan).toMatchObject({ tier: 'pro', isPro: true, label: 'Pro Beta', state: 'beta_free', proReason: 'beta' })
  })

  it('never gates in beta mode', () => {
    process.env.BETA_FREE_PRO = 'true'
    expect(proGateResponse(resolvePlan({ plan: 'free', subscription_status: 'beta_free' }), 'X')).toBeNull()
  })
})

describe('paid mode resolution', () => {
  beforeEach(() => { process.env.BETA_FREE_PRO = 'false' })

  it('new brand (defaults) resolves to Free', () => {
    const plan = resolvePlan({ plan: 'free', subscription_status: 'beta_free' })
    expect(plan.isPro).toBe(false)
    expect(plan.tier).toBe('free')
    expect(plan.label).toBe('Free')
  })

  it('active subscription resolves to Pro', () => {
    const plan = resolvePlan({ plan: 'pro', subscription_status: 'active' })
    expect(plan).toMatchObject({ isPro: true, label: 'Pro', proReason: 'subscription' })
  })

  it('past_due keeps Pro access while Stripe retries', () => {
    const plan = resolvePlan({ plan: 'pro', subscription_status: 'past_due' })
    expect(plan.isPro).toBe(true)
    expect(plan.state).toBe('past_due')
  })

  it('cancelled subscription keeps access until period end', () => {
    const plan = resolvePlan({
      plan: 'pro',
      subscription_status: 'cancelled',
      subscription_current_period_end: future,
    })
    expect(plan.isPro).toBe(true)
    expect(plan.proReason).toBe('cancelled_until_period_end')
  })

  it('cancelled subscription loses access after period end', () => {
    const plan = resolvePlan({
      plan: 'pro',
      subscription_status: 'cancelled',
      subscription_current_period_end: past,
    })
    expect(plan.isPro).toBe(false)
    expect(plan.tier).toBe('free')
  })

  it('grandfathered brand keeps Pro until the grace date', () => {
    const plan = resolvePlan({
      plan: 'free',
      subscription_status: 'beta_free',
      grandfathered_pro_until: future,
    })
    expect(plan.isPro).toBe(true)
    expect(plan.proReason).toBe('grandfathered')
  })

  it('expired grandfathering reverts to Free', () => {
    const plan = resolvePlan({
      plan: 'free',
      subscription_status: 'beta_free',
      grandfathered_pro_until: past,
    })
    expect(plan.isPro).toBe(false)
  })

  it('active subscription wins over grandfathering for proReason', () => {
    const plan = resolvePlan({
      plan: 'pro',
      subscription_status: 'active',
      grandfathered_pro_until: future,
    })
    expect(plan.proReason).toBe('subscription')
  })

  it('proGateResponse returns calm 403 for Free, null for Pro', async () => {
    const free = resolvePlan({ plan: 'free', subscription_status: 'beta_free' })
    const gate = proGateResponse(free, 'Saved creators')
    expect(gate).not.toBeNull()
    expect(gate!.status).toBe(403)
    const body = await gate!.json()
    expect(body.error).toContain('Saved creators')
    expect(body.error).not.toMatch(/\$|\d+\s*\/\s*mo/) // never leaks pricing

    const pro = resolvePlan({ plan: 'pro', subscription_status: 'active' })
    expect(proGateResponse(pro, 'Saved creators')).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { creatorOnboardingSteps, brandOnboardingSteps } from '@/lib/onboarding-steps'

describe('creator onboarding steps', () => {
  it('fresh verified account: step 1 pre-checked, socials is the current step, not ready yet', () => {
    const s = creatorOnboardingSteps({ socialsCount: 0, nicheCount: 0, hasPhoto: false, hasBio: false, hasRates: false, hasPayout: false })
    expect(s.total).toBe(6)
    expect(s.done).toBe(1) // the endowed-progress head start
    expect(s.steps[0]).toMatchObject({ key: 'account', done: true })
    expect(s.current?.key).toBe('socials')
    expect(s.current?.href).toBe('/onboarding')
    expect(s.ready).toBe(false)
  })

  it('one social opens the gate: ready is a STATE (not a step row)', () => {
    const s = creatorOnboardingSteps({ socialsCount: 1, nicheCount: 0, hasPhoto: false, hasBio: false, hasRates: false, hasPayout: false })
    expect(s.steps.find(x => x.key === 'socials')?.done).toBe(true)
    expect(s.steps.some(x => x.key === 'ready')).toBe(false)
    expect(s.ready).toBe(true)
    expect(s.current?.key).toBe('niches')
    // After onboarding the /onboarding page redirects away → niches edit moves
    // to the profile.
    expect(s.current?.href).toBe('/profile')
  })

  it('progress derives from data, so it resumes wherever the user left off', () => {
    const s = creatorOnboardingSteps({ socialsCount: 2, nicheCount: 3, hasPhoto: true, hasBio: false, hasRates: false, hasPayout: false })
    expect(s.done).toBe(3) // account, socials, niches — bio, rates, payout still missing
    expect(s.current?.key).toBe('profile')
  })

  it('the recommended-path steps (rates, payout) continue past the gate', () => {
    const s = creatorOnboardingSteps({ socialsCount: 1, nicheCount: 2, hasPhoto: true, hasBio: true, hasRates: false, hasPayout: false })
    expect(s.done).toBe(4)
    expect(s.current?.key).toBe('rates')
    expect(s.current?.href).toBe('/profile')
  })

  it('payout comes after rates and links to earnings', () => {
    const s = creatorOnboardingSteps({ socialsCount: 1, nicheCount: 2, hasPhoto: true, hasBio: true, hasRates: true, hasPayout: false })
    expect(s.done).toBe(5)
    expect(s.current?.key).toBe('payout')
    expect(s.current?.href).toBe('/earnings')
  })

  it('fully set up: everything done, no current step', () => {
    const s = creatorOnboardingSteps({ socialsCount: 1, nicheCount: 2, hasPhoto: true, hasBio: true, hasRates: true, hasPayout: true })
    expect(s.done).toBe(6)
    expect(s.current).toBeNull()
    expect(s.ready).toBe(true)
  })
})

describe('brand onboarding steps', () => {
  it('fresh verified account: company details is the current step, not ready yet', () => {
    const s = brandOnboardingSteps({ companyBasicsDone: false, hasLogo: false, hasDescription: false, campaignCount: 0 })
    expect(s.total).toBe(4)
    expect(s.done).toBe(1)
    expect(s.current?.key).toBe('company')
    expect(s.current?.href).toBe('/onboarding')
    expect(s.ready).toBe(false)
  })

  it('ready requires company basics AND a posted campaign (the activation event)', () => {
    const gated = brandOnboardingSteps({ companyBasicsDone: true, hasLogo: true, hasDescription: true, campaignCount: 0 })
    expect(gated.ready).toBe(false)
    expect(gated.current?.key).toBe('campaign')

    const active = brandOnboardingSteps({ companyBasicsDone: true, hasLogo: false, hasDescription: false, campaignCount: 1 })
    expect(active.ready).toBe(true)
    expect(active.current?.key).toBe('brand') // polish remains as the next nudge
  })

  it('fully activated brand derives as complete', () => {
    const s = brandOnboardingSteps({ companyBasicsDone: true, hasLogo: true, hasDescription: true, campaignCount: 3 })
    expect(s.done).toBe(4)
    expect(s.current).toBeNull()
    expect(s.ready).toBe(true)
  })
})

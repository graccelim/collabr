import { describe, it, expect } from 'vitest'
import { creatorOnboardingSteps, brandOnboardingSteps } from '@/lib/onboarding-steps'

describe('creator onboarding steps', () => {
  it('fresh verified account: step 1 pre-checked, socials is the current step', () => {
    const s = creatorOnboardingSteps({ socialsCount: 0, nicheCount: 0, hasPhoto: false, hasBio: false, hasRates: false })
    expect(s.total).toBe(6)
    expect(s.done).toBe(1) // the endowed-progress head start
    expect(s.steps[0]).toMatchObject({ key: 'account', done: true })
    expect(s.current?.key).toBe('socials')
    expect(s.current?.href).toBe('/onboarding')
  })

  it('one social flips both the gate step and the ready step', () => {
    const s = creatorOnboardingSteps({ socialsCount: 1, nicheCount: 0, hasPhoto: false, hasBio: false, hasRates: false })
    expect(s.steps.find(x => x.key === 'socials')?.done).toBe(true)
    expect(s.steps.find(x => x.key === 'ready')?.done).toBe(true)
    expect(s.current?.key).toBe('niches')
    // After onboarding the /onboarding page redirects away → niches edit moves
    // to the profile.
    expect(s.current?.href).toBe('/profile')
  })

  it('progress derives from data, so it resumes wherever the user left off', () => {
    const s = creatorOnboardingSteps({ socialsCount: 2, nicheCount: 3, hasPhoto: true, hasBio: false, hasRates: false })
    expect(s.done).toBe(4) // account, socials, niches, ready — bio + rates still missing
    expect(s.current?.key).toBe('profile')
  })

  it('the recommended-path steps (photo/bio, rates) continue past the gate', () => {
    const s = creatorOnboardingSteps({ socialsCount: 1, nicheCount: 2, hasPhoto: true, hasBio: true, hasRates: false })
    expect(s.done).toBe(5)
    expect(s.current?.key).toBe('rates')
    expect(s.current?.href).toBe('/profile')
  })

  it('fully set up: everything done, no current step', () => {
    const s = creatorOnboardingSteps({ socialsCount: 1, nicheCount: 2, hasPhoto: true, hasBio: true, hasRates: true })
    expect(s.done).toBe(6)
    expect(s.current).toBeNull()
  })
})

describe('brand onboarding steps', () => {
  it('fresh verified account: company details is the current step', () => {
    const s = brandOnboardingSteps({ companyBasicsDone: false, hasLogo: false, hasDescription: false, campaignCount: 0 })
    expect(s.done).toBe(1)
    expect(s.current?.key).toBe('company')
    expect(s.current?.href).toBe('/onboarding')
  })

  it('ready requires company basics AND a posted campaign (the activation event)', () => {
    const gated = brandOnboardingSteps({ companyBasicsDone: true, hasLogo: true, hasDescription: true, campaignCount: 0 })
    expect(gated.steps.find(x => x.key === 'ready')?.done).toBe(false)
    expect(gated.current?.key).toBe('campaign')

    const active = brandOnboardingSteps({ companyBasicsDone: true, hasLogo: false, hasDescription: false, campaignCount: 1 })
    expect(active.steps.find(x => x.key === 'ready')?.done).toBe(true)
    expect(active.current?.key).toBe('brand') // polish remains as the next nudge
  })

  it('fully activated brand derives as complete', () => {
    const s = brandOnboardingSteps({ companyBasicsDone: true, hasLogo: true, hasDescription: true, campaignCount: 3 })
    expect(s.done).toBe(5)
    expect(s.current).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { lintAiText, enforceAiText, AiGuardError } from '@/lib/ai/guard'

describe('AI guard — blocks comparison / ranking / guarantees', () => {
  it('passes clean, self-referential, actionable text', () => {
    const ok = 'Your restaurant videos earned more saves than your cafe videos this month. Consider posting more restaurant content.'
    expect(lintAiText(ok).ok).toBe(true)
    expect(enforceAiText(ok)).toBe(ok)
  })

  it('catches percentiles / top X%', () => {
    expect(lintAiText('You are in the top 10% of creators').ok).toBe(false)
    expect(lintAiText('That puts you in the 90th percentile').ok).toBe(false)
  })

  it('catches rankings and cross-creator comparison', () => {
    expect(lintAiText('You rank #3').ok).toBe(false)
    expect(lintAiText('better than most').ok).toBe(false)
    expect(lintAiText('compared to other creators, you do well').ok).toBe(false)
    expect(lintAiText('your engagement is above average').ok).toBe(false)
    expect(lintAiText('higher than the platform average').ok).toBe(false)
  })

  it('catches guarantees and 0–100 scores', () => {
    expect(lintAiText('This guarantees more views').ok).toBe(false)
    expect(lintAiText('Your score is 92/100').ok).toBe(false)
  })

  it('enforceAiText throws AiGuardError on violations', () => {
    expect(() => enforceAiText('You are in the top 5%')).toThrow(AiGuardError)
  })
})

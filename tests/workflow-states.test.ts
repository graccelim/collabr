import { describe, it, expect } from 'vitest'
import { deriveWorkflow, escrowStep } from '@/lib/workflow'

// Coverage for the workflow states the main workflow.test.ts does not exercise:
// draft_approved, live_confirmed, cancelled (refund wording), and the 5-step
// escrow scale used by list rows.

const base = { isBrand: false, counterpartName: 'Glow Works' }

describe('deriveWorkflow - remaining states', () => {
  it('draft_approved → creator posts live, not frozen', () => {
    const v = deriveWorkflow({ ...base, status: 'draft_approved', paymentStatus: 'funded' })
    expect(v.actor).toBe('creator')
    expect(v.frozen).toBe(false)
    expect(v.happened).toMatch(/approved/i)
  })

  it('live_confirmed → platform settling, paid wording mentions Stripe transfer', () => {
    const v = deriveWorkflow({ ...base, status: 'live_confirmed', paymentStatus: 'captured' })
    expect(v.actor).toBe('platform')
    expect(v.next).toMatch(/settl|capture|transfer/i)
  })

  it('live_confirmed barter → wraps up without payment language', () => {
    const v = deriveWorkflow({ ...base, status: 'live_confirmed', paymentStatus: 'funded', isBarter: true })
    expect(v.next).not.toMatch(/stripe|capture|transfer/i)
  })

  it('cancelled + refunded → funds already returned to brand (past tense)', () => {
    const v = deriveWorkflow({ ...base, status: 'cancelled', paymentStatus: 'refunded' })
    expect(v.frozen).toBe(true)
    expect(v.actor).toBe('none')
    expect(v.next).toMatch(/returned to the brand/i)
  })

  it('cancelled + still-held → funds being returned (present tense)', () => {
    const v = deriveWorkflow({ ...base, status: 'cancelled', paymentStatus: 'funded' })
    expect(v.next).toMatch(/being returned to the brand/i)
  })

  it('cancelled barter → just ends, no funds language', () => {
    const v = deriveWorkflow({ ...base, status: 'cancelled', paymentStatus: 'funded', isBarter: true })
    expect(v.next).not.toMatch(/funds|brand/i)
    expect(v.next).toMatch(/ended/i)
  })

  it('completed but not yet paid → not marked paid in copy', () => {
    const v = deriveWorkflow({ ...base, status: 'completed', paymentStatus: 'captured' })
    expect(v.frozen).toBe(true)
    expect(v.happened).not.toMatch(/payment was released/i)
  })
})

describe('escrowStep - 5-step list scale', () => {
  it('maps each lifecycle stage to its track position', () => {
    expect(escrowStep('briefed', 'unfunded')).toBe(0)
    expect(escrowStep('briefed', 'funded')).toBe(1)
    expect(escrowStep('draft_submitted', 'funded')).toBe(2)
    expect(escrowStep('in_revision', 'funded')).toBe(2)
    expect(escrowStep('draft_approved', 'funded')).toBe(3)
    expect(escrowStep('live_submitted', 'funded')).toBe(4)
    expect(escrowStep('live_confirmed', 'captured')).toBe(4)
    expect(escrowStep('completed', 'paid')).toBe(5)
    expect(escrowStep('completed', 'captured')).toBe(4) // completed but money not out yet
    expect(escrowStep('disputed', 'funded')).toBe(2)
  })

  it('treats manual_exception (barter) completion as fully released', () => {
    expect(escrowStep('completed', 'manual_exception')).toBe(5)
  })
})

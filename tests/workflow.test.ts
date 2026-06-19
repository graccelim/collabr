import { describe, it, expect } from 'vitest'
import { deriveWorkflow, actorLabel } from '@/lib/workflow'

const base = { isBrand: false, counterpartName: 'Glow Works' }

describe('deriveWorkflow - barter has no escrow/payment language', () => {
  const ESCROW_WORDS = /escrow|payment secured|release payment|payout|locked in|funds|capture/i
  const states: { status: string; paymentStatus: string }[] = [
    { status: 'briefed', paymentStatus: 'funded' },
    { status: 'draft_submitted', paymentStatus: 'funded' },
    { status: 'draft_approved', paymentStatus: 'funded' },
    { status: 'live_submitted', paymentStatus: 'funded' },
    { status: 'live_confirmed', paymentStatus: 'funded' },
    { status: 'completed', paymentStatus: 'manual_exception' },
  ]
  it('uses plain step labels (Confirmed / Collaboration active / Completed)', () => {
    const v = deriveWorkflow({ ...base, status: 'briefed', paymentStatus: 'funded', isBarter: true })
    const labels = v.steps.map(s => s.label)
    expect(labels).toContain('Confirmed')
    expect(labels).toContain('Collaboration active')
    expect(labels).toContain('Completed')
    expect(labels).not.toContain('Escrow funded')
    expect(labels).not.toContain('Payment released')
  })
  it('never surfaces escrow/payment words across states (both roles)', () => {
    for (const s of states) {
      for (const isBrand of [true, false]) {
        const v = deriveWorkflow({ ...base, ...s, isBrand, isBarter: true })
        expect(`${v.happened} ${v.next}`).not.toMatch(ESCROW_WORDS)
        expect(v.steps.map(l => l.label).join(' ')).not.toMatch(ESCROW_WORDS)
      }
    }
  })
  it('paid collabs still use escrow language (regression guard)', () => {
    const v = deriveWorkflow({ ...base, status: 'briefed', paymentStatus: 'funded', isBrand: false })
    expect(v.steps.map(s => s.label)).toContain('Escrow funded')
  })
})

describe('deriveWorkflow - stage and actor derivation', () => {
  it('briefed + unfunded → brand must fund escrow', () => {
    const v = deriveWorkflow({ ...base, status: 'briefed', paymentStatus: 'unfunded' })
    expect(v.actor).toBe('brand')
    expect(v.steps.find(s => s.key === 'funded')?.state).toBe('current')
    expect(v.frozen).toBe(false)
  })

  it('briefed + funded → creator must submit a draft', () => {
    const v = deriveWorkflow({ ...base, status: 'briefed', paymentStatus: 'funded' })
    expect(v.actor).toBe('creator')
    expect(v.steps.find(s => s.key === 'funded')?.state).toBe('done')
  })

  it('draft_submitted → brand reviews, 48h auto-approve deadline surfaces', () => {
    const deadline = '2026-06-14T10:00:00Z'
    const v = deriveWorkflow({
      ...base, status: 'draft_submitted', paymentStatus: 'funded',
      draftAutoApproveAt: deadline,
    })
    expect(v.actor).toBe('brand')
    expect(v.deadline).toBe(deadline)
    expect(v.next).toContain('48 hours')
  })

  it('in_revision → creator acts, remaining revisions counted from cap of 2', () => {
    const v1 = deriveWorkflow({ ...base, status: 'in_revision', paymentStatus: 'funded', revisionCount: 1 })
    expect(v1.actor).toBe('creator')
    expect(v1.next).toContain('1 revision remaining')

    const v0 = deriveWorkflow({ ...base, status: 'in_revision', paymentStatus: 'funded', revisionCount: 2 })
    expect(v0.next).toContain('0 revisions remaining')
  })

  it('live_submitted → brand confirms, 72h auto-release deadline surfaces', () => {
    const deadline = '2026-06-15T10:00:00Z'
    const v = deriveWorkflow({
      ...base, status: 'live_submitted', paymentStatus: 'funded',
      liveAutoReleaseAt: deadline,
    })
    expect(v.actor).toBe('brand')
    expect(v.deadline).toBe(deadline)
    expect(v.next).toContain('72 hours')
  })

  it('completed + paid → all steps done, terminal', () => {
    const v = deriveWorkflow({ ...base, status: 'completed', paymentStatus: 'paid' })
    expect(v.frozen).toBe(true)
    expect(v.actor).toBe('none')
    expect(v.steps.every(s => s.state !== 'current')).toBe(true)
    expect(v.steps.find(s => s.key === 'completed')?.state).toBe('done')
  })

  it('disputed → frozen, platform acts', () => {
    const v = deriveWorkflow({ ...base, status: 'disputed', paymentStatus: 'funded' })
    expect(v.frozen).toBe(true)
    expect(v.actor).toBe('platform')
  })
})

describe('actorLabel - "your turn" derivation', () => {
  it('marks the acting side as "Your turn" and the other as waiting', () => {
    const v = deriveWorkflow({ ...base, status: 'briefed', paymentStatus: 'unfunded' }) // brand acts
    expect(actorLabel(v, true, 'Sara Reyes')).toEqual({ label: 'Your turn', yourTurn: true })
    expect(actorLabel(v, false, 'Glow Works')).toEqual({ label: 'Waiting on Glow', yourTurn: false })
  })

  it('platform processing is never anyone\'s turn', () => {
    const v = deriveWorkflow({ ...base, status: 'disputed', paymentStatus: 'funded' })
    expect(actorLabel(v, true, 'X').yourTurn).toBe(false)
    expect(actorLabel(v, false, 'X').yourTurn).toBe(false)
  })
})

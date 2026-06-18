import { describe, it, expect } from 'vitest'
import {
  isPaymentSecured,
  consumesSpot,
  remainingSpots,
  isCampaignFilled,
  creatorApplicationState,
  CREATOR_APP_LABEL,
  requiresExpectedRate,
} from '@/lib/collab-status'
import { isUuid } from '@/lib/slug'

// Helpers to build collab-ish rows tersely.
const funded = (over = {}) => ({ status: 'draft_submitted', payment_status: 'funded', ...over })
const unfunded = (over = {}) => ({ status: 'briefed', payment_status: 'unfunded', ...over })
const cancelled = (over = {}) => ({ status: 'cancelled', payment_status: 'cancelled', ...over })

describe('payment secured gate', () => {
  it('treats funded and everything past it as secured', () => {
    for (const s of ['funded', 'capture_pending', 'captured', 'transfer_pending', 'paid', 'manual_exception']) {
      expect(isPaymentSecured(s)).toBe(true)
    }
  })
  it('treats pre-funding / failed / cancelled / null as NOT secured', () => {
    for (const s of ['unfunded', 'authorizing', 'cancelled', 'refunded', 'capture_failed', null, undefined]) {
      expect(isPaymentSecured(s as any)).toBe(false)
    }
  })
})

describe('creator never sees selected/unfunded — only Applied vs Confirmed', () => {
  it('shortlist stays invisible: shortlisted reads as Applied', () => {
    expect(creatorApplicationState('shortlisted', null)).toBe('applied')
  })
  it('pending reads as Applied', () => {
    expect(creatorApplicationState('pending', null)).toBe('applied')
  })
  it('selected but UNFUNDED reads as Applied (no leak)', () => {
    expect(creatorApplicationState('selected', unfunded())).toBe('applied')
  })
  it('selected and FUNDED reads as Confirmed', () => {
    expect(creatorApplicationState('selected', funded())).toBe('confirmed')
    expect(CREATOR_APP_LABEL.confirmed).toBe('Confirmed · Payment Secured')
  })
  it('rejected reads as Rejected', () => {
    expect(creatorApplicationState('rejected', null)).toBe('rejected')
  })
  it('a cancelled collab does not turn selected into Confirmed', () => {
    expect(creatorApplicationState('selected', cancelled())).toBe('applied')
  })
})

describe('spots: only funded creators consume capacity', () => {
  it('a funded, non-cancelled collab consumes a spot; unfunded/cancelled do not', () => {
    expect(consumesSpot(funded())).toBe(true)
    expect(consumesSpot(unfunded())).toBe(false)
    expect(consumesSpot(cancelled())).toBe(false)
    expect(consumesSpot({ status: 'cancelled', payment_status: 'funded' })).toBe(false) // cancelled wins
  })

  it('remaining = creators_needed − funded collabs (pending/shortlisted/unfunded/cancelled ignored)', () => {
    // 3 spots: one funded, one selected-unfunded, one cancelled → 2 left.
    expect(remainingSpots(3, [funded(), unfunded(), cancelled()])).toBe(2)
    // No collabs at all → all spots remain.
    expect(remainingSpots(3, [])).toBe(3)
    // Two funded for a 2-spot campaign → 0 left, never negative.
    expect(remainingSpots(2, [funded(), funded(), funded()])).toBe(0)
  })

  it('isCampaignFilled is true only when funded collabs reach creators_needed', () => {
    expect(isCampaignFilled(1, [unfunded()])).toBe(false)   // selected, not funded → not filled
    expect(isCampaignFilled(1, [funded()])).toBe(true)
    expect(isCampaignFilled(2, [funded(), cancelled()])).toBe(false) // cancelled doesn't count
  })
})

describe('application rate rules', () => {
  it('paid (and both) require an expected rate; barter does not', () => {
    expect(requiresExpectedRate('paid')).toBe(true)
    expect(requiresExpectedRate('both')).toBe(true)
    expect(requiresExpectedRate('barter')).toBe(false)
    expect(requiresExpectedRate(null)).toBe(false)
  })
})

describe('slug/uuid routing still resolves', () => {
  it('distinguishes a UUID from a slug', () => {
    expect(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true)
    expect(isUuid('tiktok-food-review-wild-coco')).toBe(false)
  })
})

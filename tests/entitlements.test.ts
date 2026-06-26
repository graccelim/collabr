import { describe, it, expect } from 'vitest'
import {
  proState,
  isProActive,
  shouldSyncAccount,
  canUseStudio,
  studioAccess,
  stripeStatusToPro,
} from '@/lib/entitlements'

const NOW = new Date('2026-06-25T00:00:00Z')
const future = '2026-09-01T00:00:00Z'
const past = '2026-02-18T00:00:00Z' // 127 days before NOW (the spec's stale example)

describe('proState — access while subscribed', () => {
  it('active within period → unlocked, not frozen', () => {
    expect(proState({ status: 'active', pro_until: future }, NOW)).toMatchObject({ active: true, frozen: false })
  })
  it('trialing within period → unlocked', () => {
    expect(isProActive({ status: 'trialing', pro_until: future }, NOW)).toBe(true)
  })
  it('past_due but still within period → access kept (grace)', () => {
    expect(isProActive({ status: 'past_due', pro_until: future }, NOW)).toBe(true)
  })
  it('active with no pro_until set → treated as in-period (unlocked)', () => {
    expect(isProActive({ status: 'active', pro_until: null }, NOW)).toBe(true)
  })
})

describe('proState — expiry FREEZES (never deletes)', () => {
  it('canceled → frozen, not active', () => {
    expect(proState({ status: 'canceled', pro_until: past }, NOW)).toMatchObject({ active: false, frozen: true })
  })
  it('expired → frozen', () => {
    expect(proState({ status: 'expired', pro_until: past }, NOW)).toMatchObject({ active: false, frozen: true })
  })
  it('access status whose period elapsed (webhook not caught up) → frozen', () => {
    expect(proState({ status: 'active', pro_until: past }, NOW)).toMatchObject({ active: false, frozen: true })
  })
  it('frozen creators stop syncing and cannot open Studio', () => {
    const lapsed = { status: 'canceled' as const, pro_until: past }
    expect(shouldSyncAccount(lapsed, NOW)).toBe(false)
    expect(canUseStudio(lapsed, NOW)).toBe(false)
  })
})

describe('proState — never-subscribed', () => {
  it('none / null row → not active, not frozen (no badge, no stale state)', () => {
    expect(proState({ status: 'none', pro_until: null }, NOW)).toMatchObject({ active: false, frozen: false })
    expect(proState(null, NOW)).toMatchObject({ status: 'none', active: false, frozen: false })
  })
})

describe('studioAccess — full / read-only / locked', () => {
  it('active Pro → full', () => {
    expect(studioAccess({ status: 'active', pro_until: future }, NOW)).toBe('full')
  })
  it('lapsed Pro (canceled/expired) → read_only (history kept, badge stays)', () => {
    expect(studioAccess({ status: 'canceled', pro_until: past }, NOW)).toBe('read_only')
    expect(studioAccess({ status: 'expired', pro_until: past }, NOW)).toBe('read_only')
  })
  it('never subscribed → locked', () => {
    expect(studioAccess({ status: 'none', pro_until: null }, NOW)).toBe('locked')
    expect(studioAccess(null, NOW)).toBe('locked')
  })
})

describe('renewal resumes access', () => {
  it('a frozen creator who renews (active, future period) is unlocked again', () => {
    expect(isProActive({ status: 'expired', pro_until: past }, NOW)).toBe(false)
    expect(isProActive({ status: 'active', pro_until: future }, NOW)).toBe(true)
  })
})

describe('stripeStatusToPro mapping', () => {
  it('maps Stripe statuses to our pro_status', () => {
    expect(stripeStatusToPro('trialing')).toBe('trialing')
    expect(stripeStatusToPro('active')).toBe('active')
    expect(stripeStatusToPro('past_due')).toBe('past_due')
    expect(stripeStatusToPro('canceled')).toBe('canceled')
    expect(stripeStatusToPro('unpaid')).toBe('expired')
    expect(stripeStatusToPro('incomplete_expired')).toBe('expired')
    expect(stripeStatusToPro('incomplete')).toBe('none')
    expect(stripeStatusToPro('something_new')).toBe('none')
  })
  it('only access-granting statuses unlock features', () => {
    expect(isProActive({ status: stripeStatusToPro('active'), pro_until: future }, NOW)).toBe(true)
    expect(isProActive({ status: stripeStatusToPro('unpaid'), pro_until: future }, NOW)).toBe(false)
  })
})

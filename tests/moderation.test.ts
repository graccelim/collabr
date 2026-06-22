import { describe, it, expect } from 'vitest'
import { detectContactInfo } from '@/lib/moderation'

// Contact-info detection gates collab chat (flag → not delivered) and review
// notes (block unless the only reason is a bare @handle). It is safety-critical
// for keeping deals on-platform, so pin every detector and the cross-rule
// de-duplication that stops an email from also tripping phone/handle.

describe('detectContactInfo - individual detectors', () => {
  it('flags email addresses', () => {
    const r = detectContactInfo('reach me at sam@example.com')
    expect(r.flagged).toBe(true)
    expect(r.reasons).toContain('email address')
  })

  it('flags Singapore mobile numbers (8/9 prefix, with or without +65)', () => {
    expect(detectContactInfo('9123 4567').reasons).toContain('phone number')
    expect(detectContactInfo('call +65 8123-4567').reasons).toContain('phone number')
  })

  it('flags a long generic digit run as a phone number', () => {
    // 9+ digits → LONG_DIGITS, even when it does not start 8/9.
    expect(detectContactInfo('123 456 789').reasons).toContain('phone number')
  })

  it('does NOT treat a short 8-digit non-mobile run as a phone number', () => {
    // 8 digits not starting 8/9 trips neither SG_PHONE nor LONG_DIGITS (needs 9).
    const r = detectContactInfo('order 12345670 shipped')
    expect(r.reasons).not.toContain('phone number')
  })

  it('flags named off-platform apps', () => {
    for (const t of ['move to whatsapp', 'my telegram', 't.me/handle', 'wechat me', 'snapchat']) {
      expect(detectContactInfo(t).reasons, t).toContain('off-platform app')
    }
  })

  it('flags contact solicitation phrasing', () => {
    for (const t of ['dm me', 'message me on', 'reach me at', 'add me on', 'find me on']) {
      expect(detectContactInfo(t).reasons, t).toContain('contact solicitation')
    }
  })

  it('flags a bare @handle of 3+ chars', () => {
    expect(detectContactInfo('follow @studio.collab').reasons).toContain('social handle')
    // too short → not a handle
    expect(detectContactInfo('rated it @ 5 stars').reasons).not.toContain('social handle')
  })

  it('passes clean collaboration talk', () => {
    const r = detectContactInfo('Loved working with you, the brief was clear!')
    expect(r.flagged).toBe(false)
    expect(r.reasons).toEqual([])
  })
})

describe('detectContactInfo - cross-rule hygiene', () => {
  it('does not double-count an email as a social handle or phone', () => {
    // The "@" and digits inside an email are stripped before other detectors run.
    const r = detectContactInfo('x123@y.com')
    expect(r.reasons).toEqual(['email address'])
  })

  it('de-duplicates repeated reasons', () => {
    const r = detectContactInfo('email a@b.com and also c@d.com')
    expect(r.reasons.filter(x => x === 'email address')).toHaveLength(1)
  })

  it('reports multiple distinct reasons together', () => {
    const r = detectContactInfo('reach me at sam@example.com')
    expect(new Set(r.reasons)).toEqual(new Set(['email address', 'contact solicitation']))
  })
})

describe('review-note policy: bare @handle allowed, real contact blocked', () => {
  // Mirrors app/api/reviews/route.ts which filters out 'social handle' and only
  // blocks when other reasons remain.
  const reviewBlocked = (note: string) =>
    detectContactInfo(note).reasons.filter(r => r !== 'social handle').length > 0

  it('allows a review that only mentions a handle', () => {
    expect(reviewBlocked('Amazing creator, check @theirstudio')).toBe(false)
  })

  it('blocks a review that leaks an email or phone', () => {
    expect(reviewBlocked('great, email me a@b.com')).toBe(true)
    expect(reviewBlocked('text 9123 4567 to rebook')).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { productEmails } from '@/lib/email'

describe('new notification email templates', () => {
  it('liveReviewReminder dedupes per threshold and names the hours', () => {
    const e6 = productEmails.liveReviewReminder({ creatorName: 'Andy', collabId: 'c1', hoursLeft: 6 })
    const e24 = productEmails.liveReviewReminder({ creatorName: 'Andy', collabId: 'c1', hoursLeft: 24 })
    expect(e6.dedupeKey).toContain(':live-remind:6h')
    expect(e24.dedupeKey).toContain(':live-remind:24h')
    expect(e6.subject).toMatch(/6h/)
    expect(e6.ctaUrl).toContain('/collabs/c1')
  })

  it('reviewReceived dedupes per recipient', () => {
    const e = productEmails.reviewReceived({ collabId: 'c1', recipientId: 'u1' })
    expect(e.dedupeKey).toBe('email:collab:c1:review-received:u1')
    expect(e.subject).toMatch(/review/i)
  })

  it('disputeEvidenceAdded is unique per evidence + recipient (so each fires once)', () => {
    const a = productEmails.disputeEvidenceAdded({ collabId: 'c1', disputeId: 'd1', evidenceId: 'ev1', recipientId: 'u1' })
    const b = productEmails.disputeEvidenceAdded({ collabId: 'c1', disputeId: 'd1', evidenceId: 'ev2', recipientId: 'u1' })
    expect(a.dedupeKey).not.toBe(b.dedupeKey)
    expect(a.dedupeKey).toContain('ev1')
  })

  it('disputeResolved surfaces the outcome', () => {
    const e = productEmails.disputeResolved({ collabId: 'c1', disputeId: 'd1', outcomeLabel: 'Creator wins', recipientId: 'u1' })
    expect(e.subject).toMatch(/Creator wins/)
    expect(e.dedupeKey).toContain(':resolved:u1')
  })
})

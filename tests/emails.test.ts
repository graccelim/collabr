import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mutable mock state for the admin client (hoisted so the vi.mock factory below
// can reference it). Lets each test control the email_log insert result + the
// resolved recipient email.
const state = vi.hoisted(() => ({
  insertError: null as { code?: string } | null,
  userEmail: 'recipient@example.com' as string | null,
  insertCalls: 0,
}))

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      insert: (_row: unknown) => {
        state.insertCalls++
        return Promise.resolve({ error: state.insertError })
      },
      select: (_cols: string) => ({
        eq: (_c: string, _v: string) => ({
          single: () => Promise.resolve({ data: state.userEmail ? { email: state.userEmail } : null }),
        }),
      }),
    }),
  }),
}))

// No network: stub Resend so even a stray API key can't send.
const resendSend = vi.fn(async () => ({ error: null }))
vi.mock('resend', () => ({ Resend: class { emails = { send: resendSend } } }))

import { productEmails, renderEmail, link, sendProductEmail } from '@/lib/email'

const APP = 'https://app.collabr.test'

beforeEach(() => {
  state.insertError = null
  state.userEmail = 'recipient@example.com'
  state.insertCalls = 0
  resendSend.mockClear()
  // Present so the send path runs (Resend is mocked → no network).
  process.env.RESEND_API_KEY = 're_test_dummy'
})

describe('link()', () => {
  it('builds absolute URLs from NEXT_PUBLIC_APP_URL', () => {
    expect(link('/earnings')).toBe(`${APP}/earnings`)
    expect(link('applications')).toBe(`${APP}/applications`)
  })
})

describe('product email payload creation', () => {
  it('new application (brand) → subject, CTA to the campaign, stable dedupe key', () => {
    const e = productEmails.newApplication({ campaignTitle: 'Launch serum', applicationId: 'app1', campaignId: 'camp1' })
    expect(e.subject).toContain('Launch serum')
    expect(e.ctaUrl).toBe(`${APP}/campaigns/camp1`)
    expect(e.dedupeKey).toBe('email:application:app1:brand-new')
    expect(e.type).toBe('product')
  })

  it('application submitted (creator) confirmation', () => {
    const e = productEmails.applicationSubmitted({ campaignTitle: 'Launch serum', applicationId: 'app1' })
    expect(e.ctaUrl).toBe(`${APP}/applications`)
    expect(e.dedupeKey).toBe('email:application:app1:creator-confirm')
  })

  it('application selected / rejected have distinct keys', () => {
    const sel = productEmails.applicationSelected({ campaignTitle: 'X', applicationId: 'app1', collabId: 'c1' })
    const rej = productEmails.applicationRejected({ campaignTitle: 'X', applicationId: 'app1' })
    expect(sel.ctaUrl).toBe(`${APP}/collabs/c1`)
    expect(sel.dedupeKey).toBe('email:application:app1:selected')
    expect(rej.ctaUrl).toBe(`${APP}/jobs`)
    expect(rej.dedupeKey).toBe('email:application:app1:rejected')
    expect(sel.dedupeKey).not.toBe(rej.dedupeKey)
  })

  it('invite received / accepted', () => {
    const recv = productEmails.inviteReceived({ brandName: 'Glow', campaignTitle: 'Serum', inviteId: 'i1' })
    const acc = productEmails.inviteAccepted({ creatorName: 'Maya', collabId: 'c1', inviteId: 'i1' })
    expect(recv.ctaUrl).toBe(`${APP}/invites`)
    expect(recv.dedupeKey).toBe('email:invite:i1:received')
    expect(acc.ctaUrl).toBe(`${APP}/collabs/c1`)
    expect(acc.dedupeKey).toBe('email:invite:i1:accepted')
  })

  it('draft submitted / approved / revision keyed per submission so each is sent once', () => {
    const sub = productEmails.draftSubmitted({ creatorName: 'Maya', collabId: 'c1', key: '2' })
    const app = productEmails.draftApproved({ collabId: 'c1', key: 'sub9' })
    const rev = productEmails.revisionRequested({ collabId: 'c1', key: 'sub9' })
    expect(sub.dedupeKey).toBe('email:collab:c1:draft-submitted:2')
    expect(app.dedupeKey).toBe('email:collab:c1:draft-approved:sub9')
    expect(rev.dedupeKey).toBe('email:collab:c1:revision:sub9')
    expect(app.ctaUrl).toBe(`${APP}/collabs/c1`)
  })

  it('live submitted / payment released / collab completed', () => {
    const live = productEmails.liveSubmitted({ creatorName: 'Maya', collabId: 'c1' })
    const pay = productEmails.paymentReleased({ amount: 'S$220.00', collabId: 'c1' })
    const done = productEmails.collabCompletedBrand({ creatorName: 'Maya', amount: 'S$220.00', collabId: 'c1' })
    expect(live.dedupeKey).toBe('email:collab:c1:live-submitted')
    expect(pay.ctaUrl).toBe(`${APP}/earnings`)
    expect(pay.dedupeKey).toBe('email:collab:c1:payment-released')
    expect(done.subject).toContain('S$220.00')
    expect(done.dedupeKey).toBe('email:collab:c1:completed-brand')
  })

  it('dispute / message dedupe keys include the recipient (one email per party)', () => {
    const a = productEmails.disputeOpened({ collabId: 'c1', disputeId: 'd1', recipientId: 'userA' })
    const b = productEmails.disputeOpened({ collabId: 'c1', disputeId: 'd1', recipientId: 'userB' })
    expect(a.dedupeKey).toBe('email:collab:c1:dispute:d1:userA')
    expect(b.dedupeKey).toBe('email:collab:c1:dispute:d1:userB')
    expect(a.dedupeKey).not.toBe(b.dedupeKey)

    const m1 = productEmails.newMessage({ fromName: 'Maya', collabId: 'c1', messageId: 'm1', recipientId: 'userA' })
    expect(m1.dedupeKey).toBe('email:message:m1:userA')
    expect(m1.ctaUrl).toBe(`${APP}/collabs/c1`)
  })

  it('held-payout fallback emails (creator reminder / review, brand held)', () => {
    const rem = productEmails.payoutReminder({ amount: 'S$220.00', collabId: 'c1', key: '2026-06-19' })
    const rev = productEmails.payoutUnderReview({ amount: 'S$220.00', collabId: 'c1' })
    const held = productEmails.payoutHeldBrand({ creatorName: 'Maya', collabId: 'c1' })
    // Reminder key rotates by date so each scheduled nudge sends once.
    expect(rem.dedupeKey).toBe('email:collab:c1:payout-reminder:2026-06-19')
    expect(rem.ctaUrl).toBe(`${APP}/earnings`)
    expect(rev.dedupeKey).toBe('email:collab:c1:payout-review')
    expect(rev.ctaUrl).toBe(`${APP}/earnings`)
    expect(held.dedupeKey).toBe('email:collab:c1:payout-held-brand')
    expect(held.ctaUrl).toBe(`${APP}/collabs/c1`)
    expect(held.subject.length).toBeGreaterThan(0)
  })

  it('draft auto-approve email is keyed once per collab and CTAs to the collab', () => {
    const e = productEmails.draftAutoApproved({ collabId: 'c1' })
    expect(e.dedupeKey).toBe('email:collab:c1:draft-auto-approved')
    expect(e.ctaUrl).toBe(`${APP}/collabs/c1`)
    expect(e.subject.toLowerCase()).toContain('auto-approved')
  })

  it('brand draft auto-approve email: distinct dedupe key + exact body copy', () => {
    const e = productEmails.draftAutoApprovedBrand({ collabId: 'c1' })
    expect(e.dedupeKey).toBe('email:collab:c1:draft-auto-approved:brand')
    // distinct from the creator-facing one so both can send
    expect(e.dedupeKey).not.toBe(productEmails.draftAutoApproved({ collabId: 'c1' }).dedupeKey)
    expect(e.body).toBe("A creator's draft was automatically approved because the review window ended. The collaboration can now continue to the live-post stage.")
    expect(e.ctaUrl).toBe(`${APP}/collabs/c1`)
  })

  it('every builder yields a non-empty title, body, and CTA label', () => {
    const samples = [
      productEmails.newApplication({ campaignTitle: 'X', applicationId: 'a', campaignId: 'c' }),
      productEmails.applicationSelected({ campaignTitle: 'X', applicationId: 'a' }),
      productEmails.paymentReleased({ amount: 'S$1', collabId: 'c' }),
      productEmails.newMessage({ fromName: 'Y', collabId: 'c', messageId: 'm', recipientId: 'u' }),
    ]
    for (const e of samples) {
      expect(e.title.length).toBeGreaterThan(0)
      expect(e.body.length).toBeGreaterThan(0)
      expect(e.ctaLabel.length).toBeGreaterThan(0)
      expect(e.ctaUrl.startsWith('http')).toBe(true)
    }
  })
})

describe('renderEmail layout', () => {
  it('includes title, body, CTA href + label, preheader, and footer', () => {
    const html = renderEmail({
      preheader: 'Pre header text',
      title: 'Confirm your email',
      body: 'Short body copy here.',
      ctaLabel: 'Confirm email',
      ctaUrl: 'https://app.collabr.test/x',
    })
    expect(html).toContain('Confirm your email')
    expect(html).toContain('Short body copy here.')
    expect(html).toContain('Confirm email')
    expect(html).toContain('href="https://app.collabr.test/x"')
    expect(html).toContain('Pre header text')
    expect(html).toContain('collabr') // brand mark
    expect(html).toContain('payment protection') // footer tagline
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('escapes HTML in user-provided strings', () => {
    const html = renderEmail({ title: 'A <b>x</b>', body: 'b & c', ctaLabel: 'Go', ctaUrl: 'https://x' })
    expect(html).toContain('A &lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('b &amp; c')
  })
})

describe('sendProductEmail dedupe behaviour', () => {
  const payload = productEmails.paymentReleased({ amount: 'S$220.00', collabId: 'c1' })

  it('sends when the dedupe key is fresh', async () => {
    state.insertError = null
    const result = await sendProductEmail({ to: 'a@example.com', ...payload })
    expect(result).toBe('sent')
    expect(state.insertCalls).toBe(1)
    expect(resendSend).toHaveBeenCalledTimes(1)
  })

  it('skips (duplicate) when the dedupe key already exists (23505)', async () => {
    state.insertError = { code: '23505' }
    const result = await sendProductEmail({ to: 'a@example.com', ...payload })
    expect(result).toBe('duplicate')
    expect(resendSend).not.toHaveBeenCalled()
  })

  it('resolves the recipient from userId when no address is given', async () => {
    state.insertError = null
    state.userEmail = 'fromuser@example.com'
    const result = await sendProductEmail({ userId: 'user1', ...payload })
    expect(result).toBe('sent')
  })

  it('skips gracefully when there is no recipient', async () => {
    state.userEmail = null
    const result = await sendProductEmail({ userId: 'userX', ...payload })
    expect(result).toBe('skipped')
    // never reached the dedupe insert
    expect(state.insertCalls).toBe(0)
  })
})

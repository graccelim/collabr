import { Resend } from 'resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function sendEmail({
  to, subject, html,
}: {
  to: string
  subject: string
  html: string
}) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  if (!key) {
    console.log(`[EMAIL] No RESEND_API_KEY — skipping send to ${to}: ${subject}`)
    return
  }

  const resend = new Resend(key)
  const { error } = await resend.emails.send({
    from: `collabr. <${from}>`,
    to,
    subject,
    html,
  })
  if (error) {
    console.error('[EMAIL ERROR]', error)
  }
}

export const emails = {
  welcomeCreator: (name: string, email: string) =>
    sendEmail({
      to: email,
      subject: "You're in — set up your profile to get your first collab",
      html: `<p>Hey ${name},</p>
<p>Welcome to collabr. — you're one of our founding creators.</p>
<p>Complete your profile to unlock the Verified badge and start getting selected by brands.</p>
<p><a href="${APP_URL}/profile">Set up your profile →</a></p>`,
    }),

  welcomeBrand: (name: string, email: string) =>
    sendEmail({
      to: email,
      subject: 'Your first campaign is waiting — post it in 5 minutes',
      html: `<p>Hey ${name},</p>
<p>You're on collabr. — post your first campaign brief and start receiving creator applications within 48 hours.</p>
<p>During beta, posting campaigns is free.</p>
<p><a href="${APP_URL}/post-job">Post a campaign →</a></p>`,
    }),

  draftSubmitted: (brandEmail: string, creatorName: string, collabId: string) =>
    sendEmail({
      to: brandEmail,
      subject: `Draft submitted by ${creatorName} — review it now (48h window)`,
      html: `<p>${creatorName} has submitted their draft. You have 48 hours to approve, request revisions, or reject. After 48 hours it auto-approves.</p>
<p><a href="${APP_URL}/collabs/${collabId}">Review draft →</a></p>`,
    }),

  draftApproved: (creatorEmail: string, collabId: string) =>
    sendEmail({
      to: creatorEmail,
      subject: 'Draft approved — post live and submit your link',
      html: `<p>Your draft has been approved. Post your content publicly, then return to submit your live post link to release payment.</p>
<p><a href="${APP_URL}/collabs/${collabId}">Submit live link →</a></p>`,
    }),

  revisionRequested: (creatorEmail: string, collabId: string) =>
    sendEmail({
      to: creatorEmail,
      subject: 'Revision requested — feedback is ready',
      html: `<p>The brand has requested a revision. Check the feedback and resubmit your updated draft.</p>
<p><a href="${APP_URL}/collabs/${collabId}">View feedback →</a></p>`,
    }),

  liveSubmitted: (brandEmail: string, creatorName: string, collabId: string) =>
    sendEmail({
      to: brandEmail,
      subject: `${creatorName} posted live — confirm to release payment (72h)`,
      html: `<p>${creatorName} has posted live and submitted their link. Verify the post and confirm to settle payment. You have 72 hours — after that Collabr automatically attempts capture and creator payout.</p>
<p><a href="${APP_URL}/collabs/${collabId}">Confirm live post →</a></p>`,
    }),

  paymentReleased: (creatorEmail: string, amount: string) =>
    sendEmail({
      to: creatorEmail,
      subject: `Your ${amount} is on the way`,
      html: `<p>Your payment of ${amount} has been released and is on its way to your account. It usually arrives within 1–2 business days.</p>
<p><a href="${APP_URL}/earnings">View earnings →</a></p>`,
    }),

  disputeRaised: (email: string, collabId: string) =>
    sendEmail({
      to: email,
      subject: 'A dispute has been raised — submit your evidence',
      html: `<p>A dispute has been raised on a recent collaboration. Please submit your evidence within 48 hours. The platform will mediate and resolve within 3 business days.</p>
<p><a href="${APP_URL}/collabs/${collabId}">View dispute →</a></p>`,
    }),
}

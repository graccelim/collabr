import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')

/** Absolute app URL for a path - all CTAs use NEXT_PUBLIC_APP_URL. */
export function link(path: string): string {
  return `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`
}

// ── Low-level send (graceful when unconfigured) ─────────────────────────────
export async function sendEmail({ to, subject, html, headers }: { to: string; subject: string; html: string; headers?: Record<string, string> }) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  if (!key) {
    console.warn(`[EMAIL] RESEND_API_KEY missing, skipping send to ${to}: "${subject}"`)
    return
  }
  const resend = new Resend(key)
  const { error } = await resend.emails.send({ from: `collabr. <${from}>`, to, subject, html, ...(headers ? { headers } : {}) })
  if (error) console.error('[EMAIL ERROR]', error)
}

// ── Reusable premium layout (pure, email-safe) ──────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export interface EmailContent {
  preheader?: string
  title: string
  body: string
  ctaLabel: string
  ctaUrl: string
  footnote?: string
}

/**
 * One reusable, mobile-friendly Collabr email layout. Table-based, all styles
 * inline (Gmail/Outlook/Apple Mail safe), navy brand + bulletproof CTA button.
 */
export function renderEmail({ preheader, title, body, ctaLabel, ctaUrl, footnote }: EmailContent): string {
  const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F6F7F9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F6F7F9;opacity:0;">${esc(preheader || title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F6F7F9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto;">
<tr><td align="left" style="padding:4px 8px 22px 8px;font-family:${FONT};">
<span style="font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#0E1016;">collabr<span style="color:#000435;">.</span></span>
</td></tr>
<tr><td style="background-color:#FFFFFF;border:1px solid #E6E8EE;border-radius:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="height:4px;line-height:4px;font-size:4px;background-color:#000435;border-top-left-radius:16px;border-top-right-radius:16px;">&nbsp;</td></tr>
<tr><td style="padding:40px 40px 8px 40px;font-family:${FONT};">
<h1 style="margin:0 0 14px 0;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;color:#0E1016;">${esc(title)}</h1>
<p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#545A66;">${esc(body)}</p>
</td></tr>
<tr><td align="left" style="padding:0 40px 32px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="#000435" style="border-radius:10px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="21%" stroke="f" fillcolor="#000435"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${esc(ctaLabel)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!-- --><a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#FFFFFF;text-decoration:none;border-radius:10px;background-color:#000435;">${esc(ctaLabel)}</a><!--<![endif]-->
</td></tr></table>
</td></tr>
${footnote ? `<tr><td style="padding:0 40px 36px 40px;font-family:${FONT};"><p style="margin:0;font-size:13px;line-height:1.5;color:#8A909C;">${esc(footnote)}</p></td></tr>` : ''}
</table>
</td></tr>
<tr><td style="padding:22px 8px 8px 8px;font-family:${FONT};">
<p style="margin:0 0 6px 0;font-size:12px;line-height:1.6;color:#8A909C;">You're receiving this because you have a Collabr account.</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#A6ABB6;">Collabr &middot; Creator collaborations with payment protection.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Deduped product-email sender ────────────────────────────────────────────
export type SendResult = 'sent' | 'duplicate' | 'skipped'

export interface ProductEmail extends EmailContent {
  subject: string
  /** Unique per (event × recipient) - guarantees no double-send on retries. */
  dedupeKey: string
  type: string
}

/**
 * Send a product email, deduped via `email_log`. Resolves the recipient from
 * `to` or `userId`. Never throws - failures are logged and the workflow
 * continues (returns 'skipped').
 */
export async function sendProductEmail(
  opts: ProductEmail & { to?: string | null; userId?: string | null },
): Promise<SendResult> {
  try {
    const admin = createAdminClient()
    let to = opts.to ?? null
    if (!to && opts.userId) {
      const { data } = await admin.from('users').select('email').eq('id', opts.userId).single()
      to = (data?.email as string | undefined) ?? null
    }
    if (!to) return 'skipped'

    // Claim the dedupe key first - a 23505 conflict means already sent.
    const { error } = await admin.from('email_log')
      .insert({ dedupe_key: opts.dedupeKey, recipient: to, email_type: opts.type })
    if (error) {
      if (error.code === '23505') return 'duplicate'
      console.warn('[EMAIL] dedupe log failed, sending anyway:', error.message)
    }

    await sendEmail({ to, subject: opts.subject, html: renderEmail(opts) })
    return 'sent'
  } catch (e) {
    console.warn('[EMAIL] non-blocking send failure:', (e as Error)?.message)
    return 'skipped'
  }
}

// ── Pure per-event builders (testable; no side effects) ─────────────────────
const TYPE = 'product'

export const productEmails = {
  // ───── Brand ─────
  newApplication: (d: { campaignTitle: string; applicationId: string; campaignId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:application:${d.applicationId}:brand-new`,
    subject: `New application for "${d.campaignTitle}"`,
    preheader: 'A creator just applied to your campaign.',
    title: 'You have a new application',
    body: `A creator applied to "${d.campaignTitle}". Review their pitch and shortlist or select them.`,
    ctaLabel: 'Review applicants',
    ctaUrl: link(`/campaigns/${d.campaignId}`),
  }),

  inviteAccepted: (d: { creatorName: string; collabId: string; inviteId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:invite:${d.inviteId}:accepted`,
    subject: `${d.creatorName} accepted your invite`,
    preheader: 'Your collab has been created, secure the payment to begin.',
    title: `${d.creatorName} accepted your invite`,
    body: `${d.creatorName} accepted your invite and a collab has been created. Secure the payment to get the work started, the money stays protected until you approve.`,
    ctaLabel: 'Open the collab',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  draftSubmitted: (d: { creatorName: string; collabId: string; key: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:draft-submitted:${d.key}`,
    subject: `Draft submitted by ${d.creatorName}, review within 48h`,
    preheader: 'You have 48 hours before it auto-approves.',
    title: `${d.creatorName} submitted a draft`,
    body: `Review the draft and approve, request a revision, or reject. You have 48 hours, after that it auto-approves.`,
    ctaLabel: 'Review draft',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  liveSubmitted: (d: { creatorName: string; collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:live-submitted`,
    subject: `${d.creatorName} submitted live content for review`,
    preheader: 'Review within 72 hours or payment auto-releases.',
    title: `${d.creatorName} submitted live content for review`,
    body: `Your creator has submitted live content for review. Please review within 72 hours. If no action is taken, payment will automatically be released when the review window expires.`,
    ctaLabel: 'Review live post',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  liveReviewReminder: (d: { creatorName: string; collabId: string; hoursLeft: number }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:live-remind:${d.hoursLeft}h`,
    subject: `${d.hoursLeft}h left to review ${d.creatorName}'s live post`,
    preheader: 'Payment auto-releases when the review window closes.',
    title: `About ${d.hoursLeft} hours left to review`,
    body: `${d.creatorName}'s live content is still awaiting your review. You have about ${d.hoursLeft} hours left — confirm the post or raise an issue. If no action is taken, payment releases automatically when the window expires.`,
    ctaLabel: 'Review live post',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  reviewReceived: (d: { collabId: string; recipientId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:review-received:${d.recipientId}`,
    subject: 'You received a review on Collabr',
    preheader: 'Leave yours to reveal both.',
    title: 'You got a review',
    body: `Someone you collaborated with left you a review. Reviews stay hidden until both sides submit (or 7 days pass) — leave yours to reveal both and keep feedback honest.`,
    ctaLabel: 'View the collab',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  disputeEvidenceAdded: (d: { collabId: string; disputeId: string; evidenceId: string; recipientId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:dispute:${d.disputeId}:evidence:${d.evidenceId}:${d.recipientId}`,
    subject: 'New evidence was added to your dispute',
    preheader: 'A Collabr mediator is reviewing both sides.',
    title: 'New evidence was added',
    body: `New evidence was submitted on a dispute for one of your collaborations. The protected payment stays frozen while a Collabr mediator reviews both sides. You can add your own evidence anytime.`,
    ctaLabel: 'View the dispute',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  disputeResolved: (d: { collabId: string; disputeId: string; outcomeLabel: string; recipientId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:dispute:${d.disputeId}:resolved:${d.recipientId}`,
    subject: `Your dispute has been resolved: ${d.outcomeLabel}`,
    preheader: 'See the outcome and what happens next.',
    title: 'Your dispute has been resolved',
    body: `A Collabr mediator reviewed both sides and reached a decision. Outcome: ${d.outcomeLabel}. Open your collab to see the details and what happens to the protected payment.`,
    ctaLabel: 'View the collab',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  disputeOpened: (d: { collabId: string; disputeId: string; recipientId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:dispute:${d.disputeId}:${d.recipientId}`,
    subject: 'A dispute was opened on your collab',
    preheader: 'The protected payment is frozen while we mediate.',
    title: 'A dispute was opened',
    body: `A dispute has been raised on one of your collaborations and the protected payment is now frozen. Submit your evidence, a Collabr mediator reviews both sides within 3 business days.`,
    ctaLabel: 'View the dispute',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  selectionExpired: (d: { creatorName: string; campaignTitle: string; campaignId: string; collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:selection-expired`,
    subject: `Your selection expired — ${d.campaignTitle}`,
    preheader: 'Payment wasn’t secured in time; the creator is back in the pool.',
    title: 'Your selection expired',
    body: `You selected ${d.creatorName} for "${d.campaignTitle}", but payment wasn’t secured within 72 hours. They’ve been returned to the applicant pool — you can select them again or choose someone else.`,
    ctaLabel: 'Review applicants',
    ctaUrl: link(`/campaigns/${d.campaignId}`),
  }),

  collabCompletedBrand: (d: { creatorName: string; amount: string; collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:completed-brand`,
    subject: `Collab complete, ${d.amount} released to ${d.creatorName}`,
    preheader: 'Payment released to the creator. Leave a review.',
    title: 'Your collaboration is complete',
    body: `${d.amount} has been released to ${d.creatorName}. Thanks for keeping it on Collabr, leave a review to build trust for future collabs.`,
    ctaLabel: 'View the collab',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  // ───── Creator ─────
  applicationSubmitted: (d: { campaignTitle: string; applicationId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:application:${d.applicationId}:creator-confirm`,
    subject: `Application sent, "${d.campaignTitle}"`,
    preheader: 'Most brands reply within 36 hours.',
    title: 'Your application is in',
    body: `We sent your application for "${d.campaignTitle}" to the brand, with your full profile attached. Most brands reply within 36 hours, we'll let you know the moment they do.`,
    ctaLabel: 'Track applications',
    ctaUrl: link('/applications'),
  }),

  applicationSelected: (d: { campaignTitle: string; applicationId: string; collabId?: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:application:${d.applicationId}:selected`,
    subject: `You were selected for "${d.campaignTitle}" 🎉`,
    preheader: 'A collab was created, securing the payment is next.',
    title: 'You were selected!',
    body: `The brand picked you for "${d.campaignTitle}" and a collab has been created. Once the brand secures the payment, your payment is protected and you can start the draft.`,
    ctaLabel: 'Open your collab',
    ctaUrl: d.collabId ? link(`/collabs/${d.collabId}`) : link('/collabs'),
  }),

  applicationSelectedBarter: (d: { campaignTitle: string; applicationId: string; collabId?: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:application:${d.applicationId}:selected`,
    subject: `You're confirmed for "${d.campaignTitle}" 🎉`,
    preheader: 'A barter collaboration — you can start now.',
    title: 'You were selected!',
    body: `The brand picked you for "${d.campaignTitle}". This is a barter collaboration (a product or service exchange — no cash payment), and it's confirmed. You can start the draft now.`,
    ctaLabel: 'Open your collab',
    ctaUrl: d.collabId ? link(`/collabs/${d.collabId}`) : link('/collabs'),
  }),

  applicationRejected: (d: { campaignTitle: string; applicationId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:application:${d.applicationId}:rejected`,
    subject: `Update on your application for "${d.campaignTitle}"`,
    preheader: 'New campaigns are posted regularly, keep applying.',
    title: 'Not selected this time',
    body: `The brand went in another direction for "${d.campaignTitle}". It happens, fresh campaigns that fit your niche are posted regularly. Keep applying.`,
    ctaLabel: 'Browse campaigns',
    ctaUrl: link('/jobs'),
  }),

  inviteReceived: (d: { brandName: string; campaignTitle: string; inviteId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:invite:${d.inviteId}:received`,
    subject: `${d.brandName} invited you to "${d.campaignTitle}"`,
    preheader: 'Accepting starts the collab, payment protection covers the pay.',
    title: `${d.brandName} wants to work with you`,
    body: `${d.brandName} invited you to "${d.campaignTitle}". Review the offer and accept to start the collab instantly, your payment is held safely before you create anything.`,
    ctaLabel: 'View the invite',
    ctaUrl: link('/invites'),
  }),

  draftApproved: (d: { collabId: string; key: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:draft-approved:${d.key}`,
    subject: 'Draft approved, post live and submit your link',
    preheader: 'Submit the live link to release your payment.',
    title: 'Your draft was approved',
    body: `Post your content publicly, then come back and submit the live link. Your payment releases automatically once the brand confirms.`,
    ctaLabel: 'Submit live link',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  draftAutoApprovedBrand: (d: { collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:draft-auto-approved:brand`,
    subject: 'A draft was auto-approved — the collab continues',
    preheader: 'The review window ended, so it auto-approved.',
    title: 'A draft was automatically approved',
    body: `A creator's draft was automatically approved because the review window ended. The collaboration can now continue to the live-post stage.`,
    ctaLabel: 'View the collab',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  draftAutoApproved: (d: { collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:draft-auto-approved`,
    subject: 'Draft auto-approved — post live and submit your link',
    preheader: 'The brand didn’t review in 48h, so it auto-approved.',
    title: 'Your draft was auto-approved',
    body: `The brand didn't review within 48 hours, so your draft auto-approved. Post your content publicly, then come back and submit the live link — your payment releases once it's confirmed.`,
    ctaLabel: 'Submit live link',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  revisionRequested: (d: { collabId: string; key: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:revision:${d.key}`,
    subject: 'Revision requested, feedback is ready',
    preheader: 'Review the feedback and resubmit your draft.',
    title: 'A revision was requested',
    body: `The brand left feedback on your draft. Check the notes and submit an updated version, your payment stays protected the whole time.`,
    ctaLabel: 'View feedback',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  payoutPending: (d: { amount: string; collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:payout-pending`,
    subject: `Connect your payout account to receive ${d.amount}`,
    preheader: 'Your payment is secured — connect to get paid.',
    title: 'Connect your payout account to get paid',
    body: `The brand approved your work and ${d.amount} is secured for you. Connect your payout account and we’ll release it automatically — usually within minutes of connecting.`,
    ctaLabel: 'Set up payouts',
    ctaUrl: link('/earnings'),
  }),

  // Recurring "you still need to connect" nudge while a payout is held. `key`
  // (e.g. the reminder date) keeps each send through the dedupe log distinct.
  payoutReminder: (d: { amount: string; collabId: string; key: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:payout-reminder:${d.key}`,
    subject: `Still waiting: connect payouts to receive ${d.amount}`,
    preheader: 'Your payment is held safely — connect to release it.',
    title: 'Connect payouts to receive your payment',
    body: `${d.amount} from a completed collab is being held for you. We can only release it once you connect a payout account — it usually arrives within minutes of connecting. Your money is safe in the meantime.`,
    ctaLabel: 'Set up payouts',
    ctaUrl: link('/earnings'),
  }),

  // Escalation: held too long, now under manual support review (creator side).
  payoutUnderReview: (d: { amount: string; collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:payout-review`,
    subject: `Action needed: your ${d.amount} payout is under review`,
    preheader: 'Connect payouts or contact support to release it.',
    title: 'Your held payout needs attention',
    body: `${d.amount} from a completed collab has been waiting on your payout setup for a while, so our team is now reviewing it. Nothing is lost — connect a payout account to release it automatically, or reply to support@joincollabr if you need help.`,
    ctaLabel: 'Set up payouts',
    ctaUrl: link('/earnings'),
  }),

  // Escalation: brand-facing reassurance that the held payment is safe.
  payoutHeldBrand: (d: { creatorName: string; collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:payout-held-brand`,
    subject: 'Your collab payment is safely held',
    preheader: 'Waiting on the creator to finish payout setup.',
    title: 'Payment is being held while payout setup completes',
    body: `Your collaboration with ${d.creatorName} is complete and the payment is captured and held safely. We're waiting for ${d.creatorName} to finish connecting their payout account; our team is following up. You don't need to do anything.`,
    ctaLabel: 'View the collab',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),

  paymentReleased: (d: { amount: string; collabId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:collab:${d.collabId}:payment-released`,
    subject: `Your ${d.amount} is on the way`,
    preheader: 'Payment released, funds arrive in 1–2 business days.',
    title: 'Your live post was confirmed, you got paid',
    body: `Your post was confirmed and ${d.amount} has been released to you. It usually lands in your account within 1–2 business days.`,
    ctaLabel: 'View earnings',
    ctaUrl: link('/earnings'),
  }),

  // ───── Both parties ─────
  newMessage: (d: { fromName: string; collabId: string; messageId: string; recipientId: string }): ProductEmail => ({
    type: TYPE,
    dedupeKey: `email:message:${d.messageId}:${d.recipientId}`,
    subject: `New message from ${d.fromName}`,
    preheader: 'Keep the conversation on Collabr.',
    title: `${d.fromName} sent you a message`,
    body: `You have a new message about your collab. Reply on Collabr to keep everything, and your payment protection, in one place.`,
    ctaLabel: 'Open the chat',
    ctaUrl: link(`/collabs/${d.collabId}`),
  }),
}

// ── Dispute mediation inbox (joincollabr@gmail.com) ─────────────────────────
// Disputes are mediated manually, so each event is mirrored to the support
// inbox with the full context (parties, campaign, reason/evidence, collab link).
const DISPUTE_INBOX = 'joincollabr@gmail.com'

// Generic support-inbox email. `thread` (kind + key) groups related emails into
// one Gmail conversation via a stable References/In-Reply-To id.
async function sendInboxEmail(
  subject: string,
  rows: Record<string, string>,
  thread?: { kind: string; key: string },
) {
  const body = Object.entries(rows)
    .map(([k, v]) => `<p style="margin:0 0 6px"><strong>${esc(k)}:</strong> ${esc(v)}</p>`)
    .join('')
  const headers = thread
    ? { 'References': `<${thread.kind}-${thread.key}@collabr.app>`, 'In-Reply-To': `<${thread.kind}-${thread.key}@collabr.app>` }
    : undefined
  await sendEmail({
    to: DISPUTE_INBOX,
    subject,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111217">${body}</div>`,
    headers,
  })
}

export async function sendDisputeAdminEmail(subject: string, rows: Record<string, string>, threadKey?: string) {
  await sendInboxEmail(subject, rows, threadKey ? { kind: 'dispute', key: threadKey } : undefined)
}

// Payout stuck beyond the grace period — escalate to the support inbox so a
// human can chase the creator / arrange a manual payout. Never auto-resolves.
export async function sendPayoutAdminEmail(subject: string, rows: Record<string, string>, threadKey?: string) {
  await sendInboxEmail(subject, rows, threadKey ? { kind: 'payout', key: threadKey } : undefined)
}

// ── Legacy onboarding welcomes (kept; routed through the premium layout) ─────
export const emails = {
  welcomeCreator: (name: string, email: string) =>
    sendEmail({
      to: email,
      subject: "You're in, set up your profile to get your first collab",
      html: renderEmail({
        title: `Welcome to Collabr, ${name}`,
        body: 'You’re one of our founding creators. Complete your profile to unlock the Verified badge and start getting selected by brands.',
        ctaLabel: 'Set up your profile',
        ctaUrl: link('/profile'),
      }),
    }),
  welcomeBrand: (name: string, email: string) =>
    sendEmail({
      to: email,
      subject: 'Your first campaign is waiting, post it in 5 minutes',
      html: renderEmail({
        title: `Welcome to Collabr, ${name}`,
        body: 'Post your first campaign brief and start receiving creator applications within 48 hours. During beta, posting campaigns is free.',
        ctaLabel: 'Post a campaign',
        ctaUrl: link('/post-job'),
      }),
    }),
}

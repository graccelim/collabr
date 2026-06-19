'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Lock, Shield, Clock, Check, ExternalLink, AlertCircle } from 'lucide-react'
import StripePaymentButton from './StripePaymentButton'
import { formatSGD } from '@/lib/utils'

interface Props {
  collabId: string
  collabStatus: string
  isBrand: boolean
  agreedRate: number
  platformFee: number
  creatorPayout: number
  creatorName: string
  paymentStatus: string
  creatorHasConnect: boolean
  livePostUrl: string | null
  liveAutoReleaseAt: string | null
  payoutReviewAt?: string | null
}

export default function CollabActions({
  collabId, collabStatus, isBrand, agreedRate, platformFee, creatorPayout,
  creatorName, paymentStatus, creatorHasConnect, livePostUrl, liveAutoReleaseAt,
  payoutReviewAt,
}: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const settlementAvailable = ['funded', 'capture_failed', 'captured', 'transfer_pending', 'transfer_failed', 'paid', 'manual_exception'].includes(paymentStatus)
  // A zero agreed rate means a true barter collab — no escrow, no payment.
  const isBarter = agreedRate === 0

  async function confirmLive() {
    setConfirming(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/confirm-live`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(
        data.payout_pending
          ? `Payment captured. We'll pay ${creatorName.split(' ')[0]} once they connect their payout account.`
          : isBarter ? 'Collab confirmed and completed' : 'Payment released to your creator'
      )
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setConfirming(false)
    }
  }

  // Cancel a barter collab (no money moves). Either party, with confirmation.
  async function cancelBarter() {
    if (!window.confirm('Cancel this barter collaboration? This ends it for both sides and frees the campaign spot. This cannot be undone.')) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Barter collaboration cancelled')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not cancel')
    } finally {
      setCancelling(false)
    }
  }

  // ── Barter collab: no escrow, no payment, normal draft/live flow ──
  if (isBarter && collabStatus === 'briefed') {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Check size={17} color="var(--accent-deep)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Barter collaboration</div>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
              {isBrand
                ? `No payment — this is a product or service exchange. ${creatorName.split(' ')[0]} will submit their draft next.`
                : 'No payment — this is a barter exchange. Submit your draft to get started.'}
            </p>
          </div>
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={cancelBarter} disabled={cancelling}
            style={{ border: 0, background: 'transparent', color: 'var(--ink-faint-solid)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
            {cancelling ? 'Cancelling…' : 'Cancel collaboration'}
          </button>
        </div>
      </div>
    )
  }
  if (isBarter && collabStatus === 'live_submitted') {
    if (isBrand) {
      return (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{creatorName.split(' ')[0]} posted live</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 16px', lineHeight: 1.5 }}>
            This is a barter collab, so there’s no payment to release. Confirm the live post to complete it.
          </p>
          {livePostUrl && (
            <a href={livePostUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 14, textDecoration: 'none' }}>
              <ExternalLink size={14} /> View {creatorName.split(' ')[0]}&rsquo;s live post
            </a>
          )}
          <button className="btn btn-primary btn-block btn-lg" style={{ justifyContent: 'center' }} onClick={confirmLive} disabled={confirming}>
            <Check size={18} /> {confirming ? 'Completing…' : 'Confirm & complete'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', textAlign: 'center', margin: '10px 0 0' }}>
            Auto-completes 72 hours after the post goes live if you don’t act.
          </p>
        </div>
      )
    }
    return (
      <div className="card" style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--warn-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Clock size={17} color="var(--warn)" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-deep)', marginBottom: 4 }}>Awaiting brand confirmation</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
            The brand confirms your post to complete the barter. It auto-completes after 72 hours.
          </p>
        </div>
      </div>
    )
  }

  // ── Brand: needs to pay. (Funding no longer waits on the creator's payout
  //    account — escrow is the brand's card hold; payout happens at release,
  //    retried automatically once the creator connects.) ──
  if (isBrand && collabStatus === 'briefed' && ['unfunded', 'authorizing'].includes(paymentStatus)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* deposit summary */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
            <Lock size={14} color="var(--ink-soft)" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Deposit summary
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>Creator fee</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{formatSGD(agreedRate)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>collabr fee (from payout)</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>{formatSGD(platformFee)}</span>
          </div>
          <div style={{ height: 1, background: 'var(--line)', marginBottom: 16 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>You deposit today</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
              {formatSGD(agreedRate)}
            </span>
          </div>

          <StripePaymentButton
            collabId={collabId}
            amountCents={agreedRate}
            label={`collabr., ${creatorName}`}
            onSuccess={() => router.refresh()}
          />

          <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.4 }}>
            We check your card first. Work only starts once the money is safely in.
          </p>
          {!creatorHasConnect && (
            <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', textAlign: 'center', margin: '8px 0 0', lineHeight: 1.4 }}>
              {creatorName.split(' ')[0]} hasn’t connected a payout account yet — that’s fine to fund now; the payout is released to them once they connect.
            </p>
          )}
        </div>

        {/* escrow explainer */}
        <div style={{ padding: '14px 16px', background: 'var(--safe-tint)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(22,163,74,.12)', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <Shield size={18} color="var(--safe)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--safe-deep)', marginBottom: 4 }}>What "escrow" means, plainly</div>
            <p style={{ fontSize: 13, color: 'var(--safe-deep)', lineHeight: 1.5, margin: 0 }}>
              Your money goes to collabr, <strong>not</strong> the creator. We hold it safely. It only moves to {creatorName.split(' ')[0]} once you approve their live post. If the work never happens, you get it back.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Brand: paid, waiting on creator ─────────────────────────
  if (isBrand && collabStatus === 'briefed' && paymentStatus === 'funded') {
    return (
      <div className="card" style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--safe-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Lock size={17} color="var(--safe)" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--safe-deep)', marginBottom: 4 }}>
            {formatSGD(agreedRate)} secured in escrow
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
            Funds are held and will release to {creatorName} once you confirm their live post.
          </p>
        </div>
      </div>
    )
  }

  // ── Brand: live post ready to confirm ───────────────────────
  if (isBrand && collabStatus === 'live_submitted' && settlementAvailable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>
            Release breakdown
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>In escrow</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{formatSGD(agreedRate)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>collabr fee</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)' }}>−{formatSGD(platformFee)}</span>
          </div>
          <div style={{ height: 1, background: 'var(--line)', marginBottom: 16 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700 }}>{creatorName.split(' ')[0]} receives</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--safe)' }}>
              {formatSGD(creatorPayout)}
            </span>
          </div>

          {livePostUrl && (
            <a
              href={livePostUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 16, textDecoration: 'none' }}
            >
              <ExternalLink size={14} />
              View {creatorName.split(' ')[0]}'s live post
            </a>
          )}

          <button
            className="btn btn-block btn-lg"
            style={{ background: 'var(--safe)', color: '#fff', border: 'none', borderRadius: 'var(--radius-pill)', justifyContent: 'center' }}
            onClick={confirmLive}
            disabled={confirming}
          >
            <Lock size={18} />
            {confirming ? 'Settling payment…' : paymentStatus === 'transfer_failed'
              ? 'Retry creator payout'
              : `Release ${formatSGD(creatorPayout)} to ${creatorName.split(' ')[0]}`}
          </button>
          <p style={{ fontSize: 12, color: 'var(--ink-faint-solid)', textAlign: 'center', margin: '10px 0 0' }}>
            The collab wraps up once the charge goes through and the money lands with the creator.
          </p>
        </div>

        {/* 72h auto-release notice */}
        <div style={{ padding: '13px 15px', background: 'var(--warn-tint)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(217,119,6,.15)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Clock size={16} color="var(--warn)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: 'var(--warn-deep)', lineHeight: 1.5, margin: 0 }}>
            <strong>We release the payment automatically 72 hours</strong> after the post goes live. Spot a problem?{' '}
            <a href="#dispute-section" style={{ textDecoration: 'underline', color: 'var(--warn-deep)' }}>Raise a dispute</a> before then.
          </p>
        </div>
      </div>
    )
  }

  // ── Creator: live post awaiting confirmation ─────────────────
  if (!isBrand && collabStatus === 'live_submitted' && settlementAvailable) {
    return (
      <div className="card" style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--warn-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Clock size={17} color="var(--warn)" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-deep)', marginBottom: 4 }}>
            Awaiting brand confirmation
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
            If the brand doesn't respond within 72 hours, we release your payment automatically. You're marked paid once the money reaches you.
          </p>
        </div>
      </div>
    )
  }

  // ── Escrow secured (creator sees funded state) ───────────────
  if (!isBrand && collabStatus === 'briefed' && paymentStatus === 'funded') {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', background: 'var(--safe-tint)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(22,163,74,.15)' }}>
        <Lock size={16} color="var(--safe)" style={{ flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--safe-deep)' }}>
            {formatSGD(agreedRate)} secured in escrow
          </span>
          <span style={{ fontSize: 13, color: 'var(--safe-deep)', display: 'block', marginTop: 1 }}>
            Your payment is locked in, submit your draft to get started.
          </span>
        </div>
      </div>
    )
  }

  if (collabStatus === 'briefed' && ['authorizing', 'capture_pending'].includes(paymentStatus)) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-deep)', marginBottom: 4 }}>
          Just confirming the payment
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
          Draft work stays locked until the funds are confirmed. This usually only takes a moment.
        </p>
      </div>
    )
  }

  // Transfer pending on the creator's payout account — the money IS captured;
  // it releases automatically once they connect. Not an error. After the grace
  // period (payoutReviewAt set) it's escalated to manual support review — funds
  // stay safely held; nothing is lost or auto-released.
  if (paymentStatus === 'transfer_failed') {
    const underReview = Boolean(payoutReviewAt)
    return (
      <div className="card" style={{ padding: 18, border: '1px solid rgba(217,119,6,.25)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-deep)', marginBottom: 4 }}>
          {isBrand
            ? (underReview ? 'Payment held — under support review' : 'Payment captured — waiting on payout setup')
            : (underReview ? 'Your payout is under review' : 'Connect your payout account to get paid')}
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
          {isBrand
            ? (underReview
                ? `Your payment is captured and safe. We're following up with ${creatorName.split(' ')[0]} to finish their payout setup — nothing is required from you.`
                : `Your payment is secured. We'll release it to ${creatorName.split(' ')[0]} automatically once they connect their payout account.`)
            : (underReview
                ? 'Your payment is held safely and our team is reviewing it. Connect your payout account in Earnings to release it automatically, or contact support if you need help.'
                : 'Your payment is secured. Connect your payout account in Earnings and we’ll release it to you automatically.')}
        </p>
      </div>
    )
  }

  if (paymentStatus === 'capture_failed') {
    return (
      <div className="card" style={{ padding: 18, border: '1px solid rgba(220,38,38,.25)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>
          That payment didn't go through
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>
          Nothing's been marked paid or completed yet. Try again, or reach out to us and we'll sort it out.
        </p>
      </div>
    )
  }

  // ── Draft submitted: awaiting review ────────────────────────
  if (!isBrand && collabStatus === 'draft_submitted') {
    return (
      <div className="card" style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--warn-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Clock size={17} color="var(--warn)" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warn-deep)', marginBottom: 4 }}>
            Draft under review
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
            The brand has 48 hours to approve, request changes, or reject. You'll be notified either way.
          </p>
        </div>
      </div>
    )
  }

  // ── Draft approved: creator needs to post live ───────────────
  if (isBrand && collabStatus === 'draft_approved') {
    return (
      <div className="card" style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--safe-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Check size={17} color="var(--safe)" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--safe-deep)', marginBottom: 4 }}>
            Draft approved
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.5 }}>
            Waiting for {creatorName.split(' ')[0]} to post live and submit the link.
          </p>
        </div>
      </div>
    )
  }

  return null
}

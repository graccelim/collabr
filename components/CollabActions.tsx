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
}

export default function CollabActions({
  collabId, collabStatus, isBrand, agreedRate, platformFee, creatorPayout,
  creatorName, paymentStatus, creatorHasConnect, livePostUrl, liveAutoReleaseAt,
}: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const settlementAvailable = ['funded', 'capture_failed', 'captured', 'transfer_pending', 'transfer_failed', 'paid', 'manual_exception'].includes(paymentStatus)

  async function confirmLive() {
    setConfirming(true)
    try {
      const res = await fetch(`/api/collabs/${collabId}/confirm-live`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Payment released to your creator')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setConfirming(false)
    }
  }

  // ── Brand: needs to pay ──────────────────────────────────────
  if (isBrand && collabStatus === 'briefed' && ['unfunded', 'authorizing'].includes(paymentStatus)) {
    if (!creatorHasConnect) {
      return (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Clock size={15} color="var(--warn)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn-deep)' }}>Waiting on creator</span>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            {creatorName} hasn't connected a payout account yet. Payment will be available once they do.
          </p>
        </div>
      )
    }

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

  if (['capture_failed', 'transfer_failed'].includes(paymentStatus)) {
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

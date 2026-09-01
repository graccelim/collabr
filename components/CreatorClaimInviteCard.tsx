'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { PartyPopper, Check } from 'lucide-react'
import { SOCIAL_LABELS, type SocialPlatform } from '@/lib/onboarding'
import CreatorOptOutLink from '@/components/CreatorOptOutLink'

const BENEFITS = [
  'Receive collaboration requests directly',
  'Manage your campaigns in one place',
  'Protected payments',
  'Free to join, no subscription',
]

/**
 * The activation-request card used once identity is already confirmed
 * (/join's "yes, that's me" step) - full benefits pitch, a button that fires
 * the claim-request notification directly, and never exposes a real claim
 * link. For a visitor who hasn't confirmed anything yet, see
 * CreatorJoinTeaserCard instead (the public profile page's gentler,
 * open-ended "are you this creator?" card, which links into /join rather
 * than firing this action itself).
 */
export default function CreatorClaimInviteCard({
  creatorId, buttonLabel = 'Join Collabr', contactPlatform,
}: {
  creatorId: string
  buttonLabel?: string
  /** The platform we'll actually DM the real claim link through, named
   *  explicitly in the success message so "how will you find me?" is never
   *  left unanswered. */
  contactPlatform?: SocialPlatform
}) {
  const [claimState, setClaimState] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function send() {
    setClaimState('sending')
    const res = await fetch(`/api/creators/${creatorId}/claim-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'claim' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Something went wrong. Please try again.')
      setClaimState('idle')
      return
    }
    setClaimState('sent')
  }

  return (
    <div className="rail-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
          <PartyPopper size={15} />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
          Brands are already looking for creators like you
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
        {BENEFITS.map(b => (
          <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
            <Check size={14} style={{ color: 'var(--money)', flexShrink: 0 }} />
            {b}
          </div>
        ))}
      </div>

      {claimState === 'sent' ? (
        <div>
          <p style={{ fontSize: 13, color: 'var(--money-deep)', fontWeight: 600, lineHeight: 1.5 }}>
            Thanks! We'll reach out shortly to help you activate your Collabr profile.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 6 }}>
            {contactPlatform
              ? `We'll contact you on ${SOCIAL_LABELS[contactPlatform]}.`
              : "We'll contact you on the social account linked to this profile."}
          </p>
        </div>
      ) : (
        <button type="button" className="btn-primary btn-block" style={{ justifyContent: 'center' }}
          disabled={claimState === 'sending'} onClick={send}>
          {claimState === 'sending' ? 'Sending…' : buttonLabel}
        </button>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 12, lineHeight: 1.5 }}>
        This profile was prepared using publicly available information to help brands discover creators.
        Once you join, you'll be able to manage and update everything yourself.
      </p>

      <CreatorOptOutLink creatorId={creatorId} />
    </div>
  )
}

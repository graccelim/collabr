'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { PartyPopper, Check } from 'lucide-react'

const BENEFITS = [
  'Receive collaboration requests directly',
  'Manage your campaigns in one place',
  'Protected payments',
  'Everything is free during beta',
]

/**
 * Public, unclaimed-profile-only rail card. Leads with the benefit ("brands
 * are already looking for creators like you"), explains the mechanics only
 * in the small print below, and never exposes a real claim link - "Join
 * Collabr" just notifies the ops inbox (see the claim-request route) so an
 * admin can verify and send the real one-time link over DM, same as always.
 */
export default function CreatorClaimInviteCard({
  creatorId, buttonLabel = 'Join Collabr', showIntro = true,
}: {
  creatorId: string
  /** Override for contexts that already state the outcome (e.g. /join's
   *  "we found your profile" screen), where "Request Activation" reads as
   *  the more specific next step rather than the generic entry CTA. */
  buttonLabel?: string
  /** Hide the headline + benefits block when the surrounding page has
   *  already made that pitch, so it's never stated twice in a row. */
  showIntro?: boolean
}) {
  const [claimState, setClaimState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [removeState, setRemoveState] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function send(kind: 'claim' | 'remove') {
    const setState = kind === 'claim' ? setClaimState : setRemoveState
    setState('sending')
    const res = await fetch(`/api/creators/${creatorId}/claim-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Something went wrong. Please try again.')
      setState('idle')
      return
    }
    setState('sent')
  }

  return (
    <div className="rail-section">
      {showIntro && (
        <>
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
        </>
      )}

      {claimState === 'sent' ? (
        <p style={{ fontSize: 13, color: 'var(--money-deep)', fontWeight: 600, lineHeight: 1.5 }}>
          Thanks! We'll reach out shortly to help you activate your Collabr profile.
        </p>
      ) : (
        <button type="button" className="btn-primary btn-block" style={{ justifyContent: 'center' }}
          disabled={claimState === 'sending'} onClick={() => send('claim')}>
          {claimState === 'sending' ? 'Sending…' : buttonLabel}
        </button>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 12, lineHeight: 1.5 }}>
        This profile was prepared using publicly available information to help brands discover creators.
        Once you join, you'll be able to manage and update everything yourself.
      </p>

      {removeState === 'sent' ? (
        <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 8 }}>
          Got it, we'll take care of this shortly.
        </p>
      ) : (
        <button type="button" onClick={() => send('remove')} disabled={removeState === 'sending'}
          style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 8 }}>
          Prefer not to appear? Let us know.
        </button>
      )}
    </div>
  )
}

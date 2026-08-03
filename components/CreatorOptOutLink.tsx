'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

/**
 * Shared by CreatorClaimInviteCard (/join) and CreatorJoinTeaserCard (public
 * profile page) - the one piece those two genuinely different cards have in
 * common. Fires the same claim-request notification, kind='remove'.
 */
export default function CreatorOptOutLink({ creatorId }: { creatorId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function send() {
    setState('sending')
    const res = await fetch(`/api/creators/${creatorId}/claim-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'remove' }),
    })
    if (!res.ok) {
      toast.error('Something went wrong. Please try again.')
      setState('idle')
      return
    }
    setState('sent')
  }

  if (state === 'sent') {
    return (
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 8 }}>
        Got it, we'll take care of this shortly.
      </p>
    )
  }

  return (
    <button type="button" onClick={send} disabled={state === 'sending'}
      style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 8 }}>
      Prefer not to appear? Let us know.
    </button>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Bookmark } from 'lucide-react'
import AuthModal from './AuthModal'

interface Props {
  campaignId: string
  initialSaved: boolean
  // Logged-out / non-creator visitors get the auth modal instead of saving.
  gated?: boolean
  compact?: boolean
}

/**
 * Save (bookmark) a campaign for later. Creators only; logged-out visitors
 * trigger the "Sign in to continue" modal. Mirrors SaveCreatorButton.
 */
export default function SaveCampaignButton({ campaignId, initialSaved, gated = false, compact = false }: Props) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (gated) { setAuthOpen(true); return }
    if (busy) return
    setBusy(true)
    const res = saved
      ? await fetch(`/api/saved-campaigns?campaign_id=${campaignId}`, { method: 'DELETE' })
      : await fetch('/api/saved-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId }),
        })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || 'Something went wrong')
    } else {
      setSaved(!saved)
      toast.success(saved ? 'Removed from saved campaigns' : 'Campaign saved')
      router.refresh()
    }
    setBusy(false)
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          title={saved ? 'Unsave campaign' : 'Save campaign'}
          aria-label={saved ? 'Unsave campaign' : 'Save campaign'}
          style={{
            border: '1px solid var(--line-strong)',
            background: saved ? 'var(--accent-tint)' : 'var(--surface)',
            color: saved ? 'var(--accent-deep)' : 'var(--ink-faint-solid)',
            width: 28, height: 28, borderRadius: 7,
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            transition: 'all .14s ease', flexShrink: 0,
          }}
        >
          <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
        </button>
        {gated && <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />}
      </>
    )
  }

  return (
    <>
      <button type="button" onClick={toggle} disabled={busy} className="btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
        {saved ? 'Saved' : 'Save'}
      </button>
      {gated && <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />}
    </>
  )
}

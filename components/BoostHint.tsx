'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Zap } from 'lucide-react'
import BoostModal from './BoostModal'

/**
 * Small, low-key boost nudge for creator surfaces (Earnings, Invites). Its CTA
 * opens a lightweight modal (not a full page). When a boost is active it just
 * shows the status — no aggressive upsell. Callers gate with boostUiEnabled().
 */
export default function BoostHint({ boostUntil, preview = false }: { boostUntil: string | null; preview?: boolean }) {
  const [open, setOpen] = useState(false)
  const params = useSearchParams()

  // Confirmation when Stripe Checkout returns to this page.
  useEffect(() => {
    const r = params.get('boost')
    if (r === 'success') toast.success('Boost active — you’re featured higher now.')
    else if (r === 'canceled') toast('Checkout canceled — no charge was made.')
  }, [params])

  const active = boostUntil ? new Date(boostUntil).getTime() > Date.now() : false
  const daysLeft = active
    ? Math.max(1, Math.ceil((new Date(boostUntil!).getTime() - Date.now()) / 86_400_000))
    : 0

  return (
    <>
      {active ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <Zap size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Boosted · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>You&rsquo;re featured higher in applicant lists right now.</div>
          </div>
          <button onClick={() => setOpen(true)} style={{ flexShrink: 0, border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep)' }}>Extend</button>
        </div>
      ) : (
        <div className="card" style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: 16, flexWrap: 'wrap',
          background: 'linear-gradient(120deg, var(--accent-tint) 0%, var(--surface) 60%)',
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <Zap size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 170 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Want more visibility?</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1, lineHeight: 1.45 }}>Boost your profile for a few days to appear higher in applicant lists.</div>
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary" style={{ flexShrink: 0 }}>Boost visibility</button>
        </div>
      )}

      <BoostModal open={open} onClose={() => setOpen(false)} preview={preview} boostUntil={boostUntil} />
    </>
  )
}

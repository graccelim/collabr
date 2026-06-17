'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Zap } from 'lucide-react'
import BoostModal from './BoostModal'

/**
 * Small, low-key boost nudge for creator surfaces (Earnings, Invites). Its CTA
 * opens a lightweight modal (not a full page). When a boost is active it just
 * shows the status - no aggressive upsell. Callers gate with boostUiEnabled().
 */
export default function BoostHint({ boostUntil, preview = false }: { boostUntil: string | null; preview?: boolean }) {
  const [open, setOpen] = useState(false)
  const params = useSearchParams()

  // Confirmation when Stripe Checkout returns to this page.
  useEffect(() => {
    const r = params.get('boost')
    if (r === 'success') toast.success('Boost active, you’re featured higher now.')
    else if (r === 'canceled') toast('Checkout canceled, no charge was made.')
  }, [params])

  const active = boostUntil ? new Date(boostUntil).getTime() > Date.now() : false
  const daysLeft = active
    ? Math.max(1, Math.ceil((new Date(boostUntil!).getTime() - Date.now()) / 86_400_000))
    : 0

  return (
    <>
      {active ? (
        <div className="money-panel" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', zIndex: 1, width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <Zap size={18} />
          </div>
          <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 170 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>Boosted · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left</div>
            <div style={{ fontSize: 12.5, color: 'var(--accent-on-dark)', marginTop: 2 }}>You&rsquo;re featured higher in applicant lists right now.</div>
          </div>
          <button onClick={() => setOpen(true)} style={{ position: 'relative', zIndex: 1, flexShrink: 0, border: '1px solid rgba(255,255,255,.22)', background: 'rgba(255,255,255,.08)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', borderRadius: 'var(--radius-sm)', padding: '9px 15px', fontFamily: 'var(--font-body)' }}>Extend</button>
        </div>
      ) : (
        <div className="money-panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', zIndex: 1, width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.18)', color: '#fff', display: 'grid', placeItems: 'center' }}>
            <Zap size={18} />
          </div>
          <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 170 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>Want more visibility?</div>
            <div style={{ fontSize: 12.5, color: 'var(--accent-on-dark)', marginTop: 2, lineHeight: 1.45 }}>Boost your profile for a few days to appear higher in applicant lists.</div>
          </div>
          <button onClick={() => setOpen(true)} style={{ position: 'relative', zIndex: 1, flexShrink: 0, border: 0, background: '#fff', color: 'var(--accent-deep)', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, borderRadius: 'var(--radius-sm)', padding: '10px 17px', fontFamily: 'var(--font-body)' }}>Boost visibility</button>
        </div>
      )}

      <BoostModal open={open} onClose={() => setOpen(false)} preview={preview} boostUntil={boostUntil} />
    </>
  )
}

import Link from 'next/link'
import { Zap } from 'lucide-react'

/**
 * Small, low-key boost nudge for creator surfaces (Earnings, Invites). One CTA
 * → the minimal /boost checkout. When a boost is active it just shows the
 * status — no aggressive upsell. Callers must gate this with boostEnabled().
 */
export default function BoostHint({ boostUntil }: { boostUntil: string | null }) {
  const active = boostUntil ? new Date(boostUntil).getTime() > Date.now() : false
  const daysLeft = active
    ? Math.max(1, Math.ceil((new Date(boostUntil!).getTime() - Date.now()) / 86_400_000))
    : 0

  if (active) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 16 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center' }}>
          <Zap size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Boosted · {daysLeft} day{daysLeft !== 1 ? 's' : ''} left</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 1 }}>You&rsquo;re featured higher in applicant lists right now.</div>
        </div>
        <Link href="/boost" style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--accent-deep)' }}>Extend</Link>
      </div>
    )
  }

  return (
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
      <Link href="/boost" className="btn-primary" style={{ flexShrink: 0 }}>Boost visibility</Link>
    </div>
  )
}

import Link from 'next/link'
import { Lock, BadgeCheck, DollarSign } from 'lucide-react'

/**
 * Left-rail copy. The signup page passes the live role so the pitch speaks
 * directly to whichever side the visitor picked; login/reset pass nothing and
 * get the neutral version. The rail is desktop-only (.auth-rail hides < 880px),
 * so this never affects the mobile form.
 */
const RAIL = {
  creator: {
    title: 'Get paid for the work you actually do.',
    body: "The brand's money is locked in before you start, so you're never chasing an invoice again. Post the content and the payment lands, usually the same day it goes live.",
    points: [
      [Lock, 'The full fee is secured before you say yes'],
      [BadgeCheck, "No more ghosting or “we'll pay you next month”"],
      [DollarSign, 'Paid automatically once your post is live'],
    ],
  },
  brand: {
    title: 'Work with creators you can count on.',
    body: "Your budget is protected until the work is delivered and you've signed off. Brief them, review the draft, approve it. You stay in control the whole way.",
    points: [
      [Lock, "Your money is safe until you approve the work"],
      [BadgeCheck, 'Real ratings from past collabs, not just follower counts'],
      [DollarSign, 'Approve every draft before it goes live'],
    ],
  },
  default: {
    title: 'Collaborations that actually pay out.',
    body: 'Brands fund the work upfront and approve it before it goes live. Creators get paid the moment it does. Everyone knows exactly where they stand.',
    points: [
      [Lock, 'Money held safely before work starts'],
      [BadgeCheck, 'Vetted creators with connected socials'],
      [DollarSign, 'Paid automatically the moment a post goes live'],
    ],
  },
} as const

/**
 * Auth layout (Collabr Redesign): dark brand panel on the left with the
 * value prop, centered form column on the right. The panel hides on
 * mobile (.auth-rail) and the form fills the viewport.
 */
export default function AuthShell({ children, role }: {
  children: React.ReactNode
  role?: 'brand' | 'creator'
}) {
  const copy = role ? RAIL[role] : RAIL.default

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--paper)' }}>
      {/* LEFT - brand panel */}
      <div className="auth-rail">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, background: '#fff', color: 'var(--brand)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16,
          }}>c</span>
          <span style={{ fontWeight: 640, fontSize: 18, letterSpacing: '-0.03em', color: '#fff' }}>
            collabr<span style={{ color: '#9DB3F0' }}>.</span>
          </span>
        </Link>

        <div style={{ marginTop: 'auto', marginBottom: 'auto', paddingRight: 20 }}>
          <div style={{ fontSize: 34, lineHeight: 1.12, fontWeight: 560, letterSpacing: '-0.025em', color: '#fff', maxWidth: 440 }}>
            {copy.title}
          </div>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', marginTop: 18, maxWidth: 400 }}>
            {copy.body}
          </p>
          <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {copy.points.map(([Ic, t]) => (
              <div key={t} style={{
                display: 'flex', alignItems: 'center', gap: 13,
                padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.10)',
              }}>
                <Ic size={18} style={{ color: '#6FCFB2', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: '#6FCFB2' }} />
          Free during beta · Singapore · No card needed
        </div>
      </div>

      {/* RIGHT - form, centered */}
      <div style={{
        flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center',
        padding: '48px 24px',
      }}>
        <div className="pop" style={{ width: '100%', maxWidth: 420, margin: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

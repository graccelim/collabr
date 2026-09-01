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
    title: 'Get paid for the work you deliver.',
    body: 'Every brand secures the full fee with collabr before your collaboration begins, so your payment is protected from day one. Once your content is live and approved, you are paid automatically.',
    points: [
      [Lock, 'The full fee is secured upfront, before you accept'],
      [BadgeCheck, "Work with brands who've committed real budget"],
      [DollarSign, 'Paid automatically once your content goes live'],
    ],
  },
  brand: {
    title: 'Partner with creators you can trust.',
    body: "Your budget stays protected with collabr until the work is delivered and you've approved it. Brief, review, and sign off with confidence at every step.",
    points: [
      [Lock, 'Your funds stay protected until you approve the work'],
      [BadgeCheck, 'Real ratings from past collaborations, not just follower counts'],
      [DollarSign, 'Review and approve every draft before it goes live'],
    ],
  },
  default: {
    title: 'Collaborations built on trust.',
    body: 'Brands secure the budget upfront and approve the work before it goes live. Creators are paid the moment it does. Both sides always know where they stand.',
    points: [
      [Lock, 'Funds protected before any work begins'],
      [BadgeCheck, 'Verified creators with connected socials'],
      [DollarSign, 'Payment released automatically once content is live'],
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

        <div style={{ marginTop: 56, marginBottom: 'auto', paddingRight: 20 }}>
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
          Based in Singapore
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

import Link from 'next/link'
import { Lock, BadgeCheck, DollarSign } from 'lucide-react'

/**
 * Auth layout (Collabr Redesign): dark brand panel on the left with the
 * escrow value prop, centered form column on the right. The panel hides on
 * mobile (.auth-rail) and the form fills the viewport.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  const TRUST = [
    [Lock, 'Money secured in escrow before work starts'],
    [BadgeCheck, 'Vetted creators with connected socials'],
    [DollarSign, 'Paid automatically the moment a post goes live'],
  ] as const

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
          <div style={{ fontSize: 34, lineHeight: 1.12, fontWeight: 560, letterSpacing: '-0.025em', color: '#fff' }}>
            Paid collaborations,<br />without the trust fall.
          </div>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', marginTop: 18, maxWidth: 400 }}>
            Brands fund the work upfront. Creators see the money locked in before they
            lift a finger. Escrow holds it until everyone&rsquo;s happy.
          </p>
          <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TRUST.map(([Ic, t]) => (
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

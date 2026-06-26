import { Lock } from 'lucide-react'

// Decorative blurred creator roster behind the Discover gate — gives the locked
// page a sense of "there's a real roster here." Deterministic (no random → no
// hydration mismatch), aria-hidden, non-interactive.
const TINTS = ['var(--accent-tint)', 'var(--money-tint)', '#E6E7F0', '#CDE6DA', '#D7DAF2', '#F1E6DA']
const WIDTHS = [62, 54, 70, 48, 66, 58, 52, 64]

export default function BlurredRoster() {
  const cards = Array.from({ length: 18 })
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: -40, filter: 'blur(7px)', opacity: 0.85, transform: 'scale(1.04)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, padding: 30 }}>
          {cards.map((_, i) => (
            <div key={i} className="card" style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 42, height: 42, borderRadius: 999, background: TINTS[i % TINTS.length], flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ height: 9, width: `${WIDTHS[i % WIDTHS.length]}%`, background: 'var(--line)', borderRadius: 999, display: 'block' }} />
                  <span style={{ height: 7, width: '42%', background: 'var(--surface-2)', borderRadius: 999, display: 'block' }} />
                </div>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: TINTS[(i + 2) % TINTS.length] }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ height: 20, width: 80, background: 'var(--surface-2)', borderRadius: 999 }} />
                <span style={{ height: 20, width: 40, background: 'var(--money-tint)', borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* focus scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 42%, rgba(8,10,30,.16), rgba(8,10,30,.40))' }} />
      {/* floating "locked" chip */}
      <div style={{
        position: 'absolute', top: '11%', left: '8%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '9px 15px', background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.28)',
        borderRadius: 999, backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12.5, fontWeight: 500,
        animation: 'clp-floatlock 6s ease-in-out infinite', whiteSpace: 'nowrap',
      }}>
        <Lock size={14} /> 240+ creators matched to your brand — locked
      </div>
    </div>
  )
}

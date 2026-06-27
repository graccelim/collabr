'use client'
import { Star, ShieldCheck, Eye } from 'lucide-react'

// A teaser of the Discover Creators roster with clearly-labelled SAMPLE creators.
// Cards rise in (staggered) and gently float, with verified-metric + badge chips —
// so the gate feels like a locked product, not a feature list.
const CREATORS = [
  { name: 'Maya T.', mono: 'M', bg: '#5B53E0', niche: 'Food · Singapore', views: '16.4k', eng: '17.8%', connected: true, certified: true, match: 'Top match' },
  { name: 'Jules R.', mono: 'J', bg: '#157A55', niche: 'Fashion · KL', views: '9.1k', eng: '14.2%', connected: true, certified: false },
  { name: 'Devan K.', mono: 'D', bg: '#B26B00', niche: 'Tech · Remote', views: '22.0k', eng: '11.9%', connected: false, certified: true },
  { name: 'Priya S.', mono: 'P', bg: '#0A0C22', niche: 'Beauty · Singapore', views: '12.7k', eng: '15.6%', connected: true, certified: true },
]
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 14, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }

export default function RosterPreview() {
  return (
    <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {CREATORS.map((c, i) => (
        <div key={i} style={{ animation: `clp-rise-safe .55s cubic-bezier(.16,1,.3,1) ${(0.08 + i * 0.09).toFixed(2)}s both` }}>
          <div style={{
            ...CARD, padding: 15, position: 'relative',
            ...(c.match ? { border: '1.5px solid rgba(91,83,224,.55)' } : {}),
            animation: `prev-bob ${(5 + i * 0.6).toFixed(1)}s ease-in-out ${(i * 0.4).toFixed(1)}s infinite`,
          }}>
            {c.match && (
              <span style={{ position: 'absolute', top: -9, right: 12, fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', background: '#5B53E0', padding: '2px 8px', borderRadius: 999 }}>{c.match}</span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 999, background: c.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17 }}>{c.mono}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0E1016' }}>{c.name}</span>
                  {c.certified && <ShieldCheck size={13} color="#157A55" />}
                  {c.connected && <Star size={13} color="#5B53E0" fill="#5B53E0" />}
                </div>
                <div style={{ fontSize: 12, color: '#8A909C', marginTop: 1 }}>{c.niche}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#3A4150', background: '#F1F5FC', borderRadius: 8, padding: '5px 9px' }}>
                <Eye size={12} color="#5A6072" /> {c.views} avg
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#157A55', background: '#F2FAF6', borderRadius: 8, padding: '5px 9px' }}>
                {c.eng} eng
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

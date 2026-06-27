'use client'
import { Star, ShieldCheck } from 'lucide-react'
import { socialIcon } from '@/components/SocialIcon'

// Teaser of the Discover roster with clearly-labelled sample creators, mirroring
// the real creator-card layout (avatar, name, Certified / Connected badges, social
// glyphs, niche, trust badges, rate). Cards rise in and gently float. The reasons
// to care live in the WhyList above, not inside the cards.
type Creator = {
  name: string; mono: string; bg: string; niche: string; socials: string[]
  avail: boolean; connected: boolean; certified: boolean; rating: string; rate: string; top?: boolean
}
const CREATORS: Creator[] = [
  { name: 'Maya T.', mono: 'M', bg: '#5B53E0', niche: 'Food · Singapore', socials: ['tiktok', 'instagram'], avail: true, connected: true, certified: true, rating: '4.9', rate: 'S$120', top: true },
  { name: 'Priya S.', mono: 'P', bg: '#0A0C22', niche: 'Beauty · Singapore', socials: ['instagram', 'tiktok'], avail: true, connected: true, certified: true, rating: '4.8', rate: 'S$140' },
  { name: 'Jules R.', mono: 'J', bg: '#157A55', niche: 'Fashion · Kuala Lumpur', socials: ['instagram', 'tiktok'], avail: false, connected: true, certified: false, rating: '4.7', rate: 'S$90' },
  { name: 'Devan K.', mono: 'D', bg: '#B26B00', niche: 'Tech · Remote', socials: ['youtube'], avail: true, connected: false, certified: true, rating: '5.0', rate: 'S$200' },
]
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 14, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const badge = (text: string, fg: string, bg: string) => (
  <span style={{ fontSize: 10.5, fontWeight: 600, color: fg, background: bg, borderRadius: 999, padding: '3px 9px' }}>{text}</span>
)

export default function RosterPreview() {
  return (
    <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {CREATORS.map((c, i) => (
        <div key={i} style={{ animation: `clp-rise-safe .55s cubic-bezier(.16,1,.3,1) ${(0.08 + i * 0.09).toFixed(2)}s both` }}>
          <div style={{
            ...CARD, padding: 15,
            ...(c.top ? { border: '1.5px solid rgba(91,83,224,.5)' } : {}),
            animation: `prev-bob ${(5 + i * 0.6).toFixed(1)}s ease-in-out ${(i * 0.4).toFixed(1)}s infinite`,
          }}>
            {/* head: avatar · name + badges · social glyphs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, background: c.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{c.mono}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0E1016', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  {c.certified && <ShieldCheck size={13} color="#157A55" style={{ flex: 'none' }} />}
                  {c.connected && <Star size={13} color="#5B53E0" fill="#5B53E0" style={{ flex: 'none' }} />}
                  {c.avail && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#157A55', flex: 'none' }} />}
                </div>
                <div style={{ fontSize: 12, color: '#8A909C', marginTop: 1 }}>{c.niche}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none' }}>
                {c.socials.map((p) => { const G = socialIcon(p); return <G key={p} size={14} /> })}
              </span>
            </div>

            {/* trust badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
              {c.top && badge('Top match', '#5B53E0', 'rgba(91,83,224,.12)')}
              {c.avail && badge('Available now', '#157A55', '#F2FAF6')}
              {c.connected && badge('Verified metrics', '#3A4150', '#F1F5FC')}
            </div>

            {/* footer: rating · rate */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, fontSize: 12.5, color: '#5A6072' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#0E1016' }}>
                <Star size={12} color="#E1A33B" fill="#E1A33B" /> {c.rating}
              </span>
              <span style={{ color: '#C4CAD6' }}>·</span>
              <span>From {c.rate} / post</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

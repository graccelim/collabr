'use client'
import { useEffect, useState } from 'react'
import { Star, ShieldCheck, Send, Check } from 'lucide-react'
import { socialIcon } from '@/components/SocialIcon'

// Teaser of the Discover roster with clearly-labelled sample creators, mirroring
// the real creator-card layout. Cards rise in and gently float. The top match runs
// a small invite demo: a cursor taps "Invite" and it flips to "Invite sent".
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
const badge = (text: string, fg: string, bg: string, cls?: string) => (
  <span className={cls} style={{ fontSize: 10.5, fontWeight: 600, color: fg, background: bg, borderRadius: 999, padding: '3px 9px' }}>{text}</span>
)

function InviteDemo() {
  const [sent, setSent] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const cycle = () => {
      setSent(false)
      t = setTimeout(() => { setSent(true); t = setTimeout(cycle, 2200) }, 2200)
    }
    cycle()
    return () => clearTimeout(t)
  }, [])
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '7px 13px', borderRadius: 999, background: sent ? '#E7F4EE' : '#0A0C22', color: sent ? '#157A55' : '#fff', transition: 'background .25s ease, color .25s ease', whiteSpace: 'nowrap' }}>
        {sent ? <><Check size={13} /> Invite sent</> : <><Send size={12} /> Invite</>}
      </span>
      {/* animated cursor that taps the button */}
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ position: 'absolute', right: -7, bottom: -9, filter: 'drop-shadow(0 2px 3px rgba(8,10,30,.35))', animation: 'prev-cursor 4.4s ease-in-out infinite', pointerEvents: 'none' }}>
        <path d="M4 2l6 16 2.5-6.5L19 9z" fill="#fff" stroke="#0A0C22" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function Card({ c, i }: { c: Creator; i: number }) {
  return (
    <div style={{ animation: `clp-rise-safe .55s cubic-bezier(.16,1,.3,1) ${(0.08 + i * 0.09).toFixed(2)}s both` }}>
      <div className="roster-card" style={{
        ...CARD, padding: 15,
        ...(c.top ? { border: '1.5px solid rgba(91,83,224,.5)' } : {}),
        animation: `prev-bob ${(5 + i * 0.6).toFixed(1)}s ease-in-out ${(i * 0.4).toFixed(1)}s infinite`,
      }}>
        {/* head */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span className="roster-av" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, background: c.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{c.mono}</span>
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
        <div className="roster-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
          {c.top && badge('Top match', '#5B53E0', 'rgba(91,83,224,.12)')}
          {c.avail && badge('Available now', '#157A55', '#F2FAF6')}
          {c.connected && badge('Verified metrics', '#3A4150', '#F1F5FC', 'roster-hide-mobile')}
        </div>

        {/* footer: rating · rate · (invite demo on top card) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, fontSize: 12.5, color: '#5A6072' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#0E1016' }}>
            <Star size={12} color="#E1A33B" fill="#E1A33B" /> {c.rating}
          </span>
          <span className="roster-rate" style={{ color: '#C4CAD6' }}>·</span>
          <span className="roster-rate">From {c.rate} / post</span>
          {c.top && <span style={{ marginLeft: 'auto' }}><InviteDemo /></span>}
        </div>
      </div>
    </div>
  )
}

export default function RosterPreview() {
  return (
    <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {CREATORS.map((c, i) => <Card key={i} c={c} i={i} />)}
    </div>
  )
}

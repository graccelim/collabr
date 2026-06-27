'use client'
import { useEffect, useRef, useState } from 'react'
import { Star, ShieldCheck, Zap, Eye } from 'lucide-react'
import { socialIcon } from '@/components/SocialIcon'

// Teaser of the Discover roster with clearly-labelled SAMPLE creators. Rich,
// compelling cards: platform connections + followers, a match score that counts
// up + a bar that fills, fast-reply and availability signals, verified metrics.
type Creator = {
  name: string; mono: string; bg: string; niche: string; match: number; reply: string
  avail: boolean; connected: boolean; certified: boolean; socials: [string, string][]; views: string; eng: string; top?: boolean
}
const CREATORS: Creator[] = [
  { name: 'Maya T.', mono: 'M', bg: '#5B53E0', niche: 'Food · Singapore', match: 96, reply: '~2h', avail: true, connected: true, certified: true, socials: [['tiktok', '45k'], ['instagram', '12k']], views: '16.4k', eng: '17.8%', top: true },
  { name: 'Priya S.', mono: 'P', bg: '#0A0C22', niche: 'Beauty · Singapore', match: 93, reply: '~1h', avail: true, connected: true, certified: true, socials: [['instagram', '34k'], ['tiktok', '21k']], views: '12.7k', eng: '15.6%' },
  { name: 'Jules R.', mono: 'J', bg: '#157A55', niche: 'Fashion · KL', match: 91, reply: '~4h', avail: false, connected: true, certified: false, socials: [['instagram', '28k'], ['tiktok', '9k']], views: '9.1k', eng: '14.2%' },
  { name: 'Devan K.', mono: 'D', bg: '#B26B00', niche: 'Tech · Remote', match: 88, reply: 'same day', avail: true, connected: false, certified: true, socials: [['youtube', '61k']], views: '22.0k', eng: '11.9%' },
]

const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 14, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const NUM = "var(--font-money, system-ui, sans-serif)"

function useCountUp(target: number, run: boolean, ms = 1100): number {
  const [v, setV] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!run) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / ms, 1)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, run, ms])
  return v
}

function chip(children: React.ReactNode, key: number, extra?: React.CSSProperties) {
  return (
    <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#3A4150', background: '#F1F5FC', borderRadius: 8, padding: '5px 9px', ...extra }}>
      {children}
    </span>
  )
}

function Card({ c, i }: { c: Creator; i: number }) {
  const [run, setRun] = useState(false)
  useEffect(() => { const t = setTimeout(() => setRun(true), 120 + i * 90); return () => clearTimeout(t) }, [i])
  const match = useCountUp(c.match, run)
  return (
    <div style={{ animation: `clp-rise-safe .55s cubic-bezier(.16,1,.3,1) ${(0.08 + i * 0.09).toFixed(2)}s both` }}>
      <div style={{
        ...CARD, padding: 15, position: 'relative', overflow: 'hidden',
        ...(c.top ? { border: '1.5px solid rgba(91,83,224,.55)' } : {}),
        animation: `prev-bob ${(5 + i * 0.6).toFixed(1)}s ease-in-out ${(i * 0.4).toFixed(1)}s infinite`,
      }}>
        {c.top && <span style={{ position: 'absolute', top: -9, right: 12, fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', background: '#5B53E0', padding: '2px 8px', borderRadius: 999 }}>Top match</span>}

        {/* head */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 42, height: 42, flex: 'none', borderRadius: 999, background: c.bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17 }}>{c.mono}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0E1016' }}>{c.name}</span>
              {c.certified && <ShieldCheck size={13} color="#157A55" />}
              {c.connected && <Star size={13} color="#5B53E0" fill="#5B53E0" />}
            </div>
            <div style={{ fontSize: 12, color: '#8A909C', marginTop: 1 }}>{c.niche}</div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ fontFamily: NUM, fontVariantNumeric: 'tabular-nums', fontSize: 19, fontWeight: 700, color: '#5B53E0', lineHeight: 1 }}>{match}%</div>
            <div style={{ fontSize: 10.5, color: '#8A909C', marginTop: 1 }}>match</div>
          </div>
        </div>

        {/* platforms + followers */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {c.socials.map(([p, f], k) => {
            const G = socialIcon(p)
            return chip(<><G size={13} /> {f}</>, k)
          })}
        </div>

        {/* signals */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {chip(<><Eye size={12} color="#5A6072" /> {c.views} avg</>, 0)}
          {chip(<><Zap size={12} color="#B26B00" /> Replies {c.reply}</>, 1, { color: '#8A5A14', background: '#FFF4E6' })}
          {c.avail && chip(<><span style={{ width: 6, height: 6, borderRadius: 999, background: '#157A55' }} /> Available</>, 2, { color: '#157A55', background: '#F2FAF6' })}
        </div>

        {/* match bar */}
        <div style={{ marginTop: 13, height: 4, borderRadius: 999, background: '#EAEDF3', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#3B4470,#5B53E0)', width: run ? `${c.match}%` : '0%', transition: `width 1.1s cubic-bezier(.16,1,.3,1) ${(0.2 + i * 0.1).toFixed(2)}s` }} />
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

'use client'
import { Wand2, Sparkles, TrendingUp, Clapperboard, ArrowRight } from 'lucide-react'

// A LIVE-feeling preview of the Strategy tab (the AI "game plan") with clearly
// SAMPLE content — never a real creator's data. Mirrors the real StrategistPanel:
// a "this week's idea" hero + game-plan cards. Purely a product teaser.
const MONO = 'var(--font-mono, ui-monospace, monospace)'
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 14, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const NAVY = 'linear-gradient(122deg,#0A0C22 0%,#1A2150 60%,#0A0C22 100%)'

const CARDS = [
  { label: 'Hidden pattern', color: '#5B53E0', bg: '#F1F0FE', Icon: Sparkles,
    title: 'Your followers are warming up before reach kicks in',
    body: 'More of the people who see your posts are engaging, even though views are steady. That usually means loyalty is forming first. I’d keep your style and put your energy into stronger openings.',
    conf: 'This shows across many posts, not one viral hit, so I’d trust it.' },
  { label: 'Opportunity', color: '#0F7A4D', bg: '#EAF4EE', Icon: TrendingUp,
    title: 'You haven’t tried comparison posts yet',
    body: 'Your audience loves picking a side, and a “which stall wins” post naturally pulls more comments than a single review. Worth testing once.',
    conf: 'A fair bet from how your reviews perform, though it’s untested.' },
]

export default function StrategyPreview() {
  return (
    <div style={{ animation: 'clp-rise-safe .6s cubic-bezier(.16,1,.3,1) both', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* header + sample pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(150deg,#6B62EC,#4B43C8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -8px rgba(91,83,224,.8)' }}><Wand2 size={15} color="#fff" /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>Your game plan</div>
          <div style={{ fontSize: 11.5, color: '#8A909C' }}>If I were managing your account this week</div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8A909C', border: '1px solid rgba(20,30,80,.14)', padding: '3px 8px', borderRadius: 999 }}>Sample</span>
      </div>

      {/* this week's idea */}
      <div style={{ background: NAVY, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9AA0D6' }}>
            <Clapperboard size={12} color="#8E86F0" /> This week&apos;s idea
          </span>
          <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, color: '#CFD3EE', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 999, padding: '3px 8px' }}>Quick to film</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.32 }}>Turn your top hawker review into a weekly series</div>
        <p style={{ fontSize: 12.5, color: '#B7BCE0', lineHeight: 1.55, margin: '9px 0 0' }}>Your reviews already do well, and a repeatable weekly slot gives people a reason to come back, so more of them turn into regulars.</p>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 15, fontSize: 12.5, fontWeight: 600, color: '#0A0C22', background: '#fff', borderRadius: 9, padding: '9px 14px' }}>
          <Clapperboard size={13} /> Draft it in Content Lab <ArrowRight size={12} />
        </span>
      </div>

      {/* game-plan cards */}
      {CARDS.map((c, i) => (
        <div key={i} style={{ ...CARD, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 30, height: 30, flex: 'none', borderRadius: 9, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><c.Icon size={15} color={c.color} /></span>
          <div style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: MONO, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: c.color, marginBottom: 3 }}>{c.label}</span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0E1016', lineHeight: 1.35 }}>{c.title}</div>
            <p style={{ fontSize: 12.5, color: '#3A3F4B', lineHeight: 1.55, margin: '6px 0 0' }}>{c.body}</p>
            <p style={{ fontSize: 11.5, color: '#8A909C', fontStyle: 'italic', margin: '7px 0 0' }}>{c.conf}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

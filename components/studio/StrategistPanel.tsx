'use client'
import { Sparkles, TrendingUp, AlertTriangle, Compass, Lightbulb, Wand2, HelpCircle, Clapperboard, ArrowRight } from 'lucide-react'
import type { StrategyOutput, StrategyCard } from '@/lib/ai/service'

// The AI strategist layer: a game plan, not a chart read. A featured "this week's
// idea" you can draft in Content Lab in one click, the game-plan cards, the rest
// of the content ideas, and open questions. Fully responsive.
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 14, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const MONO = 'var(--font-mono, ui-monospace, monospace)'
const NAVY = 'linear-gradient(122deg,#0A0C22 0%,#1A2150 60%,#0A0C22 100%)'

const META: Record<string, { label: string; color: string; bg: string; Icon: typeof Sparkles }> = {
  pattern: { label: 'Hidden pattern', color: '#5B53E0', bg: '#F1F0FE', Icon: Sparkles },
  opportunity: { label: 'Opportunity', color: '#0F7A4D', bg: '#EAF4EE', Icon: TrendingUp },
  watch: { label: 'Watch out', color: '#B26B00', bg: '#FBF3E6', Icon: AlertTriangle },
  strategy: { label: 'Strategy', color: '#2A3157', bg: '#EEF1F8', Icon: Compass },
}

// Honest "how much work to film this" tag (the AI rates the idea, not the data).
const EFFORT: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Quick to film', color: '#0F7A4D', bg: '#EAF4EE' },
  medium: { label: 'Some setup', color: '#5B53E0', bg: '#F1F0FE' },
  high: { label: 'Bigger project', color: '#B26B00', bg: '#FBF3E6' },
}
function EffortChip({ effort, onDark }: { effort: string; onDark?: boolean }) {
  const e = EFFORT[effort]
  if (!e) return null
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600, flex: 'none', color: onDark ? '#CFD3EE' : e.color, background: onDark ? 'rgba(255,255,255,.1)' : e.bg, border: onDark ? '1px solid rgba(255,255,255,.16)' : 'none', borderRadius: 999, padding: '4px 9px' }}>{e.label}</span>
  )
}

function DraftButton({ label, onClick, light }: { label: string; onClick: () => void; light?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', whiteSpace: 'nowrap',
        fontSize: 13, fontWeight: 600, borderRadius: 10, padding: '10px 15px',
        border: light ? 'none' : '1px solid rgba(20,30,80,.14)',
        background: light ? '#fff' : 'transparent', color: light ? '#0A0C22' : '#2A3157',
      }}>
      <Clapperboard size={14} /> {label} <ArrowRight size={13} />
    </button>
  )
}

function GameCard({ card }: { card: StrategyCard }) {
  const m = META[card.kind] || META.strategy
  return (
    <div style={{ ...CARD, padding: '15px 17px', display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><m.Icon size={16} color={m.color} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: m.color, marginBottom: 4 }}>{m.label}</span>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0E1016', lineHeight: 1.35 }}>{card.title}</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#3A3F4B', margin: '7px 0 0' }}>{card.body}</p>
        {card.confidence && <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#8A909C', margin: '9px 0 0', fontStyle: 'italic' }}>{card.confidence}</p>}
      </div>
    </div>
  )
}

export default function StrategistPanel({ strategy, onDraft }: { strategy: StrategyOutput | null; onDraft?: (topic: string) => void }) {
  if (!strategy || (!strategy.cards.length && !strategy.experiments.length && !strategy.questions?.length)) {
    return (
      <div style={{ ...CARD, padding: '22px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, background: '#F1F0FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wand2 size={18} color="#5B53E0" /></span>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0E1016' }}>Your game plan appears here</div>
          <div style={{ fontSize: 13, color: '#545A66', lineHeight: 1.5, marginTop: 3, maxWidth: 480 }}>As more of your posts sync, we read your whole account and lay out what you&apos;d do next, plus ideas you can film.</div>
        </div>
      </div>
    )
  }

  const hero = strategy.experiments[0] ?? null
  const moreIdeas = strategy.experiments.slice(hero ? 1 : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(150deg,#6B62EC,#4B43C8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -8px rgba(91,83,224,.8)' }}><Wand2 size={15} color="#fff" /></span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: '#0E1016' }}>Your game plan</div>
          <div style={{ fontSize: 12, color: '#8A909C', marginTop: 1 }}>If I were managing your account this week</div>
        </div>
      </div>

      {/* hero: this week's idea */}
      {hero && (
        <div style={{ background: NAVY, borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 3px rgba(14,16,22,.06),0 30px 60px -34px rgba(20,30,80,.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9AA0D6' }}>
              <Clapperboard size={13} color="#8E86F0" /> This week&apos;s idea
            </span>
            {hero.effort && <EffortChip effort={hero.effort} onDark />}
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', color: '#fff', lineHeight: 1.3, margin: '11px 0 0' }}>{hero.title}</div>
          {hero.why && <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#CFD3EE', margin: '9px 0 0', maxWidth: 640 }}>{hero.why}</p>}
          {onDraft && (
            <div style={{ marginTop: 16 }}>
              <DraftButton light label="Draft it in Content Lab" onClick={() => onDraft(hero.title)} />
            </div>
          )}
        </div>
      )}

      {/* game-plan cards */}
      {strategy.cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {strategy.cards.map((c, i) => <GameCard key={i} card={c} />)}
        </div>
      )}

      {/* more content ideas */}
      {moreIdeas.length > 0 && (
        <div style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <Lightbulb size={16} color="#5B53E0" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>More ideas to film</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {moreIdeas.map((e, i) => (
              <div key={i} style={{ background: '#F7F8FC', border: '1px solid rgba(20,30,80,.07)', borderRadius: 11, padding: '14px 15px', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {e.effort && <div style={{ marginBottom: 7 }}><EffortChip effort={e.effort} /></div>}
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1016', lineHeight: 1.35 }}>{e.title}</div>
                  {e.why && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A2A8B6' }}>Why I think it&apos;ll work</span>
                      <div style={{ fontSize: 12.5, color: '#3A3F4B', lineHeight: 1.5, marginTop: 1 }}>{e.why}</div>
                    </div>
                  )}
                </div>
                {onDraft && <DraftButton label="Draft" onClick={() => onDraft(e.title)} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* questions */}
      {strategy.questions && strategy.questions.length > 0 && (
        <div style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <HelpCircle size={16} color="#5B53E0" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>Food for thought</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {strategy.questions.map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 0', borderTop: i ? '1px solid rgba(14,16,22,.06)' : 'none' }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: '#A2A8B6', flex: 'none', marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13.5, color: '#0E1016', lineHeight: 1.45 }}>{q}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: '#A2A8B6', marginTop: 11 }}>Run one experiment at a time and your data will start to answer these.</div>
        </div>
      )}
    </div>
  )
}

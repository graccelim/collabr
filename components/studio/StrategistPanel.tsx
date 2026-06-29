'use client'
import { useState } from 'react'
import { Sparkles, TrendingUp, AlertTriangle, Compass, ChevronDown, FlaskConical, Wand2 } from 'lucide-react'
import type { StrategyOutput, StrategyCard } from '@/lib/ai/service'

// The AI strategist layer — reasoning the charts don't give you. Premium,
// progressive-disclosure cards (collapsed → tap to expand), grouped by kind,
// plus three concrete experiments. Distinct from the deterministic facts above.
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid rgba(20,30,80,.09)', borderRadius: 14, boxShadow: '0 1px 3px rgba(14,16,22,.04),0 14px 34px -28px rgba(20,30,80,.28)' }
const MONO = "var(--font-mono, ui-monospace, monospace)"

const META: Record<string, { label: string; color: string; bg: string; Icon: typeof Sparkles }> = {
  pattern: { label: 'Hidden pattern', color: '#5B53E0', bg: '#F1F0FE', Icon: Sparkles },
  opportunity: { label: 'Opportunity', color: '#0F7A4D', bg: '#EAF4EE', Icon: TrendingUp },
  watch: { label: 'Watch out', color: '#B26B00', bg: '#FBF3E6', Icon: AlertTriangle },
  strategy: { label: 'Strategy', color: '#2A3157', bg: '#EEF1F8', Icon: Compass },
}

function StratCard({ card, defaultOpen }: { card: StrategyCard; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const m = META[card.kind] || META.strategy
  return (
    <div style={{ ...CARD, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ width: '100%', cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 'none', display: 'flex', alignItems: 'flex-start', gap: 13, padding: '15px 17px' }}>
        <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 9, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><m.Icon size={16} color={m.color} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: MONO, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: m.color, marginBottom: 3 }}>{m.label}</span>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: '#0E1016', lineHeight: 1.35 }}>{card.title}</span>
        </span>
        <ChevronDown size={17} color="#9AA0AE" style={{ flex: 'none', marginTop: 4, transition: 'transform .25s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .3s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 17px 16px 62px' }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: '#3A3F4B', margin: 0 }}>{card.body}</p>
            {card.confidence && (
              <p style={{ fontSize: 12.5, lineHeight: 1.55, color: '#8A909C', margin: '10px 0 0', display: 'flex', gap: 7 }}>
                <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: '#A2A8B6', flex: 'none', marginTop: 1 }}>Confidence</span>
                <span>{card.confidence}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StrategistPanel({ strategy }: { strategy: StrategyOutput | null }) {
  if (!strategy || (!strategy.cards.length && !strategy.experiments.length)) {
    return (
      <div style={{ ...CARD, padding: '22px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, background: '#F1F0FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wand2 size={18} color="#5B53E0" /></span>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0E1016' }}>Your strategist read appears here</div>
          <div style={{ fontSize: 13, color: '#545A66', lineHeight: 1.5, marginTop: 3, maxWidth: 480 }}>As more of your posts sync, the strategist reads your whole account, finds hidden patterns, and lays out what to test next.</div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(150deg,#6B62EC,#4B43C8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -8px rgba(91,83,224,.8)' }}><Wand2 size={15} color="#fff" /></span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: '#0E1016' }}>Your strategist</div>
          <div style={{ fontSize: 12, color: '#8A909C', marginTop: 1 }}>Reasoning the charts don&apos;t give you</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {strategy.cards.map((c, i) => <StratCard key={i} card={c} defaultOpen={i === 0} />)}
      </div>

      {strategy.experiments.length > 0 && (
        <div style={{ ...CARD, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <FlaskConical size={16} color="#5B53E0" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0E1016' }}>Experiments to run</span>
          </div>
          <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: strategy.experiments.length >= 3 ? '1fr 1fr' : '1fr', gap: 10 }}>
            {strategy.experiments.map((e, i) => (
              <div key={i} style={{ background: '#F7F8FC', border: '1px solid rgba(20,30,80,.07)', borderRadius: 11, padding: '14px 15px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1016', lineHeight: 1.35, marginBottom: 9 }}>{e.title}</div>
                {e.hypothesis && <Field label="Hypothesis" value={e.hypothesis} />}
                {e.expected && <Field label="Expected" value={e.expected} />}
                {e.confidence && <div style={{ fontSize: 11.5, color: '#8A909C', marginTop: 8 }}><span style={{ fontWeight: 600, color: '#5B53E0' }}>Confidence:</span> {e.confidence}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A2A8B6' }}>{label}</span>
      <div style={{ fontSize: 12.5, color: '#3A3F4B', lineHeight: 1.5, marginTop: 1 }}>{value}</div>
    </div>
  )
}

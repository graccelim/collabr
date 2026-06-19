import { Shield, Lock, Play, CheckCircle2, Globe, DollarSign, Check } from 'lucide-react'
import type { LucideProps } from 'lucide-react'

type Icon = React.ComponentType<Partial<LucideProps>>

/**
 * The signature escrow object (Collabr Redesign): a horizontal 5-step rail -
 * Funded → In progress → Draft approved → Posted live → Released. Completed
 * steps are secure-green, the current step is the accent blue with a soft glow,
 * upcoming steps are grey. Driven by `escrowStep()` (0–5) so it mirrors the
 * exact states the server enforces.
 */
const STEPS: { key: string; label: string; icon: Icon; note: string }[] = [
  { key: 'funded',   label: 'Funded',         icon: Lock,         note: 'Money secured' },
  { key: 'progress', label: 'In progress',    icon: Play,         note: 'Creator working' },
  { key: 'draft',    label: 'Draft approved', icon: CheckCircle2, note: 'Brand signed off' },
  { key: 'live',     label: 'Posted live',    icon: Globe,        note: 'Content public' },
  { key: 'released', label: 'Released',        icon: DollarSign,   note: 'Paid out' },
]

const GREEN = 'var(--money)'
const GREEN_SOFT = 'var(--money-tint)'
const GREEN_INK = 'var(--money-deep)'
const TRACK = '#E7E7EA'

export default function EscrowTimeline({ current = 1, amount }: { current?: number; amount: string }) {
  return (
    <div className="card" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color={GREEN} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Payment protection</span>
        </div>
        <span className="badge badge-money">
          <Lock size={12} />
          {amount} held safely
        </span>
      </div>

      {/* steps */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          const StepIcon = s.icon
          const labelColor = active ? 'var(--ink)' : done ? GREEN_INK : 'var(--ink-faint-solid)'
          return (
            <div key={s.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minWidth: 0 }}>
              {/* connector to the next step */}
              {i < STEPS.length - 1 && (
                <div style={{
                  position: 'absolute', top: 15, left: '50%', right: '-50%',
                  height: 2.5, borderRadius: 2,
                  background: done ? GREEN : TRACK,
                }} />
              )}
              {/* node */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', zIndex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? GREEN : 'var(--surface)',
                color: done ? '#fff' : active ? 'var(--accent)' : 'var(--ink-faint-solid)',
                border: `2px solid ${done ? GREEN : active ? 'var(--accent)' : TRACK}`,
                boxShadow: active ? '0 0 0 4px var(--accent-tint)' : 'none',
              }}>
                {done ? <Check size={15} strokeWidth={2.4} /> : <StepIcon size={15} />}
              </div>
              {/* labels - per-step notes hide on mobile to cut clutter */}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div className="escrow-step-label" style={{ fontSize: 12, fontWeight: 540, color: labelColor }}>{s.label}</div>
                <div className="micro escrow-note" style={{ marginTop: 1 }}>{s.note}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

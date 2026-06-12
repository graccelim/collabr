import { Check, Clock, Scale } from 'lucide-react'
import { deriveWorkflow, actorLabel, formatDeadline } from '@/lib/workflow'

interface Props {
  status: string
  paymentStatus: string
  isBrand: boolean
  counterpartName: string
  revisionCount?: number
  draftAutoApproveAt?: string | null
  liveAutoReleaseAt?: string | null
}

/**
 * Reusable workflow timeline: completed steps, current stage, next expected
 * action and who must act. Display-only — derives everything from the same
 * states the server enforces.
 */
export default function WorkflowTimeline(props: Props) {
  const view = deriveWorkflow(props)
  const turn = actorLabel(view, props.isBrand, props.counterpartName)

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="eyebrow">Progress</span>
        {turn.label && (
          <span className={`badge ${turn.yourTurn ? 'badge-accent' : view.actor === 'platform' ? 'badge-warn' : 'badge-neutral'}`}>
            {view.actor === 'platform' && <Scale size={11} />}
            {turn.label}
          </span>
        )}
      </div>

      {/* Steps */}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {view.steps.map((step, i) => {
          const last = i === view.steps.length - 1
          const done = step.state === 'done'
          const current = step.state === 'current'
          return (
            <li key={step.key} style={{ display: 'flex', gap: 10, position: 'relative' }}>
              {/* dot + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18, flexShrink: 0 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  display: 'grid', placeItems: 'center',
                  background: done ? 'var(--accent)' : current ? 'var(--accent-tint)' : 'var(--paper-2)',
                  border: current ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  color: done ? '#fff' : current ? 'var(--accent-deep)' : 'var(--ink-faint-solid)',
                }}>
                  {done
                    ? <Check size={11} strokeWidth={3} />
                    : current
                      ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                      : <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', opacity: .5 }} />}
                </div>
                {!last && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 10, margin: '2px 0',
                    background: done ? 'var(--accent)' : 'var(--line)',
                    borderRadius: 2, opacity: done ? .5 : 1,
                  }} />
                )}
              </div>
              <div style={{ paddingBottom: last ? 0 : 10, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: current ? 600 : 500,
                  color: done || current ? 'var(--ink)' : 'var(--ink-faint-solid)',
                  lineHeight: '18px',
                }}>
                  {step.label}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {/* What happened / what's next */}
      <div style={{
        marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{view.happened}</p>
        <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.5 }}>{view.next}</p>
        {view.deadline && (
          <p style={{
            fontSize: 12.5, color: 'var(--warn-deep)', display: 'flex',
            alignItems: 'center', gap: 5, margin: 0,
          }}>
            <Clock size={12} style={{ flexShrink: 0 }} />
            Automatic on {formatDeadline(view.deadline)}
          </p>
        )}
      </div>
    </div>
  )
}

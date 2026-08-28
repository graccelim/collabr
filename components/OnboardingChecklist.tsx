import Link from 'next/link'
import { Check, Circle, ArrowRight } from 'lucide-react'
import type { StepsSummary } from '@/lib/onboarding-steps'

/**
 * The guided setup surface at the top of the dashboard. Runs the WHOLE
 * journey — the hard gate steps and the recommended-path steps after them —
 * with one spotlighted next step, and disappears at 100%. Steps are derived
 * from live profile data (lib/onboarding-steps), so it resumes wherever the
 * user left off. Step 1 arrives pre-checked — the endowed-progress head start.
 */
export default function OnboardingChecklist({ summary, greeting, readyNote }: {
  summary: StepsSummary
  greeting?: string
  /** Shown as a green status banner once the activation gate is open. */
  readyNote?: string
}) {
  const { steps, done, total, current, ready } = summary
  const pct = Math.round((done / total) * 100)

  return (
    <div className="card" style={{ padding: 22, marginBottom: 18 }}>
      {/* Title gets the full row to itself so it can wrap freely at any
          width - it previously shared a flex row with the "N of M done"
          badge, which stayed pinned beside the title's first line even when
          the title wrapped to two lines on narrow phones, producing a
          ragged overlap. The badge now sits beside the progress bar it
          actually describes instead. */}
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>
        {greeting || 'Welcome to Collabr'}
      </h2>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 12px' }}>
        Your account is live. A couple of quick steps and you&rsquo;re in business — pick up where you left off anytime.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent-deep)' }}>
          {done} of {total} done
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width .3s ease' }} />
      </div>

      {/* "Ready" is a STATE, not a step — once the gate is open it reads as a
          live status, never as an out-of-order tick at the bottom of the list. */}
      {ready && readyNote && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
          padding: '9px 12px', borderRadius: 'var(--radius-sm)',
          background: 'var(--money-tint)',
        }}>
          <Check size={15} color="var(--money-deep)" style={{ flexShrink: 0 }} strokeWidth={3} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--money-deep)' }}>{readyNote}</span>
        </div>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {steps.map((s, i) => {
          const isCurrent = current?.key === s.key
          const row = (
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {s.done
                ? <Check size={17} color="var(--money-deep)" style={{ flexShrink: 0, marginTop: 2 }} />
                : <Circle size={17} color={isCurrent ? 'var(--accent)' : 'var(--ink-faint-solid)'} style={{ flexShrink: 0, marginTop: 2 }} />}
              <span style={{ minWidth: 0 }}>
                <span style={{
                  display: 'block', fontSize: 14,
                  fontWeight: isCurrent ? 640 : 500,
                  color: s.done ? 'var(--ink-faint-solid)' : 'var(--ink)',
                  textDecoration: s.done ? 'line-through' : 'none',
                }}>
                  <span style={{ color: 'var(--ink-faint-solid)', fontWeight: 500 }}>Step {i + 1}</span> — {s.label}
                </span>
                {isCurrent && s.detail && (
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 2 }}>
                    {s.detail}
                  </span>
                )}
              </span>
            </span>
          )
          return (
            <li key={s.key} style={{
              padding: isCurrent ? '12px 14px' : '7px 14px',
              borderRadius: 'var(--radius-sm)',
              background: isCurrent ? 'var(--accent-tint)' : 'transparent',
              border: isCurrent ? '1px solid var(--accent-tint-2)' : '1px solid transparent',
            }}>
              {s.href && !s.done ? (
                <Link href={s.href} style={{ textDecoration: 'none', display: 'block' }}>
                  {row}
                  {isCurrent && s.cta && (
                    <span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, marginLeft: 27, fontSize: 13.5, padding: '8px 16px' }}>
                      {s.cta} <ArrowRight size={15} />
                    </span>
                  )}
                </Link>
              ) : row}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

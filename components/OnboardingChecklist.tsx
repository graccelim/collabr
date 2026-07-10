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
export default function OnboardingChecklist({ summary, greeting }: {
  summary: StepsSummary
  greeting?: string
}) {
  const { steps, done, total, current } = summary
  const pct = Math.round((done / total) * 100)

  return (
    <div className="card" style={{ padding: 22, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
          {greeting || 'Welcome to Collabr'}
        </h2>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--accent-deep)', whiteSpace: 'nowrap' }}>
          {done} of {total} done
        </span>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 14px' }}>
        Your account is live. A couple of quick steps and you&rsquo;re in business — pick up where you left off anytime.
      </p>
      <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width .3s ease' }} />
      </div>

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

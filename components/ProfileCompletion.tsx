import Link from 'next/link'
import { Check, Circle, Sparkles } from 'lucide-react'

interface Props {
  hasPhoto: boolean
  hasBio: boolean
  hasNiche: boolean
  hasRates: boolean
  hasExtraSocials: boolean
}

/**
 * Post-onboarding "Welcome to Collabr" card. The profile is already live (only a
 * social was required); this nudges the OPTIONAL fields with a completion % so
 * creators improve discoverability without being blocked up front. Hidden at 100%.
 */
export default function ProfileCompletion({ hasPhoto, hasBio, hasNiche, hasRates, hasExtraSocials }: Props) {
  const items = [
    { label: 'Add a profile photo', done: hasPhoto },
    { label: 'Add a short bio', done: hasBio },
    { label: 'Add your niche', done: hasNiche },
    { label: 'Add your rates', done: hasRates },
    { label: 'Add another social account', done: hasExtraSocials },
  ]
  const done = items.filter(i => i.done).length
  const pct = Math.round((done / items.length) * 100)
  if (pct === 100) return null

  return (
    <div className="card" style={{ padding: 20, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Sparkles size={17} color="var(--accent-deep)" />
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Welcome to Collabr</h2>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--accent-deep)' }}>{pct}% complete</span>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 14px' }}>
        Your profile is live. Complete your profile to improve your chances of getting discovered by brands.
      </p>
      {/* progress bar */}
      <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width .3s ease' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(i => (
          <Link key={i.label} href="/profile" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: i.done ? 'var(--ink-faint-solid)' : 'var(--ink)', textDecoration: i.done ? 'line-through' : 'none' }}>
            {i.done
              ? <Check size={16} color="var(--money-deep)" style={{ flexShrink: 0 }} />
              : <Circle size={16} color="var(--ink-faint-solid)" style={{ flexShrink: 0 }} />}
            {i.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

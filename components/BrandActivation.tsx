import Link from 'next/link'
import { Check, Circle, Rocket } from 'lucide-react'

interface Props {
  hasCampaign: boolean
  hasInvited: boolean
  hasFunded: boolean
  hasDraft: boolean
}

/**
 * Brand activation checklist — gets a new brand to their first collaboration as
 * fast as possible. Hidden once all four are done.
 */
export default function BrandActivation({ hasCampaign, hasInvited, hasFunded, hasDraft }: Props) {
  const items = [
    { label: 'Create your first campaign', done: hasCampaign, href: '/post-job' },
    { label: 'Invite creators', done: hasInvited, href: '/creators' },
    { label: 'Fund your first collaboration', done: hasFunded, href: '/collabs' },
    { label: 'Receive your first draft', done: hasDraft, href: '/collabs' },
  ]
  const done = items.filter(i => i.done).length
  const pct = Math.round((done / items.length) * 100)
  if (pct === 100) return null

  return (
    <div className="card" style={{ padding: 20, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Rocket size={17} color="var(--accent-deep)" />
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Get to your first collaboration</h2>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--accent-deep)' }}>{pct}% complete</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', margin: '8px 0 14px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width .3s ease' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(i => (
          <Link key={i.label} href={i.href} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: i.done ? 'var(--ink-faint-solid)' : 'var(--ink)', textDecoration: i.done ? 'line-through' : 'none' }}>
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

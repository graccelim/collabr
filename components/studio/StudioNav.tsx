import Link from 'next/link'

// Server-rendered tab nav for Creator Studio (query-param driven, mobile-scrollable).
const TABS = [
  ['insights', 'Insights'],
  ['content-lab', 'Content Lab'],
  ['reports', 'Reports'],
] as const

export default function StudioNav({ active }: { active: string }) {
  return (
    <nav style={{ display: 'flex', gap: 6, overflowX: 'auto', borderBottom: '1px solid var(--line)', marginBottom: 18, paddingBottom: 1 }}>
      {TABS.map(([key, label]) => {
        const on = active === key
        return (
          <Link key={key} href={`/studio?tab=${key}`} scroll={false}
            style={{
              fontSize: 13.5, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap',
              color: on ? 'var(--accent)' : 'var(--ink-soft)', textDecoration: 'none',
              padding: '9px 12px', borderBottom: `2px solid ${on ? 'var(--accent)' : 'transparent'}`,
            }}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

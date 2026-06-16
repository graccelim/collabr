import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

export interface ProfileStat {
  label: string
  value: string
  sub?: string
  icon: ComponentType<LucideProps>
  tone?: 'accent' | 'money' | 'warn' | 'neutral'
}

/**
 * Premium stat band for the creator/brand profile headers. A flat, hairline-bounded
 * strip - soft tinted circular icons on the left, tabular figures on the right -
 * reading as a polished summary rather than a cardy admin panel. 2-up on phones.
 */
export default function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  return (
    <div className="profile-stats">
      {stats.map(s => (
        <div key={s.label} className="profile-stat">
          <span className="profile-stat-icon" data-tone={s.tone || 'neutral'}>
            <s.icon size={18} />
          </span>
          <div className="profile-stat-body">
            <div className="profile-stat-val">{s.value}</div>
            <div className="profile-stat-label">{s.label}</div>
            {s.sub && <div className="profile-stat-sub">{s.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

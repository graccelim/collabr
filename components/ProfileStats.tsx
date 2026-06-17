import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

export interface ProfileStat {
  label: string
  value: string
  sub?: string
  icon?: ComponentType<LucideProps>
  tone?: 'accent' | 'money' | 'warn' | 'neutral'
}

/**
 * Flat stat band for the creator/brand profile headers - a hairline-bounded strip
 * of value / label / sub columns divided by thin rules, sitting on the light-blue
 * canvas. Stays a single 4-up row on every width (sub hidden on phones).
 */
export default function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  return (
    <div className="profile-stats">
      {stats.map(s => (
        <div key={s.label} className="profile-stat">
          <div className="profile-stat-val">{s.value}</div>
          <div className="profile-stat-label">{s.label}</div>
          {s.sub && <div className="profile-stat-sub">{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}

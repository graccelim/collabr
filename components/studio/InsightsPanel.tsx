'use client'
import { useState } from 'react'
import EmptyState from '@/components/EmptyState'
import PlatformInsights from '@/components/studio/PlatformInsights'
import PlatformSwitcher from '@/components/studio/PlatformSwitcher'
import { BarChart3 } from 'lucide-react'

// Flagship Insights: ONE platform at a time (content behaves differently per
// platform — never merged). A shared switcher flips between connected platforms.
const ORDER = ['tiktok', 'instagram', 'youtube']
type Row = { platform: string; data: any; ai_narrative: string | null }

export default function InsightsPanel({ platformInsights }: { platformInsights: Row[] }) {
  const rows = [...platformInsights].sort((a, b) => ORDER.indexOf(a.platform) - ORDER.indexOf(b.platform))
  const [active, setActive] = useState(rows[0]?.platform ?? '')

  if (!rows.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Your insights appear here once accounts sync"
        body="Connect TikTok, Instagram or YouTube above. We analyse each platform separately and surface your winning patterns, best posting windows and long term trends, kept forever, even after the native apps delete the data."
        steps={['Connect an account', 'We analyse each platform', 'See your winning patterns']}
      />
    )
  }

  const row = rows.find((r) => r.platform === active) ?? rows[0]

  return (
    <div>
      {rows.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <PlatformSwitcher platforms={rows.map((r) => r.platform)} active={row.platform} onSelect={setActive} />
        </div>
      )}
      <PlatformInsights key={row.platform} row={row} />
    </div>
  )
}

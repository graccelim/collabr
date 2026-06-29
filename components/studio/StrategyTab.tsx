'use client'
import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import PlatformSwitcher from '@/components/studio/PlatformSwitcher'
import StrategistPanel from '@/components/studio/StrategistPanel'
import type { StrategyOutput } from '@/lib/ai/service'

// The Strategy tab — per-platform AI strategist (reasoning beyond the deterministic
// facts). Numbers live in Insights; this is where the direction lives.
const ORDER = ['tiktok', 'instagram', 'youtube']
type Row = { platform: string; data: any; ai_narrative: string | null; ai_strategy?: StrategyOutput | null }

export default function StrategyTab({ platformInsights }: { platformInsights: Row[] }) {
  const rows = [...platformInsights].sort((a, b) => ORDER.indexOf(a.platform) - ORDER.indexOf(b.platform))
  const [active, setActive] = useState(rows[0]?.platform ?? '')

  if (!rows.length) {
    return (
      <EmptyState
        icon={Wand2}
        title="Your strategist appears once accounts sync"
        body="Connect a platform and sync your posts. The strategist reads your whole account, surfaces hidden patterns, flags risks, and lays out experiments to run, beyond what the charts show."
        steps={['Connect an account', 'We read your whole account', 'Get personalised direction']}
      />
    )
  }

  const row = rows.find((r) => r.platform === active) ?? rows[0]

  return (
    <div>
      {rows.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <PlatformSwitcher platforms={rows.map((r) => r.platform)} active={row.platform} onSelect={setActive} />
        </div>
      )}
      <StrategistPanel key={row.platform} strategy={row.ai_strategy ?? null} />
    </div>
  )
}

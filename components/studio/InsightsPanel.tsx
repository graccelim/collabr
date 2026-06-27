'use client'
import { useState } from 'react'
import EmptyState from '@/components/EmptyState'
import PlatformInsights from '@/components/studio/PlatformInsights'
import { socialIcon } from '@/components/SocialIcon'
import { BarChart3 } from 'lucide-react'

// Flagship Insights: ONE platform at a time (content behaves differently per
// platform — never merged). A segmented switcher (our brand glyphs) flips between
// the connected platforms; each renders the full per-platform analytics panel.
const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }
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
        <div className="pi-switch" style={{ marginBottom: 18, display: 'inline-flex', background: '#F1F5FC', border: '1px solid rgba(20,30,80,.09)', borderRadius: 11, padding: 4 }}>
          {rows.map((r) => {
            const on = r.platform === row.platform
            const Glyph = socialIcon(r.platform)
            return (
              <button key={r.platform} type="button" onClick={() => setActive(r.platform)}
                style={{
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 8,
                  padding: '8px 15px', fontSize: 13.5, fontWeight: 600,
                  background: on ? '#fff' : 'transparent', color: on ? '#0E1016' : '#8A909C',
                  boxShadow: on ? '0 2px 6px -2px rgba(14,16,22,.18)' : 'none',
                }}>
                <Glyph size={15} /> {LABEL[r.platform] || r.platform}
              </button>
            )
          })}
        </div>
      )}
      <PlatformInsights key={row.platform} row={row} />
    </div>
  )
}

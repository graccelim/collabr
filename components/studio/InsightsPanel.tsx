import EmptyState from '@/components/EmptyState'
import PlatformInsights from '@/components/studio/PlatformInsights'
import { BarChart3, Layers } from 'lucide-react'

// Flagship Insights: each platform analysed SEPARATELY (content behaves
// differently per platform), then a lightweight cross-platform strengths summary.
// No merged metrics. Deterministic-first; AI narration is an overlay per section.
const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }
const RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

type Row = { platform: string; data: any; ai_narrative: string | null }

export default function InsightsPanel({ platformInsights }: { platformInsights: Row[] }) {
  if (!platformInsights.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Your insights appear here once accounts sync"
        body="Connect TikTok, Instagram or YouTube above. We analyse each platform separately and surface your winning patterns, best posting windows and long-term trends — kept forever, even after the native apps delete the data."
        steps={['Connect an account', 'We analyse each platform', 'See your winning patterns']}
      />
    )
  }

  // Cross-platform strengths: each platform's single highest-confidence insight.
  const strengths = platformInsights.map((r) => {
    const ins: any[] = Array.isArray(r.data?.insights) ? r.data.insights : []
    const best = [...ins].sort((a, b) => (RANK[b.confidence] || 0) - (RANK[a.confidence] || 0))[0]
    return { platform: r.platform, headline: r.data?.strongest || best?.title || null }
  }).filter((s) => s.headline)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {platformInsights.map((r) => <PlatformInsights key={r.platform} row={r} />)}

      {strengths.length >= 2 && (
        <section className="card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} color="var(--accent)" /> Across your platforms
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {strengths.map((s) => (
              <div key={s.platform} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                <span style={{ fontWeight: 700, minWidth: 92 }}>{LABEL[s.platform] || s.platform}</span>
                <span style={{ color: 'var(--ink-soft)' }}>{s.headline}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 12 }}>
            Each platform is analysed on its own — never merged — and only against your own history.
          </p>
        </section>
      )}
    </div>
  )
}

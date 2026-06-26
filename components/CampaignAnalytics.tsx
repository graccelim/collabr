import { flags } from '@/lib/flags'
import { BarChart3, Trophy } from 'lucide-react'
import CampaignRecapButton from '@/components/CampaignRecapButton'
import TrendBars from '@/components/TrendBars'
import MockBanner from '@/components/MockBanner'

// Brand campaign analytics (Brand Plus + analytics suite). Deterministic only —
// the brand's OWN campaign, no marketplace comparison, no global ranking. States:
// suite-off → hidden · not Plus → upgrade prompt · no rollup → empty ·
// partial coverage → metrics + "X of Y connected" + which creators aren't connected.
function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}
function pct(n: number | null | undefined): string { return n == null ? '—' : `${(n * 100).toFixed(1)}%` }
function money(cents: number | null | undefined): string {
  return cents == null ? '—' : `S$${(cents / 100).toFixed(cents < 100 ? 3 : 2)}`
}

export default function CampaignAnalytics({
  campaignId, isPlus, rollup, unlinkedNames = [],
}: {
  campaignId: string
  isPlus: boolean
  rollup: Record<string, any> | null
  unlinkedNames?: string[]
}) {
  if (!flags.analyticsSuite) return null

  const Header = (
    <h2 className="h2" style={{ fontSize: 18, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
      <BarChart3 size={17} color="var(--accent)" /> Campaign analytics
    </h2>
  )

  if (!isPlus) {
    return (
      <section style={{ marginTop: 28 }}>
        {Header}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Campaign analytics is part of Brand Plus</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '3px 0 0', lineHeight: 1.5 }}>
            See views, reach, engagement, cost-per-view and per-creator results for your campaigns. Upgrade from Billing.
          </p>
        </div>
      </section>
    )
  }

  if (!rollup) {
    return (
      <section style={{ marginTop: 28 }}>
        {Header}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>No analytics yet</div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '3px 0 0', lineHeight: 1.5 }}>
            Analytics appear once Connected creators on this campaign publish and sync their posts. Creators who
            haven't connected supported accounts won't have synced metrics.
          </p>
        </div>
      </section>
    )
  }

  const t = rollup.totals || {}, d = rollup.derived || {}, cov = rollup.coverage || {}
  const perCreator: any[] = Array.isArray(rollup.per_creator) ? rollup.per_creator : []
  const platforms = rollup.by_platform || {}
  const partial = cov.creatorsConnected != null && cov.creatorsTotal != null && cov.creatorsConnected < cov.creatorsTotal

  return (
    <section style={{ marginTop: 28 }}>
      {Header}
      <div style={{ marginBottom: 12 }}><MockBanner /></div>

      {partial && (
        <div className="card" style={{ padding: '11px 14px', marginBottom: 12, background: 'var(--warn-tint)', border: '1px solid rgba(178,106,30,.22)' }}>
          <div style={{ fontSize: 13, color: 'var(--warn-deep, #8a531a)' }}>
            <strong>{cov.creatorsConnected} of {cov.creatorsTotal}</strong> creators have connected — analytics use available data only, nothing is estimated.
            {unlinkedNames.length > 0 && <> Not connected: {unlinkedNames.join(', ')}.</>}
          </div>
        </div>
      )}

      <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
        {[['Total views', fmt(t.views)], ['Total reach', fmt(t.reach)], ['Total engagement', fmt(t.engagement)],
          ['Engagement rate', pct(d.engagementRate)], ['Cost / view', money(d.cpvCents)], ['Cost / engagement', money(d.cpeCents)]].map(([l, v]) => (
          <div key={l} className="card" style={{ padding: '13px 15px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {Object.keys(platforms).length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>
          By platform: {Object.entries(platforms).map(([p, m]: [string, any]) => `${p[0].toUpperCase()}${p.slice(1)} ${fmt(m.views)} views`).join(' · ')}
        </div>
      )}

      {perCreator.length > 0 && (
        <div className="card" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ fontSize: 10.5, color: 'var(--ink-faint-solid)', marginBottom: 8 }}>Per-creator results (this campaign)</div>
          {perCreator.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.handle || 'Creator'}</span>
              <span style={{ color: 'var(--ink-soft)' }}>{fmt(c.totals?.views)} views</span>
              <span style={{ color: 'var(--ink-faint-solid)' }}>CPV {money(c.cpvCents)}</span>
            </div>
          ))}
        </div>
      )}

      {rollup.top_post?.url && (
        <div className="card" style={{ padding: '12px 14px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trophy size={16} color="var(--accent)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow" style={{ fontSize: 10, color: 'var(--ink-faint-solid)' }}>Top performing post</div>
            <a href={rollup.top_post.url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {rollup.top_post.url}
            </a>
          </div>
          {rollup.top_post.interactions != null && (
            <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmt(rollup.top_post.interactions)} interactions</span>
          )}
        </div>
      )}

      {Array.isArray(rollup.trends) && rollup.trends.length >= 2 && (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <TrendBars data={rollup.trends} label="Campaign views over time" />
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--ink-faint-solid)', marginTop: 10 }}>
        Your campaign's own results — never a comparison to other brands or a global creator ranking.
      </p>

      {flags.analyticsAi && <CampaignRecapButton campaignId={campaignId} />}
    </section>
  )
}

import Link from 'next/link'
import { flags } from '@/lib/flags'
import { BarChart3, ArrowRight } from 'lucide-react'

// Brand-facing Connected analytics on a creator profile. Shows ONLY the curated
// aggregate (avg views/engagement/reach + platform breakdown + last synced) —
// never the creator's full Content DNA, goals, or AI. Facts only, no ranking.
// When the creator hasn't connected, the section is HIDDEN for everyone (carrot,
// not stick) — except the owner, who sees a private "connect" nudge.
function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}
function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${(n * 100).toFixed(1)}%`
}
function lastSynced(iso: string | null): string {
  if (!iso) return 'recently'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return d <= 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} ago`
}

export default function BrandConnectedAnalytics({
  connected, lastSyncedAt, platforms, rollup, isOwner = false,
}: {
  connected: boolean
  lastSyncedAt: string | null
  platforms: string[]
  rollup: Record<string, any> | null
  /** Viewer is the creator who owns this profile (sees a private connect nudge). */
  isOwner?: boolean
}) {
  if (!flags.connectedCreator) return null

  if (!connected || !rollup) {
    // Brands/visitors: hide the section entirely (no penalty for not connecting).
    if (!isOwner) return null
    // Owner only: a private nudge to connect (brands never see this).
    return (
      <section style={{ marginBottom: 30 }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius)', padding: '18px 20px', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <BarChart3 size={16} color="var(--accent-deep)" />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Show brands verified performance</div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 12px', lineHeight: 1.5, maxWidth: 520 }}>
            Connect your TikTok, Instagram or YouTube in Creator Studio — brands will then see your synced views,
            engagement and reach right here. Only you can see this prompt.
          </p>
          <Link href="/studio" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--accent-deep)', textDecoration: 'none' }}>
            Connect accounts <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    )
  }

  const avg = rollup.averages || {}
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 className="h2" style={{ fontSize: 18, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BarChart3 size={17} color="var(--accent)" /> Performance analytics
        <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 500, color: 'var(--ink-faint-solid)' }}>
          Synced {lastSynced(lastSyncedAt)}
        </span>
      </h2>
      <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[['Avg views', fmt(avg.views)], ['Avg engagement', pct(avg.engagementRate)], ['Avg reach', fmt(avg.reach)]].map(([l, v]) => (
          <div key={l} className="card" style={{ padding: '13px 15px' }}>
            <div style={{ fontSize: 19, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{v}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint-solid)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      {platforms.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10 }}>
          Platforms: {platforms.map((p) => p[0].toUpperCase() + p.slice(1)).join(' · ')}
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--ink-faint-solid)', marginTop: 8 }}>
        Averages from the creator's own recent posts. Not a ranking or comparison to other creators.
      </p>
    </section>
  )
}

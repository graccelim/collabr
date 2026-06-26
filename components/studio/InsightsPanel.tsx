import EmptyState from '@/components/EmptyState'
import TrendBars from '@/components/TrendBars'
import { BarChart3, TrendingUp } from 'lucide-react'

// Renders the creator's OWN deterministic analytics (content_dna + creator_rollups):
// Performance Overview + "Your Strengths" (Content DNA). Self-only, facts-only — no
// comparison, no score. High-quality empty state when nothing has synced yet.
function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}
function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${(n * 100).toFixed(1)}%`
}

type Row = Record<string, any> | null

export default function InsightsPanel({ rollup, dna }: { rollup: Row; dna: Row }) {
  if (!rollup && !dna) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Your insights appear here once accounts sync"
        body="Connect TikTok, Instagram or YouTube above. Within a day you'll see your average views, engagement, strongest content and best times to post — all from your own history."
        steps={['Connect an account', 'We sync overnight', 'See your strengths']}
      />
    )
  }

  const avg = rollup?.averages || {}
  const byPlatform: Record<string, any> = rollup?.by_platform || {}
  const platforms = Object.entries(byPlatform)

  const best = (key: string) => (Array.isArray(dna?.[key]) ? dna[key].slice(0, 3) : [])
  const cats = best('best_categories'), plats = best('best_platforms'), styles = best('best_content_styles')
  const days = best('best_posting_days'), times = best('best_posting_times')
  const videoLen = dna?.best_video_length?.key ?? null
  const ppw = dna?.posting_consistency?.postsPerWeek ?? null

  const Strength = ({ label, value }: { label: string; value: string | null }) =>
    value ? (
      <div>
        <div className="eyebrow" style={{ fontSize: 10, color: 'var(--ink-faint-solid)' }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{value}</div>
      </div>
    ) : null
  const join = (items: any[]) => items.map((i) => i.key || i.platform || i).filter(Boolean).join(' · ') || null
  const hasStrengths = cats.length || plats.length || styles.length || days.length || times.length || videoLen || ppw != null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Performance Overview ── */}
      <section style={{
        borderRadius: 14, padding: 18, color: '#fff', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(100deg, transparent 58%, rgba(118,146,228,0.05) 74%, rgba(128,156,238,0.10) 82%, rgba(118,146,228,0.02) 90%, transparent 98%), radial-gradient(115% 105% at 84% -14%, rgba(150,172,235,0.09), transparent 42%), linear-gradient(152deg, #232c57 0%, #0e1538 46%, #05081c 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        <span className="eyebrow" style={{ color: 'var(--accent-on-dark)', fontSize: 10.5 }}>Performance overview</span>
        <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 12 }}>
          {[['Avg views', fmt(avg.views)], ['Avg engagement', pct(avg.engagementRate)], ['Avg reach', fmt(avg.reach)], ['Posts', fmt(rollup?.posts ?? null)]].map(([l, v]) => (
            <div key={l}>
              <div className="shiny-num" style={{ fontFamily: 'var(--font-money)', fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 24, letterSpacing: '-0.02em' }}>{v}</div>
              <div style={{ fontSize: 11, color: 'var(--accent-on-dark)', marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Historical trend + platform breakdown */}
      {(Array.isArray(rollup?.trends) && rollup!.trends.length >= 2) || platforms.length ? (
        <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TrendBars data={rollup?.trends} label="Total views over time" />
          {platforms.length > 0 && (
            <div>
              <div className="eyebrow" style={{ fontSize: 10, color: 'var(--ink-faint-solid)', marginBottom: 8 }}>Platform breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {platforms.map(([p, m]) => (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ flex: 1, fontWeight: 600, textTransform: 'capitalize' }}>{p}</span>
                    <span style={{ color: 'var(--ink-soft)' }}>{fmt(m.totals?.views)} views</span>
                    <span style={{ color: 'var(--ink-faint-solid)' }}>{m.posts} post{m.posts === 1 ? '' : 's'}</span>
                    <span style={{ color: 'var(--ink-faint-solid)' }}>{pct(m.avgEngagementRate)} eng.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* ── Your Strengths (Content DNA) ── */}
      {hasStrengths ? (
        <section className="card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} color="var(--accent)" /> Your Strengths
          </h3>
          <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Strength label="Best performing categories" value={join(cats)} />
            <Strength label="Best platforms" value={join(plats)} />
            <Strength label="Best content styles" value={join(styles)} />
            <Strength label="Best posting days" value={join(days)} />
            <Strength label="Best posting times" value={join(times)} />
            <Strength label="Best video length" value={videoLen} />
            <Strength label="Posting consistency" value={ppw != null ? `${ppw} posts / week` : null} />
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-faint-solid)', marginTop: 14 }}>
            Calculated from your own posts. Compared only against your own history — never other creators.
          </p>
        </section>
      ) : null}
    </div>
  )
}

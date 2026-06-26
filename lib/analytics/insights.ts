// Deterministic per-platform insight engine — the spine of Creator Insights.
// Pure functions over ONE platform's posts (content behaves differently per
// platform, so we NEVER merge platforms). Everything is computed from the
// creator's OWN history; never compared to other creators. AI later *narrates*
// these structured outputs — it never produces the numbers. Works fully without AI.
//
// We lean on engagement RATE (interactions/views) and recency, not cumulative
// totals, so older posts aren't unfairly favoured by age.

import type { Platform } from './adapters/types'

export type Confidence = 'high' | 'medium' | 'low'

export interface InsightPost {
  postedAt: Date | null
  durationSec: number | null
  category: string | null
  subcategory: string | null
  style: string | null
  format: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
}

export interface Insight {
  key: string
  title: string
  why: string
  evidence: string
  recommendation: string
  confidence: Confidence
  narrative?: string // filled by AI (optional)
}

export interface PlatformInsights {
  platform: Platform
  postCount: number
  overview: { medianViews: number | null; avgViews: number | null; avgEngagementRate: number | null }
  trend: { date: string; views: number }[]
  insights: Insight[]
  /** One-line "strongest at …" for the cross-platform summary (null if unknown). */
  strongest: string | null
  /** Overall confidence in the section (drives the learning state). */
  dataConfidence: Confidence
  narrative?: string // AI analyst's read of the platform (optional)
}

// ── helpers ─────────────────────────────────────────────────────────────────
const n = (v: number | null | undefined): number => (v == null ? 0 : v)
function interactions(p: InsightPost): number { return n(p.likes) + n(p.comments) + n(p.shares) + n(p.saves) }
function rate(p: InsightPost): number | null {
  const d = p.views ?? p.reach
  if (d == null || d <= 0) return null
  return interactions(p) / d
}
function avg(xs: number[]): number | null { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null }
function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const pct = (x: number | null) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
const conf = (sample: number): Confidence => (sample >= 12 ? 'high' : sample >= 6 ? 'medium' : 'low')

function lengthBucket(sec: number | null): string | null {
  if (sec == null) return null
  if (sec < 15) return 'under 15s'
  if (sec < 30) return '15–30s'
  if (sec < 60) return '30–60s'
  return '60s+'
}
function dayPart(h: number): string {
  if (h < 6) return 'late night (12–6am)'
  if (h < 12) return 'morning (6am–12pm)'
  if (h < 18) return 'afternoon (12–6pm)'
  return 'evening (6pm–12am)'
}

// Best value of a grouping key, by avg engagement rate, vs the overall baseline.
function bestBy(
  posts: InsightPost[], label: (p: InsightPost) => string | null, baseline: number | null,
): { key: string; sample: number; value: number } | null {
  const groups = new Map<string, number[]>()
  for (const p of posts) {
    const k = label(p); const r = rate(p)
    if (k == null || r == null) continue
    const arr = groups.get(k) ?? []; arr.push(r); groups.set(k, arr)
  }
  let best: { key: string; sample: number; value: number } | null = null
  for (const [k, rs] of Array.from(groups)) {
    if (rs.length < 3) continue // ignore thin buckets
    const v = avg(rs)!
    if (!best || v > best.value) best = { key: k, sample: rs.length, value: v }
  }
  if (!best || baseline == null || best.value <= baseline) return null
  return best
}

/**
 * Compute a platform's full insight set. `trend` is a pre-built [{date,views}]
 * series from our nightly snapshots (the longitudinal memory native tools lose).
 */
export function computePlatformInsights(
  platform: Platform, posts: InsightPost[], trend: { date: string; views: number }[] = [],
): PlatformInsights {
  const withViews = posts.filter((p) => p.views != null)
  const rates = posts.map(rate).filter((x): x is number => x != null)
  const baseline = avg(rates)
  const overview = {
    medianViews: median(withViews.map((p) => p.views as number)),
    avgViews: avg(withViews.map((p) => p.views as number)),
    avgEngagementRate: baseline,
  }
  const insights: Insight[] = []
  let strongest: string | null = null

  // 1. Best video length
  const len = bestBy(posts, (p) => lengthBucket(p.durationSec), baseline)
  if (len) insights.push({
    key: 'best_length',
    title: `Your ${len.key} posts outperform your others`,
    why: 'Shorter or longer formats hold attention differently for your audience.',
    evidence: `${len.key}: ${pct(len.value)} avg engagement vs your ${pct(baseline)} baseline (${len.sample} posts).`,
    recommendation: `Make more ${len.key} content and watch whether the lift holds.`,
    confidence: conf(len.sample),
  })

  // 2. Best posting window (by OUTCOME, not follower presence)
  const win = bestBy(posts, (p) => (p.postedAt ? dayPart(p.postedAt.getHours()) : null), baseline)
  if (win) insights.push({
    key: 'best_window',
    title: `Posting in the ${win.key} works best for you`,
    why: 'This is based on how your posts actually performed — not just when followers are online.',
    evidence: `${win.key}: ${pct(win.value)} avg engagement vs ${pct(baseline)} baseline (${win.sample} posts).`,
    recommendation: `Schedule more posts in the ${win.key}.`,
    confidence: conf(win.sample),
  })

  // 3. Best category / style (only when classified)
  const cat = bestBy(posts, (p) => p.category, baseline)
  if (cat) {
    insights.push({
      key: 'best_category',
      title: `“${cat.key}” is your strongest category`,
      why: 'This topic consistently beats your own average engagement.',
      evidence: `${cat.key}: ${pct(cat.value)} vs ${pct(baseline)} baseline (${cat.sample} posts).`,
      recommendation: `Lean into “${cat.key}” while it’s working.`,
      confidence: conf(cat.sample),
    })
    strongest = cat.key
  }
  const style = bestBy(posts, (p) => p.style, baseline)
  if (style) insights.push({
    key: 'best_style',
    title: `The “${style.key}” style works best for you`,
    why: 'This content style outperforms your own baseline.',
    evidence: `${style.key}: ${pct(style.value)} vs ${pct(baseline)} baseline (${style.sample} posts).`,
    recommendation: `Use the “${style.key}” style more often.`,
    confidence: conf(style.sample),
  })

  const sub = bestBy(posts, (p) => p.subcategory, baseline)
  if (sub) insights.push({
    key: 'best_subcategory',
    title: `“${sub.key}” is your strongest topic`,
    why: 'This specific topic beats your own average engagement.',
    evidence: `${sub.key}: ${pct(sub.value)} vs ${pct(baseline)} baseline (${sub.sample} posts).`,
    recommendation: `Double down on “${sub.key}”.`,
    confidence: conf(sub.sample),
  })

  const fmt2 = bestBy(posts, (p) => p.format, baseline)
  if (fmt2) insights.push({
    key: 'best_format',
    title: `${fmt2.key} performs best for you here`,
    why: 'This content format suits your audience on this platform.',
    evidence: `${fmt2.key}: ${pct(fmt2.value)} vs ${pct(baseline)} baseline (${fmt2.sample} posts).`,
    recommendation: `Prioritise ${fmt2.key}.`,
    confidence: conf(fmt2.sample),
  })

  // Emerging / declining categories (time-split; needs enough history in each).
  const mom = categoryMomentum(posts)
  for (const e of mom.emerging) insights.push({
    key: 'emerging_category',
    title: `“${e.key}” is gaining momentum`,
    why: 'This category is improving versus your earlier posts in it.',
    evidence: `${e.key}: ${pct(e.recent)} recently vs ${pct(e.older)} earlier.`,
    recommendation: `Lean into “${e.key}” while it’s rising.`,
    confidence: e.confidence,
  })
  for (const dn of mom.declining) insights.push({
    key: 'declining_category',
    title: `“${dn.key}” is cooling off`,
    why: 'This category is performing worse than it used to for you.',
    evidence: `${dn.key}: ${pct(dn.recent)} recently vs ${pct(dn.older)} earlier.`,
    recommendation: `Refresh your “${dn.key}” angle, or rebalance toward what’s working.`,
    confidence: dn.confidence,
  })

  // 4. Outperformers vs own average
  if (baseline != null && posts.length >= 6) {
    const over = posts.filter((p) => { const r = rate(p); return r != null && r >= baseline * 1.25 })
    if (over.length) {
      const lens = over.map((p) => lengthBucket(p.durationSec)).filter(Boolean) as string[]
      const common = lens.length ? topCount(lens) : null
      insights.push({
        key: 'outperformers',
        title: `${over.length} of your posts consistently beat your average`,
        why: 'Your strongest posts share traits worth repeating.',
        evidence: `${over.length} posts ≥ 25% above your ${pct(baseline)} baseline${common ? `; most are ${common}` : ''}.`,
        recommendation: common ? `Your winners skew ${common} — produce more like them.` : 'Study these posts and reuse what worked.',
        confidence: conf(over.length),
      })
    }
  }

  // 5. Posting consistency
  const dated = posts.map((p) => p.postedAt).filter((d): d is Date => !!d).map((d) => d.getTime()).sort((a, b) => a - b)
  if (dated.length >= 4) {
    const spanWeeks = (dated[dated.length - 1] - dated[0]) / (7 * 86_400_000)
    const perWeek = spanWeeks > 0 ? dated.length / spanWeeks : null
    const gaps: number[] = []
    for (let i = 1; i < dated.length; i++) gaps.push((dated[i] - dated[i - 1]) / 86_400_000)
    const mean = avg(gaps)!
    const variance = avg(gaps.map((g) => (g - mean) ** 2)) ?? 0
    const erratic = Math.sqrt(variance) > mean // high variance relative to cadence
    insights.push({
      key: 'consistency',
      title: erratic ? 'Your posting cadence is uneven' : 'You post consistently',
      why: erratic ? 'Irregular gaps make it harder to build momentum.' : 'A steady cadence compounds reach over time.',
      evidence: `${perWeek ? perWeek.toFixed(1) : '—'} posts/week, ${erratic ? 'with large gaps between posts' : 'fairly evenly spaced'}.`,
      recommendation: erratic ? 'Aim for a steadier schedule, even if you post less often.' : 'Keep the rhythm going.',
      confidence: conf(dated.length),
    })
  }

  // 6. Long-term / month-over-month trend (from our snapshot memory)
  if (trend.length >= 14) {
    const half = Math.floor(trend.length / 2)
    const prior = avg(trend.slice(0, half).map((t) => t.views)) ?? 0
    const recent = avg(trend.slice(half).map((t) => t.views)) ?? 0
    if (prior > 0) {
      const change = (recent - prior) / prior
      const dir = change > 0.05 ? 'climbing' : change < -0.05 ? 'declining' : 'steady'
      insights.push({
        key: 'trend',
        title: `Your views are ${dir}`,
        why: 'Tracked from Collabr’s own long-term history — native dashboards only keep ~90 days.',
        evidence: `Recent window is ${(change * 100).toFixed(0)}% vs your earlier window.`,
        recommendation: dir === 'declining' ? 'Revisit what worked in your earlier, stronger period.' : 'Whatever you changed recently is working — keep going.',
        confidence: trend.length >= 45 ? 'high' : 'medium',
      })
    }
  }

  // 7. Suggested experiment (gap-based)
  const shortShare = posts.filter((p) => (p.durationSec ?? 999) < 15).length / Math.max(1, posts.length)
  if (posts.length >= 8 && shortShare < 0.15) {
    insights.push({
      key: 'experiment',
      title: 'Experiment: try more very short posts',
      why: 'You rarely post under 15s, and short formats often over-index for reach.',
      evidence: `Only ${(shortShare * 100).toFixed(0)}% of your posts are under 15s.`,
      recommendation: 'Test a handful of <15s cuts this month and compare them to your baseline.',
      confidence: 'low',
    })
  }

  const dataConfidence: Confidence = posts.length >= 20 ? 'high' : posts.length >= 8 ? 'medium' : 'low'
  return { platform, postCount: posts.length, overview, trend, insights, strongest, dataConfidence }
}

// Per-category momentum: compare each category's recent vs earlier engagement
// (split at the median post date). Confidence-gated; needs ≥3 posts per half.
function categoryMomentum(posts: InsightPost[]): {
  emerging: { key: string; recent: number; older: number; confidence: Confidence }[]
  declining: { key: string; recent: number; older: number; confidence: Confidence }[]
} {
  const emerging: { key: string; recent: number; older: number; confidence: Confidence }[] = []
  const declining: { key: string; recent: number; older: number; confidence: Confidence }[] = []
  const dated = posts.filter((p) => p.postedAt && p.category)
  if (dated.length < 8) return { emerging, declining }
  const times = dated.map((p) => p.postedAt!.getTime()).sort((a, b) => a - b)
  const mid = times[Math.floor(times.length / 2)]
  const cats = Array.from(new Set(dated.map((p) => p.category as string)))
  for (const cat of cats) {
    const older = dated.filter((p) => p.category === cat && p.postedAt!.getTime() < mid)
    const recent = dated.filter((p) => p.category === cat && p.postedAt!.getTime() >= mid)
    if (older.length < 3 || recent.length < 3) continue
    const o = avg(older.map(rate).filter((x): x is number => x != null))
    const r = avg(recent.map(rate).filter((x): x is number => x != null))
    if (o == null || r == null || o <= 0) continue
    const c = conf(Math.min(older.length, recent.length))
    if (r > o * 1.15) emerging.push({ key: cat, recent: r, older: o, confidence: c })
    else if (r < o * 0.85) declining.push({ key: cat, recent: r, older: o, confidence: c })
  }
  return { emerging, declining }
}

function topCount(xs: string[]): string | null {
  const c = new Map<string, number>()
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1)
  let best: [string, number] | null = null
  for (const e of Array.from(c)) if (!best || e[1] > best[1]) best = e
  return best ? best[0] : null
}

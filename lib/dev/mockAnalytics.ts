// Mock analytics generator + seeder (developer-only; gated by mockAnalyticsEnabled).
// Produces realistic raw data (connected accounts, posts w/ metadata + taxonomy
// labels, time-series snapshots), then runs it through the SAME deterministic
// engine as real syncs. No platform API calls. Idempotent per creator.
import type { createAdminClient } from '@/lib/supabase/server'
import { computePlatformInsights, type InsightPost } from '@/lib/analytics/insights'
import { computeCreatorRollup, type RollupPost } from '@/lib/analytics/rollups'
import { aiConfigured } from '@/lib/ai/client'
import { narratePlatformInsights } from '@/lib/ai/service'
import type { Platform } from '@/lib/analytics/adapters/types'

type Admin = ReturnType<typeof createAdminClient>

function rng(seedStr: string) {
  let s = 0
  for (const c of seedStr) s = (s * 31 + c.charCodeAt(0)) % 2147483647
  return () => ((s = (s * 1103515245 + 12345) % 2147483647) / 2147483647)
}

interface Niche {
  cat: string; sub: string; style: string; baseRate: number
  lenPref?: 'short' | 'long'; fmt?: 'carousel'; trend?: 'up' | 'down'; count: number
  captions: string[]; tags: string[]
}
const PLAN: Record<Platform, Niche[]> = {
  tiktok: [
    { cat: 'Food', sub: 'Street food', style: 'review', baseRate: 0.13, lenPref: 'short', count: 7, captions: ['Best $5 street noodles in town 🍜', 'Hawker hidden gem you NEED to try', 'Ranking viral street snacks'], tags: ['#food', '#streetfood', '#foodie', '#sgfood'] },
    { cat: 'Beauty', sub: 'Makeup', style: 'tutorial', baseRate: 0.06, lenPref: 'short', trend: 'down', count: 6, captions: ['5-min everyday glam', 'Viral blush technique', 'Drugstore vs luxury foundation'], tags: ['#makeup', '#beauty', '#grwm', '#beautytok'] },
    { cat: 'Fitness', sub: 'Workouts', style: 'demo', baseRate: 0.08, lenPref: 'short', count: 5, captions: ['10-min ab burner', 'Beginner gym mistakes', 'Mobility you actually need'], tags: ['#fitness', '#workout', '#gymtok'] },
  ],
  instagram: [
    { cat: 'Fashion', sub: 'Outfits & OOTD', style: 'b-roll montage', baseRate: 0.10, fmt: 'carousel', count: 6, captions: ['5 ways to style one blazer', 'Autumn capsule wardrobe', 'OOTD: smart casual'], tags: ['#ootd', '#fashion', '#style', '#outfitinspo'] },
    { cat: 'Beauty', sub: 'Skincare', style: 'talking-head', baseRate: 0.07, count: 4, captions: ['My non-negotiable PM routine', 'Barrier repair that worked', 'SPF myths debunked'], tags: ['#skincare', '#beauty', '#skintok'] },
    { cat: 'Travel', sub: 'City guides', style: 'vlog', baseRate: 0.06, trend: 'up', count: 6, captions: ['48 hours in Bangkok', 'Hidden cafés in Seoul', 'Budget Tokyo itinerary'], tags: ['#travel', '#cityguide', '#wanderlust'] },
  ],
  youtube: [
    { cat: 'Tech', sub: 'Reviews', style: 'review', baseRate: 0.09, lenPref: 'long', count: 6, captions: ['Honest 6-month laptop review', 'Best budget phone 2026', 'Is this gadget worth it?'], tags: ['#tech', '#review', '#gadgets'] },
    { cat: 'Travel', sub: 'Itineraries', style: 'vlog', baseRate: 0.07, lenPref: 'long', trend: 'up', count: 4, captions: ['7 days in Vietnam — full guide', 'How I travel for cheap', 'Japan rail pass explained'], tags: ['#travel', '#itinerary', '#travelvlog'] },
    { cat: 'Lifestyle', sub: 'Productivity', style: 'talking-head', baseRate: 0.05, lenPref: 'long', count: 4, captions: ['My realistic 5am routine', 'Notion setup for 2026', 'How I plan my week'], tags: ['#productivity', '#lifestyle', '#notion'] },
  ],
}

function durationFor(pref: 'short' | 'long' | undefined, r: number): number {
  if (pref === 'short') return [8, 12, 20, 28][Math.floor(r * 4)]
  if (pref === 'long') return [240, 360, 540, 720][Math.floor(r * 4)]
  return [30, 45, 60, 75][Math.floor(r * 4)]
}

interface MockPost {
  platform: Platform; externalId: string; url: string; postedAt: Date; durationSec: number
  title: string; caption: string; hashtags: string[]; category: string; subcategory: string; style: string; format: string
  views: number; likes: number; comments: number; shares: number; saves: number; reach: number
}

export function generateMockPosts(seedStr: string, density: 'rich' | 'thin'): MockPost[] {
  const rand = rng(seedStr)
  const out: MockPost[] = []
  const baseViews: Record<Platform, number> = { tiktok: 12000, instagram: 6000, youtube: 4000 }
  for (const platform of Object.keys(PLAN) as Platform[]) {
    for (const niche of PLAN[platform]) {
      const count = density === 'thin' ? Math.min(2, niche.count) : niche.count
      for (let i = 0; i < count; i++) {
        const r = rand()
        const daysAgo = Math.floor(rand() * 115) + 2
        const hour = rand() < 0.5 ? 19 + Math.floor(rand() * 4) : 8 + Math.floor(rand() * 6) // evening vs morning
        const evening = hour >= 18
        const dur = durationFor(niche.lenPref, r)
        const matchesLen = niche.lenPref === 'short' ? dur < 30 : niche.lenPref === 'long' ? dur >= 240 : true
        // engineered rate: length + window + category trend + occasional outperformer
        let rate = niche.baseRate
        rate *= matchesLen ? 1.28 : 0.82
        rate *= evening ? 1.22 : 0.9
        if (niche.trend === 'up') rate *= 1 + ((115 - daysAgo) / 115) * 0.7 // recent stronger → emerging
        if (niche.trend === 'down') rate *= 1 + (daysAgo / 115) * 0.7 // older stronger → declining
        if (rand() < 0.12) rate *= 2.1 // outperformer
        const views = Math.round(baseViews[platform] * (0.5 + rand() * 1.8))
        const inter = Math.round(views * rate)
        const postedAt = new Date(Date.now() - daysAgo * 86_400_000)
        postedAt.setHours(hour, 0, 0, 0)
        const format = niche.fmt === 'carousel' ? 'carousel' : dur >= 90 ? 'long-form video' : 'short-form video'
        const cap = niche.captions[i % niche.captions.length]
        out.push({
          platform, externalId: `mock-${platform}-${out.length}`,
          url: `https://${platform}.com/mock/${platform}-${out.length}`,
          postedAt, durationSec: format === 'carousel' ? 0 : dur,
          title: cap, caption: `${cap} ${niche.tags.join(' ')}`, hashtags: niche.tags,
          category: niche.cat, subcategory: niche.sub, style: niche.style, format,
          views, likes: Math.round(inter * 0.7), comments: Math.round(inter * 0.1),
          shares: Math.round(inter * 0.1), saves: Math.round(inter * 0.1), reach: Math.round(views * 1.25),
        })
      }
    }
  }
  return out
}

export async function resetCreatorAnalytics(admin: Admin, creatorId: string) {
  const { data: accts } = await admin.from('connected_accounts').select('id').eq('creator_id', creatorId).eq('source', 'mock')
  const ids = (accts ?? []).map((a) => a.id)
  if (ids.length) {
    const { data: posts } = await admin.from('content_posts').select('id').in('account_id', ids)
    const postIds = (posts ?? []).map((p) => p.id)
    if (postIds.length) await admin.from('post_snapshots').delete().in('post_id', postIds)
    await admin.from('content_posts').delete().in('account_id', ids)
    await admin.from('connected_accounts').delete().in('id', ids)
  }
  await admin.from('creator_platform_insights').delete().eq('creator_id', creatorId)
  await admin.from('creator_rollups').delete().eq('creator_id', creatorId)
  await admin.from('ai_reports').delete().eq('creator_id', creatorId).like('input_hash', 'mock-%')
  await admin.from('creator_profiles').update({ connected: false, connected_platforms: [], insights_last_synced_at: null }).eq('id', creatorId)
}

export async function seedCreatorAnalytics(
  admin: Admin, creatorId: string, opts: { density?: 'rich' | 'thin'; pro?: 'active' | 'expired' } = {},
) {
  const density = opts.density ?? 'rich'
  await resetCreatorAnalytics(admin, creatorId)

  // Subscription state.
  const proUntil = opts.pro === 'expired'
    ? new Date(Date.now() - 5 * 86_400_000).toISOString()
    : new Date(Date.now() + 25 * 86_400_000).toISOString()
  await admin.from('creator_subscriptions').upsert(
    { creator_id: creatorId, status: opts.pro === 'expired' ? 'cancelled' : 'active', pro_until: proUntil, updated_at: new Date().toISOString() },
    { onConflict: 'creator_id' },
  )

  const platforms = Object.keys(PLAN) as Platform[]
  const posts = generateMockPosts(creatorId, density)

  // Connected accounts (one per platform) + map for post insertion.
  const accountByPlatform: Record<string, string> = {}
  for (const platform of platforms) {
    const { data: acct } = await admin.from('connected_accounts').upsert(
      { creator_id: creatorId, platform, source: 'mock', external_account_id: `mock-${platform}`, handle: `@mock_${platform}`, status: 'connected', sync_frozen: opts.pro === 'expired', last_synced_at: new Date().toISOString(), consent_at: new Date().toISOString() },
      { onConflict: 'creator_id,platform' },
    ).select('id').single()
    if (acct) accountByPlatform[platform] = acct.id
  }

  // Insert posts + a 5-point time series of snapshots each.
  for (const p of posts) {
    const accountId = accountByPlatform[p.platform]
    if (!accountId) continue
    const { data: row } = await admin.from('content_posts').upsert({
      account_id: accountId, creator_id: creatorId, platform: p.platform, external_id: p.externalId,
      url: p.url, posted_at: p.postedAt.toISOString(), duration_sec: p.durationSec || null,
      title: p.title, caption: p.caption, hashtags: p.hashtags,
      category: p.category, subcategory: p.subcategory, style: p.style, format: p.format,
      class_confidence: 0.9, class_source: 'mock', class_hash: `mock-${p.externalId}`,
    }, { onConflict: 'account_id,external_id' }).select('id').single()
    if (!row) continue
    const span = Math.max(1, Math.floor((Date.now() - p.postedAt.getTime()) / 86_400_000))
    const points = Math.min(5, Math.max(2, Math.floor(span / 7)))
    const snaps = Array.from({ length: points }, (_, k) => {
      const frac = (k + 1) / points
      const at = new Date(p.postedAt.getTime() + frac * span * 86_400_000)
      return {
        post_id: row.id, captured_at: at.toISOString(),
        views: Math.round(p.views * (0.35 + 0.65 * frac)), likes: Math.round(p.likes * (0.35 + 0.65 * frac)),
        comments: Math.round(p.comments * frac), shares: Math.round(p.shares * frac),
        saves: Math.round(p.saves * frac), reach: Math.round(p.reach * (0.35 + 0.65 * frac)),
      }
    })
    await admin.from('post_snapshots').insert(snaps)
  }

  // Run the SAME deterministic engine per platform (latest snapshot = current).
  for (const platform of platforms) {
    const pPosts: InsightPost[] = posts.filter((p) => p.platform === platform).map((p) => ({
      postedAt: p.postedAt, durationSec: p.durationSec || null,
      category: p.category, subcategory: p.subcategory, style: p.style, format: p.format,
      views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves, reach: p.reach,
    }))
    if (!pPosts.length) continue
    const trendMap = new Map<string, number>()
    for (const p of posts.filter((x) => x.platform === platform)) {
      const day = p.postedAt.toISOString().slice(0, 10)
      trendMap.set(day, (trendMap.get(day) || 0) + p.views)
    }
    const trend = Array.from(trendMap.entries()).sort().map(([date, views]) => ({ date, views }))
    const data = computePlatformInsights(platform, pPosts, trend)
    let ai_narrative: string | null = null
    if (aiConfigured()) {
      try { ai_narrative = await narratePlatformInsights(platform, { overview: data.overview, insights: data.insights, dataConfidence: data.dataConfidence }) } catch { ai_narrative = null }
    }
    await admin.from('creator_platform_insights').upsert(
      { creator_id: creatorId, platform, data, ai_narrative, ai_hash: ai_narrative ? `mock-${platform}` : null, computed_at: new Date().toISOString() },
      { onConflict: 'creator_id,platform' },
    )
  }

  // Brand-facing verified aggregate.
  const rollupPosts: RollupPost[] = posts.map((p) => ({ platform: p.platform, url: p.url, postedAt: p.postedAt, views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves, reach: p.reach }))
  const rollup = computeCreatorRollup(rollupPosts)
  const allTrend = new Map<string, number>()
  for (const p of posts) { const d = p.postedAt.toISOString().slice(0, 10); allTrend.set(d, (allTrend.get(d) || 0) + p.views) }
  await admin.from('creator_rollups').upsert(
    { creator_id: creatorId, time_window: '90d', totals: rollup.totals, averages: rollup.averages, by_platform: rollup.byPlatform, best_posts: rollup.bestPosts, worst_posts: rollup.worstPosts, trends: Array.from(allTrend.entries()).sort().map(([date, views]) => ({ date, views })), computed_at: new Date().toISOString() },
    { onConflict: 'creator_id' },
  )

  await admin.from('creator_profiles').update({
    connected: opts.pro !== 'expired', connected_platforms: platforms, insights_last_synced_at: new Date().toISOString(),
  }).eq('id', creatorId)

  // Mock weekly/monthly reports so the Reports tab has data too (input_hash
  // 'mock-…' so reset only removes seeded reports, never real ones).
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
  const reports = [
    { period_start: day(6), period_end: day(0), report: { text: 'What changed: Engagement rose ~1.1 pts week-over-week, led by evening posts; your shortest clips kept over-indexing while Food softened against its own earlier run.\n\nStrongest patterns: Evening (6pm–12am) posting and street-food reviews stayed your most reliable lifts.\n\nDeclining patterns: Food slipped from its earlier high — worth a fresh angle.\n\nExperiments to try: Post 2–3 sub-15s cuts and compare to your baseline; hold an even cadence on Instagram.\n\nPer-platform: TikTok → street-food reviews · Instagram → fashion carousels · YouTube → travel vlogs (early). Each measured only against your own history.' }, input_hash: 'mock-w1' },
    { period_start: day(13), period_end: day(7), report: { text: 'What changed: Street food held strong and your cadence steadied.\n\nStrongest patterns: Review-style short clips continued to beat your baseline.\n\nExperiments to try: Keep the evening rhythm; test one longer explainer.' }, input_hash: 'mock-w2' },
    { period_start: day(43), period_end: day(14), report: { text: 'Monthly recap: Short-form formats drove your best month so far. Evening posting and street-food reviews were the throughline; consider widening into one adjacent topic next month.' }, input_hash: 'mock-m1' },
  ]
  for (const r of reports) {
    await admin.from('ai_reports').upsert(
      { creator_id: creatorId, model: 'mock', ...r },
      { onConflict: 'creator_id,period_start,period_end' },
    )
  }

  return { posts: posts.length, platforms: platforms.length, reports: reports.length }
}

// Seed campaign_rollups for the brand's existing campaigns: first = full coverage,
// second (if any) = partial coverage. Uses real campaign ids (FK-safe).
export async function seedBrandCampaigns(admin: Admin, brandId: string) {
  const { data: campaigns } = await admin.from('campaigns').select('id').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(2)
  if (!campaigns?.length) return { campaigns: 0 }
  const variants = [
    { coverage: { creatorsTotal: 4, creatorsConnected: 4, unlinkedCreatorIds: [] }, views: 184000 },
    { coverage: { creatorsTotal: 5, creatorsConnected: 3, unlinkedCreatorIds: ['mock-a', 'mock-b'] }, views: 96000 },
  ]
  let n = 0
  for (let i = 0; i < campaigns.length; i++) {
    const v = variants[Math.min(i, variants.length - 1)]
    const eng = Math.round(v.views * 0.08)
    await admin.from('campaign_rollups').upsert({
      campaign_id: campaigns[i].id,
      totals: { views: v.views, reach: Math.round(v.views * 1.3), engagement: eng, likes: Math.round(eng * 0.7), comments: Math.round(eng * 0.1), shares: Math.round(eng * 0.1), saves: Math.round(eng * 0.1) },
      derived: { cpvCents: 1.4, cpeCents: 18, engagementRate: 0.08 },
      by_platform: { tiktok: { views: Math.round(v.views * 0.6) }, instagram: { views: Math.round(v.views * 0.3) }, youtube: { views: Math.round(v.views * 0.1) } },
      per_creator: [
        { handle: '@mock_tiktok', totals: { views: Math.round(v.views * 0.4) }, cpvCents: 1.1 },
        { handle: '@mock_instagram', totals: { views: Math.round(v.views * 0.35) }, cpvCents: 1.6 },
      ],
      top_post: { url: 'https://tiktok.com/mock/top', interactions: Math.round(eng * 0.4) },
      trends: Array.from({ length: 8 }, (_, k) => ({ date: new Date(Date.now() - (8 - k) * 7 * 86_400_000).toISOString().slice(0, 10), views: Math.round(v.views * (k + 1) / 8) })),
      coverage: v.coverage, computed_at: new Date().toISOString(),
    }, { onConflict: 'campaign_id' })
    n++
  }
  return { campaigns: n }
}

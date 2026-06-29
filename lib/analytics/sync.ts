import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { matchPostToCollab } from '@/lib/analytics/match'
import { formatFromMetadata } from '@/lib/analytics/taxonomy'
import { computeCreatorRollup, type RollupPost } from '@/lib/analytics/rollups'
import { computePlatformInsights, type InsightPost } from '@/lib/analytics/insights'
import { aiConfigured } from '@/lib/ai/client'
import { strategistRead, type StrategyOutput } from '@/lib/ai/service'
import { classifyContent } from '@/lib/ai/classify'
import { classHash, validateLabels } from '@/lib/analytics/classify'
import type { Platform, PlatformAdapter, AdapterAuth } from '@/lib/analytics/adapters/types'

// Single source of truth for the Connected sync pipeline, shared by the nightly
// crons (sync-connected, rollups) and the on-demand "Sync now" route. Behaviour is
// identical to the crons; only normalized provider data is written, never fabricated.
type Admin = ReturnType<typeof createAdminClient>
type AccountRow = { id: string; creator_id: string; platform: string; external_account_id: string | null }

// Fetch this account's metrics + posts and store snapshots. Manages the sync_jobs
// row, updates last_synced_at, and marks the account errored on failure (then rethrows).
export async function syncAccountData(admin: Admin, a: AccountRow, adapter: PlatformAdapter, auth: AdapterAuth): Promise<void> {
  const since = new Date(Date.now() - 90 * 86_400_000)
  const { data: job } = await admin.from('sync_jobs')
    .insert({ account_id: a.id, kind: 'account', status: 'running', started_at: new Date().toISOString() })
    .select('id').single()

  try {
    const acctMetrics = await adapter.fetchAccount(auth, a.external_account_id)
    await admin.from('account_snapshots').insert({
      account_id: a.id,
      follower_count: acctMetrics.followerCount, avg_views: acctMetrics.avgViews,
      avg_likes: acctMetrics.avgLikes, avg_comments: acctMetrics.avgComments,
      avg_shares: acctMetrics.avgShares, engagement_rate: acctMetrics.engagementRate,
      audience: acctMetrics.audience ?? null,
    })

    // Canonical collab URLs for this creator (live_posts.post_url) → deterministic link.
    const { data: lp } = await admin.from('live_posts')
      .select('collab_id, post_url, collabs!inner(creator_id)')
      .eq('collabs.creator_id', a.creator_id)
    const collabUrls = (lp ?? []).map((r: any) => ({ collabId: r.collab_id as string, url: r.post_url as string }))

    const posts = await adapter.fetchPosts(auth, a.external_account_id, since)
    for (const p of posts) {
      if (!p.externalId) continue
      const matchedCollab = collabUrls.length ? matchPostToCollab(p.url, collabUrls) : null
      // Category/subcategory/style are owned by the classification step; never write them here.
      const row: Record<string, unknown> = {
        account_id: a.id, creator_id: a.creator_id, platform: p.platform,
        external_id: p.externalId, url: p.url, posted_at: p.postedAt?.toISOString() ?? null,
        duration_sec: p.durationSec ?? null,
        title: p.title ?? null, caption: p.caption ?? null, hashtags: p.hashtags ?? null,
        format: formatFromMetadata(p.mediaType ?? null, p.durationSec ?? null),
      }
      if (matchedCollab) row.collab_id = matchedCollab
      const { data: post } = await admin.from('content_posts').upsert(row, { onConflict: 'account_id,external_id' }).select('id').single()
      if (post) {
        await admin.from('post_snapshots').insert({
          post_id: post.id, views: p.views, likes: p.likes, comments: p.comments,
          shares: p.shares, saves: p.saves, reach: p.reach,
        })
      }
    }

    await admin.from('connected_accounts').update({ last_synced_at: new Date().toISOString() }).eq('id', a.id)
    if (job) await admin.from('sync_jobs').update({ status: 'succeeded', finished_at: new Date().toISOString() }).eq('id', job.id)
  } catch (e: any) {
    console.error('[SYNC] account', a.id, e?.message)
    if (job) await admin.from('sync_jobs').update({ status: 'failed', error: String(e?.message).slice(0, 500), finished_at: new Date().toISOString() }).eq('id', job.id)
    await admin.from('connected_accounts').update({ status: 'error' }).eq('id', a.id)
    throw e
  }
}

// Classify one creator's unlabeled posts into the taxonomy (category / subcategory /
// style) so "What's working" has content levers to rank. Mirrors the nightly classify
// cron, scoped to a single creator. No-op if AI isn't configured. Run before rollups.
export async function classifyCreatorPosts(admin: Admin, creatorId: string): Promise<number> {
  if (!aiConfigured()) return 0
  const { data: posts } = await admin.from('content_posts')
    .select('id, title, caption, hashtags, duration_sec, class_hash, class_source')
    .eq('creator_id', creatorId).limit(2000)
  const hashOf = (p: any) => classHash({ title: p.title, caption: p.caption, hashtags: p.hashtags, durationSec: p.duration_sec })
  const stale = (posts ?? []).filter((p) => p.class_source !== 'manual' && hashOf(p) !== p.class_hash).slice(0, 400)
  const withText = stale.filter((p) => p.title || p.caption || (p.hashtags?.length))
  const noText = stale.filter((p) => !(p.title || p.caption || (p.hashtags?.length)))

  // No usable text → stamp metadata-only so we don't retry forever (format set at sync).
  for (const p of noText) {
    await admin.from('content_posts').update({ class_source: 'metadata', class_confidence: 0, class_hash: hashOf(p) }).eq('id', p.id)
  }

  let classified = 0
  const CHUNK = 25
  for (let i = 0; i < withText.length; i += CHUNK) {
    const chunk = withText.slice(i, i + CHUNK)
    let out: Awaited<ReturnType<typeof classifyContent>> = []
    try {
      out = await classifyContent(chunk.map((p) => ({ externalId: p.id, title: p.title, caption: p.caption, hashtags: p.hashtags })))
    } catch (e: any) {
      console.error('[CLASSIFY] batch failed:', e?.message)
      continue
    }
    const byId = new Map(out.map((o) => [o.externalId, o]))
    for (const p of chunk) {
      const raw = byId.get(p.id) ?? null
      const labels = validateLabels(raw)
      await admin.from('content_posts').update({
        category: labels.category, subcategory: labels.subcategory, style: labels.style,
        class_confidence: labels.confidence, class_source: raw ? 'ai' : 'metadata', class_hash: hashOf(p),
      }).eq('id', p.id)
      classified++
    }
  }
  return classified
}

// Recompute one creator's deterministic rollups + per-platform insights from stored
// snapshots. Returns true if anything was rolled up. AI narration is an optional overlay.
export async function recomputeCreatorInsights(admin: Admin, creatorId: string): Promise<boolean> {
  const { data: accounts } = await admin.from('connected_accounts')
    .select('id, platform, status, sync_frozen').eq('creator_id', creatorId)
  const usable = (accounts ?? []).filter((a) => a.status === 'connected' && !a.sync_frozen)
  if (!usable.length) return false

  const { data: posts } = await admin.from('content_posts')
    .select('id, platform, url, title, posted_at, category, subcategory, style, format, duration_sec')
    .eq('creator_id', creatorId)
  if (!posts?.length) return false

  const { data: snaps } = await admin.from('post_snapshots')
    .select('post_id, views, likes, comments, shares, saves, reach, captured_at')
    .in('post_id', posts.map((p) => p.id))
    .order('captured_at', { ascending: false })
  const latest = new Map<string, NonNullable<typeof snaps>[number]>()
  for (const s of snaps ?? []) if (!latest.has(s.post_id)) latest.set(s.post_id, s)

  const rollupPosts: RollupPost[] = posts.map((p) => {
    const s = latest.get(p.id)
    return {
      platform: p.platform as Platform,
      url: p.url, postedAt: p.posted_at ? new Date(p.posted_at) : null,
      views: s?.views ?? null, likes: s?.likes ?? null, comments: s?.comments ?? null,
      shares: s?.shares ?? null, saves: s?.saves ?? null, reach: s?.reach ?? null,
    }
  })
  const rollup = computeCreatorRollup(rollupPosts)

  const trendMap = new Map<string, number>()
  for (const s of snaps ?? []) {
    const day = String(s.captured_at).slice(0, 10)
    trendMap.set(day, (trendMap.get(day) || 0) + (s.views || 0))
  }
  const trends = Array.from(trendMap.entries()).sort().map(([date, views]) => ({ date, views }))

  await admin.from('creator_rollups').upsert({
    creator_id: creatorId, time_window: '90d',
    totals: rollup.totals, averages: rollup.averages, by_platform: rollup.byPlatform,
    best_posts: rollup.bestPosts, worst_posts: rollup.worstPosts, trends,
    computed_at: new Date().toISOString(),
  }, { onConflict: 'creator_id' })

  await admin.from('creator_profiles').update({
    connected: true,
    connected_platforms: Array.from(new Set(usable.map((a) => a.platform))),
    insights_last_synced_at: new Date().toISOString(),
  }).eq('id', creatorId)

  // Per-platform Creator Insights (the flagship), computed separately per platform.
  const postPlatform = new Map((posts ?? []).map((p) => [p.id as string, p.platform as string]))
  const ptrend = new Map<string, Map<string, number>>()
  for (const s of snaps ?? []) {
    const plat = postPlatform.get(s.post_id); if (!plat) continue
    const day = String(s.captured_at).slice(0, 10)
    const m = ptrend.get(plat) ?? new Map<string, number>()
    m.set(day, (m.get(day) || 0) + (s.views || 0)); ptrend.set(plat, m)
  }
  const platforms = Array.from(new Set(posts.map((p) => p.platform)))
  for (const platform of platforms) {
    const pPosts: InsightPost[] = posts.filter((p) => p.platform === platform).map((p) => {
      const s = latest.get(p.id)
      return {
        postedAt: p.posted_at ? new Date(p.posted_at) : null, durationSec: p.duration_sec ?? null,
        title: p.title ?? null,
        category: p.category ?? null, subcategory: p.subcategory ?? null, style: p.style ?? null, format: p.format ?? null,
        views: s?.views ?? null, likes: s?.likes ?? null, comments: s?.comments ?? null,
        shares: s?.shares ?? null, saves: s?.saves ?? null, reach: s?.reach ?? null,
      }
    })
    const trend = Array.from((ptrend.get(platform) ?? new Map()).entries())
      .sort().map(([date, views]) => ({ date, views: views as number }))
    const data = computePlatformInsights(platform as Platform, pPosts, trend)

    // AI strategist (reasons beyond the facts). analystRead doubles as the short
    // "analyst read" line; cards + experiments are the coaching layer. Cached by
    // a hash of the deterministic insights so it only regenerates when they change.
    let aiNarrative: string | null = null
    let aiStrategy: StrategyOutput | null = null
    let aiHash: string | null = null
    if (aiConfigured()) {
      aiHash = crypto.createHash('sha256').update(JSON.stringify(data.insights)).digest('hex')
      const { data: prev } = await admin.from('creator_platform_insights')
        .select('ai_hash, ai_narrative, ai_strategy').eq('creator_id', creatorId).eq('platform', platform).maybeSingle()
      if (prev?.ai_hash === aiHash && prev.ai_strategy) {
        aiStrategy = prev.ai_strategy as StrategyOutput
        aiNarrative = prev.ai_narrative
      } else {
        try {
          aiStrategy = await strategistRead(platform, {
            knownFacts: data.insights.map((i) => ({ title: i.title, recommendation: i.recommendation })),
            overview: data.overview, report: data.report, bestTime: data.bestTime,
            dataConfidence: data.dataConfidence, postCount: data.postCount,
          })
          aiNarrative = aiStrategy?.analystRead ?? null
        } catch { aiStrategy = null }
      }
    }
    await admin.from('creator_platform_insights').upsert({
      creator_id: creatorId, platform, data, ai_narrative: aiNarrative, ai_strategy: aiStrategy,
      ai_hash: aiHash, ai_strategy_hash: aiHash,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'creator_id,platform' })
  }

  return true
}

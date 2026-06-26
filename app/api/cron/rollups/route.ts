import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { isProActive } from '@/lib/entitlements'
import { computeCreatorRollup, computeCampaignRollup, type RollupPost } from '@/lib/analytics/rollups'
import { computePlatformInsights, type InsightPost } from '@/lib/analytics/insights'
import { aiConfigured } from '@/lib/ai/client'
import { narratePlatformInsights } from '@/lib/ai/service'
import type { Platform } from '@/lib/analytics/adapters/types'
import { flags } from '@/lib/flags'

// Nightly: recompute creator_rollups + per-platform creator insights — ONLY
// for Pro-active creators (lapsed Pro = frozen = skipped, history retained).
// Deterministic; reads normalized tables, never a provider. Safe no-op until the
// Connected pipeline (Phyllo sync) has written snapshots.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!flags.analyticsSuite) return NextResponse.json({ rolled_up: 0, note: 'analytics suite off' })
  const admin = createAdminClient()

  // Active Pro creators only.
  const { data: subs } = await admin.from('creator_subscriptions').select('creator_id, status, pro_until')
  const activeCreatorIds = (subs ?? []).filter((s) => isProActive(s)).map((s) => s.creator_id as string)
  if (!activeCreatorIds.length) return NextResponse.json({ rolled_up: 0, note: 'no active Pro creators' })

  let rolledUp = 0
  for (const creatorId of activeCreatorIds) {
    const { data: accounts } = await admin
      .from('connected_accounts')
      .select('id, platform, status, sync_frozen')
      .eq('creator_id', creatorId)
    const usable = (accounts ?? []).filter((a) => a.status === 'connected' && !a.sync_frozen)
    if (!usable.length) continue

    const { data: posts } = await admin
      .from('content_posts')
      .select('id, platform, url, posted_at, category, subcategory, style, format, duration_sec')
      .eq('creator_id', creatorId)
    if (!posts?.length) continue

    // Latest snapshot per post.
    const { data: snaps } = await admin
      .from('post_snapshots')
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

    // Historical trend: total cumulative views across posts per snapshot date.
    const trendMap = new Map<string, number>()
    for (const s of snaps ?? []) {
      const day = String(s.captured_at).slice(0, 10)
      trendMap.set(day, (trendMap.get(day) || 0) + (s.views || 0))
    }
    const trends = Array.from(trendMap.entries()).sort().map(([date, views]) => ({ date, views }))

    // creator_rollups = the brand-facing verified aggregate (per-platform insights
    // are the creator-facing source of truth, written below).
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

    // ── Per-platform Creator Insights (the flagship). Computed separately per
    // platform (content behaves differently); AI narration is optional overlay. ──
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
          category: p.category ?? null, subcategory: p.subcategory ?? null, style: p.style ?? null, format: p.format ?? null,
          views: s?.views ?? null, likes: s?.likes ?? null, comments: s?.comments ?? null,
          shares: s?.shares ?? null, saves: s?.saves ?? null, reach: s?.reach ?? null,
        }
      })
      const trend = Array.from((ptrend.get(platform) ?? new Map()).entries())
        .sort().map(([date, views]) => ({ date, views: views as number }))
      const data = computePlatformInsights(platform as Platform, pPosts, trend)

      // Optional AI "analyst's read", cached by a hash of the deterministic insights.
      let aiNarrative: string | null = null
      let aiHash: string | null = null
      if (aiConfigured()) {
        aiHash = crypto.createHash('sha256').update(JSON.stringify(data.insights)).digest('hex')
        const { data: prev } = await admin.from('creator_platform_insights')
          .select('ai_hash, ai_narrative').eq('creator_id', creatorId).eq('platform', platform).maybeSingle()
        if (prev?.ai_hash === aiHash && prev.ai_narrative) aiNarrative = prev.ai_narrative
        else {
          try { aiNarrative = await narratePlatformInsights(platform, { overview: data.overview, insights: data.insights, dataConfidence: data.dataConfidence }) }
          catch { aiNarrative = null }
        }
      }
      await admin.from('creator_platform_insights').upsert({
        creator_id: creatorId, platform, data, ai_narrative: aiNarrative, ai_hash: aiHash,
        computed_at: new Date().toISOString(),
      }, { onConflict: 'creator_id,platform' })
    }

    rolledUp++
  }

  // ── Campaign rollups (brand analytics) — only from linked posts (collab_id) ──
  const campaignsRolled = await rollupCampaigns(admin)

  return NextResponse.json({ rolled_up: rolledUp, campaigns: campaignsRolled })
}

async function rollupCampaigns(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  // Posts explicitly linked to a collab (canonical-URL match) drive campaign analytics.
  const { data: linked } = await admin.from('content_posts')
    .select('id, creator_id, platform, url, posted_at, collab_id')
    .not('collab_id', 'is', null)
  if (!linked?.length) return 0

  const collabIds = Array.from(new Set(linked.map((p) => p.collab_id as string)))
  const { data: linkedCollabs } = await admin.from('collabs')
    .select('id, campaign_id, creator_id, creator_payout').in('id', collabIds)
  const campaignIds = Array.from(new Set((linkedCollabs ?? []).map((c) => c.campaign_id).filter(Boolean) as string[]))
  if (!campaignIds.length) return 0

  // All collabs per campaign (for connected-coverage), and latest snapshot per linked post.
  const { data: allCollabs } = await admin.from('collabs')
    .select('id, campaign_id, creator_id, creator_payout').in('campaign_id', campaignIds)
  const { data: snaps } = await admin.from('post_snapshots')
    .select('post_id, views, likes, comments, shares, saves, reach, captured_at')
    .in('post_id', linked.map((p) => p.id)).order('captured_at', { ascending: false })
  const latest = new Map<string, NonNullable<typeof snaps>[number]>()
  for (const s of snaps ?? []) if (!latest.has(s.post_id)) latest.set(s.post_id, s)

  const collabById = new Map((linkedCollabs ?? []).map((c) => [c.id as string, c]))
  let n = 0

  for (const campaignId of campaignIds) {
    const campaignCollabs = (allCollabs ?? []).filter((c) => c.campaign_id === campaignId)
    const creatorsTotal = new Set(campaignCollabs.map((c) => c.creator_id)).size

    // Group linked posts by collab → per-creator inputs.
    const byCollab = new Map<string, RollupPost[]>()
    for (const p of linked) {
      const cid = p.collab_id as string
      if (!collabById.get(cid) || collabById.get(cid)!.campaign_id !== campaignId) continue
      const s = latest.get(p.id)
      const arr = byCollab.get(cid) ?? []
      arr.push({
        platform: p.platform as Platform, url: p.url, postedAt: p.posted_at ? new Date(p.posted_at) : null,
        views: s?.views ?? null, likes: s?.likes ?? null, comments: s?.comments ?? null,
        shares: s?.shares ?? null, saves: s?.saves ?? null, reach: s?.reach ?? null, collabId: cid,
      })
      byCollab.set(cid, arr)
    }

    const inputs = Array.from(byCollab.entries()).map(([cid, posts]) => {
      const c = collabById.get(cid)!
      return { creatorId: c.creator_id as string, posts, payoutCents: (c.creator_payout as number) || 0 }
    })
    const connectedCreatorIds = new Set(inputs.map((i) => i.creatorId))
    const unlinkedCreatorIds = campaignCollabs.map((c) => c.creator_id as string).filter((id) => !connectedCreatorIds.has(id))

    const rollup = computeCampaignRollup(inputs)

    // Trend: total views per snapshot date across the campaign's linked posts.
    const trendMap = new Map<string, number>()
    for (const s of snaps ?? []) {
      const p = linked.find((x) => x.id === s.post_id)
      if (!p || collabById.get(p.collab_id as string)?.campaign_id !== campaignId) continue
      const day = String(s.captured_at).slice(0, 10)
      trendMap.set(day, (trendMap.get(day) || 0) + (s.views || 0))
    }
    const trends = Array.from(trendMap.entries()).sort().map(([date, views]) => ({ date, views }))

    await admin.from('campaign_rollups').upsert({
      campaign_id: campaignId,
      totals: rollup.totals, derived: rollup.derived, by_platform: rollup.byPlatform,
      per_creator: rollup.perCreator, top_post: rollup.topPost, trends,
      coverage: { creatorsTotal, creatorsConnected: connectedCreatorIds.size, unlinkedCreatorIds },
      computed_at: new Date().toISOString(),
    }, { onConflict: 'campaign_id' })
    n++
  }
  return n
}

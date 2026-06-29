import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { isProActive } from '@/lib/entitlements'
import { computeCampaignRollup, type RollupPost } from '@/lib/analytics/rollups'
import { recomputeCreatorInsights } from '@/lib/analytics/sync'
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
    if (await recomputeCreatorInsights(admin, creatorId)) rolledUp++
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

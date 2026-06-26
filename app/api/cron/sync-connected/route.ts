import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { isProActive } from '@/lib/entitlements'
import { flags } from '@/lib/flags'
import { getAdapter, analyticsConfigured } from '@/lib/analytics/adapters'
import { getAccountAuth } from '@/lib/analytics/tokens'
import { matchPostToCollab } from '@/lib/analytics/match'
import type { Platform } from '@/lib/analytics/adapters/types'

// Nightly Connected sync (first-party APIs, no Phyllo). ONLY Pro-active creators;
// lapsed Pro → accounts frozen (history retained). Fail-safe: if no platform is
// configured, no-op. Writes only normalized provider data — never fabricated.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!flags.analyticsSuite) return NextResponse.json({ synced: 0, note: 'analytics suite off' })
  if (!analyticsConfigured()) return NextResponse.json({ synced: 0, note: 'no platform configured' })

  const admin = createAdminClient()
  const since = new Date(Date.now() - 90 * 86_400_000)

  const { data: subs } = await admin.from('creator_subscriptions').select('creator_id, status, pro_until')
  const activeCreators = new Set((subs ?? []).filter((s) => isProActive(s)).map((s) => s.creator_id as string))

  const { data: accounts } = await admin.from('connected_accounts')
    .select('id, creator_id, platform, external_account_id, status, sync_frozen')
    .eq('status', 'connected')

  let synced = 0, frozen = 0, failed = 0, skipped = 0
  for (const a of accounts ?? []) {
    // Freeze lapsed Pro creators' accounts (stop syncing; keep history).
    if (!activeCreators.has(a.creator_id as string)) {
      if (!a.sync_frozen) { await admin.from('connected_accounts').update({ sync_frozen: true }).eq('id', a.id); frozen++ }
      continue
    }
    if (a.sync_frozen) await admin.from('connected_accounts').update({ sync_frozen: false }).eq('id', a.id)

    const platform = a.platform as Platform
    const adapter = getAdapter(platform)
    const auth = adapter ? await getAccountAuth(admin, a.id as string, platform) : null
    if (!adapter || !auth) { skipped++; continue }

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
        const row: Record<string, unknown> = {
          account_id: a.id, creator_id: a.creator_id, platform: p.platform,
          external_id: p.externalId, url: p.url, posted_at: p.postedAt?.toISOString() ?? null,
          duration_sec: p.durationSec ?? null, category: p.category ?? null, style: p.style ?? null,
        }
        if (matchedCollab) row.collab_id = matchedCollab // never clobber an existing link with null
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
      synced++
    } catch (e: any) {
      console.error('[SYNC] account', a.id, e?.message)
      if (job) await admin.from('sync_jobs').update({ status: 'failed', error: String(e?.message).slice(0, 500), finished_at: new Date().toISOString() }).eq('id', job.id)
      await admin.from('connected_accounts').update({ status: 'error' }).eq('id', a.id)
      failed++
    }
  }

  return NextResponse.json({ synced, frozen, failed, skipped })
}

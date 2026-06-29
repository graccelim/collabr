import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { isProActive } from '@/lib/entitlements'
import { getAdapter } from '@/lib/analytics/adapters'
import { getAccountAuth } from '@/lib/analytics/tokens'
import { syncAccountData, classifyCreatorPosts, recomputeCreatorInsights } from '@/lib/analytics/sync'
import type { Platform } from '@/lib/analytics/adapters/types'

export const runtime = 'nodejs'
// Sync now does the full pull + classify + AI strategist; give it room so it
// finishes on a large account instead of timing out.
export const maxDuration = 300

// Creator disconnects a connected account: delete the stored OAuth tokens (stop
// any future API access) and mark the row revoked + frozen. Historical analytics
// are RETAINED (status flips, data stays).
export async function DELETE(req: NextRequest, { params }: { params: { accountId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  const { data: acct } = await admin.from('connected_accounts')
    .select('id, creator_id, platform')
    .eq('id', params.accountId).maybeSingle()
  if (!acct || acct.creator_id !== creator.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Full removal: revoke the token AND delete everything we derived from this
  // account (posts, snapshots, this platform's insights), so disconnecting truly
  // removes the data. Other connected platforms are untouched.
  const { data: postIds } = await admin.from('content_posts').select('id').eq('account_id', acct.id)
  const ids = (postIds ?? []).map((p) => p.id as string)
  if (ids.length) await admin.from('post_snapshots').delete().in('post_id', ids)
  await admin.from('content_posts').delete().eq('account_id', acct.id)
  await admin.from('account_snapshots').delete().eq('account_id', acct.id)
  await admin.from('creator_platform_insights').delete().eq('creator_id', creator.id).eq('platform', acct.platform as string)
  await admin.from('connected_account_tokens').delete().eq('account_id', acct.id)
  await admin.from('sync_jobs').delete().eq('account_id', acct.id)
  await admin.from('connected_accounts').delete().eq('id', acct.id)

  // Recompute from whatever remains; if nothing's connected, clear the aggregate.
  const stillConnected = await recomputeCreatorInsights(admin, creator.id as string)
  if (!stillConnected) {
    await admin.from('creator_rollups').delete().eq('creator_id', creator.id)
    await admin.from('creator_profiles').update({ connected: false, connected_platforms: [] }).eq('id', creator.id)
  }

  return NextResponse.json({ ok: true })
}

// On-demand "Sync now": pull this account's latest data and recompute the
// creator's insights immediately, instead of waiting for the nightly cron.
// Same pipeline as the cron; Pro-active creators only; owner-scoped.
export async function POST(_req: NextRequest, { params }: { params: { accountId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  const { data: sub } = await admin.from('creator_subscriptions').select('status, pro_until').eq('creator_id', creator.id).maybeSingle()
  if (!isProActive(sub ?? null)) return NextResponse.json({ error: 'Creator Pro required' }, { status: 403 })

  const { data: acct } = await admin.from('connected_accounts')
    .select('id, creator_id, platform, external_account_id, status, sync_frozen')
    .eq('id', params.accountId).maybeSingle()
  if (!acct || acct.creator_id !== creator.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (acct.status !== 'connected') return NextResponse.json({ error: 'Account is not connected' }, { status: 400 })

  // Pro is active, so the account should sync; clear any stale freeze.
  if (acct.sync_frozen) await admin.from('connected_accounts').update({ sync_frozen: false }).eq('id', acct.id)

  const platform = acct.platform as Platform
  const adapter = getAdapter(platform)
  const auth = adapter ? await getAccountAuth(admin, acct.id as string, platform) : null
  if (!adapter || !auth) return NextResponse.json({ error: 'Sync is not available for this account' }, { status: 400 })

  try {
    await syncAccountData(admin, {
      id: acct.id as string, creator_id: acct.creator_id as string,
      platform: acct.platform as string, external_account_id: (acct.external_account_id as string | null) ?? null,
    }, adapter, auth)
    // Label the freshly-synced posts (topic/style) so "What's working" can rank them,
    // then recompute. Order matters: sync → classify → rollups.
    await classifyCreatorPosts(admin, creator.id as string)
    await recomputeCreatorInsights(admin, creator.id as string)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Sync failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

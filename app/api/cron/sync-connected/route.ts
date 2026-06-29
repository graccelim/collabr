import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { isProActive } from '@/lib/entitlements'
import { flags } from '@/lib/flags'
import { getAdapter, analyticsConfigured } from '@/lib/analytics/adapters'
import { getAccountAuth } from '@/lib/analytics/tokens'
import { syncAccountData } from '@/lib/analytics/sync'
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

    try {
      await syncAccountData(admin, {
        id: a.id as string, creator_id: a.creator_id as string,
        platform: a.platform as string, external_account_id: (a.external_account_id as string | null) ?? null,
      }, adapter, auth)
      synced++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ synced, frozen, failed, skipped })
}

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { isProActive } from '@/lib/entitlements'
import { aiConfigured } from '@/lib/ai/client'
import { weeklyReport } from '@/lib/ai/service'
import { flags } from '@/lib/flags'

// Weekly AI reports for Pro-active creators. Deterministic data → Claude (Haiku).
// Idempotent: skips regeneration when the rollup hasn't changed (input_hash).
// Fail-safe: no-op without ANTHROPIC_API_KEY. Lapsed Pro creators are skipped
// (no new reports), but existing reports remain.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!flags.analyticsSuite) return NextResponse.json({ generated: 0, note: 'analytics suite off' })
  if (!aiConfigured()) return NextResponse.json({ generated: 0, note: 'AI not configured' })

  const admin = createAdminClient()
  const { data: subs } = await admin.from('creator_subscriptions').select('creator_id, status, pro_until')
  const active = (subs ?? []).filter((s) => isProActive(s)).map((s) => s.creator_id as string)
  if (!active.length) return NextResponse.json({ generated: 0 })

  const now = new Date()
  const periodEnd = now.toISOString().slice(0, 10)
  const periodStart = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10)

  let generated = 0
  for (const creatorId of active) {
    const { data: pi } = await admin.from('creator_platform_insights')
      .select('platform, data').eq('creator_id', creatorId)
    if (!pi?.length) continue

    const platforms = pi.map((p) => ({ platform: p.platform, insights: (p.data as any)?.insights ?? [] }))
    const inputHash = crypto.createHash('sha256').update(JSON.stringify(platforms)).digest('hex')
    const { data: existing } = await admin.from('ai_reports')
      .select('input_hash').eq('creator_id', creatorId).eq('period_start', periodStart).eq('period_end', periodEnd).maybeSingle()
    if (existing?.input_hash === inputHash) continue // unchanged, skip (cost control)

    try {
      const text = await weeklyReport({ periodStart, periodEnd, platforms })
      await admin.from('ai_reports').upsert(
        { creator_id: creatorId, period_start: periodStart, period_end: periodEnd, model: 'claude-haiku-4-5', report: { text }, input_hash: inputHash },
        { onConflict: 'creator_id,period_start,period_end' },
      )
      generated++
    } catch (e: any) {
      console.error('[AI reports]', creatorId, e?.message)
    }
  }
  return NextResponse.json({ generated })
}

import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'
import { aiConfigured } from '@/lib/ai/client'
import { classifyContent } from '@/lib/ai/classify'
import { classHash, validateLabels } from '@/lib/analytics/classify'

// Nightly content classification (runs between sync and rollups). Labels each post
// into the taxonomy ONCE, cached by a hash of its creator-authored metadata; only
// re-runs when the metadata changes. Never touches 'manual' overrides. AI labels
// only — never performance. Skips safely when AI is unavailable (format set at sync).
const CHUNK = 25
const MAX_PER_RUN = 400

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!flags.analyticsSuite) return NextResponse.json({ classified: 0, note: 'analytics suite off' })
  if (!aiConfigured()) return NextResponse.json({ classified: 0, note: 'AI not configured, classification skipped' })

  const admin = createAdminClient()
  const { data: posts } = await admin.from('content_posts')
    .select('id, title, caption, hashtags, duration_sec, class_hash, class_source')
    .limit(2000)

  const hashOf = (p: any) => classHash({ title: p.title, caption: p.caption, hashtags: p.hashtags, durationSec: p.duration_sec })
  const stale = (posts ?? []).filter((p) => p.class_source !== 'manual' && hashOf(p) !== p.class_hash).slice(0, MAX_PER_RUN)
  const withText = stale.filter((p) => p.title || p.caption || (p.hashtags?.length))
  const noText = stale.filter((p) => !(p.title || p.caption || (p.hashtags?.length)))

  let classified = 0

  // No usable text → stamp metadata-only so we don't retry forever (format set at sync).
  for (const p of noText) {
    await admin.from('content_posts').update({ class_source: 'metadata', class_confidence: 0, class_hash: hashOf(p) }).eq('id', p.id)
  }

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

  return NextResponse.json({ classified, stamped: noText.length, pending: Math.max(0, (posts ?? []).filter((p) => p.class_source !== 'manual' && hashOf(p) !== p.class_hash).length - stale.length) })
}

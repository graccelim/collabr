import { createAdminClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

// Nightly: reveal one-sided reviews older than 7 days (the double-blind
// fallback), refresh all visible aggregates from REVEALED reviews only, and
// notify both parties that feedback is now visible.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Reviews still hidden 7+ days after they were written → reveal them.
  const { data: overdue } = await supabase.from('reviews')
    .select('id, collab_id, collabs(brand_profiles(user_id), creator_profiles(user_id))')
    .is('revealed_at', null)
    .lt('created_at', cutoff)

  // CAS-guarded (only still-hidden rows) and error-checked: if the reveal write
  // fails, we must NOT tell people their review "is now visible".
  let revealedIds = new Set<string>()
  if (overdue && overdue.length > 0) {
    const ids = overdue.map(r => r.id)
    const { data: updated, error: revealErr } = await supabase.from('reviews')
      .update({ revealed_at: new Date().toISOString() })
      .in('id', ids).is('revealed_at', null)
      .select('id')
    if (revealErr) {
      console.error('[CRON update-ratings] reveal update failed:', revealErr.message)
      return NextResponse.json({ revealed: 0, error: revealErr.message }, { status: 500 })
    }
    revealedIds = new Set((updated || []).map(r => r.id))
  }

  // Recompute every party's visible reputation from revealed reviews.
  await supabase.rpc('recompute_all_ratings').then(() => {}, () => {})

  // Notify both sides of each newly-revealed collaboration (idempotent).
  const notifiedCollabs = new Set<string>()
  for (const r of overdue || []) {
    if (!revealedIds.has(r.id)) continue
    if (notifiedCollabs.has(r.collab_id)) continue
    notifiedCollabs.add(r.collab_id)
    const c = r.collabs as any
    const users = [c?.brand_profiles?.user_id, c?.creator_profiles?.user_id].filter(Boolean) as string[]
    for (const uid of users) {
      await sendNotification({
        userId: uid, type: 'review_revealed',
        title: 'Your collaboration review is now visible',
        body: 'The 7-day window passed, feedback is now revealed.',
        payload: { collab_id: r.collab_id },
        dedupeKey: `review_revealed:${r.collab_id}:${uid}`,
      })
    }
  }

  return NextResponse.json({ revealed: revealedIds.size, collabs_notified: notifiedCollabs.size })
}

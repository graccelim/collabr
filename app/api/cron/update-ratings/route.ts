import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const { data: reviews } = await supabase.from('reviews')
    .select('collab_id, rating, collabs(creator_id)').eq('reviewer_type', 'brand')

  if (!reviews) return NextResponse.json({ updated: 0 })

  // Group by creator
  const creatorRatings: Record<string, number[]> = {}
  for (const r of reviews) {
    const creatorId = (r.collabs as any)?.creator_id
    if (!creatorId) continue
    if (!creatorRatings[creatorId]) creatorRatings[creatorId] = []
    creatorRatings[creatorId].push(r.rating)
  }

  let updated = 0
  for (const [creatorId, ratings] of Object.entries(creatorRatings)) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
    await supabase.from('creator_profiles').update({
      rating_avg: Math.round(avg * 100) / 100,
      rating_count: ratings.length,
    }).eq('id', creatorId)
    updated++
  }

  return NextResponse.json({ updated })
}

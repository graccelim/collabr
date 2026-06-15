import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()
  // Both directions: brand→creator reviews rate creators, creator→brand rate brands.
  const { data: reviews } = await supabase.from('reviews')
    .select('rating, reviewer_type, collabs(creator_id, brand_id)')

  if (!reviews) return NextResponse.json({ creators: 0, brands: 0 })

  const creatorRatings: Record<string, number[]> = {}
  const brandRatings: Record<string, number[]> = {}
  for (const r of reviews) {
    const c = r.collabs as any
    if (r.reviewer_type === 'brand' && c?.creator_id) (creatorRatings[c.creator_id] ||= []).push(r.rating)
    if (r.reviewer_type === 'creator' && c?.brand_id) (brandRatings[c.brand_id] ||= []).push(r.rating)
  }

  const write = async (table: 'creator_profiles' | 'brand_profiles', groups: Record<string, number[]>) => {
    let n = 0
    for (const [id, ratings] of Object.entries(groups)) {
      const avg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
      await supabase.from(table).update({ rating_avg: avg, rating_count: ratings.length }).eq('id', id)
      n++
    }
    return n
  }

  const creators = await write('creator_profiles', creatorRatings)
  const brands = await write('brand_profiles', brandRatings)
  return NextResponse.json({ creators, brands })
}

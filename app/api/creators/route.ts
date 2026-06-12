import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const niche = searchParams.get('niche')
  const verified = searchParams.get('verified')

  let query = supabase.from('creator_profiles')
    .select('id, user_id, bio, niches, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, total_earned, created_at, users(display_name, avatar_url)')
    .order('is_verified', { ascending: false })
    .order('rating_avg', { ascending: false })

  if (niche) query = query.contains('niches', [niche])
  if (verified === 'true') query = query.eq('is_verified', true)

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

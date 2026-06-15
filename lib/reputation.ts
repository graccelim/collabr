import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

/**
 * Recompute a party's visible reputation (rating_avg + rating_count) from the
 * reviews left ABOUT them. Brands are rated by creators; creators by brands.
 * Aggregates use all such reviews (the numeric average is public; individual
 * notes stay double-blind via RLS). Service-role only — call after a review
 * insert or from the nightly cron.
 */
export async function recomputeBrandRating(admin: Admin, brandId: string) {
  const { data } = await admin.from('reviews')
    .select('rating, collabs!inner(brand_id)')
    .eq('reviewer_type', 'creator')
    .eq('collabs.brand_id', brandId)
  await writeRating(admin, 'brand_profiles', brandId, (data || []).map(r => r.rating))
}

export async function recomputeCreatorRating(admin: Admin, creatorId: string) {
  const { data } = await admin.from('reviews')
    .select('rating, collabs!inner(creator_id)')
    .eq('reviewer_type', 'brand')
    .eq('collabs.creator_id', creatorId)
  await writeRating(admin, 'creator_profiles', creatorId, (data || []).map(r => r.rating))
}

async function writeRating(admin: Admin, table: 'brand_profiles' | 'creator_profiles', id: string, ratings: number[]) {
  const count = ratings.length
  const avg = count > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 100) / 100 : 0
  await admin.from(table).update({ rating_avg: avg, rating_count: count }).eq('id', id)
}

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// ── Per-request memoized auth + profile ──────────────────────────────────────
// `supabase.auth.getUser()` is a NETWORK round-trip to the auth server (it
// re-validates the JWT), and the same goes for the `users` profile read. Both
// were being repeated several times per request — middleware, the dashboard
// layout, each page's role guard, and again inside pages. React `cache()`
// dedupes them to a single call per request render, so the layout, guards and
// page all share one getUser + one profile fetch.

export const getAuthUser = cache(async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

/** The signed-in user's `users` row (role, display_name, email, …) — memoized. */
export const getUserRow = cache(async () => {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = createClient()
  const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
  return data
})

export async function requireAuth() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  return user
}

export async function requireBrand() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const profile = await getUserRow()
  if (profile?.role !== 'brand') redirect('/dashboard')
  return user
}

export async function requireCreator() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const profile = await getUserRow()
  if (profile?.role !== 'creator') redirect('/dashboard')
  return user
}

export async function getProfile(userId: string) {
  const supabase = createClient()
  const { data: user } = await supabase
    .from('users').select('*').eq('id', userId).single()
  if (!user) return null
  if (user.role === 'brand') {
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('id, user_id, company_name, company_description, industry, website, social_url, logo_url, plan, completed_campaigns, onboarding_completed_at, created_at')
      .eq('user_id', userId).single()
    return { ...user, profile: brand }
  }
  if (user.role === 'creator') {
    const { data: creator } = await supabase
      .from('creator_profiles')
      .select('id, user_id, bio, niche, niches, location, portfolio_links, media_kit_url, average_rate_sgd, availability_status, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, onboarding_completed_at, created_at')
      .eq('user_id', userId).single()
    return { ...user, profile: creator }
  }
  return user
}

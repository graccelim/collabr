import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function requireAuth() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return user
}

export async function requireBrand() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'brand') redirect('/dashboard')
  return user
}

export async function requireCreator() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
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
      .from('brand_profiles').select('*').eq('user_id', userId).single()
    return { ...user, profile: brand }
  }
  if (user.role === 'creator') {
    const { data: creator } = await supabase
      .from('creator_profiles').select('*').eq('user_id', userId).single()
    return { ...user, profile: creator }
  }
  return user
}

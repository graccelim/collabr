import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'creator') return NextResponse.json({ error: 'Creator only' }, { status: 403 })

  const body = await req.json()
  const allowed = ['bio', 'niches', 'platforms', 'base_rate']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { data, error } = await supabase.from('creator_profiles')
    .update(updates).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.display_name) {
    await supabase.from('users').update({ display_name: body.display_name }).eq('id', user.id)
  }

  return NextResponse.json(data)
}

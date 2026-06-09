import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single()

  const { data, error } = await supabase.from('reviews').insert({
    collab_id: body.collab_id,
    reviewer_id: user.id,
    reviewer_type: userRow?.role,
    rating: body.rating,
    note: body.note || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

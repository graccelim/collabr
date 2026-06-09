import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { emails } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email, password, name, role } = await req.json()

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!['brand', 'creator'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Create auth user — SSR client sets session cookie on the response
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!data.user) {
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }

  // Use admin client to bypass RLS for the initial row inserts
  // (the session cookie hasn't been read back on this request yet)
  const admin = createAdminClient()

  const { error: userErr } = await admin.from('users').insert({
    id: data.user.id,
    role,
    email,
    display_name: name,
  })
  if (userErr) {
    console.error('[SIGNUP] users insert failed:', userErr)
    return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
  }

  if (role === 'brand') {
    await admin.from('brand_profiles').insert({ user_id: data.user.id, company_name: name })
    // Fire-and-forget — don't block the response on email delivery
    emails.welcomeBrand(name, email).catch(e => console.error('[SIGNUP EMAIL]', e))
  } else {
    await admin.from('creator_profiles').insert({ user_id: data.user.id })
    emails.welcomeCreator(name, email).catch(e => console.error('[SIGNUP EMAIL]', e))
  }

  return NextResponse.json({ success: true })
}

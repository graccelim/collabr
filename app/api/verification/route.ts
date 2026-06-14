import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

// Creator requests bio-code OWNERSHIP verification for one of their socials.
// verification_status is service-role-only — all writes go through the admin
// client here, never the session client.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creators only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const socialId = typeof body.social_account_id === 'string' ? body.social_account_id : ''
  if (!socialId) return NextResponse.json({ error: 'social_account_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: social } = await admin.from('social_accounts')
    .select('id, creator_id, verification_status').eq('id', socialId).maybeSingle()
  if (!social || social.creator_id !== creator.id) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
  if (social.verification_status === 'verified') {
    return NextResponse.json({ error: 'This account is already verified' }, { status: 409 })
  }

  const code = `collabr-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { error } = await admin.from('social_accounts').update({
    verification_status: 'pending',
    verification_method: 'bio_code',
    verification_code: code,
    verification_code_expires_at: expiresAt,
    verification_requested_at: new Date().toISOString(),
  }).eq('id', socialId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('verification_events').insert({
    social_account_id: socialId, creator_id: creator.id, action: 'requested', actor: user.id,
  })

  return NextResponse.json({ code, expires_at: expiresAt, status: 'pending' })
}

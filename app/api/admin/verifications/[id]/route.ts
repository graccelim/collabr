import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Admin approves/rejects a pending social ownership verification.
// id = social_account_id.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const action = body.action as 'approve' | 'reject' | undefined
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (action === 'reject' && reason.length < 3) {
    return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: social } = await admin.from('social_accounts')
    .select('id, creator_id, verification_status').eq('id', params.id).maybeSingle()
  if (!social) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  if (action === 'approve') {
    await admin.from('social_accounts').update({
      verification_status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      verification_code: null,
      verification_code_expires_at: null,
    }).eq('id', params.id)
    await admin.from('verification_events').insert({
      social_account_id: params.id, creator_id: social.creator_id, action: 'verified', actor: user.id,
    })
    // Event-triggered recompute: verification feeds reliability + ranking.
    if (social.creator_id) await admin.rpc('recompute_creator_scores', { p_creator_id: social.creator_id })
    return NextResponse.json({ success: true, status: 'verified' })
  }

  // reject
  await admin.from('social_accounts').update({
    verification_status: 'unverified',
    verification_code: null,
    verification_code_expires_at: null,
  }).eq('id', params.id)
  await admin.from('verification_events').insert({
    social_account_id: params.id, creator_id: social.creator_id, action: 'rejected', actor: user.id, reason,
  })
  return NextResponse.json({ success: true, status: 'unverified' })
}

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flags } from '@/lib/flags'

// Creator disconnects a connected account: delete the stored OAuth tokens (stop
// any future API access) and mark the row revoked + frozen. Historical analytics
// are RETAINED (status flips, data stays).
export async function DELETE(req: NextRequest, { params }: { params: { accountId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!flags.analyticsSuite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
  if (!creator) return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })

  const { data: acct } = await admin.from('connected_accounts')
    .select('id, creator_id')
    .eq('id', params.accountId).maybeSingle()
  if (!acct || acct.creator_id !== creator.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Revoke locally: drop tokens (no more API calls possible) + flip status.
  await admin.from('connected_account_tokens').delete().eq('account_id', acct.id)
  await admin.from('connected_accounts')
    .update({ status: 'revoked', sync_frozen: true })
    .eq('id', acct.id)

  return NextResponse.json({ ok: true })
}

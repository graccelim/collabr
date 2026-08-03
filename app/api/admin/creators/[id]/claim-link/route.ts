import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth'
import { issueClaimToken, revokeActiveClaims } from '@/lib/creator-claims'
import { link } from '@/lib/email'

// Generate (or regenerate - same action) a claim link. Any still-active prior
// link for this creator is revoked first, so at most one link is ever valid
// at a time - simpler to reason about than juggling several live links.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAdminApi()
  if (error) return error

  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles').select('id, user_id').eq('id', params.id).maybeSingle()
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (creator.user_id) return NextResponse.json({ error: 'This profile is already claimed.' }, { status: 409 })

  await revokeActiveClaims(admin, params.id)
  const { token, expiresAt } = await issueClaimToken(admin, { creatorId: params.id, createdBy: user.id })

  return NextResponse.json({
    token,
    url: link(`/claim/${token}`),
    expires_at: expiresAt,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdminApi()
  if (error) return error

  const admin = createAdminClient()
  await revokeActiveClaims(admin, params.id)
  return NextResponse.json({ success: true })
}

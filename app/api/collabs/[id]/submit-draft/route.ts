import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails } from '@/lib/email'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('*, creator_profiles(user_id, users(display_name, email)), brand_profiles(user_id, users(email))')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Collab not found' }, { status: 404 })

  const creatorUserId = (collab.creator_profiles as any)?.user_id
  if (creatorUserId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (collab.payment_status !== 'funded') {
    return NextResponse.json({ error: 'Brand payment must be verified as funded before draft work begins.' }, { status: 409 })
  }

  if (!['briefed', 'in_revision', 'draft_submitted'].includes(collab.status)) {
    return NextResponse.json({ error: 'Cannot submit draft at this stage' }, { status: 400 })
  }

  const body = await req.json()
  const storagePath = typeof body.storage_path === 'string' ? body.storage_path.trim() : null
  const externalUrl = typeof body.external_url === 'string' ? body.external_url.trim() : null
  if ((!storagePath && !externalUrl) || (storagePath && externalUrl)) {
    return NextResponse.json({ error: 'Exactly one draft file or external link is required' }, { status: 400 })
  }
  if (storagePath && !storagePath.startsWith(`${params.id}/`)) {
    return NextResponse.json({ error: 'Draft file path does not belong to this collab' }, { status: 400 })
  }
  if (externalUrl) {
    try {
      const url = new URL(externalUrl)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL')
    } catch {
      return NextResponse.json({ error: 'External draft link must be a valid HTTP or HTTPS URL' }, { status: 400 })
    }
  }
  const autoApproveAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const admin = createAdminClient()

  const { data: result, error } = await admin.rpc('submit_draft_reference_atomic', {
    p_collab_id: params.id,
    p_storage_path: storagePath,
    p_external_url: externalUrl,
    p_creator_note: body.creator_note || '',
    p_auto_approve_at: autoApproveAt,
  }).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 409 })
  const created = (result as any)?.created === true

  // Notify brand
  const brandUserId = (collab.brand_profiles as any)?.user_id
  const brandEmail = (collab.brand_profiles as any)?.users?.email
  const creatorName = (collab.creator_profiles as any)?.users?.display_name || 'Creator'

  if (brandUserId && created) {
    await sendNotification({ userId: brandUserId, type: 'draft_submitted',
      title: `Draft submitted by ${creatorName}`, body: 'Review it within 48 hours',
      payload: { collab_id: params.id },
      dedupeKey: `collab:${params.id}:draft:${(result as any)?.submission_version}:submitted`, email: false })
  }
  if (brandEmail && created) await sendProductEmail({ to: brandEmail, ...productEmails.draftSubmitted({ creatorName, collabId: params.id, key: String((result as any)?.submission_version ?? 'v') }) })

  return NextResponse.json({
    success: true,
    created,
    submission_id: (result as any)?.submission_id,
    version: (result as any)?.submission_version,
    auto_approve_at: created ? autoApproveAt : collab.draft_auto_approve_at,
  })
}

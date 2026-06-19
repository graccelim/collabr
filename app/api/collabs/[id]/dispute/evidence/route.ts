import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails, sendDisputeAdminEmail, link } from '@/lib/email'

function validUrl(u: string): boolean {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' } catch { return false }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('id, status, campaigns(title), creator_profiles(user_id, users(display_name, email)), brand_profiles(user_id, company_name, users(email))')
    .eq('id', params.id).single()
  if (!collab) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const brandUserId = (collab.brand_profiles as any)?.user_id
  const creatorUserId = (collab.creator_profiles as any)?.user_id
  const isBrand = brandUserId === user.id
  const isCreator = creatorUserId === user.id
  if (!isBrand && !isCreator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (collab.status !== 'disputed') return NextResponse.json({ error: 'No active dispute on this collab' }, { status: 409 })

  const admin = createAdminClient()
  const { data: dispute } = await admin.from('disputes')
    .select('id, resolved_at').eq('collab_id', params.id).is('resolved_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!dispute) return NextResponse.json({ error: 'No open dispute found' }, { status: 409 })

  let payload: { body?: string; attachment_urls?: string[] }
  try { payload = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const text = (payload.body || '').trim().slice(0, 5000)
  const urls = (Array.isArray(payload.attachment_urls) ? payload.attachment_urls : [])
    .map(u => String(u).trim()).filter(Boolean).slice(0, 10)
  if (urls.some(u => !validUrl(u))) return NextResponse.json({ error: 'Attachment links must be valid http(s) URLs' }, { status: 400 })
  if (!text && urls.length === 0) return NextResponse.json({ error: 'Add a note or at least one attachment link' }, { status: 400 })

  const { data: evidence, error } = await admin.from('dispute_evidence').insert({
    dispute_id: dispute.id,
    collab_id: params.id,
    author_user_id: user.id,
    author_type: isBrand ? 'brand' : 'creator',
    body: text || null,
    attachment_urls: urls,
  }).select('id').single()
  if (error) return NextResponse.json({ error: 'Could not save your evidence' }, { status: 500 })

  // Notify the other party (in-app + email) and mirror to the mediation inbox.
  const otherUserId = isBrand ? creatorUserId : brandUserId
  const otherEmail = isBrand ? (collab.creator_profiles as any)?.users?.email : (collab.brand_profiles as any)?.users?.email
  if (otherUserId) {
    await sendNotification({
      userId: otherUserId, type: 'dispute_evidence',
      title: 'New evidence was added to your dispute',
      body: 'Open the dispute to see it and add your own.',
      payload: { collab_id: params.id },
      dedupeKey: `dispute:${dispute.id}:evidence:${evidence.id}`,
    })
  }
  if (otherEmail && otherUserId) {
    await sendProductEmail({ to: otherEmail, ...productEmails.disputeEvidenceAdded({ collabId: params.id, disputeId: String(dispute.id), evidenceId: String(evidence.id), recipientId: otherUserId }) })
  }
  // Same subject + threadKey as the open email → threads into one conversation.
  const title = (collab.campaigns as any)?.title || 'collab'
  const submitterName = isBrand
    ? ((collab.brand_profiles as any)?.company_name || 'Brand')
    : ((collab.creator_profiles as any)?.users?.display_name || 'Creator')
  const submitterEmail = isBrand
    ? (collab.brand_profiles as any)?.users?.email
    : (collab.creator_profiles as any)?.users?.email
  await sendDisputeAdminEmail(`Dispute · ${title}`, {
    Event: 'Evidence added',
    Campaign: title,
    'Submitted by': `${submitterName} (${isBrand ? 'Brand' : 'Creator'})${submitterEmail ? ` <${submitterEmail}>` : ''}`,
    Note: text || '(none)',
    Attachments: urls.length ? urls.join('  •  ') : '(none)',
    Collab: link(`/collabs/${params.id}`),
  }, String(dispute.id)).catch(() => {})

  return NextResponse.json({ success: true, evidence_id: evidence.id })
}

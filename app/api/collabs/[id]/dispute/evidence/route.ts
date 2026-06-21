import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendNotification } from '@/lib/notifications'
import { sendProductEmail, productEmails, sendDisputeAdminEmail, link } from '@/lib/email'

const BUCKET = 'dispute-evidence'
const MAX_ITEMS = 10
const MAX_SIZE = 25 * 1024 * 1024 // 25MB

function validUrl(u: string): boolean {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' } catch { return false }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: collab } = await supabase.from('collabs')
    .select('id, status, agreed_rate, campaigns(title), creator_profiles(user_id, users(display_name, email)), brand_profiles(user_id, company_name, users(email))')
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

  // Multipart: written note + external links + uploaded files.
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const text = String(form.get('body') || '').trim().slice(0, 5000)
  const urls = form.getAll('urls').map(u => String(u).trim()).filter(Boolean).slice(0, MAX_ITEMS)
  if (urls.some(u => !validUrl(u))) return NextResponse.json({ error: 'Attachment links must be valid http(s) URLs' }, { status: 400 })
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0).slice(0, MAX_ITEMS)
  if (files.some(f => f.size > MAX_SIZE)) return NextResponse.json({ error: 'Each file must be 25MB or smaller' }, { status: 413 })
  if (!text && urls.length === 0 && files.length === 0) {
    return NextResponse.json({ error: 'Add a note, a link, or a file' }, { status: 400 })
  }

  // Upload files (service role → bypasses storage RLS, works for both parties).
  // Graceful degradation: a failed file NEVER discards the written note, links,
  // or the files that did upload — we record which files failed and report them.
  // Safe media only — no text/html or image/svg+xml (those render inline from the
  // signed-URL storage domain → stored XSS against the counterparty/mediator).
  const ALLOWED_TYPES = new Set([
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf', 'video/mp4', 'video/quicktime',
  ])
  const storedPaths: string[] = []
  const failedFiles: string[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    if (!ALLOWED_TYPES.has(f.type)) { failedFiles.push(`${f.name || `file ${i + 1}`} (unsupported type)`); continue }
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file'
    const path = `${params.id}/dispute/${Date.now()}_${i}_${safe}`
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false })
    if (upErr) { failedFiles.push(f.name || `file ${i + 1}`); continue }
    storedPaths.push(`storage:${path}`)
  }

  // Nothing survived to save (no note, no links, and every file failed) — only
  // then do we reject, so the user can retry without having lost any writing.
  if (!text && urls.length === 0 && storedPaths.length === 0) {
    return NextResponse.json(
      { error: failedFiles.length ? `Upload failed for all ${failedFiles.length} file(s). Please try again.` : 'Add a note, a link, or a file' },
      { status: failedFiles.length ? 502 : 400 },
    )
  }

  // Stored as a mix of external URLs and `storage:<path>` references.
  const attachment_urls = [...urls, ...storedPaths]

  const { data: evidence, error } = await admin.from('dispute_evidence').insert({
    dispute_id: dispute.id,
    collab_id: params.id,
    author_user_id: user.id,
    author_type: isBrand ? 'brand' : 'creator',
    body: text || null,
    attachment_urls,
  }).select('id').single()
  if (error) return NextResponse.json({ error: 'Could not save your evidence' }, { status: 500 })

  // Resolve attachments to viewable links for the email (sign stored files).
  const emailLinks = await Promise.all(attachment_urls.map(async a => {
    if (!a.startsWith('storage:')) return a
    const { data } = await admin.storage.from(BUCKET).createSignedUrl(a.slice(8), 60 * 60 * 24 * 7)
    return data?.signedUrl || '(stored file)'
  }))

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
    await sendProductEmail({ to: otherEmail, ...productEmails.disputeEvidenceAdded({ collabId: params.id, disputeId: String(dispute.id), evidenceId: String(evidence.id), recipientId: otherUserId, isBarter: ((collab as any).agreed_rate ?? 0) === 0 }) })
  }

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
    Attachments: emailLinks.length ? emailLinks.join('  •  ') : '(none)',
    ...(failedFiles.length ? { 'Failed uploads': failedFiles.join(', ') } : {}),
    Collab: link(`/collabs/${params.id}`),
  }, String(dispute.id)).catch(() => {})

  return NextResponse.json({ success: true, evidence_id: evidence.id, failed_files: failedFiles })
}

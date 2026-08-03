import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'
import { normalizeNicheTags } from '@/lib/niches'
import { socialAccountInputSchema, socialUrl } from '@/lib/onboarding'

const editSchema = z.object({
  display_name: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(2000).optional().nullable(),
  niche_tags: z.array(z.string()).max(4).optional(),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
  // Full replacement set, not a patch - the edit form always resubmits every
  // row. Optional: omit entirely to leave socials untouched.
  socials: z.array(socialAccountInputSchema).min(1).max(6).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdminApi()
  if (error) return error

  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles').select('id, user_id').eq('id', params.id).maybeSingle()
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}
  // creator_profiles.display_name is pre-claim only - once claimed, the real
  // name lives on users.display_name and this field is never read again.
  if (parsed.data.display_name !== undefined && !creator.user_id) updates.display_name = parsed.data.display_name
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio || null
  if (parsed.data.niche_tags !== undefined) {
    const niche_tags = normalizeNicheTags(parsed.data.niche_tags)
    updates.niche_tags = niche_tags
    updates.niche = niche_tags[0] ?? null
  }
  if (parsed.data.internal_notes !== undefined) updates.internal_notes = parsed.data.internal_notes || null
  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await admin.from('creator_profiles').update(updates).eq('id', params.id)
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  if (parsed.data.socials) {
    const seen = new Set<string>()
    for (const s of parsed.data.socials) {
      const key = `${s.platform}:${s.handle}`
      if (seen.has(key)) return NextResponse.json({ error: `Duplicate handle @${s.handle} on ${s.platform}` }, { status: 400 })
      seen.add(key)
    }
    for (const s of parsed.data.socials) {
      const { data: taken } = await admin.from('social_accounts')
        .select('id').eq('platform', s.platform).eq('handle', s.handle).neq('creator_id', params.id).maybeSingle()
      if (taken) {
        return NextResponse.json({ error: `@${s.handle} on ${s.platform} is already connected to another profile` }, { status: 409 })
      }
    }
    // Full replace: delete this creator's existing rows, insert the resubmitted set.
    const { error: delErr } = await admin.from('social_accounts').delete().eq('creator_id', params.id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    const { error: insErr } = await admin.from('social_accounts').insert(
      parsed.data.socials.map((s, i) => ({
        creator_id: params.id,
        platform: s.platform,
        handle: s.handle,
        url: socialUrl(s.platform, s.handle),
        follower_count: s.follower_count ?? null,
        is_primary: i === 0,
      }))
    )
    if (insErr) return NextResponse.json({ error: 'Could not save social accounts (handle may already be taken)' }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}

// Archive, never delete - applications/collabs/reviews reference
// creator_profiles.id with ON DELETE CASCADE, so a hard delete through this
// "simple internal tool" could silently destroy real transaction history for
// a claimed creator. Archiving is reversible and purely a visibility control
// (hidden from public discovery/search) - it does not touch a claimed
// creator's ability to log in and use their own dashboard.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdminApi()
  if (error) return error

  const admin = createAdminClient()
  const { data: creator } = await admin.from('creator_profiles').select('id').eq('id', params.id).maybeSingle()
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error: archiveErr } = await admin.from('creator_profiles')
    .update({ archived_at: new Date().toISOString() }).eq('id', params.id)
  if (archiveErr) return NextResponse.json({ error: archiveErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Unarchive - reverses the above.
export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdminApi()
  if (error) return error

  const admin = createAdminClient()
  const { error: unarchiveErr } = await admin.from('creator_profiles')
    .update({ archived_at: null }).eq('id', params.id)
  if (unarchiveErr) return NextResponse.json({ error: unarchiveErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

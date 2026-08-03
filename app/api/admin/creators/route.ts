import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/auth'
import { normalizeNicheTags } from '@/lib/niches'
import { socialAccountInputSchema } from '@/lib/onboarding'
import { seedCreatorProfile } from '@/lib/admin-creators'

// Concierge beta: create a creator_profiles row with no linked account yet
// (user_id stays NULL). Writes real social_accounts rows - not a text blob -
// so the profile automatically satisfies the existing onboarding gate ("at
// least one social") the moment it's claimed, with no special-case bypass.
const createSchema = z.object({
  display_name: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(2000).optional().nullable(),
  niche_tags: z.array(z.string()).max(4).optional().default([]),
  internal_notes: z.string().trim().max(2000).optional().nullable(),
  socials: z.array(socialAccountInputSchema).min(1).max(6),
})

export async function POST(req: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { error: issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const result = await seedCreatorProfile(admin, {
    displayName: parsed.data.display_name,
    bio: parsed.data.bio,
    nicheTags: normalizeNicheTags(parsed.data.niche_tags),
    internalNotes: parsed.data.internal_notes,
    socials: parsed.data.socials,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ success: true, id: result.id }, { status: 201 })
}

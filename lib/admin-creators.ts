import type { createAdminClient } from '@/lib/supabase/server'
import { ensureCreatorSlug } from '@/lib/slug-server'
import { socialUrl, type SocialAccountInput } from '@/lib/onboarding'

type Admin = ReturnType<typeof createAdminClient>

export interface SeedCreatorInput {
  displayName: string
  bio?: string | null
  nicheTags?: string[]
  internalNotes?: string | null
  socials: SocialAccountInput[]
}

export type SeedCreatorResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string }

/**
 * Core creator-seeding logic - dup-check, insert profile + real
 * social_accounts rows, assign a slug. Shared by the single-creator admin
 * route and the bulk-import route so there is exactly one place that knows
 * how to seed a concierge-beta profile.
 */
export async function seedCreatorProfile(admin: Admin, input: SeedCreatorInput): Promise<SeedCreatorResult> {
  const seen = new Set<string>()
  for (const s of input.socials) {
    const key = `${s.platform}:${s.handle}`
    if (seen.has(key)) return { ok: false, status: 400, error: `Duplicate handle @${s.handle} on ${s.platform}` }
    seen.add(key)
  }
  for (const s of input.socials) {
    const { data: taken } = await admin.from('social_accounts')
      .select('id').eq('platform', s.platform).eq('handle', s.handle).maybeSingle()
    if (taken) {
      return { ok: false, status: 409, error: `@${s.handle} on ${s.platform} is already connected to another profile` }
    }
  }

  const niche_tags = input.nicheTags || []
  const { data: creator, error: insertErr } = await admin.from('creator_profiles').insert({
    user_id: null,
    created_by_admin: true,
    display_name: input.displayName,
    bio: input.bio || null,
    niche: niche_tags[0] ?? null,
    niche_tags,
    internal_notes: input.internalNotes || null,
  }).select('id').single()
  if (insertErr || !creator) {
    console.error('[SEED CREATOR]', insertErr)
    return { ok: false, status: 500, error: 'Could not create profile' }
  }

  const { error: socialErr } = await admin.from('social_accounts').insert(
    input.socials.map((s, i) => ({
      creator_id: creator.id,
      platform: s.platform,
      handle: s.handle,
      url: socialUrl(s.platform, s.handle),
      follower_count: s.follower_count ?? null,
      is_primary: i === 0,
    }))
  )
  if (socialErr) {
    console.error('[SEED CREATOR] social insert failed:', socialErr)
    // Roll back the bare profile rather than leave a socialless row behind -
    // a seeded profile always has at least one social, matching the
    // onboarding-gate assumption elsewhere.
    await admin.from('creator_profiles').delete().eq('id', creator.id)
    return { ok: false, status: 409, error: 'Could not save social accounts (handle may already be taken)' }
  }

  await ensureCreatorSlug(admin, creator.id, input.displayName)

  return { ok: true, id: creator.id }
}

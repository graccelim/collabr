import type { createAdminClient } from '@/lib/supabase/server'
import { slugify, uniqueSlug } from '@/lib/slug'

type Admin = ReturnType<typeof createAdminClient>
type SlugTable = 'creator_profiles' | 'brand_profiles' | 'campaigns'

// Is `candidate` already taken by a DIFFERENT row in `table`?
async function taken(admin: Admin, table: SlugTable, candidate: string, excludeId: string): Promise<boolean> {
  const { data } = await admin.from(table).select('id').eq('slug', candidate).limit(1)
  if (!data || data.length === 0) return false
  return data[0].id !== excludeId
}

/**
 * Generate-once slug. If the row already has a slug, it's returned untouched
 * (slugs are stable - we never auto-regenerate when names change). Otherwise a
 * collision-free slug is built from `base` and stored (race-safe via the
 * `is('slug', null)` guard). Best-effort: returns null and logs on failure so a
 * slug hiccup never blocks signup / campaign creation.
 */
export async function ensureSlug(
  admin: Admin,
  table: SlugTable,
  id: string,
  base: string,
  existingSlug?: string | null,
): Promise<string | null> {
  if (existingSlug) return existingSlug
  if (!base || !slugify(base) || slugify(base) === 'profile') {
    // Still generate something usable so the row is always shareable.
  }
  try {
    const slug = await uniqueSlug(base, c => taken(admin, table, c, id))
    // Only claim the slug if the row is still slug-less (avoids clobbering a
    // concurrent writer).
    const { data } = await admin.from(table)
      .update({ slug }).eq('id', id).is('slug', null).select('slug').maybeSingle()
    if (data?.slug) return data.slug
    // A concurrent request set it first - return whatever is stored now.
    const { data: current } = await admin.from(table).select('slug').eq('id', id).maybeSingle()
    return current?.slug ?? null
  } catch (e) {
    console.error('[slug]', table, e)
    return null
  }
}

export const ensureCreatorSlug = (admin: Admin, id: string, displayName: string, existing?: string | null) =>
  ensureSlug(admin, 'creator_profiles', id, displayName, existing)

export const ensureBrandSlug = (admin: Admin, id: string, companyName: string, existing?: string | null) =>
  ensureSlug(admin, 'brand_profiles', id, companyName, existing)

// Campaign slug carries brand context so it's descriptive + less collision-prone.
export const ensureCampaignSlug = (admin: Admin, id: string, title: string, brandName: string, existing?: string | null) =>
  ensureSlug(admin, 'campaigns', id, `${title} ${brandName}`.trim(), existing)

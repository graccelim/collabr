import { z } from 'zod'

// Phase 5 vocabularies - must match the check constraints in
// supabase/migrations/007_trust_and_onboarding.sql.

export const CREATOR_NICHES = [
  'food', 'lifestyle', 'travel', 'fashion', 'beauty', 'fitness', 'tech',
  'parenting', 'business', 'gaming', 'education', 'other',
] as const
export type CreatorNiche = (typeof CREATOR_NICHES)[number]

export const BRAND_INDUSTRIES = [
  'fnb', 'retail', 'beauty', 'fashion', 'technology', 'travel', 'hospitality',
  'finance', 'education', 'healthcare', 'other',
] as const
export type BrandIndustry = (typeof BRAND_INDUSTRIES)[number]

export const SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'x', 'lemon8', 'xiaohongshu'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
  lemon8: 'Lemon8',
  xiaohongshu: 'RED (Xiaohongshu)',
}

// Platforms whose handle reads as "@name". Xiaohongshu profiles are id-based
// (no public @handle), so we show the id / a profile label instead.
const AT_PLATFORMS = new Set<SocialPlatform>(['instagram', 'tiktok', 'youtube', 'x', 'lemon8'])

/** Human-facing handle label for a social row ("@name" or the raw id). */
export function socialHandleLabel(platform: SocialPlatform, handle: string): string {
  return AT_PLATFORMS.has(platform) ? `@${handle}` : handle
}

/**
 * The fixed URL prefix shown before a username input, e.g. "instagram.com/" or
 * "tiktok.com/@". Derived from socialUrl() so the prefix and the stored URL can
 * never drift. (Xiaohongshu has no username - callers fall back to a link field.)
 */
export function socialUrlPrefix(platform: SocialPlatform): string {
  return socialUrl(platform, '').replace(/^https?:\/\//, '')
}

export const INDUSTRY_LABELS: Record<BrandIndustry, string> = {
  fnb: 'F&B',
  retail: 'Retail',
  beauty: 'Beauty',
  fashion: 'Fashion',
  technology: 'Technology',
  travel: 'Travel',
  hospitality: 'Hospitality',
  finance: 'Finance',
  education: 'Education',
  healthcare: 'Healthcare',
  other: 'Other',
}

export const NICHE_LABELS: Record<CreatorNiche, string> = {
  food: 'Food',
  lifestyle: 'Lifestyle',
  travel: 'Travel',
  fashion: 'Fashion',
  beauty: 'Beauty',
  fitness: 'Fitness',
  tech: 'Tech',
  parenting: 'Parenting',
  business: 'Business',
  gaming: 'Gaming',
  education: 'Education',
  other: 'Other',
}

/** Lowercase, trim, strip leading '@' - the canonical stored form. */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

/**
 * Accept bare domains the way people actually type them ("glow.sg") and
 * normalize to a full URL; empty input → null.
 */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export const HANDLE_REGEX = /^[a-z0-9._-]{1,64}$/

export function socialUrl(platform: SocialPlatform, handle: string): string {
  switch (platform) {
    case 'instagram':   return `https://instagram.com/${handle}`
    case 'tiktok':      return `https://tiktok.com/@${handle}`
    case 'youtube':     return `https://youtube.com/@${handle}`
    case 'x':           return `https://x.com/${handle}`
    case 'lemon8':      return `https://www.lemon8-app.com/@${handle}`
    case 'xiaohongshu': return `https://www.xiaohongshu.com/user/profile/${handle}`
  }
}

/**
 * Accept either a bare handle ("@girldevours") or a pasted profile URL and
 * reduce it to the canonical, storable handle. For Xiaohongshu the "handle" is
 * the profile id segment (".../user/profile/<id>"); for everyone else it's the
 * last path segment with any leading '@' stripped. Always lowercased.
 */
export function extractHandle(platform: SocialPlatform, raw: string): string {
  let t = (raw || '').trim()
  if (!t) return ''
  if (t.includes('/') || /^https?:/i.test(t)) {
    if (platform === 'xiaohongshu') {
      const m = t.match(/profile\/([^/?#]+)/i)
      t = m ? m[1] : (t.split(/[/?#]/).filter(Boolean).pop() || t)
    } else {
      t = t.split(/[?#]/)[0].replace(/\/+$/, '')
      t = t.split('/').filter(Boolean).pop() || t
    }
  }
  return t.replace(/^@+/, '').toLowerCase()
}

export const socialAccountInputSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z.string().min(1).max(300),
  follower_count: z.number().int().min(0).max(1_000_000_000).nullish(),
  is_primary: z.boolean().optional(),
})
  .transform(v => ({ ...v, handle: extractHandle(v.platform, v.handle) }))
  .refine(v => HANDLE_REGEX.test(v.handle), {
    message: 'Enter a valid handle or profile link',
    path: ['handle'],
  })
export type SocialAccountInput = z.infer<typeof socialAccountInputSchema>

export const creatorOnboardingSchema = z.object({
  // Primary niche is derived from the first tag; kept optional for compatibility.
  niche: z.enum(CREATOR_NICHES).optional(),
  // Niche is now OPTIONAL at signup (creators add it later from the completion
  // checklist) — only a social profile is required to get the account live.
  niche_tags: z.array(z.enum(CREATOR_NICHES)).max(4, 'Pick up to 4 niches').optional().default([]),
  socials: z.array(socialAccountInputSchema).min(1, 'At least one social account is required').max(6),
})

const optionalUrl = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().url('Must be a valid URL (include https://)').max(300).nullish()
)

/** Requires website OR social_url - apply to any object containing both. */
export function requireWebsiteOrSocial<T extends { website?: string | null; social_url?: string | null }>(b: T): boolean {
  return Boolean(b.website || b.social_url)
}

export const brandOnboardingFields = z.object({
  company_name: z.string().trim().min(2, 'Company name is required').max(120),
  industry: z.enum(BRAND_INDUSTRIES),
  website: optionalUrl,
  social_url: optionalUrl,
})

export const brandOnboardingSchema = brandOnboardingFields.refine(requireWebsiteOrSocial, {
  message: 'A website or a social account link is required',
  path: ['website'],
})

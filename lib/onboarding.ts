import { z } from 'zod'

// Phase 5 vocabularies — must match the check constraints in
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

export const SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

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

/** Lowercase, trim, strip leading '@' — the canonical stored form. */
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
    case 'instagram': return `https://instagram.com/${handle}`
    case 'tiktok':    return `https://tiktok.com/@${handle}`
    case 'youtube':   return `https://youtube.com/@${handle}`
  }
}

export const socialAccountInputSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z.string().min(1).max(80).transform(normalizeHandle)
    .refine(h => HANDLE_REGEX.test(h), 'Handle may only contain letters, numbers, dots, dashes and underscores'),
  follower_count: z.number().int().min(0).max(1_000_000_000).nullish(),
  is_primary: z.boolean().optional(),
})
export type SocialAccountInput = z.infer<typeof socialAccountInputSchema>

export const creatorOnboardingSchema = z.object({
  niche: z.enum(CREATOR_NICHES),
  socials: z.array(socialAccountInputSchema).min(1, 'At least one social account is required').max(6),
})

const optionalUrl = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().trim().url('Must be a valid URL (include https://)').max(300).nullish()
)

/** Requires website OR social_url — apply to any object containing both. */
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

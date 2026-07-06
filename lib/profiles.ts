import { z } from 'zod'
import { CREATOR_NICHES, BRAND_INDUSTRIES, SOCIAL_PLATFORMS } from '@/lib/onboarding'

// zod's .url() accepts any parseable URL — including javascript:/data: schemes,
// which would become stored XSS when rendered as an href on public profiles.
// Every user-supplied link must be plain http(s).
const isHttpUrl = (v: string) => {
  try { return new URL(v).protocol === 'http:' || new URL(v).protocol === 'https:' } catch { return false }
}
const HTTP_ONLY_MSG = 'Link must start with http:// or https://'

// A brand's stored social profile (multiple per brand, one primary).
export const brandSocialSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z.string().trim().min(1).max(64),
  url: z.string().trim().url().max(300).refine(isHttpUrl, HTTP_ONLY_MSG),
  is_primary: z.boolean(),
  follower_count: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
})

// Phase 6 profile editing schemas - must match the check constraints in
// supabase/migrations/008_profile_quality.sql.

export const AVAILABILITY_STATUSES = ['available', 'limited', 'unavailable'] as const
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number]

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Available for collabs',
  limited: 'Limited availability',
  unavailable: 'Not taking collabs',
}

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

const optionalUrl = z.preprocess(
  emptyToNull,
  z.string().trim().url('Must be a valid URL (include https://)').max(300)
    .refine(isHttpUrl, HTTP_ONLY_MSG).nullish()
)

const optionalText = (max: number, label: string) => z.preprocess(
  emptyToNull,
  z.string().trim().max(max, `${label} must be ${max} characters or less`).nullish()
)

// A name that can be omitted (PATCH semantics) but never set to empty - every
// brand/creator must always have a name (it drives public profiles + slugs).
const requiredName = (label = 'Your name') =>
  z.string().trim().min(2, `${label} is required`).max(120).optional()

// All fields optional - PATCH semantics. Monetary values are cents.
export const creatorProfileUpdateSchema = z.object({
  bio: optionalText(1000, 'Bio'),
  niche: z.enum(CREATOR_NICHES).nullish(),
  niche_tags: z.array(z.enum(CREATOR_NICHES)).max(4, 'Pick up to 4 niches').optional(),
  location: optionalText(120, 'Location'),
  portfolio_links: z.array(
    z.string().trim().url('Each portfolio link must be a valid URL (include https://)').max(300)
      .refine(isHttpUrl, HTTP_ONLY_MSG)
  ).max(10, 'Up to 10 portfolio links').optional(),
  media_kit_url: optionalUrl,
  average_rate_sgd: z.number().int().min(0).max(100_000_000).nullish(),
  availability_status: z.enum(AVAILABILITY_STATUSES).optional(),
  display_name: requiredName(),
}).strict()

export const brandProfileUpdateSchema = z.object({
  company_name: requiredName('Company name'),
  company_description: optionalText(2000, 'Description'),
  industry: z.enum(BRAND_INDUSTRIES).nullish(),
  location: optionalText(120, 'Location'),
  website: optionalUrl,
  social_url: optionalUrl,
  socials: z.array(brandSocialSchema).max(6).optional(),
  logo_url: optionalUrl,
  // A brand's public name is company_name (required above); the personal
  // display_name stays optional.
  display_name: optionalText(120, 'Display name'),
}).strict()

export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0]
  return issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input'
}

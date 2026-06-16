import { z } from 'zod'
import { CREATOR_NICHES, BRAND_INDUSTRIES } from '@/lib/onboarding'

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
  z.string().trim().url('Must be a valid URL (include https://)').max(300).nullish()
)

const optionalText = (max: number, label: string) => z.preprocess(
  emptyToNull,
  z.string().trim().max(max, `${label} must be ${max} characters or less`).nullish()
)

// All fields optional - PATCH semantics. Monetary values are cents.
export const creatorProfileUpdateSchema = z.object({
  bio: optionalText(1000, 'Bio'),
  niche: z.enum(CREATOR_NICHES).nullish(),
  niche_tags: z.array(z.enum(CREATOR_NICHES)).max(4, 'Pick up to 4 niches').optional(),
  location: optionalText(120, 'Location'),
  portfolio_links: z.array(
    z.string().trim().url('Each portfolio link must be a valid URL (include https://)').max(300)
  ).max(10, 'Up to 10 portfolio links').optional(),
  media_kit_url: optionalUrl,
  average_rate_sgd: z.number().int().min(0).max(100_000_000).nullish(),
  availability_status: z.enum(AVAILABILITY_STATUSES).optional(),
  display_name: optionalText(120, 'Display name'),
}).strict()

export const brandProfileUpdateSchema = z.object({
  company_name: z.preprocess(
    emptyToNull,
    z.string().trim().min(2, 'Company name is required').max(120).optional()
  ),
  company_description: optionalText(2000, 'Description'),
  industry: z.enum(BRAND_INDUSTRIES).nullish(),
  location: optionalText(120, 'Location'),
  website: optionalUrl,
  social_url: optionalUrl,
  logo_url: optionalUrl,
  display_name: optionalText(120, 'Display name'),
}).strict()

export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0]
  return issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input'
}

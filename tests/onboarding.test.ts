import { describe, it, expect } from 'vitest'
import {
  normalizeHandle, HANDLE_REGEX,
  socialAccountInputSchema, creatorOnboardingSchema, brandOnboardingSchema,
} from '@/lib/onboarding'

// Duplicate-handle prevention relies on handles being stored in ONE canonical
// form: the DB unique index is on (platform, handle), so normalization is the
// part of the defense that lives in code.
describe('handle normalization (duplicate-handle defense)', () => {
  it('canonicalizes case, whitespace, and leading @', () => {
    expect(normalizeHandle(' @FoodieSara ')).toBe('foodiesara')
    expect(normalizeHandle('@@double')).toBe('double')
    expect(normalizeHandle('Plain.Name_01')).toBe('plain.name_01')
  })

  it('two cosmetic variants of one handle collide after normalization', () => {
    expect(normalizeHandle('@FoodieSara')).toBe(normalizeHandle('foodiesara '))
  })

  it('rejects malformed handles after normalization', () => {
    expect(HANDLE_REGEX.test(normalizeHandle('has space'))).toBe(false)
    expect(HANDLE_REGEX.test(normalizeHandle('emoji😀'))).toBe(false)
    expect(HANDLE_REGEX.test('a'.repeat(65))).toBe(false)
    expect(HANDLE_REGEX.test(normalizeHandle('@valid.handle-1'))).toBe(true)
  })

  it('schema transforms and validates a social account input', () => {
    const parsed = socialAccountInputSchema.safeParse({
      platform: 'instagram', handle: ' @FoodieSara ', follower_count: 1200,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.handle).toBe('foodiesara')

    expect(socialAccountInputSchema.safeParse({
      platform: 'instagram', handle: 'bad handle!',
    }).success).toBe(false)
    expect(socialAccountInputSchema.safeParse({
      platform: 'myspace', handle: 'ok',
    }).success).toBe(false)
    expect(socialAccountInputSchema.safeParse({
      platform: 'tiktok', handle: 'ok', follower_count: -5,
    }).success).toBe(false)
  })
})

describe('creator onboarding requirements', () => {
  it('requires at least one valid niche and at least one social', () => {
    expect(creatorOnboardingSchema.safeParse({
      niche_tags: ['food'],
      socials: [{ platform: 'tiktok', handle: 'sara' }],
    }).success).toBe(true)

    expect(creatorOnboardingSchema.safeParse({
      niche_tags: ['food'], socials: [],
    }).success).toBe(false)

    expect(creatorOnboardingSchema.safeParse({
      niche_tags: ['astronomy'],
      socials: [{ platform: 'tiktok', handle: 'sara' }],
    }).success).toBe(false)
  })
})

describe('brand onboarding requirements', () => {
  it('requires company name + industry + website OR social', () => {
    expect(brandOnboardingSchema.safeParse({
      company_name: 'Glow Works', industry: 'beauty', website: 'https://glow.sg',
    }).success).toBe(true)

    expect(brandOnboardingSchema.safeParse({
      company_name: 'Glow Works', industry: 'beauty',
      social_url: 'https://instagram.com/glow',
    }).success).toBe(true)

    // neither website nor social → rejected
    expect(brandOnboardingSchema.safeParse({
      company_name: 'Glow Works', industry: 'beauty',
    }).success).toBe(false)

    // invalid industry → rejected
    expect(brandOnboardingSchema.safeParse({
      company_name: 'Glow Works', industry: 'aerospace', website: 'https://glow.sg',
    }).success).toBe(false)

    // empty strings don't satisfy the website-or-social requirement
    expect(brandOnboardingSchema.safeParse({
      company_name: 'Glow Works', industry: 'beauty', website: '', social_url: '',
    }).success).toBe(false)
  })
})

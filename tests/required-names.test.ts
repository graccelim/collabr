import { describe, it, expect } from 'vitest'
import { creatorProfileUpdateSchema, brandProfileUpdateSchema } from '@/lib/profiles'

// A creator/brand must always carry a name - it drives the public profile and
// the SEO slug, so it can be OMITTED on a PATCH (name unchanged) but never
// SET to empty.
describe('names are required (cannot be cleared)', () => {
  describe('creator display_name', () => {
    it('rejects an empty string', () => {
      const r = creatorProfileUpdateSchema.safeParse({ display_name: '' })
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error.issues[0].message).toMatch(/name is required/i)
    })
    it('rejects whitespace-only', () => {
      expect(creatorProfileUpdateSchema.safeParse({ display_name: '   ' }).success).toBe(false)
    })
    it('rejects a single character', () => {
      expect(creatorProfileUpdateSchema.safeParse({ display_name: 'A' }).success).toBe(false)
    })
    it('accepts a real name (trimmed)', () => {
      const r = creatorProfileUpdateSchema.safeParse({ display_name: '  Grace Lim  ' })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.display_name).toBe('Grace Lim')
    })
    it('allows omitting it entirely (PATCH leaves the name untouched)', () => {
      expect(creatorProfileUpdateSchema.safeParse({ bio: 'hi there everyone' }).success).toBe(true)
    })
  })

  describe('brand company_name', () => {
    it('rejects an empty company name', () => {
      const r = brandProfileUpdateSchema.safeParse({ company_name: '' })
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error.issues[0].message).toMatch(/company name is required/i)
    })
    it('rejects a single character', () => {
      expect(brandProfileUpdateSchema.safeParse({ company_name: 'A' }).success).toBe(false)
    })
    it('accepts a real company name', () => {
      expect(brandProfileUpdateSchema.safeParse({ company_name: 'Acme Pte Ltd' }).success).toBe(true)
    })
    it('allows omitting it (PATCH leaves it untouched)', () => {
      expect(brandProfileUpdateSchema.safeParse({ location: 'Singapore' }).success).toBe(true)
    })
    it("a brand's personal display_name stays optional (may be blank)", () => {
      expect(brandProfileUpdateSchema.safeParse({ display_name: '' }).success).toBe(true)
    })
  })
})

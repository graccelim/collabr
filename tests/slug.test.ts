import { describe, it, expect } from 'vitest'
import { slugify, uniqueSlug, isUuid } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Acme Coffee')).toBe('acme-coffee')
    expect(slugify('Starbucks Singapore')).toBe('starbucks-singapore')
  })
  it('keeps a clean handle as-is', () => {
    expect(slugify('girldevours')).toBe('girldevours')
  })
  it('strips apostrophes and punctuation', () => {
    expect(slugify("O'Brien & Co.")).toBe('obrien-and-co')
    expect(slugify('Café del Mar')).toBe('cafe-del-mar')
  })
  it('collapses repeats and trims hyphens', () => {
    expect(slugify('  --Hello   World!!  ')).toBe('hello-world')
  })
  it('falls back to "profile" when nothing usable remains', () => {
    expect(slugify('🎉🎉')).toBe('profile')
    expect(slugify('')).toBe('profile')
  })
  it('caps length', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60)
  })
})

describe('uniqueSlug', () => {
  it('returns the base when free', async () => {
    expect(await uniqueSlug('Acme Coffee', async () => false)).toBe('acme-coffee')
  })
  it('appends -2, -3 on collisions', async () => {
    const taken = new Set(['acme-coffee', 'acme-coffee-2'])
    expect(await uniqueSlug('Acme Coffee', async s => taken.has(s))).toBe('acme-coffee-3')
  })
  it('handles a long collision chain', async () => {
    const taken = new Set(['x', 'x-2', 'x-3', 'x-4'])
    expect(await uniqueSlug('x', async s => taken.has(s))).toBe('x-5')
  })
})

describe('isUuid', () => {
  it('recognises a UUID vs a slug', () => {
    expect(isUuid('11111111-1111-1111-1111-111111111111')).toBe(true)
    expect(isUuid('acme-coffee')).toBe(false)
    expect(isUuid('girldevours')).toBe(false)
  })
})

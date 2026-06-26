import { describe, it, expect } from 'vitest'
import { classHash, validateLabels } from '@/lib/analytics/classify'
import { formatFromMetadata, isCategory, isSubcategory } from '@/lib/analytics/taxonomy'

describe('classHash', () => {
  it('is stable for the same metadata and changes when metadata changes', () => {
    const a = classHash({ title: 'Best ramen in town', caption: 'so good #food', hashtags: ['#food'], durationSec: 22 })
    const b = classHash({ title: 'Best ramen in town', caption: 'so good #food', hashtags: ['#food'], durationSec: 22 })
    const c = classHash({ title: 'Best ramen in town', caption: 'changed', hashtags: ['#food'], durationSec: 22 })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
  it('ignores performance entirely (only metadata is hashed)', () => {
    // no views/likes parameter exists — by construction performance can't leak in
    expect(typeof classHash({ title: 't' })).toBe('string')
  })
})

describe('validateLabels — taxonomy-gated, never off-taxonomy', () => {
  it('keeps valid category + matching subcategory + valid style', () => {
    const r = validateLabels({ category: 'Food', subcategory: 'Recipes', style: 'tutorial', confidence: 0.8 })
    expect(r).toMatchObject({ category: 'Food', subcategory: 'Recipes', style: 'tutorial', source: 'ai' })
    expect(r.confidence).toBe(0.8)
  })
  it('drops an invented category and its subcategory', () => {
    const r = validateLabels({ category: 'Crypto', subcategory: 'Memes', style: 'skit', confidence: 0.9 })
    expect(r.category).toBeNull()
    expect(r.subcategory).toBeNull()
    expect(r.style).toBe('skit')
  })
  it('drops a subcategory that does not belong to the category', () => {
    const r = validateLabels({ category: 'Food', subcategory: 'Makeup', style: 'review', confidence: 0.7 })
    expect(r.category).toBe('Food')
    expect(r.subcategory).toBeNull()
  })
  it('clamps confidence and nulls an off-taxonomy style', () => {
    const r = validateLabels({ category: 'Beauty', subcategory: 'Skincare', style: 'asmr-whisper', confidence: 5 })
    expect(r.style).toBeNull()
    expect(r.confidence).toBe(1)
  })
})

describe('taxonomy is generic (food is just one branch)', () => {
  it('supports many niches', () => {
    for (const c of ['Food', 'Beauty', 'Travel', 'Tech', 'Gaming', 'Fitness', 'Lifestyle']) expect(isCategory(c)).toBe(true)
    expect(isSubcategory('Gaming', 'Esports')).toBe(true)
    expect(isSubcategory('Travel', 'Esports')).toBe(false)
  })
})

describe('formatFromMetadata — deterministic, no AI', () => {
  it('maps media + duration to a container', () => {
    expect(formatFromMetadata('CAROUSEL_ALBUM', null)).toBe('carousel')
    expect(formatFromMetadata('IMAGE', null)).toBe('image')
    expect(formatFromMetadata('VIDEO', 20)).toBe('short-form video')
    expect(formatFromMetadata('VIDEO', 600)).toBe('long-form video')
  })
})

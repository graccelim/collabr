import { describe, it, expect } from 'vitest'
import { normalizeUrl, matchPostToCollab } from '@/lib/analytics/match'

describe('normalizeUrl', () => {
  it('strips protocol, www, trailing slash, and tracking params', () => {
    expect(normalizeUrl('https://www.tiktok.com/@a/video/123/?utm_source=ig&igshid=x'))
      .toBe('tiktok.com/@a/video/123')
    expect(normalizeUrl('http://m.instagram.com/reel/ABC/')).toBe('instagram.com/reel/abc')
  })
  it('keeps significant query params (YouTube ?v=)', () => {
    const a = normalizeUrl('https://youtube.com/watch?v=abc&feature=share')
    const b = normalizeUrl('https://www.youtube.com/watch?v=abc')
    expect(a).toBe('youtube.com/watch?v=abc')
    expect(a).toBe(b)
    expect(normalizeUrl('https://youtube.com/watch?v=DIFFERENT')).not.toBe(a)
  })
  it('rejects non-http(s) and garbage', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('not a url')).toBeNull()
    expect(normalizeUrl(null)).toBeNull()
  })
})

describe('matchPostToCollab', () => {
  const collabs = [
    { collabId: 'c1', url: 'https://www.tiktok.com/@a/video/111' },
    { collabId: 'c2', url: 'https://youtube.com/watch?v=zzz' },
  ]
  it('links on an exact normalized match', () => {
    expect(matchPostToCollab('https://tiktok.com/@a/video/111/?utm_source=x', collabs)).toBe('c1')
    expect(matchPostToCollab('https://www.youtube.com/watch?v=zzz&si=abc', collabs)).toBe('c2')
  })
  it('returns null when there is no match (left unlinked, retried later)', () => {
    expect(matchPostToCollab('https://tiktok.com/@a/video/999', collabs)).toBeNull()
  })
  it('returns null when two distinct collabs share the same URL (never guess)', () => {
    const ambiguous = [
      { collabId: 'c1', url: 'https://tiktok.com/@a/video/111' },
      { collabId: 'c2', url: 'https://www.tiktok.com/@a/video/111/' },
    ]
    expect(matchPostToCollab('https://tiktok.com/@a/video/111', ambiguous)).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { makeSupabaseStub } from './helpers/supabase-stub'
import { runCreatorDiscovery, DISCOVERY_PAGE_SIZE } from '@/lib/creator-discovery'

function baseRow(overrides: Record<string, unknown>) {
  return {
    id: 'x', slug: 'x', user_id: null, display_name: null, bio: null,
    niche: null, niches: null, niche_tags: [], location: null,
    average_rate_sgd: null, availability_status: null, base_rate: null,
    onboarding_completed_at: null, certified: false, connected: false,
    insights_last_synced_at: null, boost_active_until: null,
    rating_avg: null, rating_count: null, collabs_completed: 0,
    created_at: '2026-01-01T00:00:00Z', users: null,
    ...overrides,
  }
}

describe('runCreatorDiscovery - free-text search (q)', () => {
  const creators = [
    baseRow({ id: 'a', niche: 'food', niche_tags: ['food'], users: { display_name: 'Alex Baker', avatar_url: null } }),
    baseRow({ id: 'b', display_name: 'Bella Foodie', niche: 'other', users: null }),
    baseRow({ id: 'c', niche: 'tech', users: { display_name: 'Zack Tech', avatar_url: null } }),
  ]

  it('matches by claimed (users.display_name) name, case-insensitive', async () => {
    const { client } = makeSupabaseStub({
      tables: { creator_profiles: [{ data: creators, count: 3 }], social_accounts: [{ data: [] }], creator_scores: [{ data: [] }] },
    })
    const result = await runCreatorDiscovery(client as any, client as any, { q: 'ZACK' }, null)
    expect(result.pageCreators.map(c => c.id)).toEqual(['c'])
  })

  it('matches by pre-claim display_name for an unclaimed profile', async () => {
    const { client } = makeSupabaseStub({
      tables: { creator_profiles: [{ data: creators, count: 3 }], social_accounts: [{ data: [] }], creator_scores: [{ data: [] }] },
    })
    const result = await runCreatorDiscovery(client as any, client as any, { q: 'foodie' }, null)
    expect(result.pageCreators.map(c => c.id)).toEqual(['b'])
  })

  it('matches by niche label', async () => {
    const { client } = makeSupabaseStub({
      tables: { creator_profiles: [{ data: creators, count: 3 }], social_accounts: [{ data: [] }], creator_scores: [{ data: [] }] },
    })
    const result = await runCreatorDiscovery(client as any, client as any, { q: 'food' }, null)
    // 'food' matches both a's niche label and b's name ("Foodie")
    expect(result.pageCreators.map(c => c.id).sort()).toEqual(['a', 'b'])
  })

  it('matches by social handle', async () => {
    const { client } = makeSupabaseStub({
      tables: {
        creator_profiles: [{ data: creators, count: 3 }],
        social_accounts: [{ data: [{ id: 's1', creator_id: 'c', platform: 'instagram', handle: 'zacktechreviews', follower_count: 0, is_primary: true }] }],
        creator_scores: [{ data: [] }],
      },
    })
    const result = await runCreatorDiscovery(client as any, client as any, { q: 'techreviews' }, null)
    expect(result.pageCreators.map(c => c.id)).toEqual(['c'])
  })

  it('no matches → empty result, not an error', async () => {
    const { client } = makeSupabaseStub({
      tables: { creator_profiles: [{ data: creators, count: 3 }], social_accounts: [{ data: [] }], creator_scores: [{ data: [] }] },
    })
    const result = await runCreatorDiscovery(client as any, client as any, { q: 'nonexistent' }, null)
    expect(result.pageCreators).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('empty/whitespace q returns everything (no filtering)', async () => {
    const { client } = makeSupabaseStub({
      tables: { creator_profiles: [{ data: creators, count: 3 }], social_accounts: [{ data: [] }], creator_scores: [{ data: [] }] },
    })
    const result = await runCreatorDiscovery(client as any, client as any, { q: '   ' }, null)
    expect(result.total).toBe(3)
  })
})

describe('runCreatorDiscovery - pagination', () => {
  it('paginates the ranked/filtered pool at DISCOVERY_PAGE_SIZE', async () => {
    const many = Array.from({ length: DISCOVERY_PAGE_SIZE + 5 }, (_, i) =>
      baseRow({ id: `c${i}`, users: { display_name: `Creator ${i}`, avatar_url: null } }))
    const { client } = makeSupabaseStub({
      tables: { creator_profiles: [{ data: many, count: many.length }], social_accounts: [{ data: [] }], creator_scores: [{ data: [] }] },
    })
    const page1 = await runCreatorDiscovery(client as any, client as any, {}, null)
    expect(page1.pageCreators).toHaveLength(DISCOVERY_PAGE_SIZE)
    expect(page1.totalPages).toBe(2)
    expect(page1.total).toBe(many.length)
  })

  it('brandId = null never queries saved_creators (public browse has nothing to save to)', async () => {
    const { client, calls } = makeSupabaseStub({
      tables: { creator_profiles: [{ data: [], count: 0 }] },
    })
    await runCreatorDiscovery(client as any, client as any, {}, null)
    expect(calls.writes.some(w => w.table === 'saved_creators')).toBe(false)
  })
})

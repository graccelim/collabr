import { describe, it, expect, vi } from 'vitest'
import { makeSupabaseStub, verifiedUser, jsonRequest, type StubConfig } from './helpers/supabase-stub'

let active: ReturnType<typeof makeSupabaseStub>
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => active.client,
  createAdminClient: () => active.client,
}))

async function post(body: unknown, config: StubConfig) {
  active = makeSupabaseStub(config)
  const { POST } = await import('@/app/api/collabs/[id]/results/route')
  return POST(jsonRequest('POST', body), { params: { id: 'co-1' } })
}

const collab = (overrides: Record<string, unknown> = {}) => ({
  id: 'co-1', status: 'completed', creator_id: 'cp-1', brand_id: 'bp-1', campaign_id: 'ca-1',
  creator_profiles: { user_id: 'creator-user', users: { display_name: 'Sara' } },
  brand_profiles: { user_id: 'brand-user', users: { email: undefined } }, // undefined → skip brand email
  campaigns: { title: 'Summer Launch' },
  ...overrides,
})

describe('POST /api/collabs/[id]/results', () => {
  it('401 when not signed in', async () => {
    const res = await post({ views: 100 }, { user: null })
    expect(res.status).toBe(401)
  })

  it('404 when the collab is missing', async () => {
    const res = await post({ views: 100 }, { user: verifiedUser('creator-user'), tables: { collabs: [{ data: null }] } })
    expect(res.status).toBe(404)
  })

  it('403 when the viewer is not the collab creator', async () => {
    const res = await post({ views: 100 }, { user: verifiedUser('brand-user'), tables: { collabs: [{ data: collab() }] } })
    expect(res.status).toBe(403)
  })

  it('400 when the content is not live yet', async () => {
    const res = await post({ views: 100 }, { user: verifiedUser('creator-user'), tables: { collabs: [{ data: collab({ status: 'briefed' }) }] } })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/live/i)
  })

  it('400 when no metric is provided', async () => {
    const res = await post({}, { user: verifiedUser('creator-user'), tables: { collabs: [{ data: collab() }] } })
    expect(res.status).toBe(400)
    // never reaches a write
    expect(active.calls.writes.some((w) => w.table === 'collab_results')).toBe(false)
  })

  it('upserts the results and reuses the live-post link (200)', async () => {
    const res = await post({ views: 24500, likes: 1820 }, {
      user: verifiedUser('creator-user'),
      tables: {
        collabs: [{ data: collab() }],
        live_posts: [{ data: { post_url: 'https://www.tiktok.com/@sara/video/1' } }],
        collab_results: [{ error: null }],
      },
    })
    expect(res.status).toBe(200)
    const write = active.calls.writes.find((w) => w.table === 'collab_results' && w.op === 'upsert')
    expect(write).toBeTruthy()
    const p = write!.payload as Record<string, unknown>
    expect(p.collab_id).toBe('co-1')
    expect(p.creator_id).toBe('cp-1')
    expect(p.views).toBe(24500)
    expect(p.likes).toBe(1820)
    expect(p.comments).toBeNull()
    // the link is pulled from live_posts, not the request body
    expect(p.post_url).toBe('https://www.tiktok.com/@sara/video/1')
  })
})

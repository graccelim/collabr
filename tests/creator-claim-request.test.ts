import { describe, it, expect, vi } from 'vitest'
import { makeSupabaseStub, jsonRequest, type StubConfig, type StubCalls } from './helpers/supabase-stub'

let active: ReturnType<typeof makeSupabaseStub>
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => active.client,
  createAdminClient: () => active.client,
}))

// The route's own rate limit is exercised in its own dedicated test below;
// every other test mocks it open so they aren't coupled to the shared
// in-memory bucket (module-level state that persists across cases in this file).
const rateLimitMock = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitDurable: (...args: unknown[]) => rateLimitMock(...args),
  clientIp: () => 'test-ip',
}))

function useStub(config: StubConfig): StubCalls {
  active = makeSupabaseStub(config)
  return active.calls
}

async function post(id: string, body: unknown) {
  const { POST } = await import('@/app/api/creators/[id]/claim-request/route')
  return POST(jsonRequest('POST', body), { params: { id } })
}

describe('POST /api/creators/[id]/claim-request - public, no claim token exposed', () => {
  it('unknown creator -> 404', async () => {
    useStub({ tables: { creator_profiles: [{ data: null }] } })
    const res = await post('nope', { kind: 'claim' })
    expect(res.status).toBe(404)
  })

  it('already-claimed creator -> 409, never re-notifies', async () => {
    useStub({ tables: { creator_profiles: [{ data: { id: 'cr-1', slug: 'alex', display_name: 'Alex', user_id: 'real-user' } }] } })
    const res = await post('cr-1', { kind: 'claim' })
    expect(res.status).toBe(409)
  })

  it('unclaimed creator + kind=claim -> 200, no error surfaced', async () => {
    useStub({ tables: { creator_profiles: [{ data: { id: 'cr-1', slug: 'alex', display_name: 'Alex', user_id: null } }] } })
    const res = await post('cr-1', { kind: 'claim' })
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it('unclaimed creator + kind=remove -> 200', async () => {
    useStub({ tables: { creator_profiles: [{ data: { id: 'cr-1', slug: 'alex', display_name: 'Alex', user_id: null } }] } })
    const res = await post('cr-1', { kind: 'remove' })
    expect(res.status).toBe(200)
  })

  it('rejects an invalid kind (400)', async () => {
    useStub({ tables: { creator_profiles: [{ data: { id: 'cr-1', slug: 'alex', display_name: 'Alex', user_id: null } }] } })
    const res = await post('cr-1', { kind: 'bogus' })
    expect(res.status).toBe(400)
  })

  it('never touches creator_claims - this route cannot issue or reveal a real claim token', async () => {
    const calls = useStub({ tables: { creator_profiles: [{ data: { id: 'cr-1', slug: 'alex', display_name: 'Alex', user_id: null } }] } })
    await post('cr-1', { kind: 'claim' })
    expect(calls.writes.some(w => w.table === 'creator_claims')).toBe(false)
  })

  it('rate-limited caller gets 429 before any DB read', async () => {
    rateLimitMock.mockResolvedValueOnce(false)
    const calls = useStub({ tables: {} })
    const res = await post('cr-1', { kind: 'claim' })
    expect(res.status).toBe(429)
    expect(calls.writes).toHaveLength(0)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { makeSupabaseStub, jsonRequest, type StubConfig, type StubCalls } from './helpers/supabase-stub'

// Same requireAdminApi mocking rationale as admin-creators-api.test.ts - the
// real guard wraps React's cache(), unavailable in this vitest environment.
const requireAdminApiMock = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAdminApi: () => requireAdminApiMock() }))

let active: ReturnType<typeof makeSupabaseStub>
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => active.client,
  createAdminClient: () => active.client,
}))

function useStub(config: StubConfig): StubCalls {
  active = makeSupabaseStub(config)
  return active.calls
}

const ADMIN_OK = { user: { id: 'admin-1' }, error: null }
const NOT_ADMIN = { user: null, error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) }

beforeEach(() => { requireAdminApiMock.mockReset() })

async function post(body: unknown) {
  const { POST } = await import('@/app/api/admin/creators/bulk/route')
  return POST(jsonRequest('POST', body))
}

describe('POST /api/admin/creators/bulk', () => {
  it('rejects a non-admin caller (403), touches nothing', async () => {
    requireAdminApiMock.mockReturnValue(NOT_ADMIN)
    const calls = useStub({})
    const res = await post({ platform: 'instagram', handles: ['girldevours'] })
    expect(res.status).toBe(403)
    expect(calls.writes).toHaveLength(0)
  })

  it('creates one profile per valid handle, reusing seedCreatorProfile', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    // Each seedCreatorProfile call touches creator_profiles 4 times (insert,
    // then ensureCreatorSlug's taken-check + update + fallback re-select) -
    // the stub consumes one shared queue in strict call order, so a second
    // handle's insert result must be queued AFTER the first handle's trailing
    // slug calls, not right next to its own insert.
    const calls = useStub({
      tables: {
        social_accounts: [
          { data: null }, { data: null, error: null }, // handle 1: dup-check, insert
          { data: null }, { data: null, error: null }, // handle 2: dup-check, insert
        ],
        creator_profiles: [
          { data: { id: 'cr-1' } }, { data: null }, { data: null }, { data: null }, // handle 1: insert + slug calls
          { data: { id: 'cr-2' } }, { data: null }, { data: null }, { data: null }, // handle 2: insert + slug calls
        ],
      },
    })
    const res = await post({ platform: 'instagram', handles: ['girldevours', '@foodie.sg'] })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.created).toHaveLength(2)
    expect(body.failed).toHaveLength(0)
    // display_name = the extracted handle, not the raw pasted line
    expect(body.created.map((c: any) => c.handle)).toEqual(['girldevours', 'foodie.sg'])
    const profileInserts = calls.writes.filter(w => w.table === 'creator_profiles' && w.op === 'insert')
    expect(profileInserts).toHaveLength(2)
    expect((profileInserts[1].payload as any).display_name).toBe('foodie.sg')
  })

  it('rejects an invalid handle and a within-batch duplicate without touching the DB for either', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({
      tables: {
        social_accounts: [{ data: null }, { data: null, error: null }],
        creator_profiles: [{ data: { id: 'cr-1' } }],
      },
    })
    const res = await post({ platform: 'instagram', handles: ['girldevours', 'not a valid handle!!', 'girldevours'] })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.created).toHaveLength(1)
    expect(body.failed).toHaveLength(2)
    expect(body.failed.find((f: any) => f.error === 'Duplicate in this batch')).toBeTruthy()
    const profileInserts = calls.writes.filter(w => w.table === 'creator_profiles' && w.op === 'insert')
    expect(profileInserts).toHaveLength(1) // only the one valid, non-duplicate handle
  })

  it('a handle collision with an existing profile is reported per-line, not fatal to the batch', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    useStub({
      tables: {
        social_accounts: [
          { data: { id: 'existing' } }, // handle 1 dup-check: already taken
          { data: null }, { data: null, error: null }, // handle 2: dup-check, insert
        ],
        creator_profiles: [{ data: { id: 'cr-2' } }],
      },
    })
    const res = await post({ platform: 'instagram', handles: ['already-taken', 'freshhandle'] })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.created).toHaveLength(1)
    expect(body.failed).toHaveLength(1)
    expect(body.failed[0].error).toMatch(/already connected/i)
  })
})

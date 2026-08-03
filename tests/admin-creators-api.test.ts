import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { makeSupabaseStub, jsonRequest, type StubConfig, type StubCalls } from './helpers/supabase-stub'

// lib/auth's requireAdmin/requireAdminApi wrap React's cache(), which isn't
// available in this vitest environment (Next patches its own React build for
// that at build/runtime, not the plain node_modules copy vitest resolves) -
// the same reason no existing test exercises requireAdminApi directly. Mock
// it at the module boundary so these tests cover what they're actually meant
// to: the ROUTE's behavior for an admin vs. a rejected caller, not the guard's
// own internals.
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
const UNAUTHED = { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

beforeEach(() => { requireAdminApiMock.mockReset() })

const VALID_SOCIAL = { platform: 'instagram', handle: 'alexcooks', follower_count: 12000 }

describe('POST /api/admin/creators', () => {
  it('rejects a logged-out caller (401)', async () => {
    requireAdminApiMock.mockReturnValue(UNAUTHED)
    useStub({})
    const { POST } = await import('@/app/api/admin/creators/route')
    const res = await POST(jsonRequest('POST', { display_name: 'Alex', socials: [VALID_SOCIAL] }))
    expect(res.status).toBe(401)
  })

  it('rejects a non-admin caller (403)', async () => {
    requireAdminApiMock.mockReturnValue(NOT_ADMIN)
    useStub({})
    const { POST } = await import('@/app/api/admin/creators/route')
    const res = await POST(jsonRequest('POST', { display_name: 'Alex', socials: [VALID_SOCIAL] }))
    expect(res.status).toBe(403)
  })

  it('admin: creates the profile and writes real social_accounts rows', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({
      tables: {
        social_accounts: [{ data: null }, { data: null, error: null }], // dup-check, then insert
        creator_profiles: [{ data: { id: 'cr-new' } }],                 // profile insert
      },
    })
    const { POST } = await import('@/app/api/admin/creators/route')
    const res = await POST(jsonRequest('POST', { display_name: 'Alex Tan', socials: [VALID_SOCIAL] }))
    expect(res.status).toBe(201)

    const profileInsert = calls.writes.find(w => w.table === 'creator_profiles' && w.op === 'insert')
    expect(profileInsert).toBeTruthy()
    const payload = profileInsert!.payload as Record<string, unknown>
    expect(payload.user_id).toBeNull()
    expect(payload.created_by_admin).toBe(true)
    expect(payload.display_name).toBe('Alex Tan')

    expect(calls.writes.some(w => w.table === 'social_accounts' && w.op === 'insert')).toBe(true)
  })

  it('rejects a display_name under 2 chars (400, never reaches the DB)', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({ tables: {} })
    const { POST } = await import('@/app/api/admin/creators/route')
    const res = await POST(jsonRequest('POST', { display_name: 'A', socials: [VALID_SOCIAL] }))
    expect(res.status).toBe(400)
    expect(calls.writes).toHaveLength(0)
  })

  it('rejects a handle already connected to another profile (409)', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    useStub({ tables: { social_accounts: [{ data: { id: 'existing-row' } }] } })
    const { POST } = await import('@/app/api/admin/creators/route')
    const res = await POST(jsonRequest('POST', { display_name: 'Alex Tan', socials: [VALID_SOCIAL] }))
    expect(res.status).toBe(409)
  })
})

describe('DELETE/PUT /api/admin/creators/[id] - archive, never delete', () => {
  it('DELETE archives (sets archived_at), does not remove the row', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({ tables: { creator_profiles: [{ data: { id: 'cr-1' } }, { data: null }] } })
    const { DELETE } = await import('@/app/api/admin/creators/[id]/route')
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: 'cr-1' } })
    expect(res.status).toBe(200)

    expect(calls.writes.some(w => w.table === 'creator_profiles' && w.op === 'delete')).toBe(false)
    const update = calls.writes.find(w => w.table === 'creator_profiles' && w.op === 'update')
    expect((update?.payload as any).archived_at).toBeTruthy()
  })

  it('DELETE on a non-admin caller is rejected before any write', async () => {
    requireAdminApiMock.mockReturnValue(NOT_ADMIN)
    const calls = useStub({})
    const { DELETE } = await import('@/app/api/admin/creators/[id]/route')
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: 'cr-1' } })
    expect(res.status).toBe(403)
    expect(calls.writes).toHaveLength(0)
  })

  it('PUT unarchives (clears archived_at)', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({ tables: { creator_profiles: [{ data: null }] } })
    const { PUT } = await import('@/app/api/admin/creators/[id]/route')
    const res = await PUT(jsonRequest('PUT'), { params: { id: 'cr-1' } })
    expect(res.status).toBe(200)
    const update = calls.writes.find(w => w.table === 'creator_profiles' && w.op === 'update')
    expect((update?.payload as any).archived_at).toBeNull()
  })
})

describe('PATCH /api/admin/creators/[id] - display_name is pre-claim only', () => {
  it('claimed creator (user_id set): display_name in the body is silently ignored', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({ tables: { creator_profiles: [{ data: { id: 'cr-1', user_id: 'real-user' } }] } })
    const { PATCH } = await import('@/app/api/admin/creators/[id]/route')
    const res = await PATCH(jsonRequest('PATCH', { display_name: 'New Name' }), { params: { id: 'cr-1' } })
    expect(res.status).toBe(200)
    const update = calls.writes.find(w => w.table === 'creator_profiles' && w.op === 'update')
    expect(update).toBeUndefined() // no fields changed -> no update call at all
  })

  it('unclaimed creator (user_id null): display_name updates normally', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({ tables: { creator_profiles: [{ data: { id: 'cr-1', user_id: null } }, { data: null }] } })
    const { PATCH } = await import('@/app/api/admin/creators/[id]/route')
    const res = await PATCH(jsonRequest('PATCH', { display_name: 'New Name' }), { params: { id: 'cr-1' } })
    expect(res.status).toBe(200)
    const update = calls.writes.find(w => w.table === 'creator_profiles' && w.op === 'update')
    expect((update?.payload as any).display_name).toBe('New Name')
  })
})

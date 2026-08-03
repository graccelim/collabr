import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { makeSupabaseStub, jsonRequest, type StubConfig, type StubCalls } from './helpers/supabase-stub'

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

async function patch(body: unknown) {
  const { PATCH } = await import('@/app/api/admin/pending-requests/[id]/route')
  return PATCH(jsonRequest('PATCH', body), { params: { id: 'req-1' } })
}

describe('PATCH /api/admin/pending-requests/[id] - admin-only outreach status', () => {
  it('rejects a non-admin caller (403), no write', async () => {
    requireAdminApiMock.mockReturnValue(NOT_ADMIN)
    const calls = useStub({})
    const res = await patch({ status: 'contacted' })
    expect(res.status).toBe(403)
    expect(calls.writes).toHaveLength(0)
  })

  it('admin: updates status to one of the four operational values', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({ tables: { pending_collab_requests: [{ data: null, error: null }] } })
    const res = await patch({ status: 'interested' })
    expect(res.status).toBe(200)
    const update = calls.writes.find(w => w.table === 'pending_collab_requests' && w.op === 'update')
    expect((update?.payload as any).status).toBe('interested')
  })

  it('rejects "claimed" and "expired" - those are derived, not admin-settable', async () => {
    requireAdminApiMock.mockReturnValue(ADMIN_OK)
    const calls = useStub({})
    const claimedRes = await patch({ status: 'claimed' })
    expect(claimedRes.status).toBe(400)
    const expiredRes = await patch({ status: 'expired' })
    expect(expiredRes.status).toBe(400)
    expect(calls.writes).toHaveLength(0)
  })
})

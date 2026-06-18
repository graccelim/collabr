import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub Stripe-backed payment settlement so no network/Stripe is touched.
// vi.hoisted: the factory is hoisted above imports, so the mock fn must be too.
const { cancelOrRefundPayment } = vi.hoisted(() => ({
  cancelOrRefundPayment: vi.fn(async () => ({ ok: true, paymentStatus: 'cancelled' })),
}))
vi.mock('@/lib/payments', () => ({ cancelOrRefundPayment }))

// Route the supabase factory to a per-test stub.
import { makeSupabaseStub, verifiedUser, jsonRequest, type StubConfig } from './helpers/supabase-stub'
let active: ReturnType<typeof makeSupabaseStub>
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => active.client,
  createAdminClient: () => active.client,
}))
function useStub(config: StubConfig) {
  active = makeSupabaseStub(config)
  return active.calls
}

import { canReleaseUnfunded } from '@/lib/collab-status'
import { releaseUnfundedCollab } from '@/lib/collab-funding'

beforeEach(() => { cancelOrRefundPayment.mockClear() })

const briefedUnfunded = { status: 'briefed', payment_status: 'unfunded', stripe_transfer_id: null }
const briefedAuthorizing = { status: 'briefed', payment_status: 'authorizing', stripe_transfer_id: null }
const funded = { status: 'briefed', payment_status: 'funded', stripe_transfer_id: null }
const paid = { status: 'completed', payment_status: 'paid', stripe_transfer_id: 'tr_1' }

describe('canReleaseUnfunded — the undo/expiry guard', () => {
  it('allows release before funding (unfunded / authorizing)', () => {
    expect(canReleaseUnfunded(briefedUnfunded)).toBe(true)
    expect(canReleaseUnfunded(briefedAuthorizing)).toBe(true)
  })
  it('blocks release once funded or paid, or if a transfer exists', () => {
    expect(canReleaseUnfunded(funded)).toBe(false)
    expect(canReleaseUnfunded(paid)).toBe(false)
    expect(canReleaseUnfunded({ ...briefedUnfunded, stripe_transfer_id: 'tr_x' })).toBe(false)
    expect(canReleaseUnfunded({ status: 'draft_submitted', payment_status: 'funded' })).toBe(false)
  })
})

// A tiny admin stub that records update() payloads per table.
function recordingAdmin() {
  const writes: { table: string; payload: unknown }[] = []
  const chain = (table: string): any => ({
    update(payload: unknown) { writes.push({ table, payload }); return chain(table) },
    eq() { return chain(table) },
    in() { return chain(table) },
    then(res: (r: unknown) => unknown) { return res({ data: null, error: null }) },
  })
  return { writes, client: { from: (t: string) => chain(t) } as any }
}

describe('releaseUnfundedCollab — cancel collab + return applicant to pending', () => {
  it('cancels the collab and reverts the application (no creator notification)', async () => {
    const admin = recordingAdmin()
    const res = await releaseUnfundedCollab(admin.client, {
      id: 'co-1', application_id: 'app-1', ...briefedUnfunded,
    })
    expect(res.ok).toBe(true)
    expect(cancelOrRefundPayment).toHaveBeenCalledOnce()
    expect(admin.writes).toContainEqual({ table: 'collabs', payload: { status: 'cancelled' } })
    expect(admin.writes).toContainEqual({ table: 'applications', payload: { status: 'pending' } })
  })

  it('is a no-op once funded (idempotency / after-funding block)', async () => {
    const admin = recordingAdmin()
    const res = await releaseUnfundedCollab(admin.client, {
      id: 'co-1', application_id: 'app-1', ...funded,
    })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('not_unfunded')
    expect(cancelOrRefundPayment).not.toHaveBeenCalled()
    expect(admin.writes).toHaveLength(0)
  })
})

describe('POST /api/collabs/[id]/unselect', () => {
  async function post(id = 'co-1') {
    const { POST } = await import('@/app/api/collabs/[id]/unselect/route')
    return POST(jsonRequest('POST'), { params: { id } })
  }
  const ownedUnfunded = (over = {}) => ({
    data: { id: 'co-1', application_id: 'app-1', status: 'briefed', payment_status: 'unfunded',
      stripe_payment_intent_id: null, stripe_transfer_id: null, brand_profiles: { user_id: 'brand-u' }, ...over },
  })

  it('blocks unauthenticated (401)', async () => {
    useStub({ user: null })
    expect((await post()).status).toBe(401)
  })

  it('blocks a non-owner brand (403)', async () => {
    useStub({ user: verifiedUser('someone-else'), tables: { collabs: [ownedUnfunded()] } })
    expect((await post()).status).toBe(403)
  })

  it('undoes a selection before funding (200) and reverts the application', async () => {
    const calls = useStub({ user: verifiedUser('brand-u'), tables: { collabs: [ownedUnfunded()] } })
    const res = await post()
    expect(res.status).toBe(200)
    expect(calls.writes).toContainEqual({ table: 'collabs', op: 'update', payload: { status: 'cancelled' } })
    expect(calls.writes).toContainEqual({ table: 'applications', op: 'update', payload: { status: 'pending' } })
  })

  it('refuses once funded (409) — undo is gone after payment', async () => {
    useStub({ user: verifiedUser('brand-u'), tables: { collabs: [ownedUnfunded({ payment_status: 'funded' })] } })
    const res = await post()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/funded|support/i)
  })
})

describe('GET /api/cron/expire-funding', () => {
  const SECRET = 'test-cron-secret'
  function cronReq(secret = SECRET) {
    return new Request('http://test.local/api/cron/expire-funding', {
      headers: { authorization: `Bearer ${secret}` },
    }) as never
  }
  async function run(req: Request) {
    const { GET } = await import('@/app/api/cron/expire-funding/route')
    return GET(req as never)
  }

  beforeEach(() => { process.env.CRON_SECRET = SECRET })

  it('rejects a bad secret (401)', async () => {
    useStub({ user: null })
    expect((await run(cronReq('wrong'))).status).toBe(401)
  })

  it('expires a stale unfunded collab and reports the count', async () => {
    const calls = useStub({
      user: null,
      tables: {
        collabs: [{ data: [
          { id: 'co-1', application_id: 'app-1', status: 'briefed', payment_status: 'unfunded', stripe_payment_intent_id: null, stripe_transfer_id: null },
        ] }],
      },
    })
    const res = await run(cronReq())
    expect(res.status).toBe(200)
    expect((await res.json()).expired).toBe(1)
    expect(calls.writes).toContainEqual({ table: 'applications', op: 'update', payload: { status: 'pending' } })
  })

  it('does nothing when there are no stale collabs (idempotent re-run)', async () => {
    useStub({ user: null, tables: { collabs: [{ data: [] }] } })
    const res = await run(cronReq())
    expect((await res.json()).expired).toBe(0)
  })
})

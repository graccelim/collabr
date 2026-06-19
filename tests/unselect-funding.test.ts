import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub Stripe + the payments module so no network is touched. releaseUnfundedCollab
// now claims the undo atomically via the claim_unselect_atomic RPC, then best-effort
// cancels the Stripe authorization hold.
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { retrieve: vi.fn(async () => ({ status: 'requires_capture' })), cancel: vi.fn(async () => ({})) } },
}))
vi.mock('@/lib/payments', () => ({ captureTransferAndComplete: vi.fn() }))

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

const briefedUnfunded = { status: 'briefed', payment_status: 'unfunded', stripe_transfer_id: null }
const briefedAuthorizing = { status: 'briefed', payment_status: 'authorizing', stripe_transfer_id: null }
const funded = { status: 'briefed', payment_status: 'funded', stripe_transfer_id: null }
const paid = { status: 'completed', payment_status: 'paid', stripe_transfer_id: 'tr_1' }

describe('canReleaseUnfunded — the undo/expiry guard (still used for display)', () => {
  it('allows release before funding (unfunded / authorizing)', () => {
    expect(canReleaseUnfunded(briefedUnfunded)).toBe(true)
    expect(canReleaseUnfunded(briefedAuthorizing)).toBe(true)
  })
  it('blocks release once funded or paid, or if a transfer exists', () => {
    expect(canReleaseUnfunded(funded)).toBe(false)
    expect(canReleaseUnfunded(paid)).toBe(false)
    expect(canReleaseUnfunded({ ...briefedUnfunded, stripe_transfer_id: 'tr_x' })).toBe(false)
  })
})

describe('releaseUnfundedCollab — race-safe via claim_unselect_atomic RPC', () => {
  const collab = { id: 'co-1', application_id: 'app-1', status: '', payment_status: '' }

  it('succeeds when the RPC claims the undo (result=cancelled)', async () => {
    const calls = useStub({ user: null, rpcs: { claim_unselect_atomic: { data: { result: 'cancelled', intent_id: null, application_id: 'app-1' }, error: null } } })
    const res = await releaseUnfundedCollab(active.client, collab, 'brand-u')
    expect(res.ok).toBe(true)
    // The cancellation + applicant revert happen INSIDE the locked RPC.
    expect(calls.rpc).toContainEqual({ name: 'claim_unselect_atomic', args: { p_collab_id: 'co-1', p_brand_user_id: 'brand-u' } })
  })

  it('refuses once funded (RPC observed funding under the lock)', async () => {
    useStub({ user: null, rpcs: { claim_unselect_atomic: { data: { result: 'funded', intent_id: null, application_id: null }, error: null } } })
    const res = await releaseUnfundedCollab(active.client, collab, 'brand-u')
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('not_unfunded')
  })

  it('maps a forbidden RPC result', async () => {
    useStub({ user: null, rpcs: { claim_unselect_atomic: { data: { result: 'forbidden' }, error: null } } })
    const res = await releaseUnfundedCollab(active.client, collab, 'intruder')
    expect(res).toEqual({ ok: false, reason: 'forbidden' })
  })

  it('is idempotent (already-cancelled → ok)', async () => {
    useStub({ user: null, rpcs: { claim_unselect_atomic: { data: { result: 'already', intent_id: null, application_id: 'app-1' }, error: null } } })
    const res = await releaseUnfundedCollab(active.client, collab, null)
    expect(res.ok).toBe(true)
  })
})

describe('POST /api/collabs/[id]/unselect', () => {
  async function post(id = 'co-1') {
    const { POST } = await import('@/app/api/collabs/[id]/unselect/route')
    return POST(jsonRequest('POST'), { params: { id } })
  }

  it('blocks unauthenticated (401)', async () => {
    useStub({ user: null })
    expect((await post()).status).toBe(401)
  })

  it('blocks a non-owner brand (403)', async () => {
    useStub({ user: verifiedUser('someone-else'), rpcs: { claim_unselect_atomic: { data: { result: 'forbidden' }, error: null } } })
    expect((await post()).status).toBe(403)
  })

  it('undoes a selection before funding (200)', async () => {
    useStub({ user: verifiedUser('brand-u'), rpcs: { claim_unselect_atomic: { data: { result: 'cancelled', intent_id: null, application_id: 'app-1' }, error: null } } })
    expect((await post()).status).toBe(200)
  })

  it('refuses once funded (409) — undo is gone after payment', async () => {
    useStub({ user: verifiedUser('brand-u'), rpcs: { claim_unselect_atomic: { data: { result: 'funded' }, error: null } } })
    const res = await post()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/funded|support/i)
  })
})

describe('GET /api/cron/expire-funding', () => {
  const SECRET = 'test-cron-secret'
  function cronReq(secret = SECRET) {
    return new Request('http://test.local/api/cron/expire-funding', { headers: { authorization: `Bearer ${secret}` } }) as never
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
    useStub({
      user: null,
      tables: {
        collabs: [{ data: [
          { id: 'co-1', application_id: 'app-1', status: 'briefed', payment_status: 'unfunded', stripe_payment_intent_id: null, stripe_transfer_id: null },
        ] }],
      },
      rpcs: { claim_unselect_atomic: { data: { result: 'cancelled', intent_id: null, application_id: 'app-1' }, error: null } },
    })
    const res = await run(cronReq())
    expect(res.status).toBe(200)
    expect((await res.json()).expired).toBe(1)
  })

  it('does nothing when there are no stale collabs (idempotent re-run)', async () => {
    useStub({ user: null, tables: { collabs: [{ data: [] }] } })
    const res = await run(cronReq())
    expect((await res.json()).expired).toBe(0)
  })
})

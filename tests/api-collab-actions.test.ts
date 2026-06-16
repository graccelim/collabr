import { describe, it, expect, vi } from 'vitest'
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

// ─── 8: drafts are blocked before escrow is funded ──────────────────────────
describe('POST /api/collabs/[id]/submit-draft - funding gate', () => {
  async function post(config: StubConfig) {
    useStub(config)
    const { POST } = await import('@/app/api/collabs/[id]/submit-draft/route')
    return POST(
      jsonRequest('POST', { external_url: 'https://drive.google.com/x', creator_note: 'v1' }),
      { params: { id: 'co-1' } }
    )
  }

  const collab = (paymentStatus: string, creatorUserId = 'creator-user') => ({
    id: 'co-1', status: 'briefed', payment_status: paymentStatus,
    draft_auto_approve_at: null,
    creator_profiles: { user_id: creatorUserId, users: { display_name: 'Sara', email: 's@x.dev' } },
    brand_profiles: { user_id: 'brand-user', users: { email: 'b@x.dev' } },
  })

  it('blocks draft submission while escrow is unfunded (409)', async () => {
    const res = await post({
      user: verifiedUser('creator-user'),
      tables: { collabs: [{ data: collab('unfunded') }] },
    })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/funded/i)
    expect(active.calls.rpc).toHaveLength(0) // never reaches the atomic submit
  })

  it('blocks draft submission while authorization is still pending (409)', async () => {
    const res = await post({
      user: verifiedUser('creator-user'),
      tables: { collabs: [{ data: collab('authorizing') }] },
    })
    expect(res.status).toBe(409)
  })

  it('only the collab creator can submit (403)', async () => {
    const res = await post({
      user: verifiedUser('brand-user'),
      tables: { collabs: [{ data: collab('funded') }] },
    })
    expect(res.status).toBe(403)
  })

  it('funded collab proceeds into the atomic submit', async () => {
    useStub({
      user: verifiedUser('creator-user'),
      tables: { collabs: [{ data: collab('funded') }] },
      rpcs: {
        submit_draft_reference_atomic: { data: { submission_id: 's-1', submission_version: 1, created: true } },
      },
    })
    const { POST } = await import('@/app/api/collabs/[id]/submit-draft/route')
    const res = await POST(
      jsonRequest('POST', { external_url: 'https://drive.google.com/x' }),
      { params: { id: 'co-1' } }
    )
    expect(res.status).toBe(200)
    expect(active.calls.rpc.filter(c => c.name === 'submit_draft_reference_atomic')).toHaveLength(1)
  })
})

// ─── 11: settlement claims and exactly-once completion (route layer) ─────────
describe('POST /api/collabs/[id]/confirm-live - settlement guards', () => {
  async function post(config: StubConfig) {
    useStub(config)
    const { POST } = await import('@/app/api/collabs/[id]/confirm-live/route')
    return POST(jsonRequest('POST'), { params: { id: 'co-1' } })
  }

  const collab = (overrides: Record<string, unknown> = {}) => ({
    id: 'co-1', status: 'live_submitted', payment_status: 'funded',
    agreed_rate: 25000, creator_payout: 22000,
    stripe_payment_intent_id: 'pi_1', creator_id: 'cr-1',
    creator_profiles: { id: 'cr-1', user_id: 'creator-user', users: { email: 'c@x.dev' } },
    brand_profiles: { user_id: 'brand-user' },
    ...overrides,
  })

  it('only the brand can confirm (403)', async () => {
    const res = await post({
      user: verifiedUser('creator-user'),
      tables: { collabs: [{ data: collab() }] },
    })
    expect(res.status).toBe(403)
    expect(active.calls.rpc).toHaveLength(0)
  })

  it('an already-completed paid collab short-circuits without re-settling', async () => {
    const res = await post({
      user: verifiedUser('brand-user'),
      tables: { collabs: [{ data: collab({ status: 'completed', payment_status: 'paid' }) }] },
    })
    expect(res.status).toBe(200)
    expect((await res.json()).already_completed).toBe(true)
    expect(active.calls.rpc).toHaveLength(0) // no claim, no capture, no finalize
  })

  it('a failed settlement claim (raced/ineligible) stops before any payment call (409)', async () => {
    const res = await post({
      user: verifiedUser('brand-user'),
      tables: { collabs: [{ data: collab() }] },
      rpcs: { claim_live_settlement: { data: false } },
    })
    expect(res.status).toBe(409)
    // The claim was attempted, but settlement/finalize never ran.
    expect(active.calls.rpc.map(c => c.name)).toEqual(['claim_live_settlement'])
  })
})

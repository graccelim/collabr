import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { makeSupabaseStub, verifiedUser, jsonRequest, type StubConfig, type StubCalls } from './helpers/supabase-stub'

// Concierge beta: POST /api/invites branches on creator_profiles.user_id -
// claimed creators get a real invite (unchanged), unclaimed creators queue a
// pending_collab_request instead. Both paths share campaign validation.
let active: ReturnType<typeof makeSupabaseStub>
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => active.client,
  createAdminClient: () => active.client,
}))

function useStub(config: StubConfig): StubCalls {
  active = makeSupabaseStub(config)
  return active.calls
}

const ORIGINAL_BETA = process.env.BETA_FREE_PRO
const ORIGINAL_PLUS = process.env.BETA_FREE_PLUS
afterAll(() => { process.env.BETA_FREE_PRO = ORIGINAL_BETA; process.env.BETA_FREE_PLUS = ORIGINAL_PLUS })
beforeEach(() => {
  process.env.BETA_FREE_PRO = 'true'
  process.env.BETA_FREE_PLUS = 'true' // unlock the Plus-gated invite feature for these tests
})

const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111'
const CREATOR_ID = '22222222-2222-2222-2222-222222222222'
const BODY = { creator_id: CREATOR_ID, campaign_id: CAMPAIGN_ID, proposed_rate: 10000 }

const brandRow = { data: { id: 'b-1', company_name: 'Glow', onboarding_completed_at: '2026-01-01', plan: 'free', subscription_status: 'beta_free' } }
const activeCampaign = { data: { id: CAMPAIGN_ID, title: 'Launch', status: 'active', comp_type: 'paid', brand_id: 'b-1' } }
const rateLimitOk = { rate_limit_hit: { data: true } }

async function post(body: unknown = BODY) {
  const { POST } = await import('@/app/api/invites/route')
  return POST(jsonRequest('POST', body))
}

describe('POST /api/invites - claimed vs unclaimed creator branch', () => {
  it('unclaimed creator (user_id null): queues pending_collab_requests, never touches campaign_invites', async () => {
    const calls = useStub({
      user: verifiedUser('brand-user'),
      tables: {
        users: [{ data: { role: 'brand' } }],
        brand_profiles: [brandRow],
        creator_profiles: [
          { data: { id: CREATOR_ID, user_id: null } },       // claim-status lookup
          { data: { id: CAMPAIGN_ID } },                      // campaigns select is a different table below
          { data: { display_name: 'Alex' } },                 // display_name for the ops email
        ],
        campaigns: [activeCampaign],
        pending_collab_requests: [{ data: null }],            // insert result
      },
      rpcs: rateLimitOk,
    })

    const res = await post()
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.pending).toBe(true)

    expect(calls.writes.some(w => w.table === 'pending_collab_requests' && w.op === 'insert')).toBe(true)
    expect(calls.writes.some(w => w.table === 'campaign_invites')).toBe(false)
  })

  it('unclaimed creator, campaign not active: rejected before queuing anything', async () => {
    const calls = useStub({
      user: verifiedUser('brand-user'),
      tables: {
        users: [{ data: { role: 'brand' } }],
        brand_profiles: [brandRow],
        creator_profiles: [{ data: { id: CREATOR_ID, user_id: null } }],
        campaigns: [{ data: { ...activeCampaign.data, status: 'closed' } }],
      },
      rpcs: rateLimitOk,
    })

    const res = await post()
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/active campaigns/i)
    expect(calls.writes.some(w => w.table === 'pending_collab_requests')).toBe(false)
  })

  it('unclaimed creator, duplicate request for the same campaign: 409, never mentions "unclaimed"', async () => {
    useStub({
      user: verifiedUser('brand-user'),
      tables: {
        users: [{ data: { role: 'brand' } }],
        brand_profiles: [brandRow],
        creator_profiles: [
          { data: { id: CREATOR_ID, user_id: null } },
          { data: { display_name: 'Alex' } },
        ],
        campaigns: [activeCampaign],
        pending_collab_requests: [{ data: null, error: { code: '23505', message: 'duplicate key' } }],
      },
      rpcs: rateLimitOk,
    })

    const res = await post()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).not.toMatch(/unclaimed/i)
    expect(body.error).toMatch(/already requested/i)
  })

  it('claimed creator (user_id set): unchanged real-invite path, no pending_collab_requests write', async () => {
    const calls = useStub({
      user: verifiedUser('brand-user'),
      tables: {
        users: [{ data: { role: 'brand' } }],
        brand_profiles: [brandRow],
        creator_profiles: [
          { data: { id: CREATOR_ID, user_id: 'creator-user' } }, // claim-status lookup
          { data: { user_id: 'creator-user' } },                  // createInvite's post-insert notify lookup
        ],
        campaigns: [activeCampaign],
        collabs: [{ data: null }],
        campaign_invites: [{ data: { id: 'inv-1' } }],
      },
      rpcs: rateLimitOk,
    })

    const res = await post()
    expect(res.status).toBe(201)
    expect((await res.json()).id).toBe('inv-1')
    expect(calls.writes.some(w => w.table === 'campaign_invites' && w.op === 'insert')).toBe(true)
    expect(calls.writes.some(w => w.table === 'pending_collab_requests')).toBe(false)
  })
})

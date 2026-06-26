import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { makeSupabaseStub, verifiedUser, unverifiedUser, jsonRequest, type StubConfig, type StubCalls } from './helpers/supabase-stub'

// Route the app's supabase factory to the per-test stub.
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
afterAll(() => { process.env.BETA_FREE_PRO = ORIGINAL_BETA })
beforeEach(() => { process.env.BETA_FREE_PRO = 'true' })

// ─── 1 & 2: applications POST - verification + onboarding + campaign gates ──
describe('POST /api/applications - trust gates', () => {
  const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111'
  const VALID_BODY = { campaign_id: CAMPAIGN_ID, pitch: 'A solid pitch about my audience and past work.' }
  const onboardedCreator = { data: { id: 'cr-1', boost_active_until: null, onboarding_completed_at: '2026-01-01' } }
  const activeCampaign = { data: { id: CAMPAIGN_ID, title: 'Launch', status: 'active', comp_type: 'paid', brand_profiles: { user_id: 'brand-u' } } }

  async function post(body: unknown = VALID_BODY) {
    const { POST } = await import('@/app/api/applications/route')
    return POST(jsonRequest('POST', body))
  }

  it('blocks unauthenticated users (401)', async () => {
    useStub({ user: null })
    expect((await post()).status).toBe(401)
  })

  it('blocks creators with unverified email (403)', async () => {
    useStub({ user: unverifiedUser() })
    const res = await post()
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/verify your email/i)
  })

  it('blocks creators who have not completed onboarding (403)', async () => {
    useStub({
      user: verifiedUser(),
      tables: { creator_profiles: [{ data: { id: 'cr-1', boost_active_until: null, onboarding_completed_at: null } }] },
    })
    const res = await post()
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/onboarding/i)
  })

  it('rejects a too-short pitch server-side (400)', async () => {
    useStub({ user: verifiedUser(), tables: { creator_profiles: [onboardedCreator] } })
    const res = await post({ campaign_id: CAMPAIGN_ID, pitch: 'too short' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/30 characters/i)
  })

  it('rejects a garbage campaign id without a 500 (400)', async () => {
    useStub({ user: verifiedUser(), tables: { creator_profiles: [onboardedCreator] } })
    const res = await post({ ...VALID_BODY, campaign_id: 'not-a-uuid' })
    expect(res.status).toBe(400)
  })

  it('rejects applications to nonexistent campaigns (404)', async () => {
    useStub({
      user: verifiedUser(),
      tables: { creator_profiles: [onboardedCreator], campaigns: [{ data: null }] },
    })
    const res = await post()
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/no longer exists/i)
  })

  it('rejects applications to closed campaigns (409)', async () => {
    useStub({
      user: verifiedUser(),
      tables: {
        creator_profiles: [onboardedCreator],
        campaigns: [{ data: { ...activeCampaign.data, status: 'closed' } }],
      },
    })
    const res = await post()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/no longer accepting/i)
  })

  it('a PAID campaign requires an expected rate (400)', async () => {
    useStub({
      user: verifiedUser(),
      tables: { creator_profiles: [onboardedCreator], campaigns: [activeCampaign] },
    })
    const res = await post(VALID_BODY) // paid campaign, no proposed_rate
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/expected rate/i)
  })

  it('a BARTER campaign does not require a rate (201)', async () => {
    useStub({
      user: verifiedUser(),
      tables: {
        creator_profiles: [onboardedCreator],
        campaigns: [{ data: { ...activeCampaign.data, comp_type: 'barter' } }],
        // count → existing-check (none) → insert
        applications: [{ count: 0 }, { data: null, error: null }, { data: { id: 'app-1' }, error: null }],
      },
    })
    const res = await post(VALID_BODY) // no rate — allowed for barter
    expect(res.status).toBe(201)
  })

  it('a BARTER campaign allows an optional cash rate (201)', async () => {
    useStub({
      user: verifiedUser(),
      tables: {
        creator_profiles: [onboardedCreator],
        campaigns: [{ data: { ...activeCampaign.data, comp_type: 'barter' } }],
        applications: [{ count: 0 }, { data: null, error: null }, { data: { id: 'app-2' }, error: null }],
      },
    })
    const res = await post({ ...VALID_BODY, proposed_rate: 10000 })
    expect(res.status).toBe(201)
  })

  it('rate-limits at 10 applications per hour (429)', async () => {
    useStub({
      user: verifiedUser(),
      tables: {
        creator_profiles: [onboardedCreator],
        campaigns: [activeCampaign],
        applications: [{ count: 10 }],
      },
    })
    // Paid campaign, so include a rate to clear the rate gate first.
    expect((await post({ ...VALID_BODY, proposed_rate: 10000 })).status).toBe(429)
  })

  it('maps a duplicate application (23505) to a human 409, creating nothing twice', async () => {
    useStub({
      user: verifiedUser(),
      tables: {
        creator_profiles: [onboardedCreator],
        campaigns: [activeCampaign],
        applications: [
          { count: 0 },                                   // hourly count
          { data: null, error: null },                    // existing-check: none
          { data: null, error: { code: '23505' } },       // unique(campaign,creator) violation on insert
        ],
      },
    })
    const res = await post({ ...VALID_BODY, proposed_rate: 10000 })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already applied/i)
  })

  it('revives a previously-withdrawn application instead of blocking (201)', async () => {
    useStub({
      user: verifiedUser(),
      tables: {
        creator_profiles: [onboardedCreator],
        campaigns: [activeCampaign],
        // count → existing-check (withdrawn) → revive update
        applications: [{ count: 0 }, { data: { id: 'app-w', status: 'withdrawn' }, error: null }, { data: { id: 'app-w' }, error: null }],
      },
    })
    expect((await post({ ...VALID_BODY, proposed_rate: 10000 })).status).toBe(201)
  })

  it('keeps rejection final — a rejected application cannot reapply (409)', async () => {
    useStub({
      user: verifiedUser(),
      tables: {
        creator_profiles: [onboardedCreator],
        campaigns: [activeCampaign],
        applications: [{ count: 0 }, { data: { id: 'app-r', status: 'rejected' }, error: null }],
      },
    })
    const res = await post({ ...VALID_BODY, proposed_rate: 10000 })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already decided|reapply/i)
  })

  it('a filled paid campaign cannot be applied to (409)', async () => {
    useStub({
      user: verifiedUser(),
      tables: {
        creator_profiles: [onboardedCreator],
        campaigns: [{ data: { ...activeCampaign.data, creators_needed: 1 } }],
        // one funded collab already → 0 spots left
        collabs: [{ data: [{ status: 'draft_submitted', payment_status: 'funded' }] }],
      },
    })
    const res = await post({ ...VALID_BODY, proposed_rate: 10000 })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/filled/i)
  })
})

// ─── L-4: campaign status transitions ────────────────────────────────────────
describe('PATCH /api/campaigns/[id] - status transitions', () => {
  async function patch(body: unknown) {
    const { PATCH } = await import('@/app/api/campaigns/[id]/route')
    return PATCH(jsonRequest('PATCH', body), { params: { id: 'camp-1' } })
  }
  const ownedCampaign = { data: { id: 'camp-1', brand_profiles: { user_id: 'user-1' } } }

  it('brands cannot mark a campaign completed (trust-signal inflation) (400)', async () => {
    useStub({ user: verifiedUser('user-1'), tables: { campaigns: [ownedCampaign] } })
    const res = await patch({ status: 'completed' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/active or closed/i)
  })

  it('brands can close a campaign (active → closed)', async () => {
    const calls = useStub({
      user: verifiedUser('user-1'),
      tables: { campaigns: [ownedCampaign, { data: { id: 'camp-1', status: 'closed' } }] },
    })
    const res = await patch({ status: 'closed' })
    expect(res.status).toBe(200)
    expect(calls.writes.some(w => w.table === 'campaigns' && w.op === 'update')).toBe(true)
  })

  it('non-owners cannot edit a campaign (403)', async () => {
    useStub({
      user: verifiedUser('someone-else'),
      tables: { campaigns: [{ data: { id: 'camp-1', brand_profiles: { user_id: 'user-1' } } }] },
    })
    expect((await patch({ status: 'closed' })).status).toBe(403)
  })
})

// ─── 4 & 5: Pro gates in paid mode ───────────────────────────────────────────
describe('Pro gates (BETA_FREE_PRO=false)', () => {
  it('saved-creators is gated for Free brands in paid mode', async () => {
    process.env.BETA_FREE_PRO = 'false'
    useStub({
      user: verifiedUser(),
      tables: {
        users: [{ data: { role: 'brand' } }],
        brand_profiles: [{ data: { id: 'b-1', plan: 'free', subscription_status: 'beta_free' } }],
      },
    })
    const { POST } = await import('@/app/api/saved-creators/route')
    const res = await POST(jsonRequest('POST', { creator_id: 'cr-1' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/plus/i) // Saved creators is a Brand Plus feature
  })

  it('saved-creators is GATED in beta (Plus stays gated, unlike Pro)', async () => {
    process.env.BETA_FREE_PRO = 'true' // Pro free in beta, but Plus is not
    useStub({
      user: verifiedUser(),
      tables: {
        users: [{ data: { role: 'brand' } }],
        brand_profiles: [{ data: { id: 'b-1', plan: 'free', subscription_status: 'beta_free' } }],
      },
    })
    const { POST } = await import('@/app/api/saved-creators/route')
    const res = await POST(jsonRequest('POST', { creator_id: 'cr-1' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/plus/i)
  })

  it('saved-creators works for a Brand Plus subscriber', async () => {
    process.env.BETA_FREE_PRO = 'false'
    const calls = useStub({
      user: verifiedUser(),
      tables: {
        users: [{ data: { role: 'brand' } }],
        brand_profiles: [{ data: { id: 'b-1', plan: 'plus', subscription_status: 'active' } }],
        creator_profiles: [{ data: { id: 'cr-1' } }],
        saved_creators: [{ count: 0 }, { data: null, error: null }],
      },
    })
    const { POST } = await import('@/app/api/saved-creators/route')
    const res = await POST(jsonRequest('POST', { creator_id: 'cr-1' }))
    expect(res.status).toBe(200)
    expect(calls.writes.some(w => w.table === 'saved_creators' && w.op === 'insert')).toBe(true)
  })

  it('creators (not brands) can never save creators', async () => {
    useStub({
      user: verifiedUser(),
      tables: { users: [{ data: { role: 'creator' } }] },
    })
    const { POST } = await import('@/app/api/saved-creators/route')
    const res = await POST(jsonRequest('POST', { creator_id: 'cr-1' }))
    expect(res.status).toBe(403)
  })

  it('barter campaign creation is gated for Free brands in paid mode', async () => {
    process.env.BETA_FREE_PRO = 'false'
    useStub({
      user: verifiedUser(),
      tables: {
        brand_profiles: [{ data: { id: 'b-1', onboarding_completed_at: '2026-01-01', plan: 'free', subscription_status: 'beta_free' } }],
        campaigns: [{ count: 0 }],
      },
    })
    const { POST } = await import('@/app/api/campaigns/route')
    const res = await POST(jsonRequest('POST', { title: 'T', brief: 'B', comp_type: 'barter' }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/barter/i)
  })

  it('invite creation is brand-only (creators get 403)', async () => {
    useStub({
      user: verifiedUser(),
      tables: { users: [{ data: { role: 'creator' } }] },
    })
    const { POST } = await import('@/app/api/invites/route')
    const res = await POST(jsonRequest('POST', {
      creator_id: '00000000-0000-0000-0000-000000000001',
      campaign_id: '00000000-0000-0000-0000-000000000002',
      proposed_rate: 10000,
    }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/only brands/i)
  })

  it('invite creation is gated (Plus) for non-Plus brands in paid mode', async () => {
    process.env.BETA_FREE_PRO = 'false'
    useStub({
      user: verifiedUser(),
      tables: {
        users: [{ data: { role: 'brand' } }],
        brand_profiles: [{ data: { id: 'b-1', company_name: 'X', onboarding_completed_at: '2026-01-01', plan: 'free', subscription_status: 'beta_free' } }],
      },
    })
    const { POST } = await import('@/app/api/invites/route')
    const res = await POST(jsonRequest('POST', {
      creator_id: '00000000-0000-0000-0000-000000000001',
      campaign_id: '00000000-0000-0000-0000-000000000002',
      proposed_rate: 10000,
    }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/plus/i)
  })
})

// ─── 13: review authorization ────────────────────────────────────────────────
describe('POST /api/reviews - authorization', () => {
  async function post(body: unknown) {
    const { POST } = await import('@/app/api/reviews/route')
    return POST(jsonRequest('POST', body))
  }
  const reviewBody = { collab_id: 'co-1', rating: 5, note: 'great' }

  it('rejects non-parties (403)', async () => {
    useStub({
      user: verifiedUser('intruder'),
      tables: {
        users: [{ data: { role: 'brand' } }],
        collabs: [{ data: {
          status: 'completed', payment_status: 'paid',
          creator_profiles: { user_id: 'creator-1' },
          brand_profiles: { user_id: 'brand-1' }, // not the intruder
        } }],
      },
    })
    const res = await post(reviewBody)
    expect(res.status).toBe(403)
  })

  it('rejects reviews before the collab is completed (409)', async () => {
    useStub({
      user: verifiedUser('brand-1'),
      tables: {
        users: [{ data: { role: 'brand' } }],
        collabs: [{ data: {
          status: 'live_submitted', payment_status: 'funded',
          creator_profiles: { user_id: 'creator-1' },
          brand_profiles: { user_id: 'brand-1' },
        } }],
      },
    })
    const res = await post(reviewBody)
    expect(res.status).toBe(409)
  })

  it('rejects reviews on a PAID collab that never settled (409)', async () => {
    useStub({
      user: verifiedUser('brand-1'),
      tables: {
        users: [{ data: { role: 'brand' } }],
        collabs: [{ data: {
          status: 'completed', payment_status: 'refund_pending',
          agreed_rate: 50000, // a paid collab - money must have moved
          creator_profiles: { user_id: 'creator-1' },
          brand_profiles: { user_id: 'brand-1' },
        } }],
      },
    })
    const res = await post(reviewBody)
    expect(res.status).toBe(409)
  })

  it('allows reviews on a completed BARTER collab even though unpaid (not 409)', async () => {
    useStub({
      user: verifiedUser('brand-1'),
      tables: {
        users: [{ data: { role: 'brand' } }],
        collabs: [{ data: {
          status: 'completed', payment_status: 'unfunded',
          agreed_rate: 0, // barter - eligible on completion alone
          creator_profiles: { user_id: 'creator-1' },
          brand_profiles: { user_id: 'brand-1' },
        } }],
      },
    })
    const res = await post(reviewBody)
    // Eligibility passes (it does not 409/403); downstream insert behaviour
    // depends on the stub, so we only assert the barter gate is open.
    expect(res.status).not.toBe(409)
    expect(res.status).not.toBe(403)
  })
})

// ─── 12: signed URL access protection ────────────────────────────────────────
describe('GET /api/submissions/[id]/file - signed URL authorization', () => {
  async function get(config: StubConfig) {
    useStub(config)
    const { GET } = await import('@/app/api/submissions/[id]/file/route')
    return GET(jsonRequest('GET'), { params: { id: 'sub-1' } })
  }

  it('rejects unauthenticated access (401)', async () => {
    const res = await get({ user: null })
    expect(res.status).toBe(401)
  })

  it('rejects users who are not a party to the collab (403)', async () => {
    const res = await get({
      user: verifiedUser('intruder'),
      tables: {
        submissions: [{ data: {
          id: 'sub-1', file_url: null, storage_path: 'co-1/draft.mp4', external_url: null,
          collabs: {
            creator_profiles: { user_id: 'creator-1' },
            brand_profiles: { user_id: 'brand-1' },
          },
        } }],
      },
    })
    expect(res.status).toBe(403)
  })

  it('redirects a collab party to the external draft with no-store caching', async () => {
    const res = await get({
      user: verifiedUser('brand-1'),
      tables: {
        submissions: [{ data: {
          id: 'sub-1', file_url: null, storage_path: null,
          external_url: 'https://drive.google.com/file/d/abc',
          collabs: {
            creator_profiles: { user_id: 'creator-1' },
            brand_profiles: { user_id: 'brand-1' },
          },
        } }],
      },
    })
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(res.headers.get('location')).toContain('drive.google.com')
  })
})

// ─── creator self-withdraw (DELETE) ──────────────────────────────────────────
describe('DELETE /api/applications/[id] - creator withdraw', () => {
  async function del(id = 'app-1') {
    const { DELETE } = await import('@/app/api/applications/[id]/route')
    return DELETE(jsonRequest('DELETE') as never, { params: { id } })
  }
  const app = (status: string, owner = 'creator-u') => ({
    data: { id: 'app-1', status, creator_profiles: { user_id: owner } },
  })

  it('lets a creator withdraw their own pending application (200)', async () => {
    useStub({ user: verifiedUser('creator-u'), tables: { applications: [app('pending'), { data: { id: 'app-1' }, error: null }] } })
    const res = await del()
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('withdrawn')
  })

  it('allows withdrawing a shortlisted application (200)', async () => {
    useStub({ user: verifiedUser('creator-u'), tables: { applications: [app('shortlisted'), { data: { id: 'app-1' }, error: null }] } })
    expect((await del()).status).toBe(200)
  })

  it('blocks withdrawing once selected/confirmed (409)', async () => {
    useStub({ user: verifiedUser('creator-u'), tables: { applications: [app('selected')] } })
    expect((await del()).status).toBe(409)
  })

  it('blocks a non-owner (403)', async () => {
    useStub({ user: verifiedUser('intruder'), tables: { applications: [app('pending')] } })
    expect((await del()).status).toBe(403)
  })
})

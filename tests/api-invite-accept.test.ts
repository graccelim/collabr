import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { makeSupabaseStub, verifiedUser, unverifiedUser, jsonRequest, type StubConfig } from './helpers/supabase-stub'
import { computeFee } from '@/lib/utils'

let active: ReturnType<typeof makeSupabaseStub>
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => active.client,
  createAdminClient: () => active.client,
}))

const ORIGINAL_BETA = process.env.BETA_FREE_PRO
afterAll(() => { process.env.BETA_FREE_PRO = ORIGINAL_BETA })
beforeEach(() => { process.env.BETA_FREE_PRO = 'true' })

const RATE = 25000 // cents

function pendingInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    status: 'pending',
    proposed_rate: RATE,
    creator_id: 'cr-1',
    campaigns: {
      id: 'camp-1',
      title: 'Launch',
      brand_id: 'b-1',
      status: 'active',
      comp_type: 'paid',
      brand_profiles: { user_id: 'brand-user', plan: 'free', company_name: 'Glow' },
    },
    ...overrides,
  }
}

async function patch(config: StubConfig, action: 'accept' | 'decline') {
  active = makeSupabaseStub(config)
  const { PATCH } = await import('@/app/api/invites/[id]/route')
  const res = await PATCH(jsonRequest('PATCH', { action }), { params: { id: 'inv-1' } })
  return { res, calls: active.calls }
}

describe('PATCH /api/invites/[id] — acceptance converges into ONE collab', () => {
  it('accept creates the application, then exactly one collab via select_application_atomic', async () => {
    const { res, calls } = await patch({
      user: verifiedUser('creator-user'),
      tables: {
        creator_profiles: [{ data: { id: 'cr-1', onboarding_completed_at: '2026-01-01' } }],
        campaign_invites: [
          { data: pendingInvite() },                 // invite fetch
          { data: { id: 'inv-1' } },                 // status → accepted
        ],
        users: [{ data: { display_name: 'Sara' } }],
        applications: [
          { data: null },                            // no existing application
          { data: { id: 'app-1' } },                 // insert
        ],
      },
      rpcs: {
        select_application_atomic: { data: { collab_id: 'co-1', created: true } },
      },
    }, 'accept')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.collab_id).toBe('co-1')

    // Exactly one atomic selection call, with amounts that sum exactly.
    const rpcCalls = calls.rpc.filter(c => c.name === 'select_application_atomic')
    expect(rpcCalls).toHaveLength(1)
    const args = rpcCalls[0].args as Record<string, number>
    const { fee, payout } = computeFee(RATE, 'free')
    expect(args.p_agreed_rate).toBe(RATE)
    expect(args.p_platform_fee).toBe(fee)
    expect(args.p_creator_payout).toBe(payout)
    expect(args.p_platform_fee + args.p_creator_payout).toBe(args.p_agreed_rate)

    // The invite was closed.
    const inviteUpdates = calls.writes.filter(w => w.table === 'campaign_invites' && w.op === 'update')
    expect(inviteUpdates).toHaveLength(1)
    expect((inviteUpdates[0].payload as any).status).toBe('accepted')
  })

  it('accept when the application is already selected reuses the existing collab — no second atomic call', async () => {
    const { res, calls } = await patch({
      user: verifiedUser('creator-user'),
      tables: {
        creator_profiles: [{ data: { id: 'cr-1', onboarding_completed_at: '2026-01-01' } }],
        campaign_invites: [{ data: pendingInvite() }, { data: { id: 'inv-1' } }],
        users: [{ data: { display_name: 'Sara' } }],
        applications: [{ data: { id: 'app-1', status: 'selected', proposed_rate: RATE } }],
        collabs: [{ data: { id: 'co-existing' } }],
      },
    }, 'accept')

    expect(res.status).toBe(200)
    expect((await res.json()).collab_id).toBe('co-existing')
    expect(active.calls.rpc.filter(c => c.name === 'select_application_atomic')).toHaveLength(0)
    expect(calls.writes.some(w => w.table === 'applications' && w.op === 'insert')).toBe(false)
  })

  it('an already-handled invite cannot be accepted again (409)', async () => {
    const { res } = await patch({
      user: verifiedUser('creator-user'),
      tables: {
        creator_profiles: [{ data: { id: 'cr-1', onboarding_completed_at: '2026-01-01' } }],
        campaign_invites: [{ data: pendingInvite({ status: 'accepted' }) }],
      },
    }, 'accept')
    expect(res.status).toBe(409)
  })

  it('unverified creators cannot accept (403) — invite path cannot bypass Phase 5 gates', async () => {
    const { res, calls } = await patch({
      user: unverifiedUser('creator-user'),
      tables: {
        creator_profiles: [{ data: { id: 'cr-1', onboarding_completed_at: '2026-01-01' } }],
        campaign_invites: [{ data: pendingInvite() }],
        users: [{ data: { display_name: 'Sara' } }],
      },
    }, 'accept')
    expect(res.status).toBe(403)
    expect(calls.rpc).toHaveLength(0)
  })

  it('un-onboarded creators cannot accept (403)', async () => {
    const { res } = await patch({
      user: verifiedUser('creator-user'),
      tables: {
        creator_profiles: [{ data: { id: 'cr-1', onboarding_completed_at: null } }],
        campaign_invites: [{ data: pendingInvite() }],
        users: [{ data: { display_name: 'Sara' } }],
      },
    }, 'accept')
    expect(res.status).toBe(403)
  })

  it('brands (no creator profile) cannot respond to invites (403)', async () => {
    const { res } = await patch({
      user: verifiedUser('brand-user'),
      tables: { creator_profiles: [{ data: null }] },
    }, 'accept')
    expect(res.status).toBe(403)
  })

  it('decline closes the invite without touching applications or collabs', async () => {
    const { res, calls } = await patch({
      user: verifiedUser('creator-user'),
      tables: {
        creator_profiles: [{ data: { id: 'cr-1', onboarding_completed_at: '2026-01-01' } }],
        campaign_invites: [{ data: pendingInvite() }, { data: { id: 'inv-1' } }],
        users: [{ data: { display_name: 'Sara' } }],
      },
    }, 'decline')

    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('declined')
    expect(calls.rpc).toHaveLength(0)
    const inviteUpdate = calls.writes.find(w => w.table === 'campaign_invites' && w.op === 'update')
    expect((inviteUpdate?.payload as any).status).toBe('declined')
    expect(calls.writes.some(w => w.table === 'applications')).toBe(false)
    expect(calls.writes.some(w => w.table === 'collabs')).toBe(false)
  })

  it('cannot accept an invite whose campaign was closed after sending (409)', async () => {
    const closed = pendingInvite()
    ;(closed.campaigns as any).status = 'closed'
    const { res, calls } = await patch({
      user: verifiedUser('creator-user'),
      tables: {
        creator_profiles: [{ data: { id: 'cr-1', onboarding_completed_at: '2026-01-01' } }],
        campaign_invites: [{ data: closed }],
        users: [{ data: { display_name: 'Sara' } }],
      },
    }, 'accept')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/no longer active/i)
    expect(calls.rpc).toHaveLength(0)
    expect(calls.writes.some(w => w.table === 'applications')).toBe(false)
  })

  it('campaign capacity errors surface as a human 409', async () => {
    const { res } = await patch({
      user: verifiedUser('creator-user'),
      tables: {
        creator_profiles: [{ data: { id: 'cr-1', onboarding_completed_at: '2026-01-01' } }],
        campaign_invites: [{ data: pendingInvite() }],
        users: [{ data: { display_name: 'Sara' } }],
        applications: [{ data: null }, { data: { id: 'app-1' } }],
      },
      rpcs: {
        select_application_atomic: { data: null, error: { message: 'Campaign creator capacity has been reached' } },
      },
    }, 'accept')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/filled all its creator slots/i)
  })
})

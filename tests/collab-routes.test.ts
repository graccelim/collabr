import { describe, it, expect, vi } from 'vitest'

// Stub Stripe settlement (only the cancel route touches it).
const { cancelOrRefundPayment } = vi.hoisted(() => ({
  cancelOrRefundPayment: vi.fn(async () => ({ ok: true, paymentStatus: 'cancelled' })),
}))
vi.mock('@/lib/payments', () => ({ cancelOrRefundPayment }))

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

// ─── submit-draft: creator-only + the payment-secured promise ────────────────
describe('POST /api/collabs/[id]/submit-draft', () => {
  async function post(body: unknown, id = 'co-1') {
    const { POST } = await import('@/app/api/collabs/[id]/submit-draft/route')
    return POST(jsonRequest('POST', body), { params: { id } })
  }
  const collab = (over = {}) => ({
    data: {
      id: 'co-1', status: 'briefed', payment_status: 'funded',
      creator_profiles: { user_id: 'creator-u', users: { display_name: 'C', email: 'c@x.dev' } },
      brand_profiles: { user_id: 'brand-u', users: { email: 'b@x.dev' } }, ...over,
    },
  })

  it('blocks unauthenticated (401)', async () => {
    useStub({ user: null })
    expect((await post({ storage_path: 'co-1/d.mp4' })).status).toBe(401)
  })

  it('blocks a non-creator party — the brand cannot submit (403)', async () => {
    useStub({ user: verifiedUser('brand-u'), tables: { collabs: [collab()] } })
    expect((await post({ storage_path: 'co-1/d.mp4' })).status).toBe(403)
  })

  it('BLOCKS draft work until escrow is funded (409) — product promise', async () => {
    useStub({ user: verifiedUser('creator-u'), tables: { collabs: [collab({ payment_status: 'unfunded' })] } })
    const res = await post({ storage_path: 'co-1/d.mp4' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/funded/i)
  })

  it('rejects a draft file path outside the collab (400)', async () => {
    useStub({ user: verifiedUser('creator-u'), tables: { collabs: [collab()] } })
    expect((await post({ storage_path: 'other-collab/d.mp4' })).status).toBe(400)
  })

  it('accepts a funded creator draft (200)', async () => {
    useStub({
      user: verifiedUser('creator-u'),
      tables: { collabs: [collab()] },
      rpcs: { submit_draft_reference_atomic: { data: { created: true, submission_id: 's1', submission_version: 1 } } },
    })
    const res = await post({ storage_path: 'co-1/draft.mp4' })
    expect(res.status).toBe(200)
  })
})

// ─── review-draft: brand-only + feedback rules ───────────────────────────────
describe('POST /api/collabs/[id]/review-draft', () => {
  async function post(body: unknown, id = 'co-1') {
    const { POST } = await import('@/app/api/collabs/[id]/review-draft/route')
    return POST(jsonRequest('POST', body), { params: { id } })
  }
  const collab = {
    data: {
      id: 'co-1', status: 'draft_submitted', payment_status: 'funded',
      creator_profiles: { user_id: 'creator-u', users: { email: 'c@x.dev' } },
      brand_profiles: { user_id: 'brand-u' },
    },
  }

  it('blocks a non-brand (the creator cannot review their own draft) (403)', async () => {
    useStub({ user: verifiedUser('creator-u'), tables: { collabs: [collab] } })
    expect((await post({ submission_id: 's1', decision: 'approved' })).status).toBe(403)
  })

  it('rejects an invalid decision (400)', async () => {
    useStub({ user: verifiedUser('brand-u'), tables: { collabs: [collab] } })
    expect((await post({ submission_id: 's1', decision: 'meh' })).status).toBe(400)
  })

  it('requires substantive feedback on a revision (400)', async () => {
    useStub({ user: verifiedUser('brand-u'), tables: { collabs: [collab] } })
    expect((await post({ submission_id: 's1', decision: 'revision', feedback: 'too short' })).status).toBe(400)
  })

  it('approves a draft (200)', async () => {
    useStub({
      user: verifiedUser('brand-u'), tables: { collabs: [collab] },
      rpcs: { review_draft_atomic: { data: { applied: true, submission_id: 's1' } } },
    })
    expect((await post({ submission_id: 's1', decision: 'approved' })).status).toBe(200)
  })
})

// ─── saved-campaigns: creator-only ───────────────────────────────────────────
describe('POST /api/saved-campaigns', () => {
  async function post(body: unknown) {
    const { POST } = await import('@/app/api/saved-campaigns/route')
    return POST(jsonRequest('POST', body))
  }

  it('blocks a brand from saving campaigns (403)', async () => {
    useStub({ user: verifiedUser('brand-u'), tables: { users: [{ data: { role: 'brand' } }] } })
    expect((await post({ campaign_id: 'k1' })).status).toBe(403)
  })

  it('lets a creator save a campaign (200)', async () => {
    const calls = useStub({
      user: verifiedUser('creator-u'),
      tables: {
        users: [{ data: { role: 'creator' } }],
        creator_profiles: [{ data: { id: 'cr-1' } }],
        campaigns: [{ data: { id: 'k1' } }],
        saved_campaigns: [{ data: null, error: null }],
      },
    })
    const res = await post({ campaign_id: 'k1' })
    expect(res.status).toBe(200)
    expect(calls.writes.some(w => w.table === 'saved_campaigns' && w.op === 'insert')).toBe(true)
  })
})

// ─── collab cancel: party-only + stage gate ──────────────────────────────────
describe('POST /api/collabs/[id]/cancel', () => {
  async function post(id = 'co-1') {
    const { POST } = await import('@/app/api/collabs/[id]/cancel/route')
    return POST(jsonRequest('POST'), { params: { id } })
  }
  const collab = (over = {}) => ({
    data: {
      id: 'co-1', status: 'briefed', payment_status: 'funded', stripe_transfer_id: null,
      creator_profiles: { user_id: 'creator-u' }, brand_profiles: { user_id: 'brand-u' }, ...over,
    },
  })

  it('blocks a non-party (403)', async () => {
    useStub({ user: verifiedUser('intruder'), tables: { collabs: [collab()] } })
    expect((await post()).status).toBe(403)
  })

  it('cannot cancel after the work is live (400)', async () => {
    useStub({ user: verifiedUser('brand-u'), tables: { collabs: [collab({ status: 'live_submitted' })] } })
    expect((await post()).status).toBe(400)
  })

  it('a party can cancel a cancellable collab (200)', async () => {
    const calls = useStub({ user: verifiedUser('creator-u'), tables: { collabs: [collab()] } })
    const res = await post()
    expect(res.status).toBe(200)
    expect(calls.writes.some(w => w.table === 'collabs' && w.op === 'update')).toBe(true)
  })
})

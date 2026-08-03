import { describe, it, expect } from 'vitest'
import { makeSupabaseStub } from './helpers/supabase-stub'
import {
  issueClaimToken, validateClaimToken, consumeClaimToken,
  revokeActiveClaims, activeClaimForCreator, markClaimOpened,
} from '@/lib/creator-claims'

const FUTURE = new Date(Date.now() + 30 * 86400_000).toISOString()
const PAST = new Date(Date.now() - 86400_000).toISOString()

function claimRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1', creator_id: 'cr-1', expires_at: FUTURE,
    used_at: null, revoked_at: null,
    ...overrides,
  }
}

describe('creator claim token lifecycle', () => {
  it('issue: inserts a hashed token, returns the raw token + expiry', async () => {
    const { client, calls } = makeSupabaseStub({ tables: { creator_claims: [{ data: null }] } })
    const { token, expiresAt } = await issueClaimToken(client as any, { creatorId: 'cr-1', createdBy: 'admin-1' })

    expect(token).toBeTruthy()
    expect(token.length).toBeGreaterThan(30) // 256 bits, base64url
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now())

    const insert = calls.writes.find(w => w.table === 'creator_claims' && w.op === 'insert')
    expect(insert).toBeTruthy()
    const payload = insert!.payload as Record<string, unknown>
    expect(payload.token_hash).not.toBe(token) // never stores the raw token
    expect(payload.token_hash).toMatch(/^[0-9a-f]{64}$/) // sha256 hex
    expect(payload.created_by).toBe('admin-1')
  })

  it('issue: custom ttlDays shifts the expiry', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: null }] } })
    const { expiresAt } = await issueClaimToken(client as any, { creatorId: 'cr-1', createdBy: 'admin-1', ttlDays: 1 })
    const days = (new Date(expiresAt).getTime() - Date.now()) / 86400_000
    expect(days).toBeGreaterThan(0.9)
    expect(days).toBeLessThan(1.1)
  })

  it('validate: valid, unused, unexpired, unrevoked → "valid"', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: claimRow() }] } })
    const { status, claim } = await validateClaimToken(client as any, 'sometoken')
    expect(status).toBe('valid')
    expect(claim?.creator_id).toBe('cr-1')
  })

  it('validate: no matching row → "not_found"', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: null }] } })
    const { status, claim } = await validateClaimToken(client as any, 'garbage')
    expect(status).toBe('not_found')
    expect(claim).toBeNull()
  })

  it('validate: past expires_at → "expired"', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: claimRow({ expires_at: PAST }) }] } })
    const { status } = await validateClaimToken(client as any, 'sometoken')
    expect(status).toBe('expired')
  })

  it('validate: used_at set → "used"', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: claimRow({ used_at: new Date().toISOString() }) }] } })
    const { status } = await validateClaimToken(client as any, 'sometoken')
    expect(status).toBe('used')
  })

  it('validate: revoked_at set → "revoked" (checked before "used")', async () => {
    const { client } = makeSupabaseStub({
      tables: { creator_claims: [{ data: claimRow({ used_at: new Date().toISOString(), revoked_at: new Date().toISOString() }) }] },
    })
    const { status } = await validateClaimToken(client as any, 'sometoken')
    expect(status).toBe('revoked')
  })

  it('consume: succeeds, returns the claimed row, writes used_at', async () => {
    const { client, calls } = makeSupabaseStub({ tables: { creator_claims: [{ data: claimRow() }] } })
    const claim = await consumeClaimToken(client as any, 'sometoken')
    expect(claim?.id).toBe('claim-1')
    const update = calls.writes.find(w => w.table === 'creator_claims' && w.op === 'update')
    expect((update?.payload as any).used_at).toBeTruthy()
  })

  it('consume: reuse of an already-consumed token returns null (WHERE clause matched nothing)', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: null }] } })
    const claim = await consumeClaimToken(client as any, 'sometoken')
    expect(claim).toBeNull()
  })

  it('revoke: marks every active claim for the creator as revoked', async () => {
    const { client, calls } = makeSupabaseStub({ tables: { creator_claims: [{ data: null }] } })
    await revokeActiveClaims(client as any, 'cr-1')
    const update = calls.writes.find(w => w.table === 'creator_claims' && w.op === 'update')
    expect((update?.payload as any).revoked_at).toBeTruthy()
  })

  it('activeClaimForCreator: null when nothing active', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: null }] } })
    const claim = await activeClaimForCreator(client as any, 'cr-1')
    expect(claim).toBeNull()
  })

  it('activeClaimForCreator: returns the active claim when present', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: { id: 'claim-2', expires_at: FUTURE, created_at: new Date().toISOString() } }] } })
    const claim = await activeClaimForCreator(client as any, 'cr-1')
    expect((claim as any)?.id).toBe('claim-2')
  })

  it('markClaimOpened: writes opened_at with an is(opened_at, null) first-touch guard', async () => {
    const { client, calls } = makeSupabaseStub({ tables: { creator_claims: [{ data: null }] } })
    await markClaimOpened(client as any, 'claim-1')
    const update = calls.writes.find(w => w.table === 'creator_claims' && w.op === 'update')
    expect(update).toBeTruthy()
    expect((update?.payload as any).opened_at).toBeTruthy()
  })

  it('markClaimOpened: a DB error is swallowed, never thrown (best-effort analytics)', async () => {
    const { client } = makeSupabaseStub({ tables: { creator_claims: [{ data: null, error: { message: 'boom' } }] } })
    await expect(markClaimOpened(client as any, 'claim-1')).resolves.toBeUndefined()
  })
})

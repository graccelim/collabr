import { describe, it, expect, vi, beforeEach } from 'vitest'

// Spy on the side-effect sinks. The notify helpers only orchestrate; the
// notification + email sends are what we assert on.
const sent: any[] = []
const emails: any[] = []
vi.mock('@/lib/notifications', () => ({
  sendNotification: vi.fn(async (n: any) => { sent.push(n) }),
}))
vi.mock('@/lib/email', () => ({
  sendProductEmail: vi.fn(async (e: any) => { emails.push(e) }),
  productEmails: { applicationRejected: ({ campaignTitle }: any) => ({ subject: `closed: ${campaignTitle}` }) },
}))

import { notifyCampaignChange, notifyCampaignClosed, CONTENT_FIELDS } from '@/lib/campaign-notify'

/**
 * Minimal chainable Supabase stub. Each .from(table) returns a thenable query
 * builder whose terminal data is taken from `tables[table]`; .update() records
 * the patch so we can assert the status flip on close.
 */
function makeAdmin(tables: Record<string, any[]>, sink: { updates: any[] }) {
  return {
    from(table: string) {
      const q: any = {
        _update: null as any,
        select() { return q },
        eq() { return q },
        in() { return q },
        not() { return q },
        update(patch: any) { q._update = patch; sink.updates.push({ table, patch }); return q },
        maybeSingle() { return Promise.resolve({ data: (tables[table] || [])[0] || null, error: null }) },
        then(resolve: any) { return resolve({ data: tables[table] || [], error: null }) },
      }
      return q
    },
  } as any
}

beforeEach(() => { sent.length = 0; emails.length = 0 })

describe('campaign edit/close notifications', () => {
  const CID = 'camp-1'

  it('CONTENT_FIELDS drives "did the brief/terms change" detection', () => {
    // A real content edit is detected; a pure status flip (close/reopen) is not.
    expect(CONTENT_FIELDS.some(k => k in { brief: 'new' })).toBe(true)
    expect(CONTENT_FIELDS.some(k => k in { status: 'closed' })).toBe(false)
  })

  it('edit nudges a SELECTED creator into the collab chat, and a plain applicant gets a heads-up', async () => {
    const admin = makeAdmin({
      applications: [
        { status: 'selected', creator_profiles: { id: 'cr-sel', user_id: 'u-sel' } },
        { status: 'pending', creator_profiles: { id: 'cr-app', user_id: 'u-app' } },
      ],
      collabs: [{ id: 'collab-9', creator_id: 'cr-sel', status: 'draft_submitted' }],
    }, { updates: [] })

    await notifyCampaignChange(admin, CID, 'Spring launch')

    expect(sent).toHaveLength(2)
    const selected = sent.find(n => n.userId === 'u-sel')
    const applicant = sent.find(n => n.userId === 'u-app')
    // Selected → linked to their collab chat.
    expect(selected.type).toBe('campaign_updated')
    expect(selected.payload.collab_id).toBe('collab-9')
    expect(selected.payload.href).toBe('/collabs/collab-9')
    expect(selected.body).toMatch(/collab chat/i)
    // Plain applicant → linked to the campaign, no collab.
    expect(applicant.payload.collab_id).toBeUndefined()
    expect(applicant.payload.href).toBe(`/jobs/${CID}`)
  })

  it('a selected creator WITHOUT an active collab falls back to the plain heads-up', async () => {
    const admin = makeAdmin({
      applications: [{ status: 'selected', creator_profiles: { id: 'cr-x', user_id: 'u-x' } }],
      collabs: [], // collab was cancelled/completed → filtered out upstream
    }, { updates: [] })

    await notifyCampaignChange(admin, CID, 'Title')
    expect(sent).toHaveLength(1)
    expect(sent[0].payload.collab_id).toBeUndefined()
  })

  it('uses the campaign slug for the public link when present (UUID fallback otherwise)', async () => {
    const admin = makeAdmin({
      applications: [{ status: 'pending', creator_profiles: { id: 'cr-a', user_id: 'u-a' } }],
      collabs: [],
      campaigns: [{ slug: 'spring-launch-wild-coco' }],
    }, { updates: [] })

    await notifyCampaignChange(admin, CID, 'Spring launch')
    expect(sent).toHaveLength(1)
    expect(sent[0].payload.href).toBe('/jobs/spring-launch-wild-coco')
  })

  it('close declines open applicants (status → rejected) + notifies + emails them', async () => {
    const sink = { updates: [] as any[] }
    const admin = makeAdmin({
      applications: [
        { id: 'app-1', creator_profiles: { user_id: 'u1', users: { email: 'a@x.com' } } },
        { id: 'app-2', creator_profiles: { user_id: 'u2', users: { email: 'b@x.com' } } },
      ],
    }, sink)

    await notifyCampaignClosed(admin, CID, 'Spring launch')

    // Open applications were flipped to rejected.
    expect(sink.updates).toContainEqual({ table: 'applications', patch: { status: 'rejected' } })
    // Each creator notified with the dedupe-safe rejection key + emailed.
    expect(sent).toHaveLength(2)
    expect(sent[0].type).toBe('application_rejected')
    expect(sent[0].dedupeKey).toBe('application:app-1:rejected')
    expect(emails).toHaveLength(2)
  })

  it('close with no open applicants is a no-op (no notifications, no status flip)', async () => {
    const sink = { updates: [] as any[] }
    const admin = makeAdmin({ applications: [] }, sink)
    await notifyCampaignClosed(admin, CID, 'Title')
    expect(sent).toHaveLength(0)
    expect(sink.updates).toHaveLength(0)
  })
})

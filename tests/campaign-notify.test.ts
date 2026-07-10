import { describe, it, expect, vi, beforeEach } from 'vitest'

// Spy on the side-effect sinks. The notify helpers only orchestrate; the
// notification + email sends are what we assert on.
const sent: any[] = []
const emails: any[] = []
const batched: any[] = []
vi.mock('@/lib/notifications', () => ({
  sendNotification: vi.fn(async (n: any) => { sent.push(n) }),
}))
vi.mock('@/lib/email', () => ({
  sendProductEmail: vi.fn(async (e: any) => { emails.push(e) }),
  productEmails: { applicationRejected: ({ campaignTitle }: any) => ({ subject: `closed: ${campaignTitle}` }) },
  sendEmailBatch: vi.fn(async (items: any[]) => { batched.push(...items) }),
  renderCampaignAlertEmail: vi.fn((d: any) => `<html>${d.campaignTitle}|${d.compValue}</html>`),
  unsubscribeUrl: (uid: string) => `https://app.test/unsub/${uid}`,
  link: (p: string) => `https://app.test${p}`,
}))

import {
  notifyCampaignChange, notifyCampaignClosed, notifyNewCampaign,
  CONTENT_FIELDS, type AlertableCampaign,
} from '@/lib/campaign-notify'

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

beforeEach(() => { sent.length = 0; emails.length = 0; batched.length = 0 })

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

describe('new-campaign alert fan-out', () => {
  const campaign: AlertableCampaign = {
    id: 'camp-9', slug: 'dog-food-collab-mighty-nugs', title: 'Mighty Nugs dog food collab',
    brief: 'Freeze-dried pet food launching in Singapore.', comp_type: 'paid',
    budget_min: 15000, budget_max: 30000, barter_detail: null,
    deliverable_types: ['1 x IG Reel'], niche_tags: ['lifestyle', 'food'],
    platforms: ['instagram'], min_followers: 2000,
  }

  /**
   * Alert-flavoured admin stub: creator_profiles resolves the niche-matched
   * creators, notifications records the bulk insert, and email_log's upsert
   * echoes back `claimable` (rows "won" against the dedupe log).
   */
  function makeAlertAdmin(creators: any[], sink: { notifs: any[]; upserts: any[] }, claimable?: (rows: any[]) => any[]) {
    return {
      from(table: string) {
        const q: any = {
          select() { return q },
          overlaps() { return q },
          eq() { return q },
          limit() { return Promise.resolve({ data: creators, error: null }) },
          insert(rows: any) { sink.notifs.push(...rows); return Promise.resolve({ error: null }) },
          upsert(rows: any) {
            sink.upserts.push(...rows)
            const kept = claimable ? claimable(rows) : rows
            return { select: () => Promise.resolve({ data: kept, error: null }) }
          },
        }
        return q
      },
    } as any
  }

  it('alerts each on-niche creator: in-app notification + batched alert email with unsubscribe headers', async () => {
    const sink = { notifs: [] as any[], upserts: [] as any[] }
    const admin = makeAlertAdmin([
      { user_id: 'u1', users: { email: 'a@x.com' } },
      { user_id: 'u2', users: { email: 'b@x.com' } },
    ], sink)

    const count = await notifyNewCampaign(admin, campaign, 'Mighty Nugs')

    expect(count).toBe(2)
    // In-app: one bulk insert, campaign-scoped dedupe key, slug link.
    expect(sink.notifs).toHaveLength(2)
    expect(sink.notifs[0].type).toBe('campaign_new')
    expect(sink.notifs[0].dedupe_key).toBe('campaign:camp-9:alert')
    expect(sink.notifs[0].payload.href).toBe('/jobs/dog-food-collab-mighty-nugs')
    expect(sink.notifs[0].body).toContain('Mighty Nugs')
    // Emails: dedupe keys claimed per (campaign, user), batch send with headers.
    expect(sink.upserts.map(u => u.dedupe_key)).toEqual([
      'email:campaign:camp-9:alert:u1', 'email:campaign:camp-9:alert:u2',
    ])
    expect(batched).toHaveLength(2)
    expect(batched[0].to).toBe('a@x.com')
    expect(batched[0].subject).toBe('[Campaign alert] Mighty Nugs dog food collab')
    expect(batched[0].headers['List-Unsubscribe']).toBe('<https://app.test/unsub/u1>')
    expect(batched[0].headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    // Budgets are cents → formatted range reaches the template.
    expect(batched[0].html).toContain('S$150.00 to S$300.00 per creator')
  })

  it('an untargeted campaign (no niche tags) alerts no one', async () => {
    const sink = { notifs: [] as any[], upserts: [] as any[] }
    const admin = makeAlertAdmin([{ user_id: 'u1', users: { email: 'a@x.com' } }], sink)
    const count = await notifyNewCampaign(admin, { ...campaign, niche_tags: [] }, 'Mighty Nugs')
    expect(count).toBe(0)
    expect(sink.notifs).toHaveLength(0)
    expect(batched).toHaveLength(0)
  })

  it('only emails recipients whose dedupe key was freshly claimed (no double-send on re-run)', async () => {
    const sink = { notifs: [] as any[], upserts: [] as any[] }
    const admin = makeAlertAdmin([
      { user_id: 'u1', users: { email: 'a@x.com' } },
      { user_id: 'u2', users: { email: 'b@x.com' } },
    ], sink, rows => rows.filter(r => r.dedupe_key.endsWith(':u2'))) // u1 already claimed

    const count = await notifyNewCampaign(admin, campaign, 'Mighty Nugs')
    expect(count).toBe(1)
    expect(batched).toHaveLength(1)
    expect(batched[0].to).toBe('b@x.com')
  })

  it('skips creators without a resolvable email and barter campaigns say so', async () => {
    const sink = { notifs: [] as any[], upserts: [] as any[] }
    const admin = makeAlertAdmin([
      { user_id: 'u1', users: { email: 'a@x.com' } },
      { user_id: 'u2', users: null },
    ], sink)

    const count = await notifyNewCampaign(admin, { ...campaign, comp_type: 'barter', budget_min: null, budget_max: null, barter_detail: 'Free 400g bag' }, 'Mighty Nugs')
    expect(count).toBe(1)
    expect(batched[0].html).toContain('Barter (a product or service exchange)')
  })
})

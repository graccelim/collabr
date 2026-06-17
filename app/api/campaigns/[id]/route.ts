import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolvePlan, proGateResponse, PLAN_COLUMNS } from '@/lib/plans'
import { normalizeNicheTags } from '@/lib/niches'
import { sendNotification } from '@/lib/notifications'

// Fields whose change is worth telling applicants/creators about.
const CONTENT_FIELDS = ['title', 'brief', 'deliverable_types', 'comp_type', 'budget_min',
  'budget_max', 'barter_detail', 'niche_tags', 'min_followers', 'creators_needed', 'deadline']

// Fan out "the campaign you applied to changed" notifications. Selected creators
// (with an active collab) are nudged into the collab chat; plain applicants get a
// heads-up. Best-effort — never blocks the edit.
async function notifyCampaignChange(admin: ReturnType<typeof createAdminClient>, campaignId: string, title: string) {
  const [{ data: apps }, { data: collabs }] = await Promise.all([
    admin.from('applications')
      .select('status, creator_profiles(id, user_id)')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'shortlisted', 'selected']),
    admin.from('collabs')
      .select('id, creator_id, status').eq('campaign_id', campaignId)
      .not('status', 'in', '(cancelled,completed)'),
  ])
  const collabByCreator = new Map((collabs || []).map(c => [c.creator_id as string, c.id as string]))
  for (const a of apps || []) {
    const cp = a.creator_profiles as { id?: string; user_id?: string } | null
    if (!cp?.user_id) continue
    const collabId = cp.id ? collabByCreator.get(cp.id) : undefined
    if (a.status === 'selected' && collabId) {
      await sendNotification({
        userId: cp.user_id,
        type: 'campaign_updated',
        title: `“${title}” was updated`,
        body: 'The brand changed the brief or terms. Open your collab chat to discuss before you keep working.',
        payload: { campaign_id: campaignId, collab_id: collabId, href: `/collabs/${collabId}` },
      })
    } else {
      await sendNotification({
        userId: cp.user_id,
        type: 'campaign_updated',
        title: `“${title}” was updated`,
        body: 'A campaign you applied to changed its brief or terms.',
        payload: { campaign_id: campaignId, href: `/jobs/${campaignId}` },
      })
    }
  }
}

async function getAuthedBrand(supabase: ReturnType<typeof createClient>, userId: string, campaignId: string) {
  const { data: campaign } = await supabase.from('campaigns')
    .select('*, brand_profiles(user_id)').eq('id', campaignId).single()
  if (!campaign) return { error: 'Not found', status: 404 as const, campaign: null }
  if ((campaign.brand_profiles as any)?.user_id !== userId) return { error: 'Forbidden', status: 403 as const, campaign: null }
  return { error: null, status: 200 as const, campaign }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase.from('campaigns')
    .select('*, brand_profiles(company_name, logo_url, industry, website)')
    .eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, status, campaign } = await getAuthedBrand(supabase, user.id, params.id)
  if (error) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const allowed = ['title', 'brief', 'deliverable_types', 'comp_type', 'budget_min', 'budget_max',
    'barter_detail', 'niche_tags', 'min_followers', 'creators_needed', 'deadline', 'status']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  // Normalize edited niche tags to canonical slugs (matching + trigger safety).
  if (Array.isArray(updates.niche_tags)) {
    updates.niche_tags = normalizeNicheTags(updates.niche_tags as string[])
  }

  // Brands may only open/close campaigns. 'completed' feeds the public
  // completed_campaigns trust signal (Phase 6 trigger) and is reserved for
  // server-controlled/admin transitions; 'draft' is not a brand-facing state.
  if (updates.status !== undefined && !['active', 'closed'].includes(updates.status as string)) {
    return NextResponse.json(
      { error: 'Campaigns can only be set to active or closed' },
      { status: 400 }
    )
  }

  // Switching a campaign to barter is Pro (complimentary while in beta).
  if (['barter', 'both'].includes(updates.comp_type as string)) {
    const { data: brandPlan } = await createAdminClient().from('brand_profiles')
      .select(PLAN_COLUMNS).eq('user_id', user.id).single()
    const gate = proGateResponse(resolvePlan(brandPlan), 'Barter campaigns')
    if (gate) return gate
  }

  const admin = createAdminClient()
  const { data, error: updateErr } = await admin.from('campaigns')
    .update(updates).eq('id', params.id).select().single()
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // A content edit (not a pure status flip like close/reopen) notifies everyone
  // who applied. Best-effort: never fail the save on a notification hiccup.
  const isContentSave = CONTENT_FIELDS.some(k => k in updates)
  if (isContentSave) {
    try {
      await notifyCampaignChange(admin, params.id, (updates.title as string) || campaign.title)
    } catch (e) {
      console.error('[campaign-update-notify]', e)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error, status } = await getAuthedBrand(supabase, user.id, params.id)
  if (error) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()
  await admin.from('campaigns').update({ status: 'closed' }).eq('id', params.id)
  return NextResponse.json({ success: true })
}

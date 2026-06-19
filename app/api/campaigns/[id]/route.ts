import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { resolvePlan, proGateResponse, PLAN_COLUMNS } from '@/lib/plans'
import { normalizeNicheTags } from '@/lib/niches'
import { CONTENT_FIELDS, notifyCampaignChange, notifyCampaignClosed } from '@/lib/campaign-notify'

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

  // Don't let an edit corrupt in-flight collabs: capacity can't drop below the
  // collaborations that already exist, an excessive cap is rejected, and the
  // compensation type can't be switched once any collab is under way.
  if (updates.creators_needed !== undefined || updates.comp_type !== undefined) {
    const { count } = await admin.from('collabs')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', params.id).neq('status', 'cancelled')
    const liveCollabs = count || 0
    if (updates.creators_needed !== undefined) {
      const n = Number(updates.creators_needed)
      if (!Number.isInteger(n) || n < 1 || n > 50) {
        return NextResponse.json({ error: 'Creators needed must be between 1 and 50.' }, { status: 400 })
      }
      if (n < liveCollabs) {
        return NextResponse.json({ error: `You already have ${liveCollabs} collaboration${liveCollabs === 1 ? '' : 's'} on this campaign — you can't set creators needed below that.` }, { status: 409 })
      }
    }
    if (updates.comp_type !== undefined && updates.comp_type !== campaign.comp_type && liveCollabs > 0) {
      return NextResponse.json({ error: 'You can’t change the compensation type while collaborations are in progress.' }, { status: 409 })
    }
  }

  const { data, error: updateErr } = await admin.from('campaigns')
    .update(updates).eq('id', params.id).select().single()
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // A content edit (not a pure status flip like close/reopen) notifies everyone
  // who applied. A manual close instantly declines + notifies open applicants.
  // Both best-effort: never fail the save on a notification hiccup.
  const isContentSave = CONTENT_FIELDS.some(k => k in updates)
  const isClosing = updates.status === 'closed' && campaign.status !== 'closed'
  try {
    if (isContentSave) {
      await notifyCampaignChange(admin, params.id, (updates.title as string) || campaign.title)
    } else if (isClosing) {
      await notifyCampaignClosed(admin, params.id, campaign.title)
    }
  } catch (e) {
    console.error('[campaign-update-notify]', e)
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

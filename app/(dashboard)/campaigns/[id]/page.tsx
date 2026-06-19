import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import Link from 'next/link'
import ApplicantList from '@/components/ApplicantList'
import EmptyState from '@/components/EmptyState'
import { PLAN_COLUMNS } from '@/lib/plans'
import { computeMatch, creatorIndicators } from '@/lib/recommend'
import { toCreatorSignals, toCampaignSignals, type ScoreRow } from '@/lib/discovery-data'
import { consumesSpot } from '@/lib/collab-status'
import { ChevronLeft, Calendar, Users, DollarSign, Inbox, SearchX, Shield } from 'lucide-react'

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const user = await requireBrand()
  const supabase = createClient()

  // Admin client: subscription columns are server-only; own row by user_id.
  const { data: brand } = await createAdminClient().from('brand_profiles')
    .select(`id, ${PLAN_COLUMNS}`).eq('user_id', user.id).single()

  const { data: campaign } = await supabase.from('campaigns')
    .select('*').eq('id', params.id).eq('brand_id', brand!.id).single()
  if (!campaign) {
    return (
      <div style={{ maxWidth: 560, margin: '40px auto' }}>
        <EmptyState
          icon={SearchX}
          title="Campaign not found"
          body="This campaign doesn't exist or belongs to a different account."
          actionHref="/campaigns"
          actionLabel="Back to campaigns"
        />
      </div>
    )
  }

  // Applicants and collabs are independent reads - issued concurrently.
  // Admin client: applicant identity (users join) is RLS own-row-only and
  // collabs are party-scoped for session clients. Campaign ownership was
  // verified above; emails excluded. Used for the applicant list and the
  // "spots filled" count respectively.
  const [{ data: applications }, { data: collabs }] = await Promise.all([
    createAdminClient().from('applications')
      .select('*, creator_profiles(id, user_id, bio, niche, niche_tags, niches, platforms, base_rate, average_rate_sgd, availability_status, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, created_at, users(display_name, avatar_url))')
      .eq('campaign_id', params.id)
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: true }),
    createAdminClient().from('collabs')
      .select('id, application_id, status, payment_status').eq('campaign_id', params.id),
  ])
  // A spot is only consumed once escrow is secured (funded), not at mere
  // selection. Selected-but-unfunded collabs don't count toward "filled".
  const spotsFilled = (collabs || []).filter(consumesSpot).length
  // Map each selected application to its collab so the card can deep-link the
  // brand straight to funding (Accept → Fund is one continuous motion).
  // Map each application to its LIVE collab. Skip cancelled ones: after an
  // undo/expiry an application can have a cancelled collab plus a fresh one, and
  // the card must point at the live collab, not the dead one.
  const collabByApp: Record<string, { id: string; payment_status: string }> = {}
  for (const c of (collabs || []) as { id: string; application_id: string | null; status: string; payment_status: string }[]) {
    if (c.application_id && c.status !== 'cancelled') collabByApp[c.application_id] = { id: c.id, payment_status: c.payment_status }
  }

  // Honest ranking inputs: socials (self-reported reach) and the creator_scores
  // row are fetched via the admin client for the applicant creator profile ids,
  // then mapped to ranking signals and passed down. Handles/URLs ride along so
  // the brand can open and check each profile without leaving the page.
  const creatorIds = (applications || [])
    .map(a => a.creator_profiles?.id)
    .filter((id): id is string => Boolean(id))
  type ApplicantSocial = { creator_id: string; platform: string; handle: string; url: string; follower_count: number | null; is_primary: boolean }
  const socialsByCreator: Record<string, { follower_count: number | null }[]> = {}
  const socialLinksByCreator: Record<string, { platform: string; handle: string; url: string }[]> = {}
  const scoreByCreator: Record<string, ScoreRow> = {}
  if (creatorIds.length > 0) {
    const admin = createAdminClient()
    const [{ data: socials }, { data: scores }] = await Promise.all([
      admin.from('social_accounts')
        .select('creator_id, platform, handle, url, follower_count, is_primary').in('creator_id', creatorIds)
        .order('is_primary', { ascending: false }).order('follower_count', { ascending: false, nullsFirst: false }),
      admin.from('creator_scores')
        .select('creator_id, quality_score, reliability_score, response_rate_shrunk, response_rate, invites_concluded')
        .in('creator_id', creatorIds),
    ])
    for (const s of (socials || []) as ApplicantSocial[]) {
      (socialsByCreator[s.creator_id] ||= []).push({ follower_count: s.follower_count })
      ;(socialLinksByCreator[s.creator_id] ||= []).push({ platform: s.platform, handle: s.handle, url: s.url })
    }
    for (const sc of (scores || []) as (ScoreRow & { creator_id: string })[]) {
      scoreByCreator[sc.creator_id] = sc
    }
  }

  // Build the campaign signal once, compute each applicant's match, and rank by
  // match score (best first). Boosted applicants get a small additive tie-break
  // bump - they never leap above a clearly-better match.
  const campaignSignals = toCampaignSignals(campaign)
  const BOOST_TIEBREAK = 0.04
  const rankedApplications = (applications || [])
    .map(app => {
      const creatorRow = app.creator_profiles
      const creatorSignals = creatorRow
        ? toCreatorSignals(creatorRow, socialsByCreator[creatorRow.id] || [], scoreByCreator[creatorRow.id] || null)
        : null
      const match = creatorSignals ? computeMatch(creatorSignals, campaignSignals) : null
      const indicators = creatorSignals ? creatorIndicators(creatorSignals, campaignSignals) : null
      const rankScore = (match?.score ?? 0) + (app.is_boosted ? BOOST_TIEBREAK : 0)
      const collab = collabByApp[app.id]
      const socials = creatorRow ? (socialLinksByCreator[creatorRow.id] || []) : []
      return { ...app, match, indicators, socials, _rankScore: rankScore, collab_id: collab?.id, collab_payment_status: collab?.payment_status }
    })
    .sort((a, b) => b._rankScore - a._rankScore)

  // Every brand sees every applicant - visibility is never gated (fair to creators
  // and required for honest auto-decline). Pro monetises via Discovery/invites/boost.
  const visibleApps = rankedApplications

  const isActive = campaign.status === 'active'
  const dueLabel = campaign.deadline
    ? new Date(campaign.deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
    : null
  const budgetLabel = campaign.budget_min
    ? `${formatSGD(campaign.budget_min)}${campaign.budget_max ? `–${formatSGD(campaign.budget_max)}` : ''}`
    : campaign.comp_type === 'barter' ? 'Barter' : '-'

  const deliverable = (campaign.deliverable_types && campaign.deliverable_types.length > 0)
    ? campaign.deliverable_types.join(', ')
    : '-'
  const platformsLabel = (campaign.niche_tags && campaign.niche_tags.length > 0)
    ? campaign.niche_tags.join(', ')
    : '-'
  const minFollowersLabel = campaign.min_followers > 0
    ? `${campaign.min_followers.toLocaleString()}+`
    : 'Any'

  const briefRows: [string, string][] = [
    ['Deliverable', deliverable],
    ['Niches', platformsLabel],
    ['Min followers', minFollowersLabel],
  ]

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <Link
        href="/campaigns"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-faint-solid)', fontSize: 13, textDecoration: 'none', marginBottom: 18 }}
      >
        <ChevronLeft size={15} /> Campaigns
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
          <h1 style={{ fontSize: 25 }}>{campaign.title}</h1>
          <span className={`badge ${isActive ? 'badge-money' : campaign.status === 'draft' ? 'badge-neutral' : 'badge-accent'}`} style={{ textTransform: 'capitalize' }}>{campaign.status}</span>
        </div>
        <Link href={`/campaigns/${params.id}/edit`} className="btn-secondary" style={{ flexShrink: 0 }}>Edit</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
        {dueLabel && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <Calendar size={14} /> Due {dueLabel}
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
          <Users size={14} /> {spotsFilled} of {campaign.creators_needed} spot{campaign.creators_needed > 1 ? 's' : ''} filled
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
          <DollarSign size={14} /> {budgetLabel} per creator
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }} className="pc-grid">
        {/* MAIN - applicants */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18 }}>Applicants</h2>
            <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>{applications?.length || 0} total</span>
          </div>

          {(!applications || applications.length === 0) ? (
            <EmptyState
              icon={Inbox}
              title="Applications are on the way"
              body="Creators are browsing right now, most active campaigns receive their first applications within 48 hours. You can also invite creators directly."
              actionHref="/creators"
              actionLabel="Invite creators"
            />
          ) : (
            <>
              <ApplicantList applications={visibleApps} campaignId={params.id} campaign={campaign}
                spotsLeft={Math.max(0, (campaign.creators_needed || 1) - spotsFilled)} />
            </>
          )}
        </div>

        {/* RAIL - brief + how accepting works */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>The brief</div>
            <p style={{ color: 'var(--ink)', margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{campaign.brief}</p>
            {(campaign.budget_min || campaign.budget_max) ? null : campaign.barter_detail ? (
              <p style={{ fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 12 }}>Barter: {campaign.barter_detail}</p>
            ) : null}
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {briefRows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>{k}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 530, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 18, background: 'var(--money-tint)', border: '1px solid var(--money-tint)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Shield size={16} style={{ color: 'var(--money-deep)' }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--money-deep)' }}>How accepting works</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--money-deep)', margin: 0, lineHeight: 1.5 }}>
              Accept a creator → you secure the payment for their agreed rate → work begins. You only pay out when you approve the live post.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

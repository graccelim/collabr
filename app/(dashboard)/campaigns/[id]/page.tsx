import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import Link from 'next/link'
import ApplicantList from '@/components/ApplicantList'
import EmptyState from '@/components/EmptyState'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'
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

  // Admin client: applicant identity (users join) is RLS own-row-only for
  // session clients. Campaign ownership was verified above; emails excluded.
  const { data: applications } = await createAdminClient().from('applications')
    .select('*, creator_profiles(id, user_id, bio, niches, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, total_earned, created_at, users(display_name, avatar_url))')
    .eq('campaign_id', params.id)
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: true })

  // Admin client: collabs are party-scoped for session clients; this brand owns
  // the campaign verified above. Used for the "spots filled" count.
  const { data: collabs } = await createAdminClient().from('collabs')
    .select('status').eq('campaign_id', params.id)
  const spotsFilled = (collabs || []).filter(c => c.status !== 'cancelled').length

  // Resolved plan: every brand is Pro while in beta.
  const plan = resolvePlan(brand)
  const visibleApps = plan.isPro ? (applications || []) : (applications || []).slice(0, 5)
  const hiddenCount = (applications?.length || 0) - visibleApps.length

  const isActive = campaign.status === 'active'
  const dueLabel = campaign.deadline
    ? new Date(campaign.deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
    : null
  const budgetLabel = campaign.budget_min
    ? `${formatSGD(campaign.budget_min)}${campaign.budget_max ? `–${formatSGD(campaign.budget_max)}` : ''}`
    : campaign.comp_type === 'barter' ? 'Barter' : '—'

  const deliverable = (campaign.deliverable_types && campaign.deliverable_types.length > 0)
    ? campaign.deliverable_types.join(', ')
    : '—'
  const platformsLabel = (campaign.niche_tags && campaign.niche_tags.length > 0)
    ? campaign.niche_tags.join(', ')
    : '—'
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
        {/* MAIN — applicants */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18 }}>Applicants</h2>
            <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>{applications?.length || 0} total</span>
          </div>

          {(!applications || applications.length === 0) ? (
            <EmptyState
              icon={Inbox}
              title="Applications are on the way"
              body="Creators are browsing right now — most active campaigns receive their first applications within 48 hours. You can also invite creators directly."
              actionHref="/creators"
              actionLabel="Invite creators"
            />
          ) : (
            <>
              <ApplicantList applications={visibleApps} campaignId={params.id} campaign={campaign} />
              {hiddenCount > 0 && (
                <div className="card" style={{ marginTop: 14, textAlign: 'center', background: 'var(--surface-2)' }}>
                  <p style={{ fontSize: 14, fontWeight: 540, color: 'var(--ink)', marginBottom: 4 }}>
                    {hiddenCount} more applicant{hiddenCount > 1 ? 's' : ''} available with Pro
                  </p>
                  <Link href="/billing" style={{ fontSize: 13, fontWeight: 540, color: 'var(--accent-deep)' }}>
                    Manage plan →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* RAIL — brief + how accepting works */}
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
              Accept a creator → you fund escrow for their agreed rate → work begins. You only pay out when you approve the live post.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

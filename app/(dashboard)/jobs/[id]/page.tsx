import { createClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import { formatSGD, getInitials } from '@/lib/utils'
import { NICHE_LABELS, type CreatorNiche } from '@/lib/onboarding'
import { computeFit, bestFollowers } from '@/lib/fit'
import Link from 'next/link'
import { ChevronLeft, Shield, CheckCircle2 } from 'lucide-react'
import ApplyForm from '@/components/ApplyForm'
import EmptyState from '@/components/EmptyState'

function nicheLabel(tag: string): string {
  return NICHE_LABELS[tag as CreatorNiche] ?? tag
}

function FitRing({ pct }: { pct: number }) {
  const size = 52, sw = 4
  const r = (size - sw) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-2)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13.5, fontWeight: 600, color: 'var(--ink)',
      }}>{pct}%</div>
    </div>
  )
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const user = await requireCreator()
  const supabase = createClient()

  const { data: campaign } = await supabase.from('campaigns')
    .select('*, brand_profiles(company_name, company_description, logo_url, website, social_url, industry, completed_campaigns)')
    .eq('id', params.id).eq('status', 'active').single()
  if (!campaign) return (
    <div className="card text-center py-10">
      <p className="text-sm text-gray-500">Campaign not found or no longer active.</p>
      <Link href="/jobs" className="text-sm text-purple-600 mt-2 block">← Browse campaigns</Link>
    </div>
  )

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, niche, niches').eq('user_id', user.id).single()

  const { data: socials } = await supabase.from('social_accounts')
    .select('follower_count').eq('creator_id', creator!.id)

  // Check if already applied
  const { data: existing } = await supabase.from('applications')
    .select('id, status').eq('campaign_id', params.id).eq('creator_id', creator!.id).maybeSingle()

  const brand = campaign.brand_profiles as { company_name: string | null; logo_url: string | null } | null
  const brandName = brand?.company_name || 'Brand'
  const isPaid = campaign.comp_type !== 'barter'
  const platform = typeof (campaign as { platform?: unknown }).platform === 'string'
    ? (campaign as { platform: string }).platform
    : null

  // Real fit for THIS campaign against the signed-in creator.
  const creatorNiches = [creator?.niche, ...((creator?.niches as string[] | null) ?? [])]
    .filter((n): n is string => Boolean(n))
  const fit = computeFit(
    { niches: creatorNiches, followers: bestFollowers((socials ?? []) as { follower_count: number | null }[]) },
    { niches: campaign.niche_tags ?? [], minFollowers: campaign.min_followers ?? 0 },
  )
  const primaryNiche = creatorNiches[0]
  const fitExplain = fit.nicheMatch && primaryNiche
    ? `Your ${nicheLabel(primaryNiche)} niche matches this brief.`
    : fit.followersMet
      ? 'Your reach clears this brief — a clear, specific pitch wins it.'
      : 'A specific pitch about your audience can still win this brief.'

  // Compensation display
  const compValue = !isPaid
    ? 'Barter'
    : campaign.budget_min && campaign.budget_max
      ? `${formatSGD(campaign.budget_min)}–${formatSGD(campaign.budget_max)}`
      : campaign.budget_min ? formatSGD(campaign.budget_min)
        : campaign.budget_max ? formatSGD(campaign.budget_max) : 'Paid'

  const briefMeta: { label: string; value: string }[] = [
    { label: 'Deliverable', value: campaign.deliverable_types?.[0] ?? '—' },
    { label: 'Min followers', value: campaign.min_followers ? `${campaign.min_followers.toLocaleString()}+` : 'Any' },
    { label: 'Due', value: campaign.deadline ? new Date(campaign.deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Flexible' },
    { label: 'Compensation', value: compValue },
  ]

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Link href="/jobs" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        color: 'var(--ink-faint-solid)', fontSize: 13, textDecoration: 'none',
      }}>
        <ChevronLeft size={15} /> Browse campaigns
      </Link>

      {/* Brand + title */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{
          width: 54, height: 54, borderRadius: 'var(--radius-sm)',
          background: 'var(--paper-2)', border: '1px solid var(--line)',
          display: 'grid', placeItems: 'center', flexShrink: 0, overflow: 'hidden',
          fontSize: 16, fontWeight: 700, color: 'var(--ink-soft)',
        }}>
          {brand?.logo_url
            ? <img src={brand.logo_url} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : getInitials(brandName)}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24 }}>{campaign.title}</h1>
          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 3 }}>
            {brandName}{platform ? ` · ${platform}` : ''}
          </div>
        </div>
      </div>

      <div className="pc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {/* The brief */}
          <div className="card" style={{ padding: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>The brief</div>
            <p style={{ color: 'var(--ink)', margin: 0, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {campaign.brief}
            </p>

            {campaign.barter_detail && (
              <div style={{
                marginTop: 16, padding: 13, borderRadius: 'var(--radius-sm)',
                background: 'var(--paper-2)', border: '1px solid var(--line)',
              }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Barter offer</div>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: 0 }}>{campaign.barter_detail}</p>
              </div>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14,
              marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)',
            }}>
              {briefMeta.map(m => (
                <div key={m.label}>
                  <div className="eyebrow" style={{ fontSize: 10 }}>{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 540, marginTop: 3, color: 'var(--ink)' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Apply or sent state */}
          {existing ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <EmptyState
                icon={CheckCircle2}
                tone="money"
                title={
                  existing.status === 'selected'
                    ? 'You were selected!'
                    : existing.status === 'shortlisted'
                      ? 'You’ve been shortlisted'
                      : `Application sent to ${brandName}`
                }
                body={
                  existing.status === 'selected'
                    ? 'A collab has been created. Once the brand funds escrow, you can start on the draft.'
                    : existing.status === 'shortlisted'
                      ? 'The brand is interested. You’ll be notified the moment you’re selected.'
                      : 'Your full profile went with it. Most brands reply within 36 hours — you’ll be notified the moment they do.'
                }
                actionHref={existing.status === 'selected' ? '/collabs' : '/applications'}
                actionLabel={existing.status === 'selected' ? 'View your collab' : 'Track applications'}
              />
            </div>
          ) : (
            <ApplyForm campaignId={params.id} creatorId={creator!.id} isPaid={isPaid} brandName={brandName} />
          )}
        </div>

        {/* Sticky trust rail */}
        <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Payment protected */}
          <div className="card" style={{ padding: 20, background: 'var(--money-tint)', borderColor: 'var(--money-tint)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              <Shield size={18} color="var(--money)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--money-deep)' }}>Your payment is protected</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--money-deep)', margin: 0, lineHeight: 1.55 }}>
              If you’re selected, the brand funds escrow at your agreed rate <strong>before you create anything</strong>.
              You’ll see the money locked in. Post the approved content and it releases automatically.
            </p>
          </div>

          {/* Your fit */}
          <div className="card" style={{ padding: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Your fit for this</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <FitRing pct={fit.pct} />
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{fitExplain}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

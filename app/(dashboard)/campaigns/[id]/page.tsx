import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import Link from 'next/link'
import ApplicantList from '@/components/ApplicantList'
import EmptyState from '@/components/EmptyState'
import { resolvePlan, PLAN_COLUMNS } from '@/lib/plans'
import { Inbox, SearchX } from 'lucide-react'

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

  // Resolved plan: every brand is Pro while in beta.
  const plan = resolvePlan(brand)
  const visibleApps = plan.isPro ? (applications || []) : (applications || []).slice(0, 5)
  const hiddenCount = (applications?.length || 0) - visibleApps.length

  const total = applications?.length || 0
  const pending = applications?.filter(a => a.status === 'pending').length || 0
  const shortlisted = applications?.filter(a => a.status === 'shortlisted').length || 0
  const selected = applications?.filter(a => a.status === 'selected').length || 0

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/campaigns" className="text-xs text-gray-400 hover:text-gray-600">← Campaigns</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">{campaign.title}</h1>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className={`badge ${campaign.status === 'active' ? 'badge-teal' : 'badge-gray'}`}>{campaign.status}</span>
            <span className="badge badge-gray">{campaign.comp_type}</span>
            {campaign.deadline && (
              <span className="badge badge-gray">Due {new Date(campaign.deadline).toLocaleDateString('en-SG')}</span>
            )}
          </div>
        </div>
        <Link href={`/campaigns/${params.id}/edit`} className="btn-secondary text-sm">Edit</Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total },
          { label: 'Pending', value: pending },
          { label: 'Shortlisted', value: shortlisted },
          { label: 'Selected', value: selected },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Brief */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-900 mb-2">Brief</h2>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{campaign.brief}</p>
        {(campaign.budget_min || campaign.budget_max) && (
          <p className="text-xs text-gray-500 mt-3">
            Budget: {campaign.budget_min ? formatSGD(campaign.budget_min) : '—'}
            {campaign.budget_max ? ` – ${formatSGD(campaign.budget_max)}` : ''}
          </p>
        )}
        {campaign.barter_detail && (
          <p className="text-xs text-gray-500 mt-1">Barter: {campaign.barter_detail}</p>
        )}
      </div>

      {/* Applicants */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-900">
            Applicants ({applications?.length || 0})
          </h2>
          <span className="text-xs text-gray-400">{campaign.creators_needed} needed</span>
        </div>

        {(!applications || applications.length === 0) ? (
          <EmptyState
            icon={Inbox}
            title="No applications yet"
            body="Applications will appear here once creators start applying. Most active campaigns receive their first applications within 48 hours."
          />
        ) : (
          <>
            <ApplicantList applications={visibleApps} campaignId={params.id} />
            {hiddenCount > 0 && (
              <div className="card mt-3 text-center" style={{ background: 'var(--surface-2)' }}>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {hiddenCount} more applicant{hiddenCount > 1 ? 's' : ''} available with Pro
                </p>
                <Link href="/billing" className="text-xs font-medium" style={{ color: 'var(--accent-deep)' }}>
                  Manage plan →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import { INDUSTRY_LABELS, type BrandIndustry } from '@/lib/onboarding'
import Link from 'next/link'
import ApplyForm from '@/components/ApplyForm'

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
    .select('id').eq('user_id', user.id).single()

  // Check if already applied
  const { data: existing } = await supabase.from('applications')
    .select('id, status').eq('campaign_id', params.id).eq('creator_id', creator!.id).maybeSingle()

  const brand = campaign.brand_profiles as any

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/jobs" className="text-xs text-gray-400 hover:text-gray-600">← Browse campaigns</Link>

      {/* Brand + title */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-surface border border-border flex items-center justify-center text-sm font-medium text-gray-500 shrink-0 overflow-hidden">
            {brand?.logo_url
              ? <img src={brand.logo_url} alt={brand.company_name || 'Brand'} className="w-12 h-12 object-cover" />
              : brand?.company_name?.slice(0, 2).toUpperCase() || 'B'}
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">{brand?.company_name}</p>
            <h1 className="text-lg font-semibold text-gray-900 mt-0.5">{campaign.title}</h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              {campaign.is_featured && <span className="badge badge-purple">Featured</span>}
              {(campaign.comp_type === 'paid' || campaign.comp_type === 'both') && (
                <span className="badge badge-teal">
                  Paid {campaign.budget_min ? formatSGD(campaign.budget_min) : ''}
                  {campaign.budget_max ? ` – ${formatSGD(campaign.budget_max)}` : ''}
                </span>
              )}
              {(campaign.comp_type === 'barter' || campaign.comp_type === 'both') && (
                <span className="badge badge-amber">Barter</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* About the brand — trust signals */}
      {brand && (
        <div className="card space-y-2">
          <h2 className="text-sm font-medium text-gray-900">About {brand.company_name}</h2>
          <div className="flex gap-2 flex-wrap">
            {brand.industry && (
              <span className="badge badge-gray">
                {INDUSTRY_LABELS[brand.industry as BrandIndustry] || brand.industry}
              </span>
            )}
            {(brand.completed_campaigns || 0) > 0 && (
              <span className="badge badge-teal">
                {brand.completed_campaigns} campaign{brand.completed_campaigns !== 1 ? 's' : ''} completed
              </span>
            )}
          </div>
          {brand.company_description ? (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{brand.company_description}</p>
          ) : (
            <p className="text-xs text-gray-400">This brand hasn&apos;t added a description yet.</p>
          )}
          <div className="flex gap-3">
            {brand.website && (
              <a href={brand.website} target="_blank" rel="noopener noreferrer"
                className="text-xs text-purple-600 hover:text-purple-800">Website ↗</a>
            )}
            {brand.social_url && (
              <a href={brand.social_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-purple-600 hover:text-purple-800">Social ↗</a>
            )}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="card space-y-3">
        <h2 className="text-sm font-medium text-gray-900">Campaign brief</h2>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{campaign.brief}</p>

        {campaign.barter_detail && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-700 mb-1">Barter offer</p>
            <p className="text-xs text-amber-600">{campaign.barter_detail}</p>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3">
        {campaign.deliverable_types && campaign.deliverable_types.length > 0 && (
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Deliverables</p>
            <div className="flex flex-wrap gap-1">
              {campaign.deliverable_types.map((d: string) => (
                <span key={d} className="badge badge-gray">{d}</span>
              ))}
            </div>
          </div>
        )}
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Requirements</p>
          <p className="text-xs text-gray-700">
            Min {campaign.min_followers.toLocaleString()} followers
          </p>
          {campaign.deadline && (
            <p className="text-xs text-gray-700 mt-1">
              Due {new Date(campaign.deadline).toLocaleDateString('en-SG')}
            </p>
          )}
        </div>
        {campaign.niche_tags && campaign.niche_tags.length > 0 && (
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Niches</p>
            <div className="flex flex-wrap gap-1">
              {campaign.niche_tags.map((t: string) => (
                <span key={t} className="badge badge-gray">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Escrow info */}
      {campaign.comp_type !== 'barter' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">Secured payment</p>
          <p className="text-xs text-blue-600">
            Draft work begins only after Stripe verifies the brand&apos;s payment authorization. You are marked paid only after capture and transfer succeed.
          </p>
        </div>
      )}

      {/* Apply or status */}
      {existing ? (
        <div className={`card ${existing.status === 'selected' ? 'bg-teal-50 border-teal-200' : 'bg-surface'}`}>
          <p className="text-sm font-medium text-gray-900">
            {existing.status === 'selected' ? '🎉 You were selected!' : 'Application submitted'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Status: {existing.status}</p>
          {existing.status === 'selected' && (
            <Link href="/collabs" className="btn-primary mt-3 inline-block text-sm">View your collab →</Link>
          )}
        </div>
      ) : (
        <ApplyForm campaignId={params.id} creatorId={creator!.id} isPaid={campaign.comp_type !== 'barter'} />
      )}
    </div>
  )
}

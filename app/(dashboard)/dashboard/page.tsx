import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatSGD } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile) redirect('/signup')

  if (profile.role === 'brand') return <BrandDashboard userId={user.id} />
  if (profile.role === 'creator') return <CreatorDashboard userId={user.id} />
  return <div>Loading…</div>
}

async function BrandDashboard({ userId }: { userId: string }) {
  const supabase = createClient()
  const { data: brand } = await supabase.from('brand_profiles').select('*').eq('user_id', userId).single()
  if (!brand) return <div className="card">Complete your brand profile to get started.</div>

  const { data: campaigns } = await supabase.from('campaigns')
    .select('*').eq('brand_id', brand.id).order('created_at', { ascending: false }).limit(5)
  const { data: collabs } = await supabase.from('collabs')
    .select('*, campaigns(title), creator_profiles(*, users(display_name))')
    .eq('brand_id', brand.id).neq('status', 'completed').neq('status', 'cancelled').limit(5)

  const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0
  const pendingReview = collabs?.filter(c => c.status === 'draft_submitted').length || 0
  const inEscrow = collabs?.reduce((sum, c) => sum + (c.agreed_rate || 0), 0) || 0

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back, {brand.company_name}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          ['Active campaigns', activeCampaigns],
          ['Drafts to review', pendingReview],
          ['In escrow', formatSGD(inEscrow)],
        ].map(([l, v]) => (
          <div key={String(l)} className="bg-white border border-border rounded-card p-4">
            <div className="text-2xl font-semibold text-gray-900">{v}</div>
            <div className="text-xs text-gray-500 mt-1">{l}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Link href="/post-job" className="btn-primary">Post a campaign</Link>
        <Link href="/creators" className="btn-secondary">Browse creators</Link>
      </div>
      {collabs && collabs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-900 mb-3">Active collabs</h2>
          <div className="space-y-2">
            {collabs.map(c => (
              <Link key={c.id} href={`/collabs/${c.id}`}
                className="card flex items-center justify-between hover:border-purple-200 transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-900">{c.campaigns?.title}</div>
                  <div className="text-xs text-gray-500">{(c.creator_profiles as any)?.users?.display_name}</div>
                </div>
                <span className="badge badge-purple text-xs">{c.status.replace(/_/g,' ')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {(!campaigns || campaigns.length === 0) && (
        <div className="card text-center py-10">
          <p className="text-gray-500 text-sm mb-4">No campaigns yet. Post your first one — it takes 5 minutes.</p>
          <Link href="/post-job" className="btn-primary">Post a campaign</Link>
        </div>
      )}
    </div>
  )
}

async function CreatorDashboard({ userId }: { userId: string }) {
  const supabase = createClient()
  const { data: creator } = await supabase.from('creator_profiles').select('*').eq('user_id', userId).single()
  if (!creator) return <div className="card">Complete your creator profile to get started.</div>

  const { data: applications } = await supabase.from('applications')
    .select('*, campaigns(title, comp_type, budget_min, budget_max, brand_profiles(company_name))')
    .eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(5)
  const { data: collabs } = await supabase.from('collabs')
    .select('*, campaigns(title), brand_profiles(company_name)')
    .eq('creator_id', creator.id).neq('status', 'completed').neq('status', 'cancelled').limit(5)

  const isBoosted = creator.boost_active_until && new Date(creator.boost_active_until) > new Date()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          ['Total earned', formatSGD(creator.total_earned)],
          ['Rating', creator.rating_count > 0 ? `${creator.rating_avg} ★` : '—'],
          ['Collabs done', creator.collabs_completed],
        ].map(([l, v]) => (
          <div key={String(l)} className="bg-white border border-border rounded-card p-4">
            <div className="text-2xl font-semibold text-gray-900">{v}</div>
            <div className="text-xs text-gray-500 mt-1">{l}</div>
          </div>
        ))}
      </div>
      {isBoosted && (
        <div className="card bg-purple-50 border-purple-200 flex items-center gap-3">
          <div className="text-purple-600 font-medium text-sm">Boost active</div>
          <div className="text-purple-500 text-xs">You appear at the top of applicant lists</div>
        </div>
      )}
      <div className="flex gap-3">
        <Link href="/jobs" className="btn-primary">Browse campaigns</Link>
        <Link href="/profile" className="btn-secondary">Edit profile</Link>
      </div>
      {collabs && collabs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-900 mb-3">Active collabs</h2>
          <div className="space-y-2">
            {collabs.map(c => (
              <Link key={c.id} href={`/collabs/${c.id}`}
                className="card flex items-center justify-between hover:border-purple-200 transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-900">{c.campaigns?.title}</div>
                  <div className="text-xs text-gray-500">{(c.brand_profiles as any)?.company_name}</div>
                </div>
                <span className="badge badge-teal text-xs">{c.status.replace(/_/g,' ')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {(!applications || applications.length === 0) && (
        <div className="card text-center py-10">
          <p className="text-gray-500 text-sm mb-4">No applications yet. Browse open campaigns.</p>
          <Link href="/jobs" className="btn-primary">Browse campaigns</Link>
        </div>
      )}
    </div>
  )
}

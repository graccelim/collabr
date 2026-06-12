import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import ConnectOnboarding from '@/components/ConnectOnboarding'
import EmptyState from '@/components/EmptyState'
import { Wallet } from 'lucide-react'

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: { connect?: string }
}) {
  const user = await requireCreator()
  const supabase = createClient()

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id, user_id, bio, niches, platforms, base_rate, is_verified, boost_active_until, rating_avg, rating_count, collabs_completed, total_earned, created_at')
    .eq('user_id', user.id).single()
  const admin = createAdminClient()
  const { data: connectProfile } = await admin.from('creator_profiles')
    .select('stripe_connect_id').eq('user_id', user.id).single()
  const { data: collabs } = await supabase.from('collabs')
    .select('*, campaigns(title), brand_profiles(company_name)')
    .eq('creator_id', creator!.id)
    .eq('status', 'completed')
    .in('payment_status', ['paid', 'manual_exception'])
    .order('created_at', { ascending: false })

  const connectComplete = searchParams.connect === 'complete'
  const connectRefresh = searchParams.connect === 'refresh'

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Earnings</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="text-2xl font-semibold text-gray-900">{formatSGD(creator?.total_earned || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Total earned</div>
        </div>
        <div className="card">
          <div className="text-2xl font-semibold text-gray-900">{creator?.collabs_completed || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Completed collabs</div>
        </div>
      </div>

      {/* Stripe Connect onboarding */}
      <ConnectOnboarding
        hasConnectId={!!connectProfile?.stripe_connect_id}
        justCompleted={connectComplete}
        needsRefresh={connectRefresh}
      />

      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Payout history</h2>
        <div className="space-y-2">
          {collabs?.map(c => (
            <div key={c.id} className="card flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{c.campaigns?.title}</div>
                <div className="text-xs text-gray-500">
                  {(c.brand_profiles as any)?.company_name} · {new Date(c.created_at).toLocaleDateString('en-SG')}
                </div>
              </div>
              <div className="text-sm font-medium text-teal-600">{formatSGD(c.creator_payout)}</div>
            </div>
          ))}
          {(!collabs || collabs.length === 0) && (
            <EmptyState
              icon={Wallet}
              title="No payouts yet"
              body="Payouts land here after a brand confirms your live post and Stripe transfers your earnings. Escrow guarantees payment once requirements are met."
              actionHref="/jobs"
              actionLabel="Browse campaigns"
            />
          )}
        </div>
      </div>
    </div>
  )
}

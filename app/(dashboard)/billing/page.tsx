import { createClient } from '@/lib/supabase/server'
import { requireBrand } from '@/lib/auth'
import { formatSGD } from '@/lib/utils'
import Link from 'next/link'

export default async function BillingPage() {
  const user = await requireBrand()
  const supabase = createClient()

  const { data: brand } = await supabase.from('brand_profiles')
    .select('*').eq('user_id', user.id).single()

  const { data: collabs } = await supabase.from('collabs')
    .select('*, campaigns(title), creator_profiles(users(display_name))')
    .eq('brand_id', brand!.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const totalSpend = (collabs || []).reduce((sum, c) => sum + (c.agreed_rate || 0), 0)
  const isPro = brand?.plan === 'pro'

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Billing</h1>

      {/* Current plan */}
      <div className={`card ${isPro ? 'bg-purple-50 border-purple-200' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Current plan</p>
            <p className="text-lg font-semibold text-gray-900">{isPro ? 'Pro' : 'Free'}</p>
            <p className="text-xs text-gray-500 mt-1">
              {isPro ? '8% platform fee · Unlimited campaigns · All applicants visible'
                : '12% platform fee · 2 active campaigns · First 5 applicants only'}
            </p>
          </div>
          {isPro && (
            <span className="badge badge-purple">Active</span>
          )}
        </div>
      </div>

      {/* Pro upgrade CTA */}
      {!isPro && (
        <div className="card border-purple-200 bg-purple-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-purple-900 mb-2">Upgrade to Pro</p>
              <ul className="space-y-1 text-xs text-purple-700">
                <li>→ See all applicants (not just first 5)</li>
                <li>→ Platform fee drops from 12% to 8%</li>
                <li>→ Unlimited active campaigns</li>
                <li>→ Priority support</li>
              </ul>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-semibold text-purple-900">S$99<span className="text-sm font-normal">/mo</span></p>
              <button className="btn-primary mt-2 text-sm">Upgrade now</button>
            </div>
          </div>
          <p className="text-xs text-purple-400 mt-3">
            Card payment for Pro plan coming soon. Email hello@collabr.sg to upgrade manually during beta.
          </p>
        </div>
      )}

      {/* Spend summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-2xl font-semibold text-gray-900">{formatSGD(totalSpend)}</p>
          <p className="text-xs text-gray-500 mt-1">Total campaign spend</p>
        </div>
        <div className="card">
          <p className="text-2xl font-semibold text-gray-900">{collabs?.length || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Completed collabs</p>
        </div>
      </div>

      {/* Payment history */}
      <div>
        <h2 className="text-sm font-medium text-gray-900 mb-3">Payment history</h2>
        {(!collabs || collabs.length === 0) ? (
          <div className="card text-center py-8">
            <p className="text-sm text-gray-500">No completed collabs yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {collabs.map(c => {
              const creatorName = ((c.creator_profiles as any)?.users?.display_name) || 'Creator'
              return (
                <div key={c.id} className="card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.campaigns?.title}</p>
                    <p className="text-xs text-gray-500">{creatorName} · {new Date(c.created_at).toLocaleDateString('en-SG')}</p>
                    <p className="text-xs text-gray-400">Fee: {formatSGD(c.platform_fee)} · Creator: {formatSGD(c.creator_payout)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatSGD(c.agreed_rate)}</p>
                    <Link href={`/collabs/${c.id}`} className="text-xs text-purple-600">View →</Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

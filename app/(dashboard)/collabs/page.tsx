import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD, COLLAB_STATUSES } from '@/lib/utils'

export default async function CollabsPage() {
  const user = await requireAuth()
  const supabase = createClient()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()

  const isBrand = profile?.role === 'brand'
  let query = supabase.from('collabs').select('*, campaigns(title), creator_profiles(*, users(display_name)), brand_profiles(company_name)')

  if (isBrand) {
    const { data: brand } = await supabase.from('brand_profiles').select('id').eq('user_id', user.id).single()
    if (brand) query = query.eq('brand_id', brand.id)
  } else {
    const { data: creator } = await supabase.from('creator_profiles').select('id').eq('user_id', user.id).single()
    if (creator) query = query.eq('creator_id', creator.id)
  }

  const { data: collabs } = await query.order('created_at', { ascending: false })

  const active = collabs?.filter(c => !['completed','cancelled'].includes(c.status)) || []
  const past = collabs?.filter(c => ['completed','cancelled'].includes(c.status)) || []

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Collabs</h1>

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Active ({active.length})</h2>
          <div className="space-y-2">
            {active.map(c => (
              <Link key={c.id} href={`/collabs/${c.id}`}
                className="card flex items-center justify-between hover:border-purple-200 transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-900">{c.campaigns?.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {isBrand ? (c.creator_profiles as any)?.users?.display_name : (c.brand_profiles as any)?.company_name}
                    {' · '}{formatSGD(c.agreed_rate)}
                  </div>
                </div>
                <span className={`badge badge-${COLLAB_STATUSES[c.status as keyof typeof COLLAB_STATUSES]?.color || 'gray'}`}>
                  {COLLAB_STATUSES[c.status as keyof typeof COLLAB_STATUSES]?.label || c.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Past</h2>
          <div className="space-y-2">
            {past.map(c => (
              <Link key={c.id} href={`/collabs/${c.id}`}
                className="card flex items-center justify-between opacity-70 hover:opacity-100 transition-opacity">
                <div>
                  <div className="text-sm font-medium text-gray-900">{c.campaigns?.title}</div>
                  <div className="text-xs text-gray-500">{formatSGD(c.creator_payout)} to creator</div>
                </div>
                <span className="badge badge-gray">{c.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(!collabs || collabs.length === 0) && (
        <div className="card text-center py-10">
          <p className="text-gray-500 text-sm">No collabs yet.</p>
        </div>
      )}
    </div>
  )
}

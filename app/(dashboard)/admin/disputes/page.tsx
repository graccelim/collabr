import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatSGD, relativeTime } from '@/lib/utils'

export default async function AdminDisputesPage() {
  const user = await requireAuth()
  const supabase = createClient()

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const { data: disputes } = await admin.from('disputes')
    .select('*, collabs(id, agreed_rate, creator_payout, campaigns(title), creator_profiles(users(display_name)), brand_profiles(company_name))')
    .order('created_at', { ascending: false })

  const pending = (disputes || []).filter(d => d.outcome === 'pending')
  const resolved = (disputes || []).filter(d => d.outcome !== 'pending')

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Disputes</h1>
        <span className="badge badge-amber">{pending.length} pending</span>
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Pending resolution</h2>
          <div className="space-y-2">
            {pending.map(d => {
              const collab = d.collabs as any
              return (
                <Link key={d.id} href={`/admin/disputes/${d.id}`}
                  className="card flex items-center justify-between hover:border-amber-300 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{collab?.campaigns?.title}</p>
                    <p className="text-xs text-gray-500">
                      {collab?.brand_profiles?.company_name} vs {collab?.creator_profiles?.users?.display_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Raised by {d.raised_by} · {relativeTime(d.created_at)} · {formatSGD(collab?.agreed_rate || 0)}
                    </p>
                  </div>
                  <span className="badge badge-amber">Pending →</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Resolved ({resolved.length})</h2>
          <div className="space-y-2">
            {resolved.map(d => {
              const collab = d.collabs as any
              return (
                <Link key={d.id} href={`/admin/disputes/${d.id}`}
                  className="card flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{collab?.campaigns?.title}</p>
                    <p className="text-xs text-gray-500">{d.outcome?.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="badge badge-teal">{d.outcome?.replace(/_/g, ' ')}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {(!disputes || disputes.length === 0) && (
        <div className="card text-center py-10">
          <p className="text-sm text-gray-500">No disputes. 🎉</p>
        </div>
      )}
    </div>
  )
}

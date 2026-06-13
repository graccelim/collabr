import { createClient } from '@/lib/supabase/server'
import { requireCreator } from '@/lib/auth'
import Link from 'next/link'
import { formatSGD } from '@/lib/utils'
import EmptyState from '@/components/EmptyState'
import { FileText } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-gray',
  shortlisted: 'badge-amber',
  selected: 'badge-teal',
  rejected: 'badge-gray',
}

export default async function ApplicationsPage() {
  const user = await requireCreator()
  const supabase = createClient()

  const { data: creator } = await supabase.from('creator_profiles')
    .select('id').eq('user_id', user.id).single()

  const { data: applications } = await supabase.from('applications')
    .select('*, campaigns(id, title, comp_type, budget_min, budget_max, brand_profiles(company_name))')
    .eq('creator_id', creator!.id)
    .order('created_at', { ascending: false })

  // For selected applications, find the corresponding collab
  const selectedAppIds = (applications || [])
    .filter(a => a.status === 'selected').map(a => a.id)

  const collabsByApp: Record<string, string> = {}
  if (selectedAppIds.length > 0) {
    const { data: collabs } = await supabase.from('collabs')
      .select('id, application_id').in('application_id', selectedAppIds)
    collabs?.forEach(c => { collabsByApp[c.application_id] = c.id })
  }

  const active = (applications || []).filter(a => !['rejected'].includes(a.status))
  const past = (applications || []).filter(a => a.status === 'rejected')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">My applications</h1>

      {(!applications || applications.length === 0) && (
        <EmptyState
          icon={FileText}
          title="Let's land your first paid collab"
          body="Apply to open campaigns and track every application here — you'll see the moment you're shortlisted or selected."
          steps={['Browse campaigns', 'Send a pitch', 'Get selected']}
          actionHref="/jobs"
          actionLabel="Browse campaigns"
        />
      )}

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Active ({active.length})</h2>
          <div className="space-y-2">
            {active.map(app => {
              const campaign = app.campaigns as any
              const collabId = collabsByApp[app.id]
              return (
                <div key={app.id} className="card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{campaign?.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{campaign?.brand_profiles?.company_name}</div>
                      {(campaign?.budget_min || campaign?.budget_max) && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {campaign.budget_min ? formatSGD(campaign.budget_min) : '—'}
                          {campaign.budget_max ? ` – ${formatSGD(campaign.budget_max)}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`badge ${STATUS_COLORS[app.status] || 'badge-gray'}`}>{app.status}</span>
                      {collabId && (
                        <Link href={`/collabs/${collabId}`} className="btn-primary btn-sm">
                          View collab →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Not selected ({past.length})</h2>
          <div className="space-y-2">
            {past.map(app => {
              const campaign = app.campaigns as any
              return (
                <div key={app.id} className="card opacity-60">
                  <div className="text-sm font-medium text-gray-900">{campaign?.title}</div>
                  <div className="text-xs text-gray-500">{campaign?.brand_profiles?.company_name}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

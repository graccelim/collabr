'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatSGD } from '@/lib/utils'

interface Application {
  id: string
  pitch: string
  proposed_rate: number | null
  status: string
  is_boosted: boolean
  creator_profiles?: {
    bio?: string | null
    niches?: string[] | null
    platforms?: Record<string, { handle: string; followers: number; verified: boolean }> | null
    base_rate?: number
    rating_avg?: number
    rating_count?: number
    is_verified?: boolean
    users?: { display_name?: string | null; avatar_url?: string | null }
  }
}

interface Props {
  applications: Application[]
  campaignId: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-gray',
  shortlisted: 'badge-amber',
  selected: 'badge-teal',
  rejected: 'badge-gray',
}

export default function ApplicantList({ applications, campaignId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(applications.map(a => [a.id, a.status]))
  )

  async function updateStatus(appId: string, status: string) {
    setLoading(`${appId}-${status}`)
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatuses(prev => ({ ...prev, [appId]: status }))
      if (status === 'selected') {
        toast.success('Creator selected — collab created!')
        router.refresh()
      } else {
        toast.success(`Application ${status}`)
      }
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      {applications.map(app => {
        const creator = app.creator_profiles
        const name = creator?.users?.display_name || 'Creator'
        const status = statuses[app.id]
        const totalFollowers = Object.values(creator?.platforms || {})
          .reduce((sum, p) => sum + (p.followers || 0), 0)

        return (
          <div key={app.id} className={`card ${app.is_boosted ? 'border-purple-300 bg-purple-50/30' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{name}</span>
                  {app.is_boosted && <span className="badge badge-purple text-xs">Boosted</span>}
                  {creator?.is_verified && <span className="badge badge-teal text-xs">Verified</span>}
                  <span className={`badge text-xs ${STATUS_COLORS[status] || 'badge-gray'}`}>{status}</span>
                </div>

                {totalFollowers > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">{totalFollowers.toLocaleString()} followers</p>
                )}
                {creator?.niches && creator.niches.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {creator.niches.map((n: string) => (
                      <span key={n} className="badge badge-gray text-xs">{n}</span>
                    ))}
                  </div>
                )}
                {creator?.rating_count! > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{creator?.rating_avg} ★ ({creator?.rating_count} reviews)</p>
                )}

                <p className="text-xs text-gray-600 mt-2 line-clamp-2">{app.pitch}</p>

                {app.proposed_rate && (
                  <p className="text-xs font-medium text-teal-700 mt-1">Proposed: {formatSGD(app.proposed_rate)}</p>
                )}
              </div>

              {status === 'pending' || status === 'shortlisted' ? (
                <div className="flex flex-col gap-1.5 shrink-0">
                  {status === 'pending' && (
                    <button
                      onClick={() => updateStatus(app.id, 'shortlisted')}
                      disabled={!!loading}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {loading === `${app.id}-shortlisted` ? '…' : 'Shortlist'}
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(app.id, 'selected')}
                    disabled={!!loading}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {loading === `${app.id}-selected` ? '…' : 'Select'}
                  </button>
                  <button
                    onClick={() => updateStatus(app.id, 'rejected')}
                    disabled={!!loading}
                    className="text-xs text-gray-400 hover:text-red-500 text-center py-1"
                  >
                    {loading === `${app.id}-rejected` ? '…' : 'Pass'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

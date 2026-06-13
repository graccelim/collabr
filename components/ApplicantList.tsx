'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { BadgeCheck, Shield, Zap, Check } from 'lucide-react'
import { formatSGD, getInitials } from '@/lib/utils'
import { computeFit } from '@/lib/fit'

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

/** Campaign targeting passed in so we can compute a real creator↔campaign fit. */
interface CampaignFit {
  niche_tags?: string[] | null
  min_followers?: number | null
}

interface Props {
  applications: Application[]
  campaignId: string
  campaign?: CampaignFit
}

export default function ApplicantList({ applications, campaignId, campaign }: Props) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {applications.map(app => {
        const creator = app.creator_profiles
        const name = creator?.users?.display_name || 'Creator'
        const status = statuses[app.id]
        const platforms = Object.values(creator?.platforms || {})
        const totalFollowers = platforms.reduce((sum, p) => sum + (p.followers || 0), 0)

        const fit = computeFit(
          { niches: creator?.niches || [], followers: totalFollowers },
          { niches: campaign?.niche_tags || [], minFollowers: campaign?.min_followers || 0 },
        )

        // Followers line: prefer real platform totals, else fall back to niches.
        const sub = totalFollowers > 0
          ? `${totalFollowers.toLocaleString()} followers`
          : (creator?.niches && creator.niches.length > 0 ? creator.niches.join(' · ') : 'New creator')

        const rateLabel = app.proposed_rate != null ? formatSGD(app.proposed_rate) : null
        const isOpen = status === 'pending' || status === 'shortlisted'

        return (
          <div key={app.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: 16,
                }}>{getInitials(name)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{name}</span>
                    {creator?.is_verified && <BadgeCheck size={15} style={{ color: 'var(--accent)' }} />}
                    {app.is_boosted && (
                      <span className="badge badge-warn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Zap size={11} /> Boosted
                      </span>
                    )}
                    {status === 'selected' && <span className="badge badge-money">Selected</span>}
                    {status === 'rejected' && <span className="badge badge-neutral">Passed</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink-faint-solid)', marginTop: 1 }}>
                    {sub}
                    {creator?.rating_count ? ` · ${creator.rating_avg} ★ (${creator.rating_count})` : ''}
                  </div>
                </div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: '4px 9px', borderRadius: 99,
                background: 'var(--accent-tint)', color: 'var(--accent-deep)',
                fontSize: 12, fontWeight: 600,
              }}>
                {fit.pct}% fit
              </span>
            </div>

            <p style={{ margin: '13px 0', fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
              “{app.pitch}”
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 14, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-faint-solid)' }}>Their rate</span>
                <span className="mono-num" style={{ fontSize: 15, fontWeight: 560, color: 'var(--ink)' }}>
                  {rateLabel || '—'}
                </span>
              </div>

              {isOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {status === 'pending' && (
                    <button
                      onClick={() => updateStatus(app.id, 'shortlisted')}
                      disabled={!!loading}
                      className="btn-secondary"
                      style={{ height: 32, fontSize: 13, padding: '0 13px' }}
                    >
                      {loading === `${app.id}-shortlisted` ? '…' : 'Shortlist'}
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(app.id, 'rejected')}
                    disabled={!!loading}
                    className="btn-ghost"
                    style={{ height: 32, fontSize: 13, padding: '0 10px', color: 'var(--ink-faint-solid)' }}
                  >
                    {loading === `${app.id}-rejected` ? '…' : 'Pass'}
                  </button>
                  <button
                    onClick={() => updateStatus(app.id, 'selected')}
                    disabled={!!loading}
                    className="btn-primary"
                    style={{ height: 32, fontSize: 13, padding: '0 13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Shield size={14} />
                    {loading === `${app.id}-selected` ? '…' : `Accept & fund${rateLabel ? ` ${rateLabel}` : ''}`}
                  </button>
                </div>
              )}

              {status === 'selected' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 540, color: 'var(--money-deep)' }}>
                  <Check size={15} /> Selected · collab created
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
